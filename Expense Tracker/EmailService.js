/**
 * Automated Monthly Report Trigger
 * This can be set to run daily or monthly in Google Apps Script Triggers.
 */
function sendMonthlyReportAuto() {
  const now = new Date();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentMonth = months[now.getMonth()];
  const currentYear = now.getFullYear();

  const data = getMonthlyData(currentMonth);
  if (!data || data.tableData.length === 0) return "No data to send";

  const userName = "Automated System";
  const targetEmail = "anil.chahar170@gmail.com";
  const fileName = `Auto_Report_${currentMonth}_${currentYear}`;

  const summary = `📅 Month: ${currentMonth} ${currentYear}\n` +
    `💸 Total Expenses: ₹${data.totalExpenses}\n` +
    `📂 Categories: ${data.uniqueCategories}\n` +
    `📆 Active Days: ${data.daysWithExpenses}\n` +
    `👤 Status: Automatic Backup`;

  // Build the HTML for PDF (Backend version matching the visual statement preview)
  const html = buildBackendReportHTML(data, currentMonth, currentYear, userName);

  return generateAndEmailPDF(html, fileName, targetEmail, summary);
}

/**
 * Builds the PDF HTML on the server side (for automation) matching the preview layout
 */
function buildBackendReportHTML(data, month, year, userName) {
  const generatedAt = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  let tableRows = "";
  const itemSums = {};
  let grandTotal = 0;

  data.tableData.forEach((row, idx) => {
    const sn = row[0] || (idx + 1);
    const id = row[1] || '';
    const date = row[2] || '';
    const category = row[4] || 'General';
    const amountRaw = row[5] || 0;
    const remark = row[6] || '';

    const amtNum = Math.round(parseFloat(String(amountRaw).replace(/[^\d.-]/g, '')) || 0);
    grandTotal += amtNum;
    itemSums[category] = (itemSums[category] || 0) + amtNum;

    const rowBg = idx % 2 === 0 ? 'background:#ffffff;' : 'background:#f8fafc;';

    tableRows += `
    <tr style="${rowBg}">
      <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;color:#64748b;text-align:center;">${sn}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;color:#3b82f6;font-weight:600;">${id}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;white-space:nowrap;">${date}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-weight:600;">${category}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-weight:700;color:#0f172a;">₹${amtNum.toLocaleString('en-IN')}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;color:#64748b;">${remark}</td>
    </tr>`;
  });

  const sortedCategories = Object.keys(itemSums).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  let summaryRows = "";
  sortedCategories.forEach(cat => {
    const amt = itemSums[cat];
    summaryRows += `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:0.8rem;font-weight:500;">${cat}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:0.8rem;text-align:right;font-weight:700;color:#0f172a;">${amt.toLocaleString('en-IN')}</td>
      </tr>`;
  });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Expense Statement – ${month} ${year}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #1e293b; font-size: 11px; margin: 0; padding: 20px; }
  .page { max-width: 1100px; margin: 0 auto; background: #ffffff; border-radius: 14px; padding: 28px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
  .report-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 3px solid #0f172a; margin-bottom: 25px; }
  .brand { font-size: 1.6rem; font-weight: 800; color: #0f172a; }
  .brand span { color: #3b82f6; }
  .stats-strip { display: flex; gap: 16px; margin-bottom: 25px; }
  .stat-box { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; text-align: center; }
  .stat-label { font-size: 0.7rem; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 6px; }
  .stat-value { font-size: 1.4rem; font-weight: 800; color: #0f172a; }
  .report-body { display: flex; gap: 20px; align-items: flex-start; margin-bottom: 20px; }
  .details-col { flex: 68; }
  .summary-col { flex: 32; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: #0f172a; color: #ffffff; padding: 10px; text-align: left; font-size: 0.75rem; font-weight: 700; }
  .summary-table thead th { background: #7b9e3a !important; color: #ffffff; }
  .footer { margin-top: 25px; padding-top: 15px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; font-size: 0.75rem; color: #94a3b8; }
</style>
</head>
<body>
<div class="page">
  <div class="report-header">
    <div>
      <div class="brand">💰 EXPENSE<span>PRO</span></div>
      <div style="font-size:0.8rem;color:#64748b;margin-top:4px;">Premium Financial Statement</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:1.2rem;font-weight:800;color:#0f172a;">Monthly Expense Statement</div>
      <div style="font-size:0.85rem;color:#64748b;">${month} ${year} • By ${userName}</div>
      <div style="font-size:0.8rem;color:#64748b;font-weight:600;margin-top:4px;">Generated: ${generatedAt}</div>
    </div>
  </div>
  <div class="stats-strip">
    <div class="stat-box"><div class="stat-label">Total Volume</div><div class="stat-value">₹${Math.round(grandTotal).toLocaleString('en-IN')}</div></div>
    <div class="stat-box"><div class="stat-label">Categories</div><div class="stat-value">${data.uniqueCategories}</div></div>
    <div class="stat-box"><div class="stat-label">Active Days</div><div class="stat-value">${data.daysWithExpenses}</div></div>
  </div>
  <div class="report-body">
    <div class="details-col">
      <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <table>
          <thead><tr><th>S.N.</th><th>Unique ID</th><th>Date</th><th>Category</th><th>Amount</th><th>Remark</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </div>
    <div class="summary-col">
      <div style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
        <table class="summary-table">
          <thead>
            <tr><th style="padding:8px 10px;">Item List</th><th style="padding:8px 10px;text-align:right;">Sum of Amount</th></tr>
          </thead>
          <tbody>
            ${summaryRows}
            <tr style="background:#f1f5f9;font-weight:800;border-top:2px solid #7b9e3a;">
              <td style="padding:8px 10px;font-size:0.8rem;color:#0f172a;">Grand Total</td>
              <td style="padding:8px 10px;font-size:0.85rem;text-align:right;color:#0f172a;">${Math.round(grandTotal).toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <div class="footer">
    <div>Records: <strong>${data.tableData.length}</strong></div>
    <div>Report ID: EXP-AUTO-${year}${month}</div>
  </div>
</div>
</body>
</html>`;
}

/**
 * Generates a PDF from HTML and sends it via email.
 */
function generateAndEmailPDF(htmlContent, fileName, recipientEmail, summary) {
  const finalRecipient = recipientEmail || "anil.chahar170@gmail.com";

  try {
    const fullHtml = (htmlContent && htmlContent.includes('<html'))
      ? htmlContent
      : `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif;">${htmlContent}</body></html>`;

    const tempFile = DriveApp.createFile('temp_' + new Date().getTime() + '.html', fullHtml, 'text/html');
    const pdfBlob = tempFile.getAs('application/pdf').setName(fileName + '.pdf');
    tempFile.setTrashed(true);

    // Create a professional HTML Body for the email
    const htmlBody = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #0f172a; padding: 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: -1px; display: block;">💰 EXPENSE<span style="color:#3b82f6;">PRO</span></h1>
        <p style="color: #94a3b8; margin: 5px 0 0; font-size: 14px;">Premium Financial Statement</p>
      </div>
      
      <div style="padding: 30px; color: #1e293b;">
        <h2 style="margin-top: 0; color: #0f172a; font-size: 20px;">Monthly Statement Attached</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #475569;">Hello Anil,</p>
        <p style="font-size: 15px; line-height: 1.6; color: #475569;">Your monthly expense statement for <strong>${fileName.replace('Expense_Report_', '').replace('Auto_Report_', '').replace(/_/g, ' ')}</strong> has been generated with complete itemized breakdown and category summaries. Please find your official statement PDF attached.</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 25px 0;">
          <h3 style="margin-top: 0; font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Statement Summary</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Total Volume:</td>
              <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 800; font-size: 16px;">${summary.match(/Total Expenses: (.*)/) ? summary.match(/Total Expenses: (.*)/)[1] : (summary.match(/Total: (.*)/) ? summary.match(/Total: (.*)/)[1] : 'N/A')}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Active Categories:</td>
              <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 600;">${summary.match(/Categories: (.*)/) ? summary.match(/Categories: (.*)/)[1] : 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Active Days:</td>
              <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 600;">${summary.match(/Active Days: (.*)/) ? summary.match(/Active Days: (.*)/)[1] : 'N/A'}</td>
            </tr>
          </table>
        </div>
        
        <p style="font-size: 13px; color: #94a3b8; font-style: italic;">Note: This is an automated email from Expense Pro.</p>
      </div>
      
      <div style="background-color: #f1f5f9; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 600;">Expense Pro - 2026</p>
        <p style="margin: 5px 0 0; font-size: 11px; color: #94a3b8;">High-Precision Finance Tracking</p>
      </div>
    </div>`;

    const options = {
      htmlBody: htmlBody,
      attachments: [pdfBlob],
      name: "Expense Pro"
    };

    GmailApp.sendEmail(finalRecipient, "Expense Statement: " + fileName, "", options);

    return { success: true };
  } catch (e) {
    console.error("Critical PDF/Email Error:", e.message);
    return { error: e.message };
  }
}

/**
 * Run this function manually in the Apps Script Editor (script.google.com)
 * to trigger the Google OAuth Authorization dialog for Gmail.
 */
function triggerGmailPermissionCheck() {
  GmailApp.sendEmail("anil.chahar170@gmail.com", "Expenses Pro Scope Authorization", "Gmail permissions authorized successfully!");
}
