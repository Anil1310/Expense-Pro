export default async (request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed." }), {
      status: 405,
      headers: { "Content-Type": "application/json", Allow: "POST" }
    });
  }

  const scriptUrl = process.env.APPS_SCRIPT_WEB_APP_URL;
  if (!scriptUrl) {
    return new Response(JSON.stringify({
      success: false,
      error: "The APPS_SCRIPT_WEB_APP_URL environment variable is not configured."
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: "Request body must be valid JSON." }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const upstream = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "follow"
    });
    const body = await upstream.text();

    if (!upstream.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: `Apps Script returned HTTP ${upstream.status}.`
      }), {
        status: 502,
        headers: { "Content-Type": "application/json" }
      });
    }

    try {
      JSON.parse(body);
    } catch {
      return new Response(JSON.stringify({
        success: false,
        error: "Apps Script returned a non-JSON response. Verify the web app deployment URL and access settings."
      }), {
        status: 502,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(body, {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Apps Script proxy failed:", error);
    return new Response(JSON.stringify({
      success: false,
      error: "Could not reach the Apps Script backend."
    }), {
      status: 502,
      headers: { "Content-Type": "application/json" }
    });
  }
};
