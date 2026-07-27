// PROMPT_23 mobile + contrast audit. Renders every rider-facing route
// at mobile viewport against prod, captures screenshots, and surfaces
// programmatic findings (tap targets, horizontal overflow). Output
// goes to /tmp/p23-audit/. Run via:
//
//   cd tests/visual && OOS_VISUAL_BASE_URL=http://localhost:3000 \
//     npx playwright test audits/p23-mobile-audit.spec.ts \
//     --project=chromium-mobile
//
// Lives in tests/visual/audits/ (not specs/) so it sits outside
// playwright.config.ts's testMatch glob ("specs/**/*.spec.ts").
// That keeps it from running on a generic `npx playwright test`
// invocation or any future broad-suite CI workflow. Manual /
// on-demand only.

import { test } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const ROUTES: Array<{ name: string; path: string; settleMs?: number }> = [
  { name: "01-home", path: "/", settleMs: 2000 },
  { name: "02-home-mock-up", path: "/?mock=up", settleMs: 2000 },
  { name: "03-map", path: "/map", settleMs: 4000 },
  { name: "04-map-mock-up", path: "/map?mock=up", settleMs: 4000 },
  { name: "05-forecast", path: "/forecast", settleMs: 1500 },
  { name: "06-activity", path: "/activity", settleMs: 1500 },
  { name: "07-about", path: "/about", settleMs: 1500 },
  { name: "08-help", path: "/help", settleMs: 1500 },
  { name: "09-legal", path: "/legal", settleMs: 1500 },
  { name: "10-plane-N305DK", path: "/plane/N305DK", settleMs: 2000 },
  { name: "11-settings-alerts", path: "/settings/alerts", settleMs: 1500 },
];

const OUT_DIR = "/tmp/p23-audit";

type Finding = {
  kind: "tap-target" | "overflow" | "low-contrast";
  selector: string;
  detail: string;
};

test.beforeAll(() => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
});

for (const r of ROUTES) {
  test(`audit ${r.name}`, async ({ page }) => {
    await page.goto(r.path, { waitUntil: "networkidle" });
    await page.waitForTimeout(r.settleMs ?? 1500);

    await page.screenshot({
      path: path.join(OUT_DIR, `${r.name}.png`),
      fullPage: true,
    });

    const findings: Finding[] = await page.evaluate(() => {
      const out: Array<{
        kind: "tap-target" | "overflow" | "low-contrast";
        selector: string;
        detail: string;
      }> = [];

      const winW = window.innerWidth;

      // Tap-target audit — every clickable < 44 px in either dimension
      // (excluding 0×0 hidden elements). Cap at 20 to keep noise down.
      const clickables = Array.from(
        document.querySelectorAll(
          "button, a, [role='button'], [onclick], input[type='checkbox'], input[type='radio']",
        ),
      );
      let tapHits = 0;
      for (const el of clickables) {
        const rect = (el as HTMLElement).getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const tooSmall = rect.width < 44 || rect.height < 44;
        if (!tooSmall) continue;
        const tag = el.tagName.toLowerCase();
        const cls =
          (el as HTMLElement).className?.toString().slice(0, 30) || "";
        const text = (el.textContent || "").trim().slice(0, 40);
        const aria = (el as HTMLElement).getAttribute("aria-label") || "";
        out.push({
          kind: "tap-target",
          selector: `${tag}.${cls}`,
          detail: `${Math.round(rect.width)}×${Math.round(
            rect.height,
          )} "${text || aria}"`,
        });
        if (++tapHits >= 20) break;
      }

      // Horizontal overflow — find any wide element whose right edge
      // pushes past the viewport. Cap at 5.
      let overflowHits = 0;
      for (const el of Array.from(document.querySelectorAll("*"))) {
        const rect = (el as HTMLElement).getBoundingClientRect();
        if (rect.right > winW + 1 && rect.width > 100) {
          const tag = el.tagName.toLowerCase();
          if (["html", "body", "head", "script", "link"].includes(tag))
            continue;
          out.push({
            kind: "overflow",
            selector: `${tag}.${
              (el as HTMLElement).className?.toString().slice(0, 30) || ""
            }`,
            detail: `right=${Math.round(rect.right)} (vw=${winW})`,
          });
          if (++overflowHits >= 5) break;
        }
      }

      return out;
    });

    if (findings.length > 0) {
      const report = {
        route: r.path,
        findings,
      };
      fs.writeFileSync(
        path.join(OUT_DIR, `${r.name}.findings.json`),
        JSON.stringify(report, null, 2),
      );
      console.log(`[${r.path}] ${findings.length} findings`);
    }
  });
}
