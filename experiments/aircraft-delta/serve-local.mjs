import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";
import { deltaMessage, encodeMessage } from "./protocol.ts";

// This server has no credentials, backend imports, or external requests.
const output = resolve(process.argv[2] ?? ".local/aircraft-delta-test");
await mkdir(output, { recursive: true });
const pairs = JSON.parse(await readFile(`${output}/browser-pairs.json`, "utf8"));
await build({ entryPoints: ["experiments/aircraft-delta/browser.ts"], bundle: true, platform: "browser",
  target: "safari17", outfile: `${output}/browser.js` });
const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>OOS local update test</title>
<style>body{background:#101820;color:#eff7ff;font:18px system-ui;padding:32px 20px}h1{font-size:28px}pre{white-space:pre-wrap;font:17px/1.8 system-ui;color:#adc8db}</style>
<h1>OOS local update test</h1><p id="status">Running checks…</p><pre id="details"></pre><script src="/browser.js" defer></script>`;
const server = createServer(async (req, res) => {
  const path = new URL(req.url, "http://127.0.0.1").pathname;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'");
  try {
    if (req.method === "POST" && path === "/result") {
      let body = "";
      for await (const chunk of req) { body += chunk; if (body.length > 1_000_000) throw new Error("Oversized report"); }
      const report = JSON.parse(body);
      await writeFile(`${output}/simulator-results.json`, JSON.stringify(report, null, 2));
      console.log(JSON.stringify({ status: report.status, checks: report.checks, passed: report.passed, userAgent: report.userAgent }));
      res.writeHead(204).end(); return;
    }
    if (req.method !== "GET") { res.writeHead(405).end(); return; }
    if (path === "/") { res.setHeader("Content-Type", "text/html"); res.end(html); return; }
    if (path === "/browser.js") { res.setHeader("Content-Type", "application/javascript"); res.end(await readFile(`${output}/browser.js`)); return; }
    res.setHeader("Content-Type", "application/json");
    if (path === "/pairs.json") { res.end(JSON.stringify(pairs)); return; }
    const match = /^\/(baseline|frames)\/(\d+)$/.exec(path);
    if (match && pairs[Number(match[2])]) {
      const pair = pairs[Number(match[2])];
      res.end(JSON.stringify(match[1] === "baseline" ? pair.before : encodeMessage(deltaMessage(pair.before, pair.after)))); return;
    }
    res.writeHead(404).end();
  } catch (error) { console.error(String(error)); res.writeHead(500).end("Local test error"); }
});
server.listen(0, "127.0.0.1", async () => {
  const url = `http://127.0.0.1:${server.address().port}`;
  await writeFile(`${output}/url.txt`, url);
  console.log(`Local test page: ${url}`);
});
