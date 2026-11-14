// Packaged-app integration tests with an isolated native bridge and network.
// These fixtures cannot verify real background GPS on a physical iPhone.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium, webkit } = await import(process.env.OOS_PLAYWRIGHT_MODULE ?? "@playwright/test");
const base = process.env.OOS_VISUAL_BASE_URL ?? "http://127.0.0.1:4183";
const out = process.env.OOS_REVIEW_OUTPUT ?? ".local/dev-rides-22";
await mkdir(out, { recursive: true });
const browser = await (process.env.OOS_WEBKIT === "1" ? webkit : chromium).launch({ headless: true });

async function fixture(page, seeded = false, aircraftCount = 0) {
  page.setDefaultTimeout(30000);
  const aircraft = Array.from({ length: aircraftCount }, (_, i) => ({
    // Production state feeds use home_state_code; these new tails deliberately
    // do not exist in the bundled aircraft catalog.
    tail: `N${100 + i}TEST`, home_state_code: "WA", nickname: `Aircraft ${i + 1}`,
    role: i % 2 ? "fixed_wing" : "patrol", model: i % 2 ? "Cessna 182" : "Bell 407",
    airborne: true, observed: true, lat: 47.48 + i * .04, lon: i % 3 === 0 ? -122.33 : i % 3 === 1 ? -122.19 : -122.26,
    heading: 0, ground_speed_kt: 100, altitude_ft: 2000,
  }));
  await page.routeWebSocket("**/realtime/v1/**", socket => {
    socket.onMessage(raw => {
      const [join, ref, topic, event] = JSON.parse(String(raw));
      if (event === "phx_join" || event === "heartbeat") {
        socket.send(JSON.stringify([join, ref, topic, "phx_reply", { status: "ok", response: {} }]));
      }
    });
  });
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith(base) || url.startsWith("blob:") || url.startsWith("data:")) return route.continue();
    if (url.includes("/live?")) return route.fulfill({ json: {
      version: 1, state: "WA", revision: Date.now(),
      snapshot: { aircraft, fetched_at: Date.now(), source_ok: true, source: "adsbfi" }, trails: {},
    } });
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
    const compass = window.headingFixture = { heading: 0, callbacks: {} };
    const location = window.locationFixture = { watches: [], started: 0, callbacks: {} };
    const position = () => ({ timestamp: Date.now(), coords: { latitude: 47.5, longitude: -122.26,
      accuracy: 5, altitude: null, altitudeAccuracy: null, speed: 0, heading: 0 } });
    window.webkit = { messageHandlers: { bridge: {} } };
    window.Capacitor = {
      PluginHeaders: [
        { name: "OOSLocation", methods: ["clearWatch", "clearHeading"].map(name => ({ name, rtype: "promise" })).concat(["watchPosition", "watchHeading"].map(name => ({ name, rtype: "callback" }))) },
        { name: "OOSRideRecorder", methods: ["start", "finish", "delete", "status"].map(name => ({ name, rtype: "promise" })) },
        { name: "OOSLiveTracking", methods: ["start", "stop", "status", "configure"].map(name => ({ name, rtype: "promise" })) },
        { name: "Preferences", methods: ["get", "set", "remove"].map(name => ({ name, rtype: "promise" })) },
        { name: "Geolocation", methods: ["getCurrentPosition", "clearWatch"].map(name => ({ name, rtype: "promise" })).concat([{ name: "watchPosition", rtype: "callback" }]) },
      ],
      nativePromise: async (plugin, method, args) => {
        if (plugin === "OOSLocation") {
          if (method === "clearWatch") { location.watches = location.watches.filter(id => id !== args.id); delete location.callbacks[args.id]; }
          if (method === "clearHeading") delete compass.callbacks[args.id];
          return {};
        }
        if (plugin === "Preferences") return { value: null };
        if (plugin === "Geolocation") {
          if (method === "clearWatch") { location.watches = location.watches.filter(id => id !== args.id); delete location.callbacks[args.id]; }
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
      nativeCallback: (plugin, method, _options, callback) => {
        if (plugin === "OOSLocation" && method === "watchHeading") {
          const id = `compass-${Math.random()}`;
          compass.callbacks[id] = callback;
          callback({ heading: compass.heading });
          return id;
        }
        const id = `fixture-watch-${++location.started}`;
        location.watches.push(id);
        location.callbacks[id] = () => callback(plugin === "OOSLocation" ? { position: position() } : position());
        location.callbacks[id]();
        return id;
      },
    };
    function assertId(actual, expected) { if (!expected || actual !== expected) throw new Error("Wrong ride ID"); }
  }, { seeded });
  return aircraft;
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
  assert.equal(styleRequests, 2, "Home preview and summary each load once; status polling must not recreate them");
  assert(await originalCanvas.evaluate(el => el.isConnected), "The loaded canvas must remain mounted");
  assert.equal(await delayed.locator(".ss-ride-route-map .maplibregl-ctrl-attrib-button").count(), 0);
  await delayed.locator(".ss-ride-route-marker-end").waitFor();
  assert.equal(await delayed.getByRole("img", { name: "Ride start", exact: true }).locator("svg path").count(), 1);
  assert.match(await delayed.locator(".ss-ride-route-marker-end").evaluate(el => getComputedStyle(el).backgroundImage), /conic-gradient/);
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
    const preview = page.locator(".ss-home-map-preview");
    await preview.waitFor();
    if (large) await page.addStyleTag({ content: ".ss-home h1 { font-size: 72px !important; } .ss-ride-date, .ss-ride-row-stats, button, a { font-size: 24px !important; }" });
    assert.equal(await page.locator(".ss-ride-history").count(), 0, "Home keeps summaries behind Recent Rides");
    const footer = page.locator(".ss-home-actions");
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await preview.locator(".maplibregl-ctrl-attrib").count(), 0, "Preview has no information button or box");
    assert(await page.getByRole("button", { name: "Start Ride", exact: true }).evaluate(el => getComputedStyle(el).fontFamily.includes("Manrope")), "Home controls use Manrope");
    assert(await page.evaluate(() => [...document.fonts].some(face => face.family === "Manrope" && face.status === "loaded")), "Bundled Manrope font loads");
    const startBounds = await page.getByRole("button", { name: "Start Ride", exact: true }).boundingBox();
    const recentBounds = await footer.getByRole("button", { name: "Recent Rides" }).boundingBox();
    assert.equal(startBounds.y, recentBounds.y, "Start and Recent Rides share a row");
    assert(recentBounds.x < startBounds.x, "Recent Rides is left of Start Ride");
    assert.equal(startBounds.height, recentBounds.height, "Home controls share the original action-area height");
    assert.equal((await preview.boundingBox()).height, 276.5, "Map gains the height released by the shorter home buttons");
    await preview.locator(".maplibregl-marker").waitFor();
    await page.evaluate(() => {
      window.headingFixture.heading = 90;
      for (const callback of Object.values(window.headingFixture.callbacks)) callback({ heading: 90 });
    });
    await page.waitForFunction(() => document.querySelector(".ss-home-map-preview .maplibregl-marker")?.style.transform.includes("rotateZ(90deg)"));
    if (name === "iphone") {
      const canvas = preview.locator("canvas");
      const marker = preview.locator(".maplibregl-marker");
      const initialMarker = await marker.evaluate(el => el.style.transform);
      const initialMarkerBounds = await marker.boundingBox();
      await canvas.focus();
      await canvas.press("ArrowRight");
      await page.waitForTimeout(500);
      assert.notEqual(await marker.evaluate(el => el.style.transform), initialMarker, "Preview pans without leaving Home");
      const pannedMarker = await marker.evaluate(el => el.style.transform);
      await canvas.press("Equal");
      await page.waitForTimeout(500);
      const zoomedMarker = await marker.evaluate(el => el.style.transform);
      assert.notEqual(zoomedMarker, pannedMarker, "Preview supports zooming");
      await page.evaluate(() => { for (const emit of Object.values(window.locationFixture.callbacks)) emit(); });
      await page.waitForTimeout(300);
      assert.equal(await marker.evaluate(el => el.style.transform), zoomedMarker, "GPS updates retain the rider's chosen map view");
      assert.equal(new URL(page.url()).pathname, "/home");
      await preview.getByRole("button", { name: "Center preview on your location" }).click();
      await page.waitForTimeout(400);
      const centeredMarkerBounds = await marker.boundingBox();
      assert(Math.abs(centeredMarkerBounds.x - initialMarkerBounds.x) <= 2 && Math.abs(centeredMarkerBounds.y - initialMarkerBounds.y) <= 2, "Recenter restores the initial view");
    }
    const before = await footer.boundingBox();
    await page.locator(".ss-home-scroll").evaluate(el => { el.scrollTop = el.scrollHeight; });
    assert.deepEqual(await footer.boundingBox(), before, "Footer stays fixed while the home content scrolls");
    await visibleControl(page.getByRole("button", { name: "Start Ride", exact: true }));
    await visibleControl(page.getByRole("button", { name: "Recent Rides", exact: true }));
    await preview.getByRole("link", { name: "View Map", exact: true }).click({ trial: true });
    await page.screenshot({ path: `${out}/${name}-home.png`, fullPage: true });
    await page.getByRole("button", { name: "Recent Rides", exact: true }).click();
    const history = page.getByRole("dialog", { name: "Recent Rides", exact: true });
    await history.waitFor();
    assert.equal(await history.evaluate(el => getComputedStyle(el).borderTopWidth), "0px", "Recent Rides has no saffron border");
    assert.equal(await history.locator(".ss-ride-history li").count(), 3);
    await visibleControl(history.locator(".ss-ride-history button").last());
    await page.screenshot({ path: `${out}/${name}-history.png`, fullPage: true });
    await history.locator(".ss-ride-history button").last().click();
    const dialog = page.getByRole("dialog", { name: "Ride summary" });
    await dialog.waitFor();
    await dialog.getByRole("img", { name: "Recorded route with start and finish", exact: true }).waitFor();
    await dialog.locator(".ss-ride-route-map[data-ready=true]").waitFor();
    await page.screenshot({ path: `${out}/${name}-summary.png`, fullPage: true });
    await visibleControl(dialog.getByRole("button", { name: "Done" }));
    await dialog.getByRole("button", { name: "Done" }).click();
    await history.waitFor();
    await history.getByRole("button", { name: "Done", exact: true }).click();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    console.log(`PASS ${name}: large home map, Recent Rides, three summaries, summary navigation and fixed actions`);
    await page.close();
  }
  const livePreview = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const liveAircraft = await fixture(livePreview);
  await livePreview.goto(`${base}/home`);
  const liveMap = livePreview.locator(".ss-home-map-preview");
  await liveMap.getByRole("button", { name: "Center preview on your location" }).waitFor();
  const originalCamera = await liveMap.locator("[data-oos-map-camera]").getAttribute("data-oos-map-camera");
  liveAircraft.push({ tail: "NNEWTEST", home_state_code: "WA", role: "fixed_wing", model: "Cessna 182",
    airborne: true, observed: true, lat: 47.52, lon: -122.19, heading: 45 });
  const refreshPreview = () => livePreview.evaluate(() => {
    document.dispatchEvent(new Event("pause"));
    document.dispatchEvent(new Event("resume"));
  });
  await refreshPreview();
  const liveMarker = liveMap.locator(".ss-home-map-aircraft");
  await liveMarker.waitFor();
  const originalPosition = await liveMarker.evaluate(el => el.style.transform);
  liveAircraft[0].lat += .03;
  liveAircraft[0].heading = 120;
  await refreshPreview();
  await livePreview.waitForFunction(original => document.querySelector(".ss-home-map-aircraft")?.style.transform !== original, originalPosition);
  await livePreview.waitForFunction(() => document.querySelector(".ss-home-map-aircraft .ss-cessna-icon")?.style.transform === "rotate(120deg)");
  assert.equal(await liveMap.locator("[data-oos-map-camera]").getAttribute("data-oos-map-camera"), originalCamera, "Live aircraft updates retain the chosen preview camera");
  liveAircraft[0].airborne = false;
  await refreshPreview();
  await liveMarker.waitFor({ state: "detached" });
  await livePreview.close();
  console.log("PASS preview shows newly arriving aircraft, updates position and heading, and removes landed flights without moving the camera");
  for (const mode of ["animate", "reduce", "unsupported"]) {
    const transitionPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await fixture(transitionPage, true);
    await transitionPage.route("https://tiles.openfreemap.org/styles/**", route => route.fulfill({ json: {
      version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": "#234567" } }],
    } }));
    if (mode === "reduce") await transitionPage.emulateMedia({ reducedMotion: "reduce" });
    await transitionPage.goto(`${base}/home`);
    await transitionPage.locator(".ss-home-map-preview canvas").waitFor();
    await transitionPage.waitForFunction(() => {
      const source = document.querySelector(".ss-home-map-preview canvas");
      const copy = document.createElement("canvas");
      copy.width = source.width; copy.height = source.height;
      const context = copy.getContext("2d"); context.drawImage(source, 0, 0);
      return context.getImageData(10, 10, 1, 1).data[3] > 0;
    });
    const previewCanvas = transitionPage.locator(".ss-home-map-preview canvas");
    await previewCanvas.focus();
    await previewCanvas.press("ArrowRight");
    await previewCanvas.press("Equal");
    await transitionPage.waitForTimeout(500);
    const openingCamera = await transitionPage.locator(".ss-home-map-preview [data-oos-map-camera]").evaluate(el => JSON.parse(el.dataset.oosMapCamera));
    await transitionPage.evaluate(mode => {
      window.mapTransitionLive = false;
      window.mapTransitionCount = 0;
      window.mapTransitionCaptured = false;
      if (mode === "unsupported") document.startViewTransition = undefined;
      else document.startViewTransition = () => { throw new Error("Browser page transitions must not be used"); };
      const observer = new MutationObserver(records => {
        for (const record of records) {
          if (record.type === "attributes" && record.target instanceof HTMLElement && record.target.dataset.oosMapReveal === "live") window.mapTransitionLive = true;
          for (const node of record.addedNodes) {
          if (node instanceof HTMLElement && node.hasAttribute("data-oos-map-transition")) {
            window.mapTransitionCount++;
            const canvases = [...node.querySelectorAll("canvas")];
            window.mapTransitionCaptured = canvases.length >= 1
              && canvases.every(canvas => canvas.getContext("2d").getImageData(10, 10, 1, 1).data[3] > 0);
          }
        }}
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-oos-map-reveal"] });
    }, mode);
    await transitionPage.locator(".ss-home-map-preview").getByRole("link", { name: "View Map", exact: true }).click();
    await transitionPage.waitForURL("**/map");
    await transitionPage.locator(".ss-map-screen canvas").waitFor();
    if (mode !== "reduce") {
      await transitionPage.waitForFunction(() => window.mapTransitionCount === 1);
      assert.equal(await transitionPage.evaluate(() => window.mapTransitionCaptured), true, "Animation keeps the Home snapshot while the live map is prepared");
      await transitionPage.locator("[data-oos-map-transition]").waitFor({ state: "detached" });
      assert.equal(await transitionPage.evaluate(() => window.mapTransitionLive), true, "Expansion reveals the live map without enlarging a snapshot");
      await transitionPage.screenshot({ path: `${out}/map-transition-${mode}-finished.png` });
    } else {
      assert.equal(await transitionPage.evaluate(() => window.mapTransitionCount), 0, "Reduced motion opens the map immediately");
    }
    const openedCamera = await transitionPage.locator(".ss-map-screen [data-oos-map-camera]").evaluate(el => JSON.parse(el.dataset.oosMapCamera));
    assert(Math.abs(openedCamera.zoom - openingCamera.zoom) < 0.000001, "Opening retains the preview zoom");
    assert(openedCamera.center.every((value, index) => Math.abs(value - openingCamera.center[index]) < 0.000001), "Opening retains the preview center instead of jumping to the rider");
    const fullCanvas = transitionPage.locator(".ss-map-screen canvas");
    await fullCanvas.focus();
    await fullCanvas.press("ArrowRight");
    await fullCanvas.press("Equal");
    await transitionPage.waitForTimeout(500);
    const returnCamera = await transitionPage.locator(".ss-map-screen [data-oos-map-camera]").evaluate(el => JSON.parse(el.dataset.oosMapCamera));
    await transitionPage.evaluate(() => { window.mapTransitionCount = 0; window.mapTransitionLive = false; });
    await transitionPage.locator(".ss-map-screen").getByRole("link", { name: "Home", exact: true }).nth(mode === "unsupported" ? 1 : 0).click();
    await transitionPage.waitForURL("**/home");
    await transitionPage.locator("[data-oos-map-transition]").waitFor({ state: "detached" });
    assert.equal(await transitionPage.evaluate(() => window.mapTransitionCount), mode === "reduce" ? 0 : 1);
    assert.equal(await transitionPage.evaluate(() => window.mapTransitionLive), mode !== "reduce", "Home reveals as the full map contracts");
    if (mode !== "reduce") assert.equal(await transitionPage.evaluate(() => window.mapTransitionCaptured), true, "The contracting full map retains its rendered pixels");
    const returnedCamera = await transitionPage.locator(".ss-home-map-preview [data-oos-map-camera]").evaluate(el => JSON.parse(el.dataset.oosMapCamera));
    for (const key of ["zoom", "bearing", "pitch"]) assert(Math.abs(returnedCamera[key] - returnCamera[key]) < 0.000001, `Returning retains ${key}`);
    assert(returnedCamera.center.every((value, index) => Math.abs(value - returnCamera.center[index]) < 0.000001), "Returning retains the map center");
    await transitionPage.evaluate(() => { for (const emit of Object.values(window.locationFixture.callbacks)) emit(); });
    await transitionPage.waitForTimeout(100);
    assert.equal(await transitionPage.locator(".ss-home-map-preview [data-oos-map-camera]").getAttribute("data-oos-map-camera"), JSON.stringify(returnedCamera), "GPS updates do not undo the returned camera");
    assert.equal(await transitionPage.locator(".ss-home-map-preview").evaluate(el => getComputedStyle(el).transform), "none");
    await transitionPage.screenshot({ path: `${out}/map-return-${mode}-finished.png` });
    await transitionPage.close();
    console.log(`PASS Home to map and return: ${mode}, live reveal and camera continuity`);
  }
  for (const mode of ["back", "slow", "cancel"]) {
    const returnPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await fixture(returnPage, true);
    const style = { version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": "#234567" } }] };
    await returnPage.route("https://tiles.openfreemap.org/styles/**", route => route.fulfill({ json: style }));
    await returnPage.goto(`${base}/home`);
    await returnPage.locator(".ss-home-map-preview").getByRole("button", { name: "Center preview on your location" }).waitFor();
    await returnPage.locator(".ss-home-map-preview").getByRole("link", { name: "View Map", exact: true }).click();
    await returnPage.waitForURL("**/map");
    await returnPage.locator("[data-oos-map-transition]").waitFor({ state: "detached" });
    await returnPage.evaluate(() => {
      window.returnTransitions = 0; window.returnLive = false;
      new MutationObserver(records => {
        for (const record of records) {
          if (record.type === "attributes" && record.target instanceof HTMLElement && record.target.matches(".ss-home[data-oos-map-reveal=live]")) window.returnLive = true;
          for (const node of record.addedNodes) if (node instanceof HTMLElement && node.dataset.oosScreenTransition === "home") window.returnTransitions++;
        }
      }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-oos-map-reveal"] });
    });
    if (mode !== "back") await returnPage.route("https://tiles.openfreemap.org/styles/**", async route => {
      await new Promise(resolve => setTimeout(resolve, 3000));
      await route.fulfill({ json: style }).catch(() => {});
    });
    if (mode === "back") await returnPage.goBack();
    else await returnPage.locator(".ss-map-screen").getByRole("link", { name: "Home", exact: true }).first().click();
    await returnPage.waitForURL("**/home");
    if (mode === "cancel") { await returnPage.goBack(); await returnPage.waitForURL("**/map"); }
    await returnPage.locator("[data-oos-map-transition]").waitFor({ state: "detached" });
    assert.equal(await returnPage.evaluate(() => window.returnTransitions), 1);
    assert.equal(await returnPage.evaluate(() => window.returnLive), mode === "back");
    assert.equal(await returnPage.evaluate(() => window.rideFixture.starts), 0);
    assert.equal(await returnPage.evaluate(() => window.rideFixture.finishes), 0);
    await returnPage.close();
    console.log(`PASS Map return: ${mode}, transition cleanup and unchanged recording`);
  }
  for (const mode of ["animate", "reduce", "slow", "cancel"]) {
    const ridePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await fixture(ridePage, true);
    const style = { version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": "#234567" } }] };
    await ridePage.route("https://tiles.openfreemap.org/styles/**", route => route.fulfill({ json: style }));
    if (mode === "reduce") await ridePage.emulateMedia({ reducedMotion: "reduce" });
    await ridePage.goto(`${base}/home`);
    await ridePage.locator(".ss-home-map-preview").getByRole("button", { name: "Center preview on your location" }).waitFor();
    if (mode === "slow" || mode === "cancel") await ridePage.route("https://tiles.openfreemap.org/styles/**", async route => {
      await new Promise(resolve => setTimeout(resolve, 3000));
      await route.fulfill({ json: style }).catch(() => {});
    });
    await ridePage.evaluate(() => {
      window.rideTransitionCount = 0;
      window.rideTransitionLive = false;
      document.startViewTransition = () => { throw new Error("Ride transitions must work without browser page transitions"); };
      new MutationObserver(records => {
        for (const record of records) {
          if (record.type === "attributes" && record.target instanceof HTMLElement && record.target.matches(".ss-ride-screen[data-oos-map-reveal=live]")) window.rideTransitionLive = true;
          for (const node of record.addedNodes) if (node instanceof HTMLElement && node.dataset.oosScreenTransition === "ride") window.rideTransitionCount++;
        }
      }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-oos-map-reveal"] });
    });
    await ridePage.getByRole("button", { name: "Start Ride", exact: true }).click();
    const consent = ridePage.getByRole("dialog", { name: "Record your ride" });
    await consent.waitFor();
    assert.equal(await ridePage.evaluate(() => window.rideTransitionCount), 0, "Consent remains visible until the ride is started");
    await consent.getByRole("button", { name: "Start Ride", exact: true }).click();
    await ridePage.waitForURL("**/ride");
    if (mode === "cancel") {
      await ridePage.goBack();
      await ridePage.waitForURL("**/home");
      await ridePage.locator("[data-oos-map-transition]").waitFor({ state: "detached" });
    } else {
      await ridePage.locator("[data-oos-map-transition]").waitFor({ state: "detached" });
      assert.equal(await ridePage.evaluate(() => window.rideTransitionCount), mode === "reduce" ? 0 : 1);
      assert.equal(await ridePage.evaluate(() => window.rideTransitionLive), mode === "animate", "Ready maps animate; slow maps safely fade; reduced motion opens immediately");
      assert.equal(await ridePage.locator(".ss-ride-screen").evaluate(el => el.inert), false);
      assert.equal(await ridePage.locator(".ss-ride-screen").evaluate(el => el.style.clipPath), "");
      assert.equal(await ridePage.locator(".ss-ride-map-link").evaluate(el => el.style.transform), "");
      assert.equal(await ridePage.locator(".ss-ride-map-link").evaluate(el => getComputedStyle(el).transform), "none", "Finishing the reveal does not replay the link's press transition");
      assert.equal(await ridePage.locator(".ss-ride-screen header").evaluate(el => el.style.opacity), "");
      await ridePage.screenshot({ path: `${out}/ride-transition-${mode}-finished.png` });
      if (mode === "animate") {
        await ridePage.getByRole("link", { name: "Open map, keep ride active", exact: true }).click();
        await ridePage.waitForURL("**/map");
        await ridePage.locator("[data-oos-map-transition]").waitFor({ state: "detached" });
        await ridePage.getByRole("button", { name: "Resume Ride", exact: true }).click();
        await ridePage.waitForURL("**/ride");
        await ridePage.locator("[data-oos-map-transition]").waitFor({ state: "detached" });
        assert.equal(await ridePage.evaluate(() => window.rideTransitionCount), 2, "Resuming from the full map also animates");
      }
    }
    assert.equal(await ridePage.evaluate(() => window.rideFixture.starts), 1, "Animations never start a second recording");
    assert.equal(await ridePage.evaluate(() => window.rideFixture.finishes), 0, "Navigation keeps the ride recording");
    assert.equal(await ridePage.evaluate(() => window.rideFixture.active?.id), "recorded");
    await ridePage.close();
    console.log(`PASS Ride opening: ${mode}, recording continuity and transition cleanup`);
  }
  for (const mode of ["animate", "reduce", "back", "slow", "cancel"]) {
    const homePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await fixture(homePage, true);
    const style = { version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": "#234567" } }] };
    await homePage.route("https://tiles.openfreemap.org/styles/**", route => route.fulfill({ json: style }));
    await homePage.goto(`${base}/home`);
    await homePage.getByRole("button", { name: "Start Ride", exact: true }).click();
    await homePage.getByRole("dialog", { name: "Record your ride" }).getByRole("button", { name: "Start Ride", exact: true }).click();
    await homePage.waitForURL("**/ride");
    await homePage.locator("[data-oos-map-transition]").waitFor({ state: "detached" });
    if (mode === "reduce") await homePage.emulateMedia({ reducedMotion: "reduce" });
    if (mode === "slow" || mode === "cancel") await homePage.route("https://tiles.openfreemap.org/styles/**", async route => {
      await new Promise(resolve => setTimeout(resolve, 3000));
      await route.fulfill({ json: style }).catch(() => {});
    });
    await homePage.evaluate(() => {
      window.rideHomeCount = 0; window.rideHomeLive = false;
      new MutationObserver(records => {
        for (const record of records) {
          if (record.type === "attributes" && record.target instanceof HTMLElement && record.target.matches(".ss-home[data-oos-map-reveal=live]")) window.rideHomeLive = true;
          for (const node of record.addedNodes) if (node instanceof HTMLElement && node.dataset.oosScreenTransition === "home") window.rideHomeCount++;
        }
      }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-oos-map-reveal"] });
    });
    if (mode === "back") await homePage.goBack();
    else await homePage.getByRole("link", { name: "Home, keep ride active", exact: true }).click();
    await homePage.waitForURL("**/home");
    if (mode === "cancel") { await homePage.goBack(); await homePage.waitForURL("**/ride"); }
    await homePage.locator("[data-oos-map-transition]").waitFor({ state: "detached" });
    assert.equal(await homePage.evaluate(() => window.rideHomeCount), mode === "reduce" ? 0 : 1);
    assert.equal(await homePage.evaluate(() => window.rideHomeLive), mode === "animate" || mode === "back");
    assert.equal(await homePage.evaluate(() => window.rideFixture.active?.id), "recorded");
    assert.equal(await homePage.evaluate(() => window.rideFixture.finishes), 0, "Returning Home keeps the ride recording");
    assert.equal(await homePage.evaluate(() => window.rideFixture.live), true, "Returning Home keeps Live Tracking active");
    assert.equal(await homePage.getByRole("dialog", { name: "Ride summary" }).count(), 0, "Returning Home never opens an end-of-ride summary");
    if (mode !== "cancel") {
      await homePage.getByRole("button", { name: "Resume Ride", exact: true }).waitFor();
      assert.equal(await homePage.locator(".ss-home").evaluate(el => el.inert), false);
      assert.equal(await homePage.locator(".ss-home").evaluate(el => el.style.clipPath), "");
      await homePage.screenshot({ path: `${out}/ride-home-${mode}.png` });
    }
    if (mode === "animate") {
      await homePage.getByRole("button", { name: "Resume Ride", exact: true }).click();
      await homePage.waitForURL("**/ride");
      await homePage.locator("[data-oos-map-transition]").waitFor({ state: "detached" });
    }
    assert.equal(await homePage.evaluate(() => window.rideFixture.starts), 1, "Resuming keeps the same recording");
    await homePage.close();
    console.log(`PASS Ride to Home: ${mode}, animation cleanup and active recording`);
  }
  for (const mode of ["animate", "reduce", "slow", "cancel"]) {
    const endPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await fixture(endPage, true);
    const style = { version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": "#234567" } }] };
    await endPage.route("https://tiles.openfreemap.org/styles/**", route => route.fulfill({ json: style }));
    await endPage.goto(`${base}/home`);
    await endPage.getByRole("button", { name: "Start Ride", exact: true }).click();
    await endPage.getByRole("dialog", { name: "Record your ride" }).getByRole("button", { name: "Start Ride", exact: true }).click();
    await endPage.waitForURL("**/ride");
    await endPage.locator("[data-oos-map-transition]").waitFor({ state: "detached" });
    assert.equal(await endPage.locator(".ss-map-heading-cone svg").getAttribute("width"), "80", "The original direction cone is restored");
    if (mode === "reduce") await endPage.emulateMedia({ reducedMotion: "reduce" });
    if (mode === "slow" || mode === "cancel") await endPage.route("https://tiles.openfreemap.org/styles/**", async route => {
      await new Promise(resolve => setTimeout(resolve, 3000));
      await route.fulfill({ json: style }).catch(() => {});
    });
    await endPage.evaluate(() => {
      window.endTransitionCount = 0;
      window.endTransitionLive = false;
      window.summaryDuringExit = false;
      new MutationObserver(records => {
        for (const record of records) {
          if (record.type === "attributes" && record.target instanceof HTMLElement && record.target.matches(".ss-home[data-oos-map-reveal=live]")) window.endTransitionLive = true;
          for (const node of record.addedNodes) if (node instanceof HTMLElement && node.dataset.oosScreenTransition === "home") window.endTransitionCount++;
        }
        if (document.querySelector("dialog.ss-ride-summary[open]") && document.querySelector("[data-oos-screen-transition=home]")) window.summaryDuringExit = true;
      }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-oos-map-reveal", "open"] });
    });
    const end = endPage.getByRole("button", { name: "End Ride and return to the main app" });
    if (mode === "animate") {
      await endPage.evaluate(() => { window.rideFixture.failure = "Could not save the ride."; });
      await end.click();
      await endPage.getByRole("alert").filter({ hasText: "Could not save" }).waitFor();
      assert.equal(await endPage.evaluate(() => window.endTransitionCount), 0, "A failed save keeps the rider on the ride screen");
      assert.equal(await endPage.evaluate(() => window.rideFixture.finishes), 0);
      await endPage.evaluate(() => { window.rideFixture.failure = ""; });
    }
    await end.click();
    await endPage.waitForURL(url => url.pathname === "/home" && url.searchParams.get("rideSummary") === "recorded");
    const summary = endPage.getByRole("dialog", { name: "Ride summary" });
    if (mode === "cancel") {
      await endPage.goBack();
      await endPage.waitForURL(url => url.pathname === "/home" && !url.search);
      await endPage.locator("[data-oos-map-transition]").waitFor({ state: "detached" });
      await endPage.getByRole("button", { name: "Recent Rides", exact: true }).click();
      await endPage.getByRole("dialog", { name: "Recent Rides" }).locator(".ss-ride-history button").first().click();
    }
    await summary.waitFor();
    assert.equal(await endPage.locator("[data-oos-map-transition]").count(), 0, "The summary opens after transition cleanup");
    assert.equal(await endPage.evaluate(() => window.summaryDuringExit), false, "The summary never covers the exit animation");
    assert.equal(await endPage.evaluate(() => window.endTransitionCount), mode === "reduce" ? 0 : 1);
    assert.equal(await endPage.evaluate(() => window.endTransitionLive), mode === "animate");
    assert.equal(await endPage.evaluate(() => window.rideFixture.finishes), 1, "End Ride saves exactly once");
    assert.equal(await endPage.evaluate(() => window.rideFixture.active), null);
    await summary.getByText("12.3 mi", { exact: true }).waitFor();
    await endPage.screenshot({ path: `${out}/end-transition-${mode}-summary.png` });
    await summary.getByRole("button", { name: "Done", exact: true }).click();
    assert.equal(await endPage.locator(".ss-home").evaluate(el => el.inert), false);
    assert.equal(await endPage.locator(".ss-home").evaluate(el => el.style.clipPath), "");
    assert.equal(await endPage.locator(".ss-home-map-preview").evaluate(el => getComputedStyle(el).transform), "none");
    await endPage.close();
    console.log(`PASS End Ride: ${mode}, saved summary sequencing and cleanup`);
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(15000);
  await fixture(page);
  await page.goto(`${base}/home`);
  await page.getByRole("button", { name: "Recent Rides", exact: true }).click();
  await page.getByText("No rides yet. Start a ride to save your first summary.", { exact: true }).waitFor();
  await page.getByRole("dialog", { name: "Recent Rides", exact: true }).getByRole("button", { name: "Done", exact: true }).click();
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
  await page.getByRole("link", { name: "Open map, keep ride active", exact: true }).click();
  await page.waitForURL("**/map");
  assert.equal(await page.evaluate(() => window.rideFixture.active.id), "recorded");
  assert.equal(await page.evaluate(() => window.rideFixture.finishes), 0);
  await page.getByRole("button", { name: "Resume Ride", exact: true }).click();
  await page.waitForURL("**/ride");
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
  await page.getByRole("button", { name: "Recent Rides", exact: true }).click();
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
    await home.locator(".ss-home-map-preview").waitFor();
    if (count === 0) {
      await home.getByRole("button", { name: "Recent Rides", exact: true }).click();
      await home.getByRole("dialog", { name: "Recent Rides", exact: true }).waitFor();
      await home.getByRole("dialog", { name: "Recent Rides", exact: true }).getByRole("button", { name: "Done", exact: true }).click();
    }
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
      if (count === 3) {
        const preview = home.locator(".ss-home-map-preview");
        await preview.scrollIntoViewIfNeeded();
        const markers = preview.locator(".ss-home-map-aircraft");
        await markers.last().waitFor();
        assert.equal(await markers.count(), count, "Preview retains live aircraft absent from the bundled catalog");
        assert.equal(await markers.locator(".ss-helicopter-icon").count(), 2);
        assert.equal(await markers.locator(".ss-cessna-icon").count(), 1);
        assert.equal(await markers.getByText("N102TEST", { exact: true }).count(), 1, "Aircraft names appear on the preview");
        assert(await markers.locator(".ss-home-map-aircraft-label").last().evaluate(el => getComputedStyle(el).fontFamily.includes("Manrope")));
        await home.screenshot({ path: `${out}/preview-aircraft-icons.png`, fullPage: true });
        await preview.getByRole("button", { name: "View N102TEST aircraft details", exact: true }).click();
        await preview.locator(".ss-home-map-popup").getByText("N102TEST", { exact: true }).waitFor();
        await home.screenshot({ path: `${out}/preview-aircraft-details.png`, fullPage: true });
        await preview.getByRole("link", { name: "View on full map", exact: true }).click();
      } else await links.last().click();
      await home.waitForURL(url => url.pathname === "/map" && url.search === new URL(href, base).search);
    }
    console.log(`PASS ${count} active aircraft: visibility, single-line title, centering/scrolling and map link`);
    await home.close();
  }
  }
} finally { await browser.close(); }
