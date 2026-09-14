// Verifies the React glue layer specifically — <ReportWidget /> actually
// calls init() on mount and destroy() on unmount, and useReportWidget()'s
// open() actually reaches the already-proven core widget. The widget UI
// itself (form/screenshot/submit) is pleaseresolve-sdk's own test-e2e.mjs's
// job, not re-verified here in full — this is the new risk surface only.
import { execSync } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const SDK_ROOT = join(ROOT, "..", "pleaseresolve-sdk");
const API_BASE = "http://localhost:5000/api/v1";
const PORT = 8124;
const ORIGIN = `http://localhost:${PORT}`;
const MONGO_EXEC =
  "docker compose -f /home/saikat/workspace/nukta/pleaseresolve/pleaseresolve-backend/docker-compose.yml exec -T mongo mongosh --quiet please_resolve --eval";

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${JSON.stringify(body)}`);
  return body.data;
}

function mongoEval(script) {
  return execSync(`${MONGO_EXEC} '${script.replace(/'/g, "'\\''")}'`, { encoding: "utf8" });
}

async function provision() {
  const { token } = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "owner0@seed.pleaseresolve.dev", password: "SeedPass123!" }),
  });
  const me = await api("/auth/me", { headers: { Authorization: `Bearer ${token}` } });
  const orgId = me.user.organizationId;
  const projects = await api(`/organizations/${orgId}/projects?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const projectId = projects[0]._id;
  const keyResult = await api(`/organizations/${orgId}/api-keys`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: "e2e-react-test-key",
      keyType: "public",
      allowedProjects: [projectId],
      allowedOrigins: [ORIGIN],
    }),
  });
  return { orgId, projectId, apiKeyId: keyResult.apiKey._id, rawKey: keyResult.rawKey };
}

async function cleanup({ apiKeyId }) {
  mongoEval(
    `const ids = db.reports.find({title: /^REACT-E2E:/}).toArray().map(r => r._id); ` +
      `print(JSON.stringify(db.report_activities.deleteMany({reportId: {$in: ids}}))); ` +
      `print(JSON.stringify(db.reports.deleteMany({_id: {$in: ids}})));`,
  );
  mongoEval(`print(JSON.stringify(db.api_keys.deleteMany({_id: ObjectId("${apiKeyId}")})));`);
}

const MIME = { ".html": "text/html", ".js": "text/javascript", ".map": "application/json" };

function serveStatic(html, key, projectId) {
  return createServer(async (req, res) => {
    try {
      if (req.url === "/" || req.url === "/index.html") {
        res.writeHead(200, { "Content-Type": "text/html" });
        return res.end(html);
      }
      if (req.url === "/app.mjs") {
        const src = (await readFile(join(ROOT, "test-app.mjs"), "utf8"))
          .replace("__API_KEY__", key)
          .replace("__PROJECT_ID__", projectId)
          .replace("__API_BASE_URL__", API_BASE);
        res.writeHead(200, { "Content-Type": "text/javascript" });
        return res.end(src);
      }
      if (req.url.startsWith("/sdk-core/")) {
        const body = await readFile(join(SDK_ROOT, "dist", req.url.replace("/sdk-core/", "")));
        res.writeHead(200, { "Content-Type": MIME[extname(req.url)] ?? "application/octet-stream" });
        return res.end(body);
      }
      if (req.url.startsWith("/sdk-react/")) {
        const body = await readFile(join(ROOT, "dist", req.url.replace("/sdk-react/", "")));
        res.writeHead(200, { "Content-Type": MIME[extname(req.url)] ?? "application/octet-stream" });
        return res.end(body);
      }
      res.writeHead(404);
      res.end("not found");
    } catch (err) {
      res.writeHead(500);
      res.end(String(err));
    }
  });
}

const PAGE_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>React wrapper test</title>
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@18.3.1",
    "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime",
    "react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
    "@pleaseresolve/sdk": "/sdk-core/sdk.js",
    "@pleaseresolve/react": "/sdk-react/index.js"
  }
}
</script>
</head>
<body>
<div id="root"></div>
<script type="module" src="/app.mjs"></script>
</body></html>`;

async function run() {
  const ctx = await provision();
  console.log("Provisioned public key:", ctx.rawKey.slice(0, 15) + "...");

  const server = serveStatic(PAGE_HTML, ctx.rawKey, ctx.projectId);
  await new Promise((resolve) => server.listen(PORT, resolve));

  const consoleErrors = [];
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push("PAGEERROR: " + err.message));

    await page.goto(`${ORIGIN}/`, { waitUntil: "networkidle0" });

    const mounted = await page.evaluate(
      () => !!document.querySelector("[data-pleaseresolve-widget]"),
    );
    console.log("1. <ReportWidget /> mounted the core widget on render:", mounted);

    // Custom trigger, not the default floating button — exercises
    // useReportWidget()'s open() specifically.
    await page.click("#custom-trigger");
    await page.waitForFunction(
      () =>
        !!document
          .querySelector("[data-pleaseresolve-widget]")
          .shadowRoot.querySelector('input[id^="pr-title-"]'),
      { timeout: 8000 },
    );
    console.log("2. useReportWidget().open() opened the form:", true);

    await page.evaluate(() => {
      const root = document.querySelector("[data-pleaseresolve-widget]").shadowRoot;
      const titleInput = root.querySelector('input[id^="pr-title-"]');
      titleInput.value = "REACT-E2E: submitted via useReportWidget().open()";
      titleInput.dispatchEvent(new Event("input", { bubbles: true }));
      root.querySelector("form").requestSubmit();
    });
    await page.waitForFunction(
      () =>
        !!document
          .querySelector("[data-pleaseresolve-widget]")
          .shadowRoot.querySelector(".pr-success-title"),
      { timeout: 5000 },
    );
    console.log("3. Submission via the React-mounted widget succeeded");

    // The success overlay is still fixed/full-viewport at this point (it
    // auto-closes after 2.5s — widget.ts's renderSuccess) and would
    // intercept the click otherwise; wait for it to actually close first.
    await page.waitForFunction(
      () =>
        document.querySelector("[data-pleaseresolve-widget]").shadowRoot.querySelector(
          ".pr-overlay",
        ).hidden,
      { timeout: 4000 },
    );

    // Unmount <ReportWidget /> — verifies destroy() actually tears it down.
    await page.click("#unmount-btn");
    await new Promise((r) => setTimeout(r, 300));
    const unmounted = await page.evaluate(
      () => !document.querySelector("[data-pleaseresolve-widget]"),
    );
    console.log("4. Unmounting <ReportWidget /> called destroy() and removed it:", unmounted);

    const dbCheck = mongoEval(
      `db.reports.find({title: /^REACT-E2E:/}).forEach(r => print(r.title + " | source=" + r.source))`,
    );
    console.log("5. Verified in database:\n" + dbCheck.trim());

    if (consoleErrors.length) {
      console.log("\nConsole errors (favicon 404 is expected/harmless):", consoleErrors);
    }
  } finally {
    await browser.close();
    server.close();
    await cleanup(ctx);
    console.log("\nCleaned up test key + test reports.");
  }
}

run().catch((err) => {
  console.error("E2E TEST FAILED:", err);
  process.exit(1);
});
