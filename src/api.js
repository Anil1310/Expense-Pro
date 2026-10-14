const API_URL = "/.netlify/functions/apps-script";

export async function callAppsScript(method, ...args) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, args })
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("The Apps Script backend returned an invalid response.");
  }

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || `Apps Script request failed (${response.status}).`);
  }

  if (payload.result && typeof payload.result === "object" && payload.result.error) {
    throw new Error(payload.result.error);
  }

  return payload.result;
}

export function monthlyRowToExpense(row) {
  return {
    sn: row[0],
    id: String(row[1] || ""),
    date: String(row[2] || ""),
    month: String(row[3] || ""),
    item: String(row[4] || ""),
    amount: Number(row[5]) || 0,
    credit: String(row[6] || ""),
    admin: String(row[7] || "")
  };
}

export function reportRowToExpense(row) {
  return {
    date: String(row[0] || ""),
    month: String(row[1] || ""),
    item: String(row[2] || ""),
    amount: Number(row[3]) || 0,
    credit: String(row[4] || ""),
    year: String(row[5] || ""),
    admin: String(row[6] || ""),
    id: String(row[7] || "")
  };
}
