// Run against the packaged mobile preview. All remote requests and native
// plugins are isolated fixtures; this does not exercise real background GPS.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(process.env.OOS_PLAYWRIGHT_MODULE ?? "@playwright/test");
const base = process.env.OOS_VISUAL_BASE_URL ?? "http://127.0.0.1:4183";
const out = process.env.OOS_REVIEW_OUTPUT ?? ".local/dev-apple-review";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function fixture(page) {
  await page.route("**/*", route => {
    if (route.request().url().startsWith(base)) return route.continue();
    return route.fulfill({ json: { aircraft: [], fetched_at: Date.now(), source_ok: true } });
  });
  await page.addInitScript(() => {
    const state = window.reviewTracking = { supported: true, active: false, enabled: true, message: "", failure: "", stops: 0 };
    const position = () => ({ timestamp: Date.now(), coords: { latitude: 47.5, longitude: -122.26, accuracy: 5, altitude: null, altitudeAccuracy: null, speed: 0, heading: 0 } });
    window.webkit = { messageHandlers: { bridge: {} } };
    window.Capacitor = {
      PluginHeaders: [
        { name: "OOSLiveTracking", methods: ["start", "stop", "status", "configure"].map(name => ({ name, rtype: "promise" })) },
        { name: "Preferences", methods: ["get", "set"].map(name => ({ name, rtype: "promise" })) },
        { name: "Geolocation", methods: ["getCurrentPosition", "clearWatch"].map(name => ({ name, rtype: "promise" })).concat([{ name: "watchPosition", rtype: "callback" }]) },
      ],
      nativePromise: async (plugin, method) => {
        if (plugin === "Preferences") return { value: null };
        if (plugin === "Geolocation") return position();
        if (plugin === "OOSLiveTracking") {
          if (method === "start") {
            if (state.failure) throw new Error(state.failure);
            state.active = true;
          }
          if (method === "stop") { state.active = false; state.stops++; }
          return { ...state };
        }
        throw new Error(`Unexpected native call: ${plugin}.${method}`);
      },
      nativeCallback: (_plugin, _method, _options, callback) => { callback(position()); return "review-watch"; },
    };
  });
}

async function reachable(page, locator) {
  await locator.waitFor({ state: "visible" });
  await locator.scrollIntoViewIfNeeded();
  assert(await locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1 && el.contains(hit);
  }), "Control must be fully on screen and unobstructed after scrolling");
}

try {
  for (const [name, width, height, zoom = 1] of [
    ["iphone", 390, 844], ["small-phone", 375, 667],
    ["ipad-portrait", 820, 1180], ["ipad-landscape", 1180, 820],
    ["phone-landscape", 667, 375], ["larger-text", 390, 844, 1.5],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await fixture(page);
    await page.goto(`${base}/home`);
    await page.getByRole("button", { name: "Start Live Tracking", exact: true }).waitFor();
    if (zoom !== 1) await page.addStyleTag({ content: ".ss-home h1 { font-size: 72px !important; } p { font-size: 21px !important; } button, a { font-size: 24px !important; }" });
    const map = page.getByRole("link", { name: "View Map", exact: true }).last();
    await reachable(page, map);
    await map.click();
    await page.waitForURL("**/map");
    await page.goto(`${base}/home`);
    if (zoom !== 1) await page.addStyleTag({ content: ".ss-home h1 { font-size: 72px !important; } p { font-size: 21px !important; } button, a { font-size: 24px !important; }" });
    const start = page.getByRole("button", { name: "Start Live Tracking", exact: true });
    await reachable(page, start);
    await page.screenshot({ path: `${out}/${name}-home.png`, fullPage: true });
    await start.click();
    await page.getByRole("button", { name: "Stop Live Tracking", exact: true }).waitFor();
    await page.getByRole("button", { name: "Start Ride", exact: true }).click();
    await page.waitForURL("**/ride");
    assert(await page.evaluate(() => {
      const header = document.querySelector("main > header").getBoundingClientRect();
      const speed = document.querySelector('[aria-label^="Your speed:"]').getBoundingClientRect();
      return speed.top >= header.bottom;
    }), "Speedometer must not overlap the Ride heading");
    const stop = page.getByRole("button", { name: "Stop Live Tracking", exact: true });
    assert.equal(await stop.count(), 0, "Live Tracking controls stay on Home");
    await page.screenshot({ path: `${out}/${name}-ride.png`, fullPage: true });
    await page.getByRole("button", { name: "End Ride and return to the main app" }).click();
    await page.waitForURL("**/home");
    await stop.waitFor();
    await stop.click();
    assert.equal(await page.evaluate(() => window.reviewTracking.stops), 1);
    await page.getByRole("button", { name: "Start Live Tracking", exact: true }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "No horizontal overflow");
    console.log(`PASS ${name}: Map reachable, start, End Ride retains tracking, stop from Home, no Live Tracking control in Ride`);
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  await fixture(page);
  await page.goto(`${base}/home`);
  const start = page.getByRole("button", { name: "Start Live Tracking", exact: true });
  await start.waitFor();
  await page.evaluate(() => { window.reviewTracking.failure = "Allow location access in Settings to start Live Tracking."; });
  await start.click();
  const error = page.getByRole("alert").filter({ hasText: "Allow location access" });
  await reachable(page, error);
  await page.evaluate(() => { window.reviewTracking.failure = ""; });
  await start.click();
  await page.getByRole("button", { name: "Stop Live Tracking", exact: true }).waitFor();
  await page.evaluate(() => { window.reviewTracking.enabled = false; document.dispatchEvent(new Event("visibilitychange")); });
  await page.getByRole("button", { name: "Stop Live Tracking", exact: true }).click();
  await start.waitFor();
  await start.click();
  await reachable(page, page.getByRole("alert").filter({ hasText: "Enable Live Activities" }));
  console.log("PASS permission errors remain readable; stop works with Live Activities disabled");
} finally {
  await browser.close();
}
