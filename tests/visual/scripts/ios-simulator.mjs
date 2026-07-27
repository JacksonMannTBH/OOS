#!/usr/bin/env node
// Boot iOS Simulator + Safari, screenshot each route. Skips entirely
// (gracefully) if Xcode/xcrun is unavailable.

import { execSync, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE = process.env.OOS_VISUAL_BASE_URL ?? "http://localhost:3000";
const OUT = path.join(ROOT, "out/ios-simulator");

function skip(reason) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(
    path.join(OUT, "skipped.json"),
    JSON.stringify({ reason }, null, 2),
  );
  console.log(`SKIPPED: ${reason}`);
  process.exit(0);
}

let xcrunOk = false;
try {
  execSync("xcrun --version", { stdio: "ignore" });
  xcrunOk = true;
} catch {
  /* ignore */
}
if (!xcrunOk) skip("xcrun not on PATH");

if (!fs.existsSync("/Applications/Xcode.app")) {
  skip("Xcode.app not installed (Command Line Tools alone is not enough for Simulator)");
}

let list;
try {
  list = JSON.parse(
    execSync("xcrun simctl list devices available --json").toString(),
  );
} catch (e) {
  skip(`xcrun simctl failed: ${e.message}`);
}
const all = Object.values(list.devices).flat();
const iphone =
  all.find((d) => /iPhone (15|16|17) Pro\b/.test(d.name)) ??
  all.find((d) => /iPhone /.test(d.name));
if (!iphone) skip("no iPhone simulator available");

console.log("Using simulator:", iphone.name, iphone.udid);
fs.mkdirSync(OUT, { recursive: true });

spawnSync("xcrun", ["simctl", "boot", iphone.udid]);
spawnSync("open", [
  "-a",
  "Simulator",
  "--args",
  "-CurrentDeviceUDID",
  iphone.udid,
]);
await new Promise((r) => setTimeout(r, 8000));

const ROUTES_JSON = path.join(ROOT, "out/routes.json");
let ROUTES;
if (fs.existsSync(ROUTES_JSON)) {
  ROUTES = JSON.parse(fs.readFileSync(ROUTES_JSON, "utf8"));
} else {
  // Fallback inline list mirrored from specs/routes.ts
  ROUTES = [
    { name: "home-default", path: "/", settleMs: 1500 },
    { name: "map", path: "/map", settleMs: 3500 },
    { name: "forecast", path: "/forecast", settleMs: 1500 },
    { name: "activity", path: "/activity", settleMs: 1500 },
    { name: "about", path: "/about", settleMs: 1000 },
    { name: "legal", path: "/legal", settleMs: 1000 },
    { name: "help", path: "/help", settleMs: 1000 },
    { name: "404", path: "/this-page-does-not-exist", settleMs: 1000 },
    { name: "plane-N305DK", path: "/plane/N305DK", settleMs: 2000 },
  ];
}

for (const route of ROUTES) {
  const url = BASE + route.path;
  console.log("iOS:", route.name, "->", url);
  spawnSync("xcrun", ["simctl", "openurl", iphone.udid, url]);
  await new Promise((r) =>
    setTimeout(r, (route.settleMs ?? 2000) + 1500),
  );
  spawnSync("xcrun", [
    "simctl",
    "io",
    iphone.udid,
    "screenshot",
    path.join(OUT, `${route.name}.png`),
  ]);
}

fs.writeFileSync(
  path.join(OUT, "meta.json"),
  JSON.stringify(
    { device: iphone.name, udid: iphone.udid, ts: new Date().toISOString() },
    null,
    2,
  ),
);
console.log("iOS Simulator pass complete:", OUT);
