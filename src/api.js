async function sendApiRequest(endpoint, payload) {
  return fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function callAppsScript(method, ...args) {
  const payloadData = { method, args };
  
  // Try Vercel / Universal endpoint first, then fallback to Netlify
  let response;
  try {
    response = await sendApiRequest("/api/apps-script", payloadData);
    if (response.status === 404) {
      response = await sendApiRequest("/.netlify/functions/apps-script", payloadData);
    }
  } catch (err) {
    // If first request failed network-wise, attempt fallback
    try {
      response = await sendApiRequest("/.netlify/functions/apps-script", payloadData);
    } catch {
      throw new Error("Unable to connect to the backend server. Check your network connection.");
    }
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(
      "The Apps Script backend returned an invalid response. Ensure your Google Apps Script Web App is deployed with 'Execute as: Me' and 'Who has access: Anyone'."
    );
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
