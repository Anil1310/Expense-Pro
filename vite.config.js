import { defineConfig, loadEnv } from "vite";

function appsScriptDevProxy(scriptUrl) {
  return {
    name: "apps-script-dev-proxy",
    configureServer(server) {
      if (!scriptUrl) return;

      const proxyHandler = async (request, response) => {
        if (request.method !== "POST") {
          response.writeHead(405, { Allow: "POST", "Content-Type": "application/json" });
          response.end(JSON.stringify({ success: false, error: "Method not allowed." }));
          return;
        }

        try {
          const chunks = [];
          for await (const chunk of request) chunks.push(chunk);
          const upstream = await fetch(scriptUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: Buffer.concat(chunks),
            redirect: "follow"
          });
          const body = await upstream.text();
          response.writeHead(upstream.ok ? 200 : 502, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
          });
          response.end(body);
        } catch (error) {
          console.error("Apps Script development proxy failed:", error);
          response.writeHead(502, { "Content-Type": "application/json" });
          response.end(JSON.stringify({
            success: false,
            error: "Could not reach the Apps Script backend."
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
