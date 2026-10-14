import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(projectRoot, "dist");

const [indexTemplate, styles, clientScript] = await Promise.all([
  readFile(path.join(projectRoot, "Expense Tracker/Index.html"), "utf8"),
  readFile(path.join(projectRoot, "Expense Tracker/Style.html"), "utf8"),
  readFile(path.join(projectRoot, "Expense Tracker/Script.html"), "utf8")
]);

const bridgeScript = `(() => {
  function createRunner(successHandler, failureHandler, userObject) {
    const runner = function () {};
    runner.withSuccessHandler = (handler) => createRunner(handler, failureHandler, userObject);
    runner.withFailureHandler = (handler) => createRunner(successHandler, handler, userObject);
    runner.withUserObject = (obj) => createRunner(successHandler, failureHandler, obj);

    return new Proxy(runner, {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (typeof prop !== "string" || prop.startsWith("_")) return undefined;

        return (...args) => {
          const payload = { method: prop, args };
          const endpoints = ["/api/apps-script", "/.netlify/functions/apps-script"];

          async function sendRequest(urlIdx = 0) {
            try {
              const res = await fetch(endpoints[urlIdx], {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
              });

              if (!res.ok && urlIdx + 1 < endpoints.length) {
                return sendRequest(urlIdx + 1);
              }

              const rawText = await res.text();
              let data;
              try {
                data = rawText && rawText.trim() ? JSON.parse(rawText) : {};
              } catch (parseErr) {
                if (urlIdx + 1 < endpoints.length) {
                  return sendRequest(urlIdx + 1);
                }
                throw new Error("Invalid response from server: " + (rawText ? rawText.slice(0, 100) : "empty response"));
              }

              if (!res.ok || (data && data.success === false)) {
                throw new Error(data?.error || ("Apps Script request failed: " + res.status));
              }

              const result = data && "result" in data ? data.result : data;
              if (successHandler) {
                if (userObject !== undefined) successHandler(result, userObject);
                else successHandler(result);
              }
              return result;
            } catch (err) {
              if (urlIdx + 1 < endpoints.length) {
                return sendRequest(urlIdx + 1);
              }
              console.error("Apps Script Error (" + prop + "):", err);
              if (failureHandler) {
                if (userObject !== undefined) failureHandler(err, userObject);
                else failureHandler(err);
              }
            }
          }

          return sendRequest(0);
        };
      }
    });
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = createRunner(null, null, undefined);
})();
`;

let html = indexTemplate;

// 1. Inject Styles
html = html.replace(/<\?!=include\('Expense Tracker\/Style'\); \?>/i, styles);

// 2. Initial Data fallback
html = html.replace(/window\.SERVER_INITIAL_DATA = <\?!= initialData \?>;/i, "window.SERVER_INITIAL_DATA = null;");

// 3. Inject Client Script
html = html.replace(/<\?!=include\('Expense Tracker\/Script'\); \?>/i, clientScript);

// 4. Inject Google Script Run Bridge in Head
html = html.replace(
  "<head>",
  `<head>\n  <script id="apps-script-bridge">\n${bridgeScript}\n  </script>`
);

await mkdir(outputDir, { recursive: true });

await Promise.all([
  writeFile(path.join(projectRoot, "index.html"), html),
  writeFile(path.join(outputDir, "index.html"), html),
  writeFile(path.join(outputDir, "apps-script-bridge.js"), bridgeScript)
]);

console.log("✅ Assembled web app successfully from Expense Tracker pulled code.");
