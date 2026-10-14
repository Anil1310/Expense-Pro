export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }

  const scriptUrl = process.env.APPS_SCRIPT_WEB_APP_URL || process.env.VITE_APPS_SCRIPT_WEB_APP_URL;
  if (!scriptUrl) {
    return res.status(500).json({
      success: false,
      error: "The APPS_SCRIPT_WEB_APP_URL environment variable is not configured on Vercel."
    });
  }

  let payload = req.body;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return res.status(400).json({ success: false, error: "Request body must be valid JSON." });
    }
  }

  try {
    const upstream = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "follow"
    });

    const bodyText = await upstream.text();

    if (!upstream.ok) {
      return res.status(502).json({
        success: false,
        error: `Apps Script returned HTTP ${upstream.status}.`
      });
    }

    try {
      const data = JSON.parse(bodyText);
      return res.status(200).json(data);
    } catch {
      return res.status(502).json({
        success: false,
        error: "Apps Script returned a non-JSON response. Ensure your Google Apps Script is deployed as a Web App with 'Execute as: Me' and 'Who has access: Anyone'."
      });
    }
  } catch (error) {
    console.error("Vercel Apps Script proxy failed:", error);
    return res.status(502).json({
      success: false,
      error: "Could not reach the Apps Script backend: " + error.message
    });
  }
}
