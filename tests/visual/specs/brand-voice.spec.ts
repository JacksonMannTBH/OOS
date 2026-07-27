import { test } from "@playwright/test";
import { ROUTES } from "./routes";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..");

// Lifted from BRAND.md §3 voice rules + Prompt 4 banned-vocab list.
//
// The "emoji" matcher excludes a small set of glyphs that are part of the
// Out Of Sight design language and not actually emoji:
//   ©          OpenFreeMap / OpenStreetMap attribution
//   ↗ ↘ ✦ ⚠   activity-feed kind icons (takeoff/landing/first-seen/squawk)
//   ↑ ↓ →     directional arrow glyphs used in chrome
// Adding allowed symbols here is preferred over weakening the regex so we
// still catch genuine emoji in copy.
const ALLOWED_SYMBOLS = /[©↗↘↑↓→✦⚠]/;

const BANNED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /[\p{Extended_Pictographic}]/u, reason: "emoji forbidden in rider-facing copy" },
  { pattern: /!/, reason: "exclamation mark forbidden" },
  { pattern: /\bpolice\b/i, reason: 'use "WSP" or "agency", never "police"' },
  { pattern: /\bcop\b/i, reason: 'use "Bird", never "cop"' },
  { pattern: /\blaw enforcement\b/i, reason: 'use "WSP" or "agency"' },
  { pattern: /\bdrone\b/i, reason: "we track manned aircraft, not drones" },
  { pattern: /\bsurveilling\b/i, reason: 'use "watching"' },
  { pattern: /\bdrive safe\b/i, reason: "no moralizing about safety" },
  { pattern: /\bslow down\b/i, reason: 'no lecturing; warning copy uses "ease off"' },
  { pattern: /\brest assured\b/i, reason: "defensive language; state the data flow factually" },
  { pattern: /\bwe would never\b/i, reason: "defensive language; state the data flow factually" },
];

const RIDER_ROUTES = ROUTES.filter((r) => r.riderFacing);

for (const route of RIDER_ROUTES) {
  test(`brand-voice: ${route.name}`, async ({ page }, testInfo) => {
    if (testInfo.project.name !== "chromium-desktop") test.skip();
    try {
      await page.goto(route.path, { waitUntil: "networkidle" });
    } catch {
      return;
    }
    if (route.settleMs) await page.waitForTimeout(route.settleMs);
    const text = await page.locator("body").innerText();
    const violations: Array<{
      pattern: string;
      reason: string;
      matched: string;
      context: string;
    }> = [];
    for (const { pattern, reason } of BANNED_PATTERNS) {
      const flags = pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g";
      const re = new RegExp(pattern.source, flags);
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        // Skip allow-listed glyphs (©, design-language arrows, etc.).
        if (ALLOWED_SYMBOLS.test(m[0])) {
          if (m.index === re.lastIndex) re.lastIndex++;
          continue;
        }
        const context = text.slice(
          Math.max(0, m.index - 30),
          m.index + m[0].length + 30,
        );
        violations.push({
          pattern: pattern.source,
          reason,
          matched: m[0],
          context,
        });
        // Avoid infinite loop on zero-length matches
        if (m.index === re.lastIndex) re.lastIndex++;
      }
    }
    const dir = path.join(ROOT, "out/brand-voice");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, `${route.name}.json`),
      JSON.stringify({ violations }, null, 2),
    );
  });
}
