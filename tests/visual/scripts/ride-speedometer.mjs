// Exercise the packaged Ride screen with isolated GPS and recording fixtures.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fixture } from "../fixtures/ride.mjs";

const { chromium, webkit } = await import(process.env.OOS_PLAYWRIGHT_MODULE ?? "@playwright/test");
const base = process.env.OOS_VISUAL_BASE_URL ?? "http://127.0.0.1:4183";
const out = process.env.OOS_REVIEW_OUTPUT ?? ".local/ride-speedometer";
await mkdir(out, { recursive: true });
const results = [];

for (const [engine, type] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await type.launch({ headless: true });
  try {
    for (const [layout, width, height, aircraftCount] of [
      ["portrait", 393, 852, 0], ["small-portrait", 320, 568, 0],
      ["landscape", 852, 393, 1], ["small-landscape", 568, 320, 1],
    ]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await fixture(page, true, aircraftCount);
      await page.route(/\/mobile\?kind=catalog(?:&|$)/, route => route.fulfill({ json: [] }));
      await page.addInitScript(() => {
        window.speedFixtureMps = 65 / 2.236936;
        const original = window.Capacitor.nativeCallback;
        window.Capacitor.nativeCallback = (plugin, method, options, callback) =>
          original(plugin, method, options, result => {
            if (method === "watchPosition") (result.position ?? result).coords.speed = window.speedFixtureMps;
            callback(result);
          });
      });
      await page.goto(`${base}/home`);
      await page.getByRole("button", { name: "Start Ride", exact: true }).click().catch(async error => {
        await page.screenshot({ path: `${out}/${engine}-${layout}-failure.png` });
        await writeFile(`${out}/${engine}-${layout}-failure.json`, JSON.stringify({
          errors, url: page.url(), body: await page.locator("body").innerText(),
        }, null, 2));
        throw error;
      });
      await page.getByRole("dialog", { name: "Record your ride", exact: true })
        .getByRole("button", { name: "Start Ride", exact: true }).click();
      await page.waitForURL("**/ride");
      await page.locator(".ss-ride-map canvas").waitFor();
      await page.locator("[data-oos-map-transition]").waitFor({ state: "detached" });
      const canvas = await page.locator(".ss-ride-map canvas").elementHandle();
      const mapBounds = await page.locator(".ss-ride-map-link").boundingBox();
      const compact = page.getByRole("button", { name: /Expand speedometer/ });
      const expanded = page.getByRole("button", { name: /Shrink speedometer/ });
      await page.waitForFunction(() => document.querySelector(".ss-ride-speedometer__value")?.textContent.trim() === "65");
      if (layout === "portrait") await page.screenshot({ path: `${out}/${engine}-compact.png` });
      await compact.click();
      await expanded.waitFor();
      await page.waitForTimeout(250);
      assert(await expanded.evaluate(el => el === document.activeElement), "Focus follows the enlarged control");
      const bounds = await expanded.boundingBox();
      assert(Math.abs(bounds.width - mapBounds.width) < 2 && Math.abs(bounds.height - mapBounds.height) < 2,
        "The enlarged speedometer occupies the map circle");
      assert(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= height,
        "The whole enlarged speedometer fits on screen");
      assert.equal(await page.getByRole("link", { name: "Open map, keep ride active", exact: true }).isVisible(), false);
      assert.equal(await page.locator(".ss-ride-instruments .ss-ride-speedometer").count(), 0, "The compact readout moves into the circle");
      if (layout === "portrait" || layout === "landscape") await page.screenshot({ path: `${out}/${engine}-${layout}-expanded.png` });
      for (const [mph, display] of [[128, "128"], [0, "0"], [null, "—"]]) {
        await page.evaluate(value => {
          window.speedFixtureMps = value == null ? null : value / 2.236936;
          Object.values(window.locationFixture.callbacks).forEach(callback => callback());
        }, mph);
        await page.waitForFunction(expected => document.querySelector(".ss-ride-speedometer__value")?.textContent.trim() === expected, display);
        assert(await expanded.locator(".ss-ride-speedometer__value").evaluate(el => {
          const text = el.getBoundingClientRect(), dial = el.closest("button").getBoundingClientRect();
          return text.left >= dial.left && text.right <= dial.right;
        }), "Changing speed and unknown readings stay inside the circle");
      }
      await expanded.click();
      await compact.waitFor();
      await page.waitForFunction(() => document.activeElement?.matches(".ss-ride-instruments .ss-ride-speedometer"));
      assert(await canvas.evaluate(el => el.isConnected), "Expanding and shrinking keeps the original map");
      await compact.press("Enter");
      await expanded.waitFor();
      await expanded.press("Space");
      await compact.waitFor();
      await page.emulateMedia({ reducedMotion: "reduce" });
      await compact.click();
      assert.equal(await expanded.evaluate(el => getComputedStyle(el).animationName), "none");
      const expectedRim = aircraftCount ? "#f6c431" : "#39d98a";
      assert(await expanded.evaluate((el, color) => {
        const reference = document.createElement("span");
        reference.style.borderColor = `color-mix(in srgb, ${color} 78%, #f5f2e8)`;
        document.body.append(reference);
        const matches = getComputedStyle(el).borderColor === getComputedStyle(reference).borderColor;
        reference.remove();
        return matches;
      }, expectedRim), "The enlarged rim follows the aircraft status color");
      const swipe = async target => target.evaluate(element => {
        const touch = x => ({ identifier: 1, target: element, clientX: x, clientY: 180 });
        const send = (type, touches, changedTouches = []) => {
          const event = new Event(type, { bubbles: true, cancelable: true });
          Object.defineProperties(event, { touches: { value: touches }, changedTouches: { value: changedTouches } });
          element.dispatchEvent(event);
        };
        send("touchstart", [touch(240)]);
        send("touchmove", [touch(110)]);
        send("touchend", [], [touch(110)]);
      });
      await swipe(expanded);
      const meter = page.getByRole("region", { name: "G-force meter", exact: true });
      await meter.waitFor();
      assert.equal(await expanded.count(), 0, "Swiping the enlarged speedometer opens G-force");
      await swipe(meter);
      await page.getByRole("link", { name: "Open map, keep ride active", exact: true }).waitFor();
      await compact.click();
      await page.getByRole("button", { name: "Show ride stats", exact: true }).click();
      await page.getByRole("region", { name: "Current ride stats", exact: true }).waitFor();
      assert.equal(await expanded.count(), 0, "Stats remains usable from the enlarged readout");
      assert.equal(await page.evaluate(() => window.rideFixture.starts), 1);
      assert.equal(await page.evaluate(() => window.rideFixture.finishes), 0);
      assert(await page.evaluate(() => Boolean(window.rideFixture.active)), "The same ride keeps recording");
      assert.deepEqual(errors, []);
      results.push({ engine, layout, passed: true });
      await page.close();
      console.log(`PASS ${engine} ${layout}: tap/keyboard round trips, live speed, status rim, G-force swipe, retained map/ride, stats, and reduced motion`);
    }
  } finally { await browser.close(); }
}
await writeFile(`${out}/verification.json`, JSON.stringify(results, null, 2) + "\n");
