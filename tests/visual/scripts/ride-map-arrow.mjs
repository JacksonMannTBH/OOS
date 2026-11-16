// Keep the complete off-map aircraft indicator, including its glow, inside the
// landscape panel at every bearing. All location and aircraft data are fixtures.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fixture } from "../fixtures/ride.mjs";

const { chromium, webkit } = await import(process.env.OOS_PLAYWRIGHT_MODULE ?? "@playwright/test");
const base = process.env.OOS_VISUAL_BASE_URL ?? "http://127.0.0.1:4183";
const out = process.env.OOS_REVIEW_OUTPUT ?? ".local/ride-map-arrow";
await mkdir(out, { recursive: true });
const browser = await (process.env.OOS_WEBKIT === "1" ? webkit : chromium).launch({ headless: true });

try {
  for (const [name, width, height, safe] of [
    ["small-phone", 568, 320], ["phone", 667, 375], ["large-phone", 844, 390],
    ["notch-left", 852, 393, { left: 62, right: 0, top: 0, bottom: 21 }],
    ["notch-right", 852, 393, { left: 0, right: 62, top: 0, bottom: 21 }],
    ["tablet", 1024, 768],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const [aircraft] = await fixture(page, true, 1);
    if (safe) await page.route(`${base}/assets/**`, async route => {
      if (!/\.(css|js)$/.test(new URL(route.request().url()).pathname)) return route.fallback();
      const response = await route.fetch();
      const body = (await response.text()).replace(/env\(safe-area-inset-(left|right|top|bottom)(?:,\s*0px)?\)/g,
        (_match, edge) => `${safe[edge]}px`);
      return route.fulfill({ response, body });
    });
    await page.goto(`${base}/home`);
    await page.getByRole("button", { name: "Start Ride", exact: true }).click();
    await page.getByRole("dialog", { name: "Record your ride", exact: true })
      .getByRole("button", { name: "Start Ride", exact: true }).click();
    await page.waitForURL("**/ride");
    await page.locator(".ss-ride-map canvas").waitFor();
    await page.locator("[data-oos-map-transition]").waitFor({ state: "detached" });
    const originalCanvas = await page.locator(".ss-ride-map canvas").elementHandle();

    for (let bearing = 0; bearing < 360; bearing += 15) {
      const radians = bearing * Math.PI / 180;
      // Put the rider 20 nm from this aircraft so it stays beyond the Watch ring.
      await page.evaluate(({ lat, lon, radians }) => {
        window.locationFixture.latitude = lat - Math.cos(radians) / 3;
        window.locationFixture.longitude = lon - Math.sin(radians) / (3 * Math.cos(lat * Math.PI / 180));
        Object.values(window.locationFixture.callbacks).forEach(callback => callback());
      }, { lat: aircraft.lat, lon: aircraft.lon, radians });
      const arrow = page.locator(".ss-ride-off-map-arrow");
      await arrow.waitFor();
      // Wait for the updated rider point to reach the map instead of inspecting
      // the previous bearing during React's next render.
      await page.waitForFunction(expected => {
        const el = document.querySelector(".ss-ride-off-map-arrow");
        const actual = Number(el?.style.transform.match(/rotate\(([-\d.]+)deg\)/)?.[1]);
        return Math.abs(((actual - expected + 540) % 360) - 180) < 1;
      }, bearing);
      assert(await arrow.evaluate(el => {
        const r = el.getBoundingClientRect();
        const panel = el.closest(".ss-ride-panel").getBoundingClientRect();
        const glow = 16;
        return r.left - glow >= panel.left - 1 && r.right + glow <= panel.right + 1 &&
          r.top - glow >= panel.top - 1 && r.bottom + glow <= panel.bottom + 1 &&
          r.left - glow >= 0 && r.right + glow <= innerWidth &&
          r.top - glow >= 0 && r.bottom + glow <= innerHeight;
      }), `${name}: the entire arrow and glow fit at ${bearing} degrees`);
      if (bearing % 90 === 0) await page.screenshot({ path: `${out}/${name}-${bearing}.png` });
    }
    assert(await originalCanvas.evaluate(el => el.isConnected), "Updating the bearing keeps the same map");
    assert(await page.locator(".ss-ride-panel").evaluate(el => el.scrollTop === 0 && el.scrollHeight <= el.clientHeight + 1),
      "The map and its arrow need no scrolling");
    assert.equal(await page.evaluate(() => window.rideFixture.starts), 1);
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`PASS ${name}: arrow and glow fit at all 24 bearings without scrolling or restarting the ride`);
  }
} finally { await browser.close(); }
