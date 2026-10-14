import { useCallback, useEffect, useMemo, useState } from "react";
import legacyStyles from "../Expense Tracker/Style.html?raw";
import { callAppsScript, monthlyRowToExpense, reportRowToExpense } from "./api.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const NAV_ITEMS = [
  ["dashboard", "Dashboard", "fa-house", "#3b82f6"],
  ["reports", "Reports", "fa-chart-bar", "#ec4899"],
  ["summary", "Summary", "fa-clipboard-list", "#10b981"],
  ["analytics", "Analytics", "fa-chart-line", "#a855f7"],
  ["charts", "Charts", "fa-chart-column", "#06b6d4"],
  ["insights", "Insights", "fa-tags", "#f59e0b"],
  ["items", "Items", "fa-list-check", "#0ea5e9"]
];
const SHEETS = {
  primary: "https://docs.google.com/spreadsheets/d/1WK0QOkrz4c7Fl-wvkLKrH1gPODxkF3stvYajR5lVM0M/edit",
  master: "https://docs.google.com/spreadsheets/d/1lCkNPBkVABweit6dD-3atsP71O0qsBnbuH1rlvzqtV8/edit"
};

const money = (value) => `₹${(Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const currentMonth = MONTHS[new Date().getMonth()];
const currentYear = new Date().getFullYear();
const todayISO = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};
const expenseDate = (value) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
const safeText = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);

function useLegacyStyles() {
  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.expenseLegacyStyles = "true";
    style.textContent = legacyStyles
      .replace(/^\s*<!--[\s\S]*?-->\s*<style[^>]*>/i, "")
      .replace(/<\/style>\s*$/i, "");
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
}

function Pagination({ currentPage, pageCount, onChange }) {
  if (pageCount < 2) return null;
  return <div className="react-pagination"><span>Page {currentPage} of {pageCount}</span><div><button className="react-button" type="button" disabled={currentPage <= 1} onClick={() => onChange(currentPage - 1)}>Previous</button><button className="react-button" type="button" disabled={currentPage >= pageCount} onClick={() => onChange(currentPage + 1)}>Next</button></div></div>;
}

export default function App() {
  useLegacyStyles();
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("currentUser") || "null");
    } catch {
      return null;
    }
  });
  const [page, setPage] = useState("dashboard");
  const [month, setMonth] = useState(currentMonth);
  const [monthlyData, setMonthlyData] = useState(null);
  const [allData, setAllData] = useState([]);
  const [items, setItems] = useState([]);
  const [trash, setTrash] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem("expense_theme") || "light");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);

  useEffect(() => {
    document.body.dataset.theme = theme === "dark" ? "dark" : "";
    localStorage.setItem("expense_theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const loadMonth = useCallback(async (selectedMonth = month) => {
    const data = await callAppsScript("getMonthlyData", selectedMonth);
    setMonthlyData(data);
  }, [month]);

  const loadAllData = useCallback(async () => {
    const data = await callAppsScript("getAllData");
    setAllData(Array.isArray(data?.allExpenses) ? data.allExpenses.map(reportRowToExpense) : []);
  }, []);

  const loadItems = useCallback(async () => {
    const data = await callAppsScript("getItemList");
    setItems(Array.isArray(data) ? data : []);
  }, []);

  const loadPageData = useCallback(async (selectedPage = page, selectedMonth = month) => {
    setBusy(true);
    setError("");
    try {
      if (selectedPage === "dashboard") await Promise.all([loadMonth(selectedMonth), loadItems()]);
      if (["reports", "summary", "analytics", "charts", "insights"].includes(selectedPage)) await loadAllData();
      if (selectedPage === "items") await loadItems();
      return true;
    } catch (loadError) {
      setError(loadError.message || "Could not load data from Google Sheets.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [loadAllData, loadItems, loadMonth, month, page]);

  useEffect(() => {
    if (user) void loadPageData(page, month);
  }, [loadPageData, month, page, user]);

  const notify = (message) => {
    setNotice(message);
    setError("");
  };

  const login = async (username, password) => {
    setBusy(true);
    setError("");
    try {
      const response = await callAppsScript("checkLogin", username.trim(), password);
      if (!response?.success) throw new Error(response?.message || "Invalid username or password.");
      const authenticatedUser = {
        username: response.username,
        name: response.name,
        role: response.role,
        email: response.email || ""
      };
      localStorage.setItem("currentUser", JSON.stringify(authenticatedUser));
      setUser(authenticatedUser);
      setPage("dashboard");
      setMonth(currentMonth);
      notify(`Welcome, ${authenticatedUser.name}.`);
    } catch (loginError) {
      setError(loginError.message || "Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("currentUser");
    setUser(null);
    setMonthlyData(null);
    setAllData([]);
    setPage("dashboard");
  };

  const refresh = async () => {
    if (await loadPageData(page, month)) notify("Data refreshed from Google Sheets.");
  };

  const runAutomation = async () => {
    if (!window.confirm(`Apply the existing spreadsheet automation to ${month}? This updates the S.N and Unique ID columns in that month's sheet.`)) return;
    setBusy(true);
    setError("");
    try {
      await callAppsScript("runCompleteProcess", month);
      await loadMonth(month);
      notify(`${month} automation completed.`);
    } catch (automationError) {
      setError(automationError.message || "Could not run spreadsheet automation.");
    } finally {
      setBusy(false);
    }
  };

  const saveExpense = async (entry) => {
    setBusy(true);
    setError("");
    try {
      const result = await callAppsScript("addEntry", {
        ...entry,
        user: user?.name || user?.username || ""
      });
      if (result?.success === false) throw new Error(result.message || "Could not save this expense.");
      setModal(null);
      await Promise.all([loadMonth(month), loadAllData()]);
      notify(entry.uniqueId ? "Expense updated." : "Expense added.");
    } catch (saveError) {
      setError(saveError.message || "Could not save this expense.");
    } finally {
      setBusy(false);
    }
  };

  const deleteExpense = async (expense) => {
    if (!window.confirm(`Move "${expense.item}" (${money(expense.amount)}) to the recycle bin?`)) return;
    setBusy(true);
    setError("");
    try {
      await callAppsScript("deleteEntry", expense.id, expense.month, user?.name || user?.username || "");
      await Promise.all([loadMonth(month), loadAllData()]);
      notify("Expense moved to the recycle bin.");
    } catch (deleteError) {
      setError(deleteError.message || "Could not delete this expense.");
    } finally {
      setBusy(false);
    }
  };

  const openTrash = async () => {
    setBusy(true);
    setError("");
    try {
      const rows = await callAppsScript("getTrashData");
      setTrash(Array.isArray(rows) ? rows : []);
      setModal({ type: "trash" });
    } catch (trashError) {
      setError(trashError.message || "Could not load the recycle bin.");
    } finally {
      setBusy(false);
    }
  };

  const restoreExpense = async (uniqueId) => {
    setBusy(true);
    setError("");
    try {
      await callAppsScript("restoreEntry", uniqueId);
      setTrash((entries) => entries.filter((entry) => String(entry.uniqueId) !== String(uniqueId)));
      await Promise.all([loadMonth(month), loadAllData()]);
      notify("Expense restored.");
    } catch (restoreError) {
      setError(restoreError.message || "Could not restore this expense.");
    } finally {
      setBusy(false);
    }
  };

  const addItem = async (itemName, category) => {
    setBusy(true);
    setError("");
    try {
      await callAppsScript("addItemToList", itemName.trim(), category.trim());
      await loadItems();
      setModal(null);
      notify("Item added to your Google Sheets list.");
    } catch (itemError) {
      setError(itemError.message || "Could not add the item.");
    } finally {
      setBusy(false);
    }
  };

  const exportRows = (rows, fileName) => {
    const headings = ["Unique ID", "Date", "Month", "Item", "Amount", "Credit & Remark", "Admin"];
    const lines = [headings, ...rows.map((row) => [row.id, row.date, row.month, row.item, row.amount, row.credit, row.admin])]
      .map((line) => line.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","));
    const blob = new Blob(["\uFEFF", lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const emailReport = async () => {
    if (!user?.email) {
      setError("No email address is configured for this account.");
      return;
    }
    const rows = monthlyExpenses;
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    const reportHtml = `<h1>Expenses Pro — ${safeText(month)} ${currentYear}</h1><p>Total: ${money(total)}</p><table><thead><tr><th>Date</th><th>Item</th><th>Amount</th><th>Remark</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${safeText(row.date)}</td><td>${safeText(row.item)}</td><td>${money(row.amount)}</td><td>${safeText(row.credit)}</td></tr>`).join("")}</tbody></table>`;
    setBusy(true);
    setError("");
    try {
      await callAppsScript("generateAndEmailPDF", reportHtml, `Expense_Report_${month}_${currentYear}`, user.email, `Total Expenses: ${money(total)}\nCategories: ${new Set(rows.map((row) => row.item)).size}\nActive Days: ${new Set(rows.map((row) => row.date)).size}`);
      notify("The PDF report has been emailed.");
    } catch (emailError) {
      setError(emailError.message || "Could not send the report.");
    } finally {
      setBusy(false);
    }
  };

  const monthlyExpenses = useMemo(
    () => (monthlyData?.tableData || []).map(monthlyRowToExpense),
    [monthlyData]
  );
  const visibleMonthlyExpenses = useMemo(() => filterExpenses(monthlyExpenses, search), [monthlyExpenses, search]);
  const visibleAllExpenses = useMemo(() => filterExpenses(allData, search), [allData, search]);
  const groupedExpenses = useMemo(() => groupExpenses(allData), [allData]);

  if (!user) {
    return (
      <LoginScreen busy={busy} error={error} onLogin={login} onClearError={() => setError("")} />
    );
  }

  const title = NAV_ITEMS.find(([id]) => id === page)?.[1] || "Dashboard";
  const onNavigate = (nextPage) => {
    setSearch("");
    setError("");
    setPage(nextPage);
  };
  return (
    <div className="app-container">
      <Sidebar user={user} page={page} month={month} onNavigate={onNavigate} onMonthChange={(value) => { setMonth(value); setPage("dashboard"); }} onLogout={logout} />
      <main className="main-content react-app">
        <header className="header react-header">
          <div>
            <h1 className="page-title">{title}</h1>
            <div className="react-subtitle">{user.name} <span className="react-role">{user.role}</span></div>
          </div>
          <div className="header-actions">
            <button className="theme-toggle" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle color theme">
              <i className={`fas ${theme === "dark" ? "fa-sun" : "fa-moon"}`} />
            </button>
            <button className="refresh-btn-header" type="button" onClick={() => void refresh()} aria-label="Refresh data">
              <i className={`fas fa-sync-alt ${busy ? "fa-spin" : ""}`} />
            </button>
            <button className="header-icon-btn" type="button" onClick={() => void openTrash()} title="Recycle bin" aria-label="Recycle bin">
              <i className="fas fa-trash-restore" />
            </button>
            <button className="react-button react-button-primary" type="button" onClick={() => setModal({ type: "expense" })}>
              <i className="fas fa-plus me-2" />Add Expense
            </button>
          </div>
        </header>

        {error && <div className="react-alert react-alert-error" role="alert"><i className="fas fa-circle-exclamation" />{error}<button type="button" onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}
        {notice && <div className="react-alert react-alert-success" role="status"><i className="fas fa-circle-check" />{notice}</div>}

        {page === "dashboard" && (
          <DashboardPage
            month={month}
            monthlyData={monthlyData}
            rows={visibleMonthlyExpenses}
            allRows={monthlyExpenses}
            query={search}
            busy={busy}
            onMonthChange={setMonth}
            onSearch={setSearch}
            onAdd={() => setModal({ type: "expense" })}
            onEdit={(entry) => setModal({ type: "expense", entry })}
            onDelete={(entry) => void deleteExpense(entry)}
            onExport={() => exportRows(monthlyExpenses, `expenses-${month.toLowerCase()}-${currentYear}.csv`)}
            onEmail={() => void emailReport()}
            onSummary={() => onNavigate("summary")}
          />
        )}
        {page === "reports" && (
          <ReportsPage rows={visibleAllExpenses} allRows={allData} query={search} onSearch={setSearch} onExport={() => exportRows(allData, `expenses-all-${currentYear}.csv`)} onEdit={(entry) => setModal({ type: "expense", entry })} onDelete={(entry) => void deleteExpense(entry)} />
        )}
        {page === "summary" && <SummaryPage rows={allData} year={currentYear} />}
        {page === "analytics" && <AnalyticsPage rows={allData} year={currentYear} />}
        {page === "charts" && <ChartsPage rows={allData} year={currentYear} />}
        {page === "insights" && <InsightsPage rows={allData} grouped={groupedExpenses} />}
        {page === "items" && <ItemsPage items={items} onAdd={() => setModal({ type: "item" })} />}
        {page === "automate" && <AutomationPage month={month} busy={busy} onRun={() => void runAutomation()} />}
        {page === "database" && (
          <section className="table-container react-card">
            <h2>Google Sheets database</h2>
            <p>Your current spreadsheets remain the source of truth. The React app sends changes through the existing Apps Script backend.</p>
            <a className="react-button react-button-primary" href={SHEETS.primary} target="_blank" rel="noreferrer">Open expense spreadsheet <i className="fas fa-arrow-up-right-from-square" /></a>
            <a className="react-button" href={SHEETS.master} target="_blank" rel="noreferrer">Open master spreadsheet <i className="fas fa-arrow-up-right-from-square" /></a>
          </section>
        )}

        <div className="react-data-note"><i className="fas fa-cloud" /> Live data is stored in Google Sheets</div>
      </main>
      <nav className="bottom-nav d-md-none" aria-label="Primary">
        {NAV_ITEMS.filter(([id]) => ["dashboard", "reports", "summary", "analytics", "insights"].includes(id)).map(([id, label, icon]) => (
          <button key={id} type="button" className={`bottom-nav-item ${page === id ? "active" : ""}`} onClick={() => onNavigate(id)}>
            <i className={`fas ${icon}`} /><span>{label}</span>
          </button>
        ))}
        <button type="button" className="bottom-nav-item" onClick={logout}><i className="fas fa-right-from-bracket" /><span>Exit</span></button>
      </nav>
      {modal?.type === "expense" && <ExpenseModal entry={modal.entry} items={items} busy={busy} onClose={() => setModal(null)} onSave={saveExpense} />}
      {modal?.type === "item" && <ItemModal busy={busy} onClose={() => setModal(null)} onSave={addItem} />}
      {modal?.type === "trash" && <TrashModal rows={trash} busy={busy} onClose={() => setModal(null)} onRestore={restoreExpense} />}
    </div>
  );
}

function LoginScreen({ busy, error, onLogin, onClearError }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const submit = (event) => {
    event.preventDefault();
    onClearError();
    void onLogin(username, password);
  };

  return (
    <main className="react-login-screen">
      <section className="login-container react-login-card">
        <div className="login-logo-container"><div className="login-logo-inner"><i className="fas fa-wallet" /></div></div>
        <h1 className="login-title">Expenses Tracker Pro</h1>
        <p className="login-subtitle">Secure Access</p>
        <h2 className="login-form-heading">Welcome back</h2>
        <p className="login-form-sub">Sign in to manage your household expenses.</p>
        <form onSubmit={submit}>
          <label className="login-label" htmlFor="react-username">User Profile</label>
          <div className="login-input-wrapper">
            <i className="fas fa-user login-input-icon" />
            <input id="react-username" autoComplete="username" className="login-input" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Enter your username" required />
          </div>
          <label className="login-label react-password-label" htmlFor="react-password">Security PIN</label>
          <div className="login-input-wrapper">
            <i className="fas fa-lock login-input-icon" />
            <input id="react-password" autoComplete="current-password" className="login-input" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your PIN" required />
            <button className="react-password-toggle" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide PIN" : "Show PIN"}><i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`} /></button>
          </div>
          <div className="react-quick-access">
            <span className="login-label">Quick Access</span>
            <div className="quick-login-row">
              <button type="button" className="quick-login-card" onClick={() => { setUsername("Anil Chahar"); setPassword(""); }}>
                <span className="quick-avatar admin"><i className="fas fa-user-shield" /></span><span className="quick-info"><span className="quick-name">Anil Chahar</span><span className="quick-role">Admin</span></span>
              </button>
              <button type="button" className="quick-login-card" onClick={() => { setUsername("Radhika"); setPassword(""); }}>
                <span className="quick-avatar user"><i className="fas fa-user" /></span><span className="quick-info"><span className="quick-name">Radhika Chahar</span><span className="quick-role">User</span></span>
              </button>
            </div>
          </div>
          {error && <p className="react-login-error" role="alert">{error}</p>}
          <button className="login-btn" type="submit" disabled={busy}><i className={`fas ${busy ? "fa-spinner fa-spin" : "fa-right-to-bracket"} me-2`} />{busy ? "Authenticating…" : "Sign In"}</button>
        </form>
      </section>
    </main>
  );
}

function Sidebar({ user, page, month, onNavigate, onMonthChange, onLogout }) {
  const [openMonths, setOpenMonths] = useState(false);
  return (
    <aside className="sidebar">
      <div className="sidebar-header"><h2 className="sidebar-title"><i className="fas fa-wallet" />Expenses Pro</h2></div>
      <div className="user-info">
        <div className="user-avatar"><i className="fas fa-user" /></div>
        <div className="user-details"><div className="user-name">{user.name}</div><div className="user-role"><span className={user.role?.toLowerCase() === "admin" ? "admin-badge" : "user-badge"}>{user.role}</span></div></div>
      </div>
      <nav aria-label="Main menu"><ul className="nav-menu">
        {NAV_ITEMS.map(([id, label, icon, color]) => <li className="nav-item" key={id}><button type="button" className={`nav-link ${page === id ? "active" : ""}`} onClick={() => onNavigate(id)}><i className={`fas ${icon} nav-icon`} style={{ color }} /><span className="nav-text">{label}</span></button></li>)}
        <li className="nav-item"><button type="button" className={`nav-link ${page === "automate" ? "active" : ""}`} onClick={() => onNavigate("automate")}><i className="fas fa-robot nav-icon" style={{ color: "#10b981" }} /><span className="nav-text">Automate</span></button></li>
        <li className="nav-item">
          <button type="button" className="nav-link" onClick={() => setOpenMonths(!openMonths)} aria-expanded={openMonths}><i className="fas fa-calendar-alt nav-icon" style={{ color: "#38bdf8" }} /><span className="nav-text">Months</span><i className={`fas fa-chevron-${openMonths ? "up" : "down"} ms-auto`} /></button>
          {openMonths && <ul className="react-month-list">{MONTHS.map((value) => <li key={value}><button type="button" className={month === value ? "active" : ""} onClick={() => onMonthChange(value)}>{value}</button></li>)}</ul>}
        </li>
        <li className="nav-item"><button type="button" className={`nav-link ${page === "database" ? "active" : ""}`} onClick={() => onNavigate("database")}><i className="fas fa-database nav-icon" style={{ color: "#6366f1" }} /><span className="nav-text">Database</span></button></li>
      </ul></nav>
      <button className="logout-btn" type="button" onClick={onLogout}><i className="fas fa-sign-out-alt" /><span>Logout</span></button>
    </aside>
  );
}

function DashboardPage({ month, monthlyData, rows, allRows, query, busy, onMonthChange, onSearch, onAdd, onEdit, onDelete, onExport, onEmail, onSummary }) {
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => setCurrentPage(1), [month, query]);
  const pageCount = Math.max(1, Math.ceil(rows.length / 30));
  useEffect(() => {
    if (currentPage > pageCount) setCurrentPage(pageCount);
  }, [currentPage, pageCount]);
  const pageRows = rows.slice((currentPage - 1) * 30, currentPage * 30);
  const total = Number(monthlyData?.totalExpenses) || allRows.reduce((sum, row) => sum + row.amount, 0);
  return (
    <section className="page-content">
      <div className="react-month-buttons">{MONTHS.map((value) => <button className={`month-btn ${month === value ? "active" : ""}`} key={value} onClick={() => { onMonthChange(value); onSearch(""); }}>{value}</button>)}</div>
      <div className="stats-cards">
        <button className="stat-card react-stat-action" type="button" onClick={onSummary}><h6>Total Expenses</h6><p>{money(total)}</p><span className="react-stat-caption">View Summary</span></button>
        <div className="stat-card"><h6>Unique Categories</h6><p>{monthlyData?.uniqueCategories ?? new Set(allRows.map((row) => row.item)).size}</p></div>
        <div className="stat-card"><h6>Days with Expenses</h6><p>{monthlyData?.daysWithExpenses ?? new Set(allRows.map((row) => row.date)).size}</p></div>
      </div>
      <section className="table-container">
        <div className="react-table-heading">
          <div><h2 className="table-title">{new Date(currentYear, MONTHS.indexOf(month), 1).toLocaleString("en", { month: "long" })} Expenses</h2><span className="react-table-count">{rows.length} records</span></div>
          <input className="react-search" value={query} onChange={(event) => onSearch(event.target.value)} placeholder="Search this month…" aria-label="Search expenses" />
          <div className="react-actions">
            <button type="button" className="react-icon-action" onClick={onExport} title="Export CSV" aria-label="Export CSV"><i className="fas fa-file-csv" /></button>
            <button type="button" className="react-icon-action" onClick={onEmail} title="Email PDF report" aria-label="Email PDF report"><i className="fas fa-envelope" /></button>
            <button type="button" className="react-button react-button-primary" onClick={onAdd}><i className="fas fa-plus" /> Add</button>
          </div>
        </div>
        <ExpenseTable rows={pageRows} onEdit={onEdit} onDelete={onDelete} busy={busy} />
        <Pagination currentPage={currentPage} pageCount={pageCount} onChange={setCurrentPage} />
      </section>
    </section>
  );
}

function ReportsPage({ rows, allRows, query, onSearch, onExport, onEdit, onDelete }) {
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => setCurrentPage(1), [query]);
  const pageCount = Math.max(1, Math.ceil(rows.length / 30));
  useEffect(() => {
    if (currentPage > pageCount) setCurrentPage(pageCount);
  }, [currentPage, pageCount]);
  const pageRows = rows.slice((currentPage - 1) * 30, currentPage * 30);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const grandTotal = allRows.reduce((sum, row) => sum + row.amount, 0);
  return (
    <section className="page-content">
      <div className="stats-cards react-report-stats">
        <div className="stat-card"><h6>Filtered Total</h6><p>{money(total)}</p></div><div className="stat-card"><h6>Grand Total</h6><p>{money(grandTotal)}</p></div><div className="stat-card"><h6>Records Found</h6><p>{rows.length}</p></div>
      </div>
      <section className="table-container">
        <div className="react-table-heading"><div><h2 className="table-title">All expenses</h2><span className="react-table-count">Across all months and years</span></div><input className="react-search" value={query} onChange={(event) => onSearch(event.target.value)} placeholder="Search all records…" aria-label="Search all expenses" /><button className="react-button" type="button" onClick={onExport}><i className="fas fa-download" /> Export CSV</button></div>
        <ExpenseTable rows={pageRows} onEdit={onEdit} onDelete={onDelete} />
        <Pagination currentPage={currentPage} pageCount={pageCount} onChange={setCurrentPage} />
      </section>
    </section>
  );
}

function ExpenseTable({ rows, onEdit, onDelete, busy = false }) {
  return (
    <div className="table-responsive">
      <table className="table react-expense-table">
        <thead><tr><th>Date</th><th>Item</th><th>Amount</th><th>Remark</th><th>Admin</th><th>Actions</th></tr></thead>
        <tbody>
          {rows.map((row, index) => <tr key={`${row.month}-${row.id}-${index}`}><td>{expenseDate(row.date)}</td><td className="react-item-cell">{row.item}</td><td><strong className="text-primary">{money(row.amount)}</strong></td><td>{row.credit || "—"}</td><td>{row.admin || "—"}</td><td className="react-row-actions"><button type="button" onClick={() => onEdit(row)} title="Edit expense" aria-label={`Edit ${row.item}`} disabled={busy}><i className="fas fa-pen" /></button><button type="button" onClick={() => onDelete(row)} title="Delete expense" aria-label={`Delete ${row.item}`} disabled={busy}><i className="fas fa-trash" /></button></td></tr>)}
          {rows.length === 0 && <tr><td colSpan="6" className="react-empty"><i className="fas fa-inbox" /><span>No expenses found.</span></td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function SummaryPage({ rows, year }) {
  const yearRows = rows.filter((row) => row.year === String(year));
  const monthly = MONTHS.map((month) => ({ name: month, amount: yearRows.filter((row) => row.month === month).reduce((sum, row) => sum + row.amount, 0) }));
  return (
    <section className="page-content">
      <div className="stats-cards"><div className="stat-card"><h6>{year} Spending</h6><p>{money(yearRows.reduce((sum, row) => sum + row.amount, 0))}</p></div><div className="stat-card"><h6>Transactions</h6><p>{yearRows.length}</p></div><div className="stat-card"><h6>Categories</h6><p>{groupByCategory(yearRows).length}</p></div></div>
      <section className="table-container react-chart-card"><h2 className="table-title">Monthly spending · {year}</h2><BarChart rows={monthly} /></section>
      <section className="table-container"><h2 className="table-title">Category summary · {year}</h2><CategoryTable rows={groupByCategory(yearRows)} /></section>
    </section>
  );
}

function AnalyticsPage({ rows, year }) {
  const categories = groupByCategory(rows.filter((row) => row.year === String(year))).slice(0, 10);
  const months = MONTHS.map((month) => ({ name: month, amount: rows.filter((row) => row.month === month && row.year === String(year)).reduce((sum, row) => sum + row.amount, 0) }));
  return <section className="page-content"><div className="stats-cards"><div className="stat-card"><h6>Year</h6><p>{year}</p></div><div className="stat-card"><h6>Transactions</h6><p>{rows.filter((row) => row.year === String(year)).length}</p></div><div className="stat-card"><h6>Average / Month</h6><p>{money(months.reduce((sum, item) => sum + item.amount, 0) / 12)}</p></div></div><section className="table-container react-chart-card"><h2 className="table-title">Spending trend</h2><BarChart rows={months} /></section><section className="table-container"><h2 className="table-title">Top categories</h2><CategoryTable rows={categories} /></section></section>;
}

function ChartsPage({ rows, year }) {
  const yearRows = rows.filter((row) => row.year === String(year));
  const monthly = MONTHS.map((month) => ({
    name: month,
    amount: yearRows.filter((row) => row.month === month).reduce((sum, row) => sum + row.amount, 0)
  }));
  return <section className="page-content"><div className="stats-cards"><div className="stat-card"><h6>Chart year</h6><p>{year}</p></div><div className="stat-card"><h6>Year total</h6><p>{money(yearRows.reduce((sum, row) => sum + row.amount, 0))}</p></div><div className="stat-card"><h6>Monthly average</h6><p>{money(monthly.reduce((sum, row) => sum + row.amount, 0) / 12)}</p></div></div><section className="table-container react-chart-card"><h2 className="table-title">Yearly expenses</h2><BarChart rows={monthly} /></section></section>;
}

function AutomationPage({ month, busy, onRun }) {
  return <section className="page-content"><section className="table-container react-card react-automation-card"><div className="react-automation-icon"><i className="fas fa-robot" /></div><h2>Spreadsheet automation</h2><p>Run the existing Apps Script operation for <strong>{month}</strong>. It rebuilds the serial-number and unique-ID columns on that month's sheet and converts the calculated values to static values.</p><button className="react-button react-button-primary" type="button" disabled={busy} onClick={onRun}><i className={`fas ${busy ? "fa-spinner fa-spin" : "fa-play"}`} />{busy ? "Working…" : `Run for ${month}`}</button></section></section>;
}

function InsightsPage({ rows, grouped }) {
  const top = grouped.slice(0, 6);
  const largest = [...rows].sort((a, b) => b.amount - a.amount).slice(0, 5);
  return <section className="page-content"><div className="stats-cards"><div className="stat-card"><h6>Largest Expense</h6><p>{money(largest[0]?.amount)}</p></div><div className="stat-card"><h6>Average Transaction</h6><p>{money(rows.length ? rows.reduce((sum, row) => sum + row.amount, 0) / rows.length : 0)}</p></div><div className="stat-card"><h6>Active Months</h6><p>{new Set(rows.map((row) => `${row.year}-${row.month}`)).size}</p></div></div><section className="table-container"><h2 className="table-title">Spending by category</h2><CategoryTable rows={top} /></section><section className="table-container"><h2 className="table-title">Largest transactions</h2><ExpenseTable rows={largest} onEdit={() => {}} onDelete={() => {}} /></section></section>;
}

function ItemsPage({ items, onAdd }) {
  return <section className="page-content"><section className="table-container"><div className="react-table-heading"><div><h2 className="table-title">Expense items</h2><span className="react-table-count">From your Google Sheets item list</span></div><button className="react-button react-button-primary" type="button" onClick={onAdd}><i className="fas fa-plus" /> Add Item</button></div><div className="react-item-grid">{items.map((item) => <div className="react-item-pill" key={item}><i className="fas fa-tag" />{item}</div>)}{items.length === 0 && <p className="react-empty">No items found.</p>}</div></section></section>;
}

function BarChart({ rows }) {
  const max = Math.max(...rows.map((row) => row.amount), 1);
  return <div className="react-bars" role="img" aria-label="Bar chart of spending by month">{rows.map((row) => <div className="react-bar-column" key={row.name}><span className="react-bar-value">{row.amount ? money(row.amount) : "—"}</span><div className="react-bar-track"><div className="react-bar" style={{ height: `${Math.max((row.amount / max) * 100, row.amount ? 3 : 0)}%` }} /></div><span className="react-bar-label">{row.name}</span></div>)}</div>;
}

function CategoryTable({ rows }) {
  return <div className="table-responsive"><table className="table react-expense-table"><thead><tr><th>Category</th><th>Transactions</th><th>Total spent</th><th>Share</th></tr></thead><tbody>{rows.map((row) => <tr key={row.name}><td>{row.name}</td><td>{row.count}</td><td><strong className="text-primary">{money(row.amount)}</strong></td><td>{row.share}%</td></tr>)}{rows.length === 0 && <tr><td colSpan="4" className="react-empty">No category data yet.</td></tr>}</tbody></table></div>;
}

function ExpenseModal({ entry, items, busy, onClose, onSave }) {
  const [itemList, setItemList] = useState(entry?.item || "");
  const [date, setDate] = useState(toInputDate(entry?.date) || todayISO());
  const [amount, setAmount] = useState(entry ? String(entry.amount) : "");
  const [credit, setCredit] = useState(entry?.credit || "");
  const submit = (event) => {
    event.preventDefault();
    const targetDate = new Date(`${date}T12:00:00`);
    const targetMonth = MONTHS[targetDate.getMonth()];
    void onSave({
      uniqueId: entry?.id,
      month: entry?.month || targetMonth,
      date,
      itemList: itemList.trim(),
      amount,
      credit
    });
  };
  return <Modal title={entry ? "Edit expense" : "Add expense"} onClose={onClose}><form className="react-form" onSubmit={submit}><label>Item<select required value={itemList} onChange={(event) => setItemList(event.target.value)}><option value="">Choose an item</option>{items.map((item) => <option key={item} value={item}>{item}</option>)}{itemList && !items.includes(itemList) && <option value={itemList}>{itemList}</option>}</select></label><label>Date<input type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Amount (₹)<input type="number" min="0.01" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Credit &amp; Remark<input value={credit} onChange={(event) => setCredit(event.target.value)} placeholder="Optional note" /></label><div className="react-modal-actions"><button className="react-button" type="button" onClick={onClose}>Cancel</button><button className="react-button react-button-primary" type="submit" disabled={busy}>{busy ? "Saving…" : entry ? "Save changes" : "Add expense"}</button></div></form></Modal>;
}

function ItemModal({ busy, onClose, onSave }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  return <Modal title="Add expense item" onClose={onClose}><form className="react-form" onSubmit={(event) => { event.preventDefault(); void onSave(name, category); }}><label>Item name<input value={name} onChange={(event) => setName(event.target.value)} required autoFocus /></label><label>Category<input value={category} onChange={(event) => setCategory(event.target.value)} required /></label><div className="react-modal-actions"><button className="react-button" type="button" onClick={onClose}>Cancel</button><button className="react-button react-button-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Add item"}</button></div></form></Modal>;
}

function TrashModal({ rows, busy, onClose, onRestore }) {
  return <Modal title="Recycle bin" onClose={onClose} wide><div className="table-responsive"><table className="table react-expense-table"><thead><tr><th>Deleted item</th><th>Amount</th><th>Deleted by</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row.uniqueId}><td>{row.item}<small className="react-deleted-date">{row.deletedAt}</small></td><td>{money(row.amount)}</td><td>{row.deletedBy || "—"}</td><td><button type="button" className="react-button" disabled={busy} onClick={() => void onRestore(row.uniqueId)}><i className="fas fa-rotate-left" /> Restore</button></td></tr>)}{rows.length === 0 && <tr><td colSpan="4" className="react-empty">Recycle bin is empty.</td></tr>}</tbody></table></div></Modal>;
}

function Modal({ title, onClose, wide = false, children }) {
  return <div className="react-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={`react-modal ${wide ? "react-modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="react-modal-title"><header><h2 id="react-modal-title">{title}</h2><button type="button" onClick={onClose} aria-label="Close dialog">×</button></header>{children}</section></div>;
}

function filterExpenses(rows, query) {
  const searchText = query.trim().toLowerCase();
  if (!searchText) return rows;
  return rows.filter((row) => [row.id, row.date, row.month, row.item, row.amount, row.credit, row.admin, row.year].join(" ").toLowerCase().includes(searchText));
}

function groupByCategory(rows) {
  const groups = new Map();
  for (const row of rows) {
    const group = groups.get(row.item) || { name: row.item || "Other", count: 0, amount: 0 };
    group.count += 1;
    group.amount += row.amount;
    groups.set(group.name, group);
  }
  const total = [...groups.values()].reduce((sum, group) => sum + group.amount, 0);
  return [...groups.values()]
    .map((group) => ({ ...group, share: total ? ((group.amount / total) * 100).toFixed(1) : "0.0" }))
    .sort((a, b) => b.amount - a.amount);
}

function groupExpenses(rows) {
  return groupByCategory(rows);
}

function toInputDate(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}
