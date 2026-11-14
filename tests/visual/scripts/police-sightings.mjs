// Packaged-app integration tests with an isolated native bridge and network.
// These fixtures cannot verify real background GPS on a physical iPhone.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(process.env.OOS_PLAYWRIGHT_MODULE ?? "@playwright/test");
const base = process.env.OOS_VISUAL_BASE_URL ?? "http://127.0.0.1:4183";
const out = process.env.OOS_REVIEW_OUTPUT ?? ".local/police-86";
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
        { name: "PushNotifications", methods: ["checkPermissions", "requestPermissions", "register", "unregister", "removeListener", "removeAllListeners"].map(name => ({ name, rtype: "promise" })).concat([{ name: "addListener", rtype: "callback" }]) },
        { name: "OOSRideRecorder", methods: ["start", "finish", "delete", "status"].map(name => ({ name, rtype: "promise" })) },
        { name: "OOSLiveTracking", methods: ["start", "stop", "status", "configure"].map(name => ({ name, rtype: "promise" })) },
        { name: "Preferences", methods: ["get", "set", "remove"].map(name => ({ name, rtype: "promise" })) },
        { name: "Geolocation", methods: ["getCurrentPosition", "clearWatch"].map(name => ({ name, rtype: "promise" })).concat([{ name: "watchPosition", rtype: "callback" }]) },
      ],
      nativePromise: async (plugin, method, args) => {
        if (plugin === "Preferences") {
          const key = "native-test:" + args.key;
          if (method === "set") sessionStorage.setItem(key, args.value);
          if (method === "remove") sessionStorage.removeItem(key);
          return { value: sessionStorage.getItem(key) };
        }
        if (plugin === "PushNotifications") return { receive: "denied" };
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
        if (_plugin === "PushNotifications") return "push-fixture";
        const id = `fixture-watch-${++location.started}`;
        location.watches.push(id);
        callback(position());
        return id;
      },
    };
    function assertId(actual, expected) { if (!expected || actual !== expected) throw new Error("Wrong ride ID"); }
  }, { seeded });
}

const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const failures = [];
page.on("pageerror", error => failures.push(error.message));
await fixture(page);
await page.addInitScript(() => {
  window.rideFixture.active = { id: "active-ride", startedAt: Date.now(), updatedAt: Date.now(), endedAt: null, distanceMeters: 0, topSpeedMps: 0, durationSeconds: 0, sampleCount: 0 };
  localStorage.setItem("oos_state_code", "WA");
  localStorage.setItem("oos_state_selection_source", "manual");
});
let reports = 0, withdrawn = 0, preparations = 0;
const votes = [];
let failVote = false, removeOnVote = false, preparationIsClear = false;
let sightings = [{ id: "wa", stateCode: "WA", lat: 47.501, lon: -122.26, reportCount: 4, lastReportedAt: Date.now() - 120000, expiresAt: Date.now() + 900000 }, { id: "ca", stateCode: "CA", lat: 47.5, lon: -122.26, reportCount: 10, lastReportedAt: Date.now(), expiresAt: Date.now() + 900000 }];
await page.route("**/oos-police*", async route => {
  const method = route.request().method();
  if (method === "POST") {
    const body = route.request().postDataJSON();
    if (body.action === "prepare") { preparations++; return route.fulfill({ json: preparationIsClear ? { status: "clear" } : { status: "nearby", sightingId: "11111111-1111-4111-8111-111111111111" } }); }
    if (failVote) return route.fulfill({ status: 503, json: { error: "reporting_unavailable" } });
    if (removeOnVote) sightings = [];
    reports++; votes.push(body);
    return route.fulfill({ json: { status: body.action === "report" ? "reported" : "voted", reportId: "11111111-1111-4111-8111-111111111111", retryAfterMs: 30000 } });
  }
  if (method === "DELETE") { withdrawn++; return route.fulfill({ json: { status: "withdrawn" } }); }
  return route.fulfill({ json: { sightings, serverTime: Date.now() } });
});
await page.route("**/mobile?kind=catalog", route => route.fulfill({ json: [] }));
await page.goto(base + "/ride");
await page.getByText("POLICE NEARBY", { exact: true }).waitFor();
const headline = page.locator(".ss-police-nearby");
const aircraftStatus = page.locator(".ss-ride-aircraft-status");
assert.equal(await aircraftStatus.textContent(), "Aircraft · CLEAR");
const fontSize = locator => locator.evaluate(element => parseFloat(getComputedStyle(element).fontSize));
for (const width of [320, 393]) {
  await page.setViewportSize({ width, height: 852 });
  const policeBox = await headline.boundingBox(), statusBox = await aircraftStatus.boundingBox();
  assert.ok(statusBox.y >= policeBox.y + policeBox.height, "Aircraft status belongs below the police headline");
  assert.ok(await fontSize(headline) > await fontSize(aircraftStatus));
  assert.ok(policeBox.x >= 0 && policeBox.x + policeBox.width <= width, "Headline fits narrow screens");
  assert.ok(policeBox.height < 1.5 * await fontSize(headline), "Short police headline stays on one line");
}
const button = page.getByRole("button", { name: "Report police sighting", exact: true });
const speed = page.locator('[aria-label^="Your speed:"]');
const a = await button.boundingBox(), b = await speed.boundingBox();
assert.equal(a.width, b.width); assert.equal(a.height, b.height); assert.equal(a.y, b.y); assert.ok(a.x > b.x);
await page.locator(".oos-police-marker").first().waitFor();
assert.equal(await page.locator(".oos-police-marker").count(), 1);
assert.equal(await page.locator(".oos-police-popup").count(), 0);
assert.equal((await page.locator(".oos-police-marker__badge").boundingBox()).width, 22);
await page.screenshot({ path: out + "/ride-police.png" });
await button.click();
await page.getByRole("dialog", { name: "Report police sightings" }).waitFor();
assert.equal(reports, 0);
assert.equal(preparations, 0);
await page.screenshot({ path: out + "/police-intro.png" });
await page.getByRole("button", { name: "Close", exact: true }).click();
await button.click();
await page.getByRole("dialog", { name: "Report police sightings" }).waitFor();
await page.getByRole("button", { name: "Got it", exact: true }).click();
assert.equal(await page.getByRole("dialog").count(), 0);
assert.equal(reports, 0);
assert.equal(preparations, 0);
await button.click();
await page.getByRole("dialog", { name: "Are police still here?" }).waitFor();
assert.equal(reports, 0);
for (const name of ["Still Here", "Not Seen"]) assert.ok((await page.getByRole("button", { name, exact: true }).boundingBox()).height >= 68);
await page.screenshot({ path: out + "/police-vote.png" });
await page.getByRole("button", { name: "Close", exact: true }).click();
assert.equal(reports, 0);
await button.click();
await page.getByRole("button", { name: "Still Here", exact: true }).click();
await page.getByRole("button", { name: "Police reported", exact: true }).waitFor();
assert.equal(votes[0].vote, "still_here");
assert.equal(votes[0].sightingId, "11111111-1111-4111-8111-111111111111");
assert.equal(reports, 1);
assert.equal(await page.getByText(/already reported/).count(), 0);
assert.equal(await page.getByRole("button", { name: "Police reported", exact: true }).isDisabled(), true);
assert.equal(await page.getByRole("button", { name: "Undo", exact: true }).count(), 0);
assert.equal(withdrawn, 0);
const alert = page.getByText("POLICE NEARBY", { exact: true });
const reportControl = page.getByRole("button", { name: /Report police sighting|Police reported/ });
for (const control of [alert, reportControl]) {
  const colors = await control.evaluate(element => {
    const animation = element.getAnimations().find(item => item.animationName === "oos-police-alert");
    if (!animation) throw new Error("Missing police alert animation");
    animation.pause();
    animation.currentTime = 0;
    const blue = getComputedStyle(element).color;
    const blueBorder = getComputedStyle(element).borderTopColor;
    animation.currentTime = 960;
    const transition = getComputedStyle(element).color;
    animation.currentTime = 1200;
    const red = getComputedStyle(element).color;
    const border = getComputedStyle(element).borderTopColor;
    animation.play();
    return { blue, transition, red, border, blueBorder };
  });
  assert.equal(colors.blue, "rgb(77, 163, 255)");
  assert.equal(colors.red, "rgb(255, 90, 101)");
  assert.notEqual(colors.transition, colors.blue);
  assert.notEqual(colors.transition, colors.red);
  if (control === reportControl) {
    assert.equal(colors.border, "rgba(255, 255, 255, 0.2)");
    assert.equal(colors.blueBorder, colors.border);
  }
}
await page.emulateMedia({ reducedMotion: "reduce" });
for (const control of [alert, reportControl]) {
  assert.equal(await control.evaluate(element => getComputedStyle(element).animationName), "none");
  assert.equal(await control.evaluate(element => getComputedStyle(element).color), "rgb(77, 163, 255)");
}
await page.emulateMedia({ reducedMotion: "no-preference" });
// Hide speedometer without hiding the report control.
await page.evaluate(() => { localStorage.setItem("oos_ride_speedometer_visible", "0"); window.dispatchEvent(new Event("oos-ride-speedometer-change")); });
await page.waitForTimeout(100);
assert.equal(await speed.count(), 0);
assert.equal(await page.getByRole("button", { name: /Report police sighting|Police reported/ }).count(), 1);
const navigate = path => page.evaluate(path => { history.pushState({}, "", path); window.dispatchEvent(new PopStateEvent("popstate")); }, path);
// Change state through the real selector, which updates durable native preferences.
await navigate("/settings/alerts");
await page.getByRole("combobox", { name: "State", exact: true }).selectOption("TX");
await page.waitForTimeout(200);
await navigate("/ride");
await page.waitForTimeout(500);
assert.equal(await page.getByText("POLICE NEARBY", { exact: true }).count(), 0);
assert.equal(await page.locator(".oos-police-marker").count(), 0);
assert.equal(await aircraftStatus.textContent(), "CLEAR");
assert.equal(await reportControl.evaluate(element => getComputedStyle(element).animationName), "none");
assert.equal(await reportControl.evaluate(element => getComputedStyle(element).color), "rgb(77, 163, 255)");
assert.ok(await fontSize(aircraftStatus) >= 56, "Regular aircraft status returns when police alert clears");
await navigate("/settings/alerts");
await page.getByRole("combobox", { name: "State", exact: true }).selectOption("WA");
await page.waitForTimeout(200);
await navigate("/map");
const marker = page.getByRole("button", { name: "Police sighting", exact: true });
await marker.waitFor();
assert.equal(await marker.count(), 1);
await marker.click();
await page.getByText("4 riders", { exact: true }).waitFor();
assert.equal(await page.locator(".oos-police-popup .maplibregl-popup-close-button").count(), 0);
await marker.click();
assert.equal(await page.locator(".oos-police-popup").count(), 0);
await marker.click();
await page.getByText("4 riders", { exact: true }).waitFor();
const markerEffects = await marker.evaluate(element => [element, ...element.querySelectorAll(".oos-police-marker__badge, svg")].map(node => {
  const style = getComputedStyle(node);
  return { shadow: style.boxShadow, filter: style.filter };
}));
assert.ok(markerEffects.every(effect => effect.shadow === "none" && effect.filter === "none"));
assert.equal(await marker.evaluate(element => getComputedStyle(element).webkitTapHighlightColor), "rgba(0, 0, 0, 0)");
assert.equal((await marker.boundingBox()).width, 44);
assert.equal((await marker.locator(".oos-police-marker__badge").boundingBox()).width, 28);
assert.ok((await page.locator(".oos-police-popup").boundingBox()).width <= 180);
await page.screenshot({ path: out + "/map-police-details.png" });
// Main-map markers and open details hide at overview zoom, including refreshes.
const canvas = page.locator(".maplibregl-canvas");
await canvas.focus();
for (let i = 0; i < 3; i++) { await canvas.press("Minus"); await page.waitForTimeout(400); }
// Sightings now remain visible at the wider view that previously hid them.
assert.equal(await marker.isVisible(), true);
for (let i = 0; i < 2; i++) { await canvas.press("Minus"); await page.waitForTimeout(400); }
await page.locator(".oos-police-marker").waitFor({ state: "hidden" });
assert.equal(await page.locator(".oos-police-popup").count(), 0);
await page.evaluate(() => window.dispatchEvent(new Event("oos-police-refresh")));
await page.waitForTimeout(1100);
assert.equal(await page.locator(".oos-police-marker").isVisible(), false);
for (let i = 0; i < 5; i++) { await canvas.press("Equal"); await page.waitForTimeout(400); }
await marker.waitFor({ state: "visible" });
assert.equal(await page.locator(".oos-police-popup").count(), 0);
await marker.click();
await page.getByText("4 riders", { exact: true }).waitFor();
// Expired markers and their open detail popup disappear without a navigation.
sightings = sightings.map(s => ({ ...s, expiresAt: Date.now() - 1 }));
await page.evaluate(() => window.dispatchEvent(new Event("oos-police-refresh")));
await page.waitForTimeout(1000);
assert.equal(await page.locator(".oos-police-marker").count(), 0);
assert.equal(await page.locator(".oos-police-popup").count(), 0);
// Acknowledgement survives reload and loss of the browser copy via native preferences.
sightings = [{ id: "wa", stateCode: "WA", lat: 47.501, lon: -122.26, reportCount: 1, lastReportedAt: Date.now(), expiresAt: Date.now() + 900000 }];
await navigate("/ride");
await page.evaluate(() => localStorage.removeItem("oos_police_intro_seen"));
await page.reload();
await headline.waitFor();
await reportControl.click();
await page.getByRole("dialog", { name: "Are police still here?" }).waitFor();
assert.equal(await page.getByRole("dialog", { name: "Report police sightings" }).count(), 0);
failVote = true;
await page.getByRole("button", { name: "Not Seen", exact: true }).click();
await page.getByRole("alert").filter({ hasText: "Couldn’t report" }).waitFor();
assert.equal(await page.getByRole("dialog").count(), 1);
assert.equal(await page.getByRole("button", { name: "Police reported", exact: true }).count(), 0);
failVote = false; removeOnVote = true;
await page.getByRole("button", { name: "Not Seen", exact: true }).click();
await page.getByRole("button", { name: "Police reported", exact: true }).waitFor();
assert.equal(votes.at(-1).vote, "not_seen");
await headline.waitFor({ state: "hidden" });
assert.equal(await page.getByRole("dialog").count(), 0);
// With no nearby sighting, the next intentional tap reports normally.
preparationIsClear = true; removeOnVote = false;
await page.reload();
await reportControl.waitFor();
await reportControl.click();
await page.getByRole("button", { name: "Police reported", exact: true }).waitFor();
assert.equal(votes.at(-1).action, "report");
assert.equal(await page.getByRole("dialog").count(), 0);
assert.deepEqual(failures, []);
console.log("PASS: matched button size/alignment; one selected-state marker; no ride details; report/checkmark/cooldown; no Undo; blue/red alert and reduced motion; state change; main-map details; zoom-out hides markers/details and zoom-in restores markers; ride map stays visible; expiry clears marker and popup.");
await browser.close();
