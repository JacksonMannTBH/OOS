// State-coherence assertions. Compare what /api/aircraft, /api/tails,
// /api/activity report against what each rider-facing surface displays.
//
// These catch state-machine inconsistencies that smoke tests miss —
// "airborne shown as completed", role-mismatched copy, time labels that
// don't match data, badge-vs-pill divergence.
//
// Each assertion writes its own out/coherence/{name}.json. categorize-bugs
// glues them all into the unified bug list.

import { test } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "out/coherence");
const BASE = process.env.OOS_VISUAL_BASE_URL ?? "http://localhost:3000";

type Aircraft = {
  tail: string;
  hex?: string;
  operator?: string;
  role: string;
  roleConfidence?: string;
  roleDescription?: string;
  airborne: boolean;
  altitude_ft?: number | null;
  ground_speed_kt?: number | null;
  last_seen_min?: number | null;
  time_aloft_min?: number | null;
  nickname?: string | null;
};

type Snapshot = {
  fetched_at: number;
  source: string;
  aircraft: Aircraft[];
};

let snap: Snapshot | null = null;

test.beforeAll(async ({ playwright }) => {
  fs.mkdirSync(OUT, { recursive: true });
  const ctx = await playwright.request.newContext({ baseURL: BASE });
  const r = await ctx.get("/api/aircraft");
  if (!r.ok()) throw new Error(`/api/aircraft returned ${r.status()}`);
  snap = (await r.json()) as Snapshot;
  fs.writeFileSync(path.join(OUT, "snapshot.json"), JSON.stringify(snap, null, 2));
});

function writeViolations(name: string, violations: unknown[]): void {
  fs.writeFileSync(
    path.join(OUT, `${name}.json`),
    JSON.stringify({ violations }, null, 2),
  );
}

// ASSERT 1: airborne flight detail must NOT say "Completed flight"
test("coherence: airborne flights are not labeled completed", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "chromium-desktop") test.skip();
  const airborne = (snap?.aircraft ?? []).filter((a) => a.airborne);
  const violations: unknown[] = [];
  for (const tail of airborne) {
    try {
      await page.goto(`/plane/${tail.tail}`, { waitUntil: "networkidle" });
    } catch {
      continue;
    }
    const text = await page.locator("main").innerText();
    if (/completed flight/i.test(text)) {
      violations.push({
        tail: tail.tail,
        bug: 'plane-detail says "Completed flight" while /api/aircraft says airborne=true',
        snippet: text.match(/.{0,80}completed flight.{0,80}/i)?.[0] ?? null,
      });
    }
    if (!/airborne|aloft|in the air|in progress/i.test(text)) {
      violations.push({
        tail: tail.tail,
        bug: "plane-detail does not mark current flight as in-progress despite airborne=true",
      });
    }
  }
  writeViolations("airborne-vs-completed", violations);
});

// ASSERT 2: home hero tier matches /api/aircraft
test("coherence: home hero tier matches /api/aircraft", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "chromium-desktop") test.skip();
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const heroText = (await page.locator("h1").first().innerText().catch(() => "")).toUpperCase();
  const fleet = snap?.aircraft ?? [];
  const anyBirdUp = fleet.some((a) => a.airborne && a.role === "fixed_wing");
  const anyAlertUp = fleet.some(
    (a) => a.airborne && (a.role === "patrol" || a.role === "unknown"),
  );
  const violations: unknown[] = [];
  if (anyBirdUp && !/EYE IN THE SKY/i.test(heroText)) {
    violations.push({
      bug: `fixed_wing is airborne but home headline reads "${heroText}"`,
      expected: "Active Air Support",
    });
  } else if (
    !anyBirdUp &&
    anyAlertUp &&
    !/EYE IN THE SKY/i.test(heroText)
  ) {
    violations.push({
      bug: `patrol/unknown is airborne but home headline reads "${heroText}"`,
      expected: "Active Air Support",
    });
  } else if (
    !anyBirdUp &&
    !anyAlertUp &&
    !/NO EYES/i.test(heroText)
  ) {
    violations.push({
      bug: `nothing alert-tier is airborne but headline reads "${heroText}"`,
      expected: "No Eyes",
    });
  }
  writeViolations("home-hero-tier", violations);
});

// ASSERT 3: airborne tails should have last_seen_min ≤ 5
test("coherence: airborne tails have recent last_seen_min", () => {
  const fleet = snap?.aircraft ?? [];
  const violations = fleet
    .filter(
      (a) =>
        a.airborne &&
        a.last_seen_min != null &&
        a.last_seen_min > 5,
    )
    .map((a) => ({
      tail: a.tail,
      last_seen_min: a.last_seen_min,
      bug: `airborne but last seen ${a.last_seen_min}m ago`,
    }));
  writeViolations("airborne-stale-snapshot", violations);
});

// ASSERT 4: SAR/transport copy doesn't use speed-enforcement language
test("coherence: SAR/transport plane copy doesn't use speed-enforcement language", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name !== "chromium-desktop") test.skip();
  const sarTransport = (snap?.aircraft ?? []).filter(
    (a) => a.role === "sar" || a.role === "transport",
  );
  const violations: unknown[] = [];
  for (const tail of sarTransport) {
    try {
      await page.goto(`/plane/${tail.tail}`, { waitUntil: "networkidle" });
    } catch {
      continue;
    }
    const text = await page.locator("main").innerText();
    if (/speed enforcement|flir clocking|clocking speeders/i.test(text)) {
      violations.push({
        tail: tail.tail,
        role: tail.role,
        bug: "speed-enforcement language on non-fixed_wing tail",
      });
    }
  }
  writeViolations("role-mismatched-copy", violations);
});

// ASSERT 5: time-ago labels are non-negative + not future-tense
test("coherence: time-ago labels are non-negative", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "chromium-desktop") test.skip();
  const surfaces = ["/", "/map"];
  const violations: unknown[] = [];
  for (const surface of surfaces) {
    try {
      await page.goto(surface, { waitUntil: "networkidle" });
    } catch {
      continue;
    }
    await page.waitForTimeout(1500);
    const text = await page.locator("body").innerText();
    const negMatch = text.match(/-\d+\s*(?:m|min|h|hr|d)\s*ago/i);
    const futureMatch = text.match(/in\s+\d+\s*(?:m|min|h|hr|d)\b(?!\s*ago)/i);
    if (negMatch) {
      violations.push({ surface, bug: "negative time-ago label", match: negMatch[0] });
    }
    if (futureMatch) {
      violations.push({ surface, bug: "future tense for an event", match: futureMatch[0] });
    }
  }
  writeViolations("time-coherence", violations);
});

// ASSERT 6: map layer controls are present + interactive on /map
test("coherence: map layer controls reflect state", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "chromium-desktop") test.skip();
  try {
    await page.goto("/map", { waitUntil: "networkidle" });
  } catch {
    writeViolations("map-toggle", [{ bug: "navigation to /map failed" }]);
    return;
  }
  await page.waitForTimeout(3000);
  const rings = await page.locator('button[aria-label*="distance rings" i]').count();
  const paths = await page.locator('button[aria-label*="flight paths" i]').count();
  const violations = [
    ...(rings > 0 ? [] : [{ bug: "distance-rings toggle not found on /map" }]),
    ...(paths > 0 ? [] : [{ bug: "flight-paths toggle not found on /map" }]),
  ];
  writeViolations("map-toggle", violations);
});

// ASSERT 7: /api/badge.svg matches the home pill state
test("coherence: /api/badge.svg matches home pill", async ({ request, page }, testInfo) => {
  if (testInfo.project.name !== "chromium-desktop") test.skip();
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const heroText = (await page.locator("h1").first().innerText().catch(() => "")).toUpperCase();
  const r = await request.get("/api/badge.svg");
  if (!r.ok()) {
    writeViolations("badge-match", [
      { bug: `/api/badge.svg returned ${r.status()}` },
    ]);
    return;
  }
  const svg = await r.text();
  const violations: unknown[] = [];
  if (/BIRD/i.test(heroText) && !/BIRD/i.test(svg)) {
    violations.push({ bug: "home shows BIRD but badge.svg does not" });
  } else if (
    /CLEAR|DOWN/i.test(heroText) &&
    !/(CLEAR|DOWN|QUIET|UP)/i.test(svg)
  ) {
    violations.push({
      bug: `home reads "${heroText}" but badge.svg has no matching status word`,
    });
  }
  writeViolations("badge-match", violations);
});

// ASSERT 8: numeric sanity
test("coherence: altitudes / speeds within sane bounds", () => {
  const violations: unknown[] = [];
  for (const a of snap?.aircraft ?? []) {
    if (a.altitude_ft != null && (a.altitude_ft < 0 || a.altitude_ft > 50_000)) {
      violations.push({
        tail: a.tail,
        bug: `altitude_ft=${a.altitude_ft} out of [0, 50000]`,
      });
    }
    if (a.ground_speed_kt != null && (a.ground_speed_kt < 0 || a.ground_speed_kt > 600)) {
      violations.push({
        tail: a.tail,
        bug: `ground_speed_kt=${a.ground_speed_kt} out of [0, 600]`,
      });
    }
  }
  writeViolations("numeric-sanity", violations);
});

// ASSERT 9: registry vs UI tail set — every snapshot tail visible on /about
test("coherence: every snapshot tail appears on /about registry list", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name !== "chromium-desktop") test.skip();
  await page.goto("/about", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const text = await page.locator("body").innerText();
  const violations = (snap?.aircraft ?? [])
    .filter((a) => !text.includes(a.tail))
    .map((a) => ({
      tail: a.tail,
      bug: "in /api/aircraft snapshot but missing from /about registry list",
    }));
  writeViolations("tail-registry-sync", violations);
});

