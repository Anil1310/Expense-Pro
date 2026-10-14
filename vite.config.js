import { defineConfig, loadEnv } from "vite";

function appsScriptDevProxy(scriptUrl) {
  return {
    name: "apps-script-dev-proxy",
    configureServer(server) {
      if (!scriptUrl) return;

      const proxyHandler = async (request, response) => {
        // Handle CORS preflight
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (request.method === "OPTIONS") {
          response.writeHead(200);
          response.end();
          return;
        }

        if (request.method !== "POST") {
          response.writeHead(405, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ success: false, error: "Method not allowed." }));
          return;
        }

        try {
          const chunks = [];
          await new Promise((resolve, reject) => {
            request.on("data", (chunk) => chunks.push(chunk));
            request.on("end", resolve);
            request.on("error", reject);
          });

          const bodyBuffer = Buffer.concat(chunks);
          const upstream = await fetch(scriptUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: bodyBuffer,
            redirect: "follow"
          });

          const rawText = await upstream.text();
          if (!rawText || rawText.trim() === "") {
            response.writeHead(502, { "Content-Type": "application/json" });
            response.end(JSON.stringify({
              success: false,
              error: "Received empty response from Apps Script."
            }));
            return;
          }

          response.writeHead(upstream.ok ? 200 : 502, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
          });
          response.end(rawText);
        } catch (error) {
          console.error("Apps Script development proxy failed:", error);
          response.writeHead(502, { "Content-Type": "application/json" });
          response.end(JSON.stringify({
            success: false,
            error: "Could not reach the Apps Script backend: " + (error?.message || "network error")
          }));
        }
      };

      server.middlewares.use("/api/apps-script", proxyHandler);
      server.middlewares.use("/.netlify/functions/apps-script", proxyHandler);
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const scriptUrl = env.APPS_SCRIPT_WEB_APP_URL || env.VITE_APPS_SCRIPT_WEB_APP_URL;

  return {
    plugins: [appsScriptDevProxy(scriptUrl)],
    server: {
      port: 5173
    }
  };
});
