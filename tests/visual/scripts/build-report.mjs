#!/usr/bin/env node
// Build the human-readable HTML report and the markdown PR body.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "out");

const bugsPath = path.join(OUT, "bugs.json");
if (!fs.existsSync(bugsPath)) {
  console.error("bugs.json missing; run categorize-bugs first.");
  process.exit(1);
}
const bugs = JSON.parse(fs.readFileSync(bugsPath, "utf8"));
const autofix = fs.existsSync(path.join(OUT, "autofix.json"))
  ? JSON.parse(fs.readFileSync(path.join(OUT, "autofix.json"), "utf8"))
  : { applied: [], skipped: [] };

const iosSkipped = fs.existsSync(path.join(OUT, "ios-simulator/skipped.json"))
  ? JSON.parse(fs.readFileSync(path.join(OUT, "ios-simulator/skipped.json"), "utf8"))
  : null;

function formatBugs(list) {
  if (!list.length) return "*None.*";
  return list
    .map(
      (b) =>
        `- **${b.id}** [${b.type}] *${b.surface}* — ${b.title}${
          b.autoFixable ? " _(auto-fix attempted)_" : ""
        }`,
    )
    .join("\n");
}

const md = `# QA Pass — ${new Date().toISOString().slice(0, 10)}

Automated full-pipeline visual + functional + a11y + perf + PWA + brand-voice
sweep against the deployed site. ${bugs.summary.total} findings; ${autofix.applied.length}
auto-fixed in this PR; ${bugs.summary.total - autofix.applied.length} flagged for review.

## Summary

- **Total findings:** ${bugs.summary.total}
- **Severity:** P0=${bugs.summary.p0} · P1=${bugs.summary.p1} · P2=${bugs.summary.p2} · P3=${bugs.summary.p3}
- **By type:** ${
  Object.entries(bugs.summary.byType).length
    ? Object.entries(bugs.summary.byType)
        .map(([k, v]) => `${k}=${v}`)
        .join(" · ")
    : "*none*"
}
- **Auto-fixed in this PR:** ${autofix.applied.length}
- **Deferred to manual review:** ${
  autofix.skipped.length + bugs.bugs.filter((b) => !b.autoFixable).length
}
- **iOS Simulator pass:** ${iosSkipped ? `skipped (${iosSkipped.reason})` : "ran"}

## Auto-fixes applied

${
  autofix.applied.length
    ? autofix.applied
        .map((a) => `- ✅ **${a.bug}** — ${a.change} in \`${a.file}\``)
        .join("\n")
    : "*No fixes applied this run.*"
}

## P0 — blocking (look at these first)

${formatBugs(bugs.bugs.filter((b) => b.severity === "P0"))}

## P1 — visible to users

${formatBugs(bugs.bugs.filter((b) => b.severity === "P1"))}

## P2 — polish

${formatBugs(bugs.bugs.filter((b) => b.severity === "P2"))}

## How this was generated

\`\`\`bash
cd ~/Dev/Out Of Sight/tests/visual
OOS_VISUAL_BASE_URL=http://localhost:3000 npm test
node scripts/ios-simulator.mjs       # auto-skipped if Xcode absent
node scripts/categorize-bugs.mjs     # → bugs.json
node scripts/autofix.mjs             # apply allow-listed fixes only
node scripts/build-report.mjs        # → report.html + this PR body
\`\`\`

Re-run with \`npm test\` from \`tests/visual/\` whenever you want a fresh pass.

Local report: \`tests/visual/out/report.html\`.

## Out of scope (Phase 3)

- CI integration (run on every PR via GitHub Actions)
- Visual regression baselines for pixel diffs run-over-run
- Lighthouse / Core Web Vitals via real Lighthouse CLI
- Login-gated /admin interior screens
- Auto-fix expansion: image-alt heuristics, brand-voice source mapping
`;

fs.writeFileSync(path.join(OUT, "pr-body.md"), md);
fs.writeFileSync(path.join(OUT, "report.md"), md);

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>QA Pass</title>
<style>
body{font-family:system-ui;background:#0b0d10;color:#f2f4f7;margin:0;padding:24px;line-height:1.5}
h1{font-size:22px;margin:0 0 12px}
h2{font-size:16px;margin:24px 0 8px;color:#a8aeb8;letter-spacing:.04em;text-transform:uppercase}
.summary{background:#15181d;border:0.5px solid #262b33;border-radius:14px;padding:18px;margin:12px 0}
.bug{font-family:'SF Mono',Menlo,monospace;font-size:12px;padding:6px 0;border-top:0.5px solid #262b33}
.p0{color:#dc2626}.p1{color:#f5b840}.p2{color:#a8aeb8}
.applied{color:#5fcf8a}
</style></head>
<body>
<h1>QA Pass — ${new Date().toLocaleString()}</h1>
<div class="summary">
<div>Total: <b>${bugs.summary.total}</b></div>
<div>P0: <span class="p0">${bugs.summary.p0}</span> · P1: <span class="p1">${bugs.summary.p1}</span> · P2: <span class="p2">${bugs.summary.p2}</span></div>
<div>Auto-fixed: <b class="applied">${autofix.applied.length}</b></div>
<div>iOS Simulator: ${iosSkipped ? `<i>skipped (${iosSkipped.reason})</i>` : "<b>ran</b>"}</div>
</div>
<h2>Bugs</h2>
${
  bugs.bugs.length
    ? bugs.bugs
        .map(
          (b) =>
            `<div class="bug ${b.severity.toLowerCase()}">[${b.severity}] ${b.id} ${b.type} · ${b.surface} · ${b.title.replace(/</g, "&lt;")}</div>`,
        )
        .join("")
    : '<div class="bug">No bugs found.</div>'
}
<h2>Auto-fixes applied</h2>
${
  autofix.applied.length
    ? autofix.applied
        .map((a) => `<div class="bug applied">${a.bug} → ${a.change} (${a.file})</div>`)
        .join("")
    : '<div class="bug">None.</div>'
}
</body></html>`;

fs.writeFileSync(path.join(OUT, "report.html"), html);
console.log("Built pr-body.md, report.md, report.html");
