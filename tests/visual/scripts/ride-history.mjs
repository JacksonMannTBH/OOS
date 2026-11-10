// Packaged-app integration tests with an isolated native bridge and network.
// These fixtures cannot verify real background GPS on a physical iPhone.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(process.env.OOS_PLAYWRIGHT_MODULE ?? "@playwright/test");
const base = process.env.OOS_VISUAL_BASE_URL ?? "http://127.0.0.1:4183";
const out = process.env.OOS_REVIEW_OUTPUT ?? ".local/dev-rides-22";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function fixture(page, seeded = false, aircraftCount = 0) {
  page.setDefaultTimeout(15000);
  const aircraft = Array.from({ length: aircraftCount }, (_, i) => ({
    tail: `N${100 + i}TEST`, stateId: "washington", nickname: `Aircraft ${i + 1}`,
    role: i % 2 ? "fixed_wing" : "patrol", model: i % 2 ? "Cessna 182" : "Bell 407",
    airborne: true, observed: true, lat: 47.5 + i * .01, lon: -122.26,
    heading: 0, ground_speed_kt: 100, altitude_ft: 2000,
  }));
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith(base)) return route.continue();
    if (url.includes("style") && !url.includes("aircraft")) return route.fulfill({ json: { version: 8, sources: {}, layers: [] } });
    return route.fulfill({ json: { aircraft, fetched_at: Date.now(), source_ok: true } });
  });
  await page.addInitScript(({ seeded }) => {
    const ride = (id, days = 0) => ({ id, startedAt: Date.now() - days * 86400000 - 3600000,
      updatedAt: Date.now() - days * 86400000, endedAt: Date.now() - days * 86400000,
      distanceMeters: 19800, topSpeedMps: 22, durationSeconds: 3600, sampleCount: 3600,
      hasGaps: false, interrupted: false, route: [
        { latitude: 47.5, longitude: -122.26, startsSegment: true },
        { latitude: 47.502, longitude: -122.258, startsSegment: false },
        { latitude: 47.504, longitude: -122.258, startsSegment: false },
        { latitude: 47.506, longitude: -122.254, startsSegment: false },
      ] });
    const state = window.rideFixture = JSON.parse(sessionStorage.getItem("rideFixture") || "null") ?? {
      supported: true, consentRequired: true, active: null,
      rides: seeded ? [ride("one"), ride("two", 1), ride("three", 2)] : [],
      receivingLocation: true, message: "", starts: 0, finishes: 0, failure: "", live: false,
    };
    const save = () => sessionStorage.setItem("rideFixture", JSON.stringify(state));
    const location = window.locationFixture = { watches: [], started: 0 };
    const position = () => ({ timestamp: Date.now(), coords: { latitude: 47.5, longitude: -122.26,
      accuracy: 5, altitude: null, altitudeAccuracy: null, speed: 0, heading: 0 } });
    window.webkit = { messageHandlers: { bridge: {} } };
    window.Capacitor = {
      PluginHeaders: [
        { name: "OOSRideRecorder", methods: ["start", "finish", "delete", "status"].map(name => ({ name, rtype: "promise" })) },
        { name: "OOSLiveTracking", methods: ["start", "stop", "status", "configure"].map(name => ({ name, rtype: "promise" })) },
        { name: "Preferences", methods: ["get", "set", "remove"].map(name => ({ name, rtype: "promise" })) },
        { name: "Geolocation", methods: ["getCurrentPosition", "clearWatch"].map(name => ({ name, rtype: "promise" })).concat([{ name: "watchPosition", rtype: "callback" }]) },
      ],
      nativePromise: async (plugin, method, args) => {
        if (plugin === "Preferences") return { value: null };
        if (plugin === "Geolocation") {
          if (method === "clearWatch") location.watches = location.watches.filter(id => id !== args.id);
          return position();
        }
        if (plugin === "OOSLiveTracking") {
          if (method === "start") state.live = true;
          if (method === "stop") state.live = false;
          save();
          return { supported: true, enabled: true, active: state.live, message: "" };
        }
        if (plugin === "OOSRideRecorder") {
          if (state.failure && method !== "status") throw new Error(state.failure);
          if (method === "start") {
            if (!state.active) {
              if (state.consentRequired && !args.consent) throw new Error("Consent required");
              state.consentRequired = false;
              state.active = { ...ride("recorded"), endedAt: null };
              state.starts++;
            }
          }
          if (method === "finish") {
            assertId(args.id, state.active?.id);
            const result = { ...state.active, endedAt: Date.now() };
            state.rides = [result, ...state.rides].slice(0, 3);
            state.active = null;
            state.finishes++;
            save();
            return { ride: result };
          }
          if (method === "delete") state.rides = state.rides.filter(item => item.id !== args.id);
          save();
          return JSON.parse(JSON.stringify(state));
        }
        throw new Error(`Unexpected bridge call ${plugin}.${method}`);
      },
      nativeCallback: (_plugin, _method, _options, callback) => {
        const id = `fixture-watch-${++location.started}`;
        location.watches.push(id);
        callback(position());
        return id;
      },
    };
    function assertId(actual, expected) { if (!expected || actual !== expected) throw new Error("Wrong ride ID"); }
  }, { seeded });
}
async function visibleControl(locator) {
  await locator.scrollIntoViewIfNeeded();
  assert(await locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1 &&
      el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
  }), "Control must be visible and unobstructed");
}

try {
  // End Ride opens a query-selected summary while native status polls every 2s.
  // A slow style response must finish instead of restarting on every poll.
  const delayed = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await fixture(delayed, true);
  let styleRequests = 0;
  await delayed.route("https://tiles.openfreemap.org/styles/**", async route => {
    styleRequests++;
    await new Promise(resolve => setTimeout(resolve, 3500));
    await route.fulfill({ json: { version: 8, sources: {}, layers: [
      { id: "background", type: "background", paint: { "background-color": "#234567" } },
    ] } }).catch(() => {});
  });
  await delayed.goto(`${base}/home?rideSummary=one`);
  await delayed.locator(".ss-ride-route-map[data-ready=true]").waitFor();
  const originalCanvas = await delayed.locator(".ss-ride-route-map canvas").elementHandle();
  // Trigger another native status refresh after the map has finished loading.
  await delayed.evaluate(() => window.dispatchEvent(new Event("oos:ride-recording")));
  await delayed.waitForTimeout(2500);
  assert.equal(styleRequests, 1, "Status polling must not recreate the summary map");
  assert(await originalCanvas.evaluate(el => el.isConnected), "The loaded canvas must remain mounted");
  assert.equal(await delayed.locator(".ss-ride-route-map .maplibregl-ctrl-attrib-button").count(), 0);
  await delayed.locator(".ss-ride-route-marker-end").waitFor();
  await delayed.screenshot({ path: `${out}/slow-map-summary.png`, fullPage: true });
  await delayed.close();
  console.log("PASS slow map loads through repeated status updates, keeps its canvas, and has no information button");
  if (process.env.OOS_ROUTE_MAP_ONLY !== "1") {
  for (const [name, width, height, large = false] of [
    ["iphone", 390, 844], ["small-phone", 375, 667], ["ipad-portrait", 820, 1180],
    ["ipad-landscape", 1180, 820], ["phone-landscape", 667, 375], ["large-text", 390, 844, true],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await fixture(page, true);
    await page.goto(`${base}/home`);
    await page.locator(".ss-ride-history li").last().waitFor();
    if (large) await page.addStyleTag({ content: ".ss-home h1 { font-size: 72px !important; } .ss-ride-date, .ss-ride-row-stats, button, a { font-size: 24px !important; }" });
    assert.equal(await page.locator(".ss-ride-history li").count(), 3);
    assert.equal(await page.getByText("Recent rides", { exact: true }).count(), 0);
    const footer = page.locator(".ss-home-actions");
    const before = await footer.boundingBox();
    await page.locator(".ss-home-scroll").evaluate(el => { el.scrollTop = el.scrollHeight; });
    assert.deepEqual(await footer.boundingBox(), before, "Footer must stay fixed while history scrolls");
    await visibleControl(page.getByRole("button", { name: "Start Ride", exact: true }));
    await visibleControl(page.getByRole("link", { name: "View Map", exact: true }).last());
    await visibleControl(page.locator(".ss-ride-history button").last());
    await page.screenshot({ path: `${out}/${name}-history.png`, fullPage: true });
    await page.locator(".ss-ride-history button").last().click();
    const dialog = page.getByRole("dialog", { name: "Ride summary" });
    await dialog.waitFor();
    await dialog.getByRole("img", { name: "Recorded route with start and finish", exact: true }).waitFor();
    await dialog.locator(".ss-ride-route-map[data-ready=true]").waitFor();
    await page.screenshot({ path: `${out}/${name}-summary.png`, fullPage: true });
    await visibleControl(dialog.getByRole("button", { name: "Done" }));
    await dialog.getByRole("button", { name: "Done" }).click();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    console.log(`PASS ${name}: three date/stat rows, fixed bottom actions, scrollable history and summary`);
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(15000);
  await fixture(page);
  await page.goto(`${base}/home`);
  await page.getByRole("button", { name: "Start Ride", exact: true }).click();
  const consent = page.getByRole("dialog", { name: "Record your ride" });
  await consent.waitFor();
  assert.equal(await page.evaluate(() => window.rideFixture.starts), 0);
  await consent.getByRole("button", { name: "Cancel" }).click();
  assert.equal(await page.evaluate(() => window.rideFixture.active), null);
  await page.getByRole("button", { name: "Start Ride", exact: true }).click();
  await page.evaluate(() => { window.rideFixture.failure = "Allow Precise Location in Settings."; });
  await consent.getByRole("button", { name: "Start Ride", exact: true }).click();
  await consent.getByRole("alert").waitFor();
  assert.equal(await page.evaluate(() => window.rideFixture.active), null);
  await page.evaluate(() => { window.rideFixture.failure = ""; window.rideFixture.live = true; });
  await consent.getByRole("button", { name: "Start Ride", exact: true }).click();
  await page.waitForURL("**/ride");
  assert.equal(await page.getByRole("button", { name: "Stop Live Tracking", exact: true }).count(), 0);
  await page.getByRole("link", { name: "Home, keep ride active", exact: true }).click();
  await page.waitForURL("**/home");
  assert.equal(await page.evaluate(() => window.rideFixture.active.id), "recorded");
  assert.equal(await page.evaluate(() => window.rideFixture.finishes), 0);
  assert.equal(await page.evaluate(() => window.rideFixture.live), true);
  await page.getByRole("button", { name: "Stop Live Tracking", exact: true }).click();
  assert.equal(await page.evaluate(() => window.rideFixture.active.id), "recorded");
  await page.getByRole("button", { name: "Resume Ride", exact: true }).click();
  await page.waitForURL("**/ride");
  assert.equal(await page.evaluate(() => window.rideFixture.starts), 1);
  await page.evaluate(() => { window.rideFixture.failure = "Could not save the ride. Free up storage."; });
  const end = page.getByRole("button", { name: "End Ride and return to the main app" });
  await end.click();
  await page.getByRole("alert").filter({ hasText: "Free up storage" }).waitFor();
  assert.equal(await page.evaluate(() => window.rideFixture.finishes), 0);
  assert(page.url().endsWith("/ride"));
  await page.evaluate(() => { window.rideFixture.failure = ""; });
  await end.click();
  const summary = page.getByRole("dialog", { name: "Ride summary" });
  await summary.waitFor();
  await summary.getByText("49 mph", { exact: true }).waitFor();
  await summary.getByText("12.3 mi", { exact: true }).waitFor();
  await page.screenshot({ path: `${out}/end-ride-summary.png`, fullPage: true });
  await summary.getByRole("button", { name: "Done" }).click();
  await page.waitForURL("**/home");
  await page.reload();
  await page.locator(".ss-ride-history button").click();
  await summary.waitFor();
  assert.equal(await summary.getByRole("button").count(), 1);
  assert.equal(await summary.getByRole("button", { name: "Done" }).count(), 1);
  await summary.getByRole("button", { name: "Done" }).click();
  await page.goto(`${base}/ride`);
  await page.waitForURL("**/home");
  assert.equal(await page.getByRole("button", { name: "Start Recording", exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => window.rideFixture.active), null, "Opening a ride deep link must not silently record");
  await page.goto(`${base}/map`);
  await page.getByRole("button", { name: "Start Ride", exact: true }).click();
  await page.waitForURL("**/ride");
  assert.equal(await page.evaluate(() => window.rideFixture.starts), 2, "Map Start Ride must start the native recorder");
  await page.waitForFunction(() => window.locationFixture.watches.length > 0);
  await page.evaluate(() => {
    window.rideFixture.live = true;
    document.dispatchEvent(new Event("pause"));
  });
  await page.waitForFunction(() => window.locationFixture.watches.length === 0);
  assert.equal(await page.evaluate(() => Boolean(window.rideFixture.active)), true, "Backgrounding must retain an active ride");
  assert.equal(await page.evaluate(() => window.rideFixture.live), true, "Backgrounding must retain explicit Live Tracking");
  await page.evaluate(() => document.dispatchEvent(new Event("resume")));
  await page.waitForFunction(() => window.locationFixture.watches.length > 0);
  assert.equal(await page.getByText("Ride Mode", { exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Start Recording", exact: true }).count(), 0);
  await end.click();
  await summary.waitFor();
  console.log("PASS consent, denied permission, resume, independent Live Tracking, failed save, End summary, reload, direct-link recovery and map recording start");
  await page.close();
  for (const count of [0, 3, 12]) {
    const home = await browser.newPage({ viewport: { width: 375, height: 667 } });
    await fixture(home, true, count);
    await home.goto(`${base}/home`);
    await home.locator(".ss-ride-history").waitFor();
    if (count === 0) {
      await home.waitForFunction(() => window.locationFixture.watches.length > 0);
      await home.evaluate(() => document.dispatchEvent(new Event("pause")));
      await home.waitForFunction(() => window.locationFixture.watches.length === 0);
      assert.equal(await home.evaluate(() => window.rideFixture.active), null);
      assert.equal(await home.evaluate(() => window.rideFixture.live), false);
      await home.evaluate(() => document.dispatchEvent(new Event("resume")));
      await home.waitForFunction(() => window.locationFixture.watches.length > 0);
      console.log("PASS Home GPS pauses with both features off; active Ride and Live Tracking survive UI GPS suspension");
    }
    const section = home.getByRole("region", { name: "Active Air Support", exact: true });
    if (count === 0) {
      await home.getByRole("heading", { name: "No Eyes", exact: true }).waitFor();
      assert.equal(await section.count(), 0);
    } else {
      await section.waitFor();
      const links = section.getByRole("link");
      assert.equal(await links.count(), count);
      assert(await section.locator("h1").evaluate(el => el.scrollWidth <= el.clientWidth), "Heading fits one line");
      const scroller = section.locator("nav");
      assert.equal(await scroller.evaluate(el => el.scrollWidth > el.clientWidth + 1), count === 12);
      if (count === 3) {
        const bounds = await scroller.boundingBox();
        const first = await links.first().boundingBox();
        const last = await links.last().boundingBox();
        assert(Math.abs((first.x + last.x + last.width) / 2 - (bounds.x + bounds.width / 2)) < 2, "Short aircraft row is centered");
      }
      await visibleControl(links.last());
      await visibleControl(home.getByRole("button", { name: "Start Ride", exact: true }));
      await home.screenshot({ path: `${out}/home-${count}-active.png`, fullPage: true });
      const href = await links.last().getAttribute("href");
      await links.last().click();
      await home.waitForURL(url => url.pathname === "/map" && url.search === new URL(href, base).search);
    }
    console.log(`PASS ${count} active aircraft: visibility, single-line title, centering/scrolling and map link`);
    await home.close();
  }
  }
} finally { await browser.close(); }
