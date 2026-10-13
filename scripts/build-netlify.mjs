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

const replacements = [
  [/<\?!=include\('Expense Tracker\/Style'\); \?>/, styles],
  [/window\.SERVER_INITIAL_DATA = <\?!= initialData \?>;/, "window.SERVER_INITIAL_DATA = null;"],
  [/<\?!=include\('Expense Tracker\/Script'\); \?>/, clientScript]
];

let html = indexTemplate;
for (const [pattern, replacement] of replacements) {
  if (!pattern.test(html)) {
    throw new Error(`Expected Apps Script template expression was not found: ${pattern}`);
  }
  html = html.replace(pattern, replacement);
}

html = html.replace(
  "<head>",
  '<head>\n  <script src="/apps-script-bridge.js"></script>'
);

const bridge = `(() => {
  function createRunner(successHandler, failureHandler) {
    return new Proxy(function () {}, {
      get(_target, property) {
        if (property === "withSuccessHandler") {
          return (handler) => createRunner(handler, failureHandler);
        }
        if (property === "withFailureHandler") {
          return (handler) => createRunner(successHandler, handler);
        }
        if (property === "withUserObject") {
          return () => createRunner(successHandler, failureHandler);
        }
        if (typeof property !== "string" || property.startsWith("_")) {
          return undefined;
        }

        return (...args) => {
          fetch("/.netlify/functions/apps-script", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ method: property, args })
          })
            .then(async (response) => {
              const payload = await response.json();
              if (!response.ok || !payload.success) {
                throw new Error(payload.error || "Apps Script request failed.");
              }
              if (successHandler) successHandler(payload.result);
            })
            .catch((error) => {
              if (failureHandler) failureHandler(error.message);
              else console.error("Apps Script request failed:", error);
            });
        };
      }
    });
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = createRunner(null, null);
})();
`;

await mkdir(outputDir, { recursive: true });
await Promise.all([
  writeFile(path.join(outputDir, "index.html"), html),
  writeFile(path.join(outputDir, "apps-script-bridge.js"), bridge)
]);
console.log(`Built Netlify frontend in ${outputDir}`);
