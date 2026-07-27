#!/usr/bin/env node
// Apply auto-fixes for the safe-to-fix bug subset. Allow-list narrow
// on purpose; expanding requires per-rule confidence work (Phase 2).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "../../..");
const OUT = path.resolve(__dirname, "../out");

const ALLOW = [
  /^content\/.*\.md$/,
  /^app\/layout\.tsx$/,
  /^app\/\(tabs\)\/.*\/page\.tsx$/,
  /^components\/[^/]+\.tsx$/,
];
const DENY = [
  /^lib\//,
  /^app\/api\//,
  /^scripts\//,
  /^lib\/brand\//,
  /^app\/admin\//,
  /^\.git\//,
  /^\.netlify\//,
  /^\.next\//,
  /^node_modules\//,
  /push/i,
  /auth/i,
  /payment/i,
  /stripe/i,
];

function isAllowed(rel) {
  if (DENY.some((re) => re.test(rel))) return false;
  return ALLOW.some((re) => re.test(rel));
}

const bugsPath = path.join(OUT, "bugs.json");
if (!fs.existsSync(bugsPath)) {
  console.error("bugs.json not found; run categorize-bugs first.");
  process.exit(1);
}
const bugsFile = JSON.parse(fs.readFileSync(bugsPath, "utf8"));
const fixable = bugsFile.bugs.filter((b) => b.autoFixable);

console.log(`Attempting ${fixable.length} auto-fixes (allow-list only).`);

const applied = [];
const skipped = [];

for (const bug of fixable) {
  if (bug.type === "a11y" && bug.suggestedFix?.rule === "html-has-lang") {
    const rel = "app/layout.tsx";
    if (!isAllowed(rel)) {
      skipped.push({ bug: bug.id, reason: `path not in allow-list: ${rel}` });
      continue;
    }
    const layout = path.join(REPO, rel);
    if (!fs.existsSync(layout)) {
      skipped.push({ bug: bug.id, reason: "layout.tsx not found" });
      continue;
    }
    const txt = fs.readFileSync(layout, "utf8");
    if (/<html\b[^>]*\blang=/.test(txt)) {
      skipped.push({ bug: bug.id, reason: "lang already present" });
      continue;
    }
    const fixed = txt.replace(/<html(\s|>)/, '<html lang="en"$1');
    if (fixed === txt) {
      skipped.push({ bug: bug.id, reason: "<html> tag pattern not matched" });
      continue;
    }
    fs.writeFileSync(layout, fixed);
    applied.push({
      bug: bug.id,
      file: rel,
      change: 'add lang="en" to <html>',
    });
    continue;
  }

  skipped.push({
    bug: bug.id,
    reason: "no automated handler for this bug type yet",
  });
}

fs.writeFileSync(
  path.join(OUT, "autofix.json"),
  JSON.stringify({ applied, skipped, ts: new Date().toISOString() }, null, 2),
);
console.log(`Applied ${applied.length} fixes; skipped ${skipped.length}.`);

if (applied.length === 0) {
  console.log("No fixes applied. Bug report still goes to PR body.");
  process.exit(0);
}

const byCategory = applied.reduce((acc, a) => {
  const key = a.change.split(" ")[0];
  (acc[key] ??= []).push(a);
  return acc;
}, {});

for (const [cat, items] of Object.entries(byCategory)) {
  const files = [...new Set(items.map((i) => i.file))];
  for (const f of files) {
    execSync(`git -C ${JSON.stringify(REPO).slice(1, -1)} add ${JSON.stringify(f)}`);
  }
  const msg =
    `fix(qa-pass): ${cat} — ${items.length} item${items.length === 1 ? "" : "s"}\n\n` +
    items.map((i) => `- ${i.bug}: ${i.change} (${i.file})`).join("\n") +
    `\n\nAuto-applied by tests/visual/scripts/autofix.mjs.\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`;
  execSync(`git -C ${JSON.stringify(REPO).slice(1, -1)} commit -m ${JSON.stringify(msg)}`);
}

console.log("Auto-fixes committed.");
