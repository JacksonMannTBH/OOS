// Exercises the packaged UI with a simulated native recorder. Sensor math is
// tested separately in RideMotionTests.swift; real riding needs device testing.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium, webkit } = await import(process.env.OOS_PLAYWRIGHT_MODULE ?? "@playwright/test");
const base = process.env.OOS_VISUAL_BASE_URL ?? "http://127.0.0.1:4183";
const out = process.env.OOS_REVIEW_OUTPUT ?? ".local/ride-motion";
await mkdir(out, { recursive: true });
const browser = await (process.env.OOS_WEBKIT === "1" ? webkit : chromium).launch({ headless: true });
let page;
try {
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(15000);
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.startsWith(base) || url.startsWith("blob:") || url.startsWith("data:")) return route.continue();
    if (url.includes("style")) return route.fulfill({ json: { version: 8, sources: {}, layers: [] } });
    return route.fulfill({ json: { aircraft: [], fetched_at: Date.now(), source_ok: true } });
  });
  await page.routeWebSocket("**/realtime/v1/**", socket => socket.close());
  await page.addInitScript(() => {
    const state = window.motionFixture = JSON.parse(sessionStorage.getItem("motionFixture") || "null") ?? {
      supported: true, consentRequired: false, active: null, rides: [], message: "", receivingLocation: true,
      motion: { supported: true, enabled: false, calibrated: false, gForceCalibrated: false, message: "" },
      calibrations: 0, calibrationAttempts: 0, unstable: false, failure: "",
    };
    const save = () => sessionStorage.setItem("motionFixture", JSON.stringify(state));
    const position = () => ({ timestamp: Date.now(), coords: { latitude: 47.5, longitude: -122.26,
      accuracy: 5, altitude: null, altitudeAccuracy: null, speed: 15, heading: 0 } });
    window.webkit = { messageHandlers: { bridge: {} } };
    const methods = names => names.map(name => ({ name, rtype: "promise" }));
    window.Capacitor = {
      PluginHeaders: [
        { name: "Preferences", methods: methods(["get", "set", "remove"]) },
        { name: "OOSRideRecorder", methods: methods(["status", "gForceStatus", "start", "finish", "configureMotion", "calibrateMotion", "resetMotionPeaks", "resetGForcePeaks"]) },
        { name: "OOSLiveTracking", methods: methods(["status", "start", "stop", "configure"]) },
        { name: "OOSLocation", methods: methods(["clearWatch", "clearHeading"]).concat(["watchPosition", "watchHeading"].map(name => ({ name, rtype: "callback" }))) },
      ],
      nativePromise: async (plugin, method, args) => {
        if (plugin === "Preferences") {
          if (method === "set") localStorage.setItem(`native:${args.key}`, args.value);
          if (method === "remove") localStorage.removeItem(`native:${args.key}`);
          return { value: localStorage.getItem(`native:${args.key}`) };
        }
        if (plugin === "OOSLocation") return {};
        if (plugin === "OOSLiveTracking") return { supported: true, enabled: false, active: false, message: "" };
        if (plugin !== "OOSRideRecorder") throw new Error(`${plugin}.${method}`);
        if (method === "gForceStatus") {
          state.gForceRequests = (state.gForceRequests ?? 0) + 1;
          return {
            supported: state.motion.supported, calibrated: state.motion.gForceCalibrated,
            receiving: state.motion.gForceCalibrated && !state.gForcePaused,
            reading: state.motion.gForceCalibrated && !state.gForcePaused
              ? state.gForceReading ?? { timestamp: 1, longitudinalG: 0.3, lateralG: 0.4, combinedG: 0.5 } : null,
            peaks: state.active?.gForce ?? null, message: "",
          };
        }
        if (method === "start") {
          state.active ??= { id: "angle-ride", startedAt: Date.now(), updatedAt: Date.now(), endedAt: null,
            distanceMeters: 0, topSpeedMps: null, sampleCount: 0, durationSeconds: 0, hasGaps: false, interrupted: false };
          state.motion.enabled = args.recordAngles;
        }
        if (method === "configureMotion") {
          state.motion.enabled = args.enabled;
          if (!args.enabled) state.motion.calibrated = false;
          save(); return state.motion;
        }
        if (method === "calibrateMotion") {
          state.calibrationAttempts++;
          if (args.rideId !== state.active?.id) throw new Error("Ride changed");
          if (state.failure) throw new Error(state.failure);
          if (state.unstable) throw Object.assign(new Error("Waiting for the bike to stabilize."), { code: "CALIBRATION_NOT_READY" });
          state.calibrations++;
          state.motion.calibrated = state.motion.enabled;
          state.motion.gForceCalibrated = true;
          if (state.motion.enabled) state.active.motion = { calibratedAt: Date.now(), maxLeftRollDegrees: 32.4,
            maxRightRollDegrees: 35.6, maxPitchDegrees: 28.2, sampleCount: 20 };
          state.active.gForce ??= { calibratedAt: Date.now(), maxAccelerationG: 0.8,
            maxBrakingG: 0.7, maxLeftG: 0.6, maxRightG: 0.5, sampleCount: 20 };
          save(); return state.motion;
        }
        if (method === "resetMotionPeaks") {
          if (args.rideId !== state.active?.id) throw new Error("Ride changed");
          if (state.resetFailure) throw new Error(state.resetFailure);
          state.active.motion = { ...state.active.motion, maxLeftRollDegrees: 0,
            maxRightRollDegrees: 0, maxPitchDegrees: 0, sampleCount: 0 };
        }
        if (method === "resetGForcePeaks") {
          state.gForceResetRequests = (state.gForceResetRequests ?? 0) + 1;
          if (state.holdGForceReset) await new Promise(resolve => { window.completeGForceReset = resolve; });
          if (args.rideId !== state.active?.id) throw new Error("Ride changed");
          if (state.resetGForceFailure) throw new Error(state.resetGForceFailure);
          state.active.gForce = { ...state.active.gForce, maxAccelerationG: 0,
            maxBrakingG: 0, maxLeftG: 0, maxRightG: 0, sampleCount: 0 };
        }
        if (method === "finish") {
          const ride = { ...state.active, endedAt: Date.now() };
          state.rides = [ride]; state.active = null; state.motion.calibrated = false; state.motion.gForceCalibrated = false;
          save(); return { ride };
        }
        save(); return JSON.parse(JSON.stringify(state));
      },
      nativeCallback: (_plugin, method, _options, callback) => {
        callback(method === "watchHeading" ? { heading: 0 } : { position: position() });
        return `watch-${Math.random()}`;
      },
    };
  });
  await page.goto(`${base}/settings/display`);
  const toggle = page.getByRole("checkbox", { name: /Lean and Pitch angles in summary/ });
  await toggle.waitFor();
  assert.equal(await page.locator(".ss-settings-card").filter({ has: page.getByRole("heading", { name: "Speedometer", exact: true }) }).getByRole("checkbox").count(), 1);
  assert.equal(await toggle.evaluate(input => input.closest("section").previousElementSibling.matches("button.ss-ride-gauge-row")), true, "Angles have their own card directly below Swipe gauge");
  assert.equal(await toggle.isChecked(), true, "Lean and Pitch starts enabled");
  const info = page.getByRole("button", { name: "About Lean and Pitch", exact: true });
  const infoDialog = page.getByRole("dialog", { name: "Lean and Pitch", exact: true });
  await info.click();
  await infoDialog.waitFor();
  assert.equal(await infoDialog.evaluate(el => getComputedStyle(el).borderTopWidth), "0px");
  assert.equal(await toggle.isChecked(), true, "Opening instructions does not change the setting");
  await page.screenshot({ path: `${out}/angle-info.png`, fullPage: true });
  await infoDialog.press("Escape");
  await infoDialog.waitFor({ state: "detached" });
  await info.click();
  await infoDialog.getByRole("button", { name: "Done", exact: true }).click();
  await infoDialog.waitFor({ state: "detached" });
  await toggle.uncheck();
  await page.reload();
  await toggle.waitFor();
  assert.equal(await toggle.isChecked(), false, "Explicitly disabling survives reopening");
  await toggle.check();
  await page.waitForFunction(() => window.motionFixture.motion.enabled);
  await page.screenshot({ path: `${out}/angle-settings.png`, fullPage: true });
  await page.reload();
  await toggle.waitFor();
  assert.equal(await toggle.isChecked(), true, "Choice survives reopening");
  await page.goto(`${base}/home`);
  await page.getByRole("button", { name: "Start Ride", exact: true }).click();
  await page.waitForURL("**/ride");
  const cal = page.getByRole("button", { name: "Calibrate phone", exact: true });
  await cal.waitFor({ state: "visible" });
  await page.waitForFunction(() => !document.querySelector(".ss-ride-navigation__calibrate").disabled);
  assert.equal(await page.locator(".ss-ride-screen footer p").count(), 0, "No calibration instructions appear before an attempt");
  const homeBounds = await page.getByRole("link", { name: "Home, keep ride active", exact: true }).boundingBox();
  const calBounds = await cal.boundingBox();
  assert(calBounds.x >= homeBounds.x + homeBounds.width && Math.abs(calBounds.y - homeBounds.y) < 2);
  await page.getByRole("button", { name: "Show ride stats", exact: true }).click();
  const peaks = page.getByRole("region", { name: "Peak angles", exact: true });
  const reset = peaks.getByRole("button", { name: "Reset peak angles", exact: true });
  const calibrationPrompt = peaks.locator(".ss-ride-calibration-prompt");
  await calibrationPrompt.waitFor();
  assert.equal(await peaks.locator("dl").count(), 0, "Uncalibrated stats replace peak readings with the calibration prompt");
  assert.equal(await reset.isDisabled(), true);
  assert.equal(await reset.textContent(), "", "Peak-angle reset uses an icon without visible text");
  assert.equal(await reset.locator("svg").count(), 1);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/uncalibrated-stats.png`, fullPage: true });
  await page.evaluate(() => { window.motionFixture.failure = "Motion readings are unavailable."; });
  await cal.click();
  await page.getByRole("alert").filter({ hasText: "Motion readings are unavailable" }).waitFor();
  assert.equal(await page.evaluate(() => window.motionFixture.calibrations), 0);
  await page.evaluate(() => { window.motionFixture.failure = ""; window.motionFixture.unstable = true; });
  await cal.click();
  await page.waitForFunction(() => window.motionFixture.calibrationAttempts >= 3);
  assert.equal(await cal.getAttribute("aria-busy"), "true");
  assert.equal(await cal.isDisabled(), true, "Repeated taps cannot create overlapping calibrations");
  assert.equal(await cal.evaluate(el => getComputedStyle(el).animationName), "ss-calibration-wait");
  assert.equal(await page.locator(".ss-ride-screen footer p").count(), 0, "Movement waits silently without an error");
  assert.equal(await calibrationPrompt.isVisible(), true, "The prompt remains until calibration succeeds");
  await page.screenshot({ path: `${out}/waiting-calibration.png`, fullPage: true });
  await page.evaluate(() => { window.motionFixture.unstable = false; });
  await page.waitForFunction(() => document.querySelector(".ss-ride-navigation__calibrate").getAttribute("aria-pressed") === "true");
  await page.waitForFunction(() => document.querySelector(".ss-ride-navigation__calibrate").getAttribute("aria-busy") === "false");
  assert.equal(await page.evaluate(() => window.motionFixture.calibrations), 1, "Stabilizing completes calibration without tapping again");
  assert.equal(await cal.evaluate(el => getComputedStyle(el).animationName), "none");
  assert.equal(await page.locator(".ss-ride-screen footer p").count(), 0, "Successful calibration clears the error and stays quiet");
  await page.screenshot({ path: `${out}/calibrated-ride.png`, fullPage: true });
  const swipe = async () => page.locator(".ss-ride-view").evaluate(element => {
    const touch = x => ({ identifier: 1, target: element, clientX: x, clientY: 400 });
    const send = (type, touches, changedTouches = []) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, { touches: { value: touches }, changedTouches: { value: changedTouches } });
      element.dispatchEvent(event);
    };
    send("touchstart", [touch(240)]);
    send("touchmove", [touch(110)]);
    send("touchend", [], [touch(110)]);
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 });
    element.dispatchEvent(click);
    if (!click.defaultPrevented) throw new Error("A swipe must suppress its following click");
  });
  const meter = page.getByRole("region", { name: "G-force meter", exact: true });
  const checkGForceEntrance = async from => {
    await meter.waitFor();
    const entrance = await meter.evaluate(element => {
      const style = getComputedStyle(element);
      const animation = element.getAnimations().find(animation => animation.effect?.target === element);
      let midpoint = null;
      if (animation) {
        animation.pause();
        animation.currentTime = 110;
        midpoint = { opacity: Number(getComputedStyle(element).opacity), transform: getComputedStyle(element).transform };
        animation.finish();
      }
      return { name: style.animationName, duration: style.animationDuration, midpoint };
    });
    assert.equal(entrance.name, "ss-ride-panel-reveal", `${from} opens G-force with the shared panel entrance`);
    assert.equal(entrance.duration, "0.22s");
    assert(entrance.midpoint, `${from} has an active entrance animation`);
    if (entrance.midpoint) {
      assert(entrance.midpoint.opacity > 0 && entrance.midpoint.opacity < 1, `${from} fades G-force in`);
      assert.notEqual(entrance.midpoint.transform, "none", `${from} turns G-force into view`);
    }
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".ss-gforce-view")).transform === "none");
  };
  await swipe();
  await checkGForceEntrance("Stats");
  assert.equal(await page.getByRole("region", { name: "Current ride stats", exact: true }).count(), 0, "Swiping opens G-force instead of Stats");
  await meter.locator(".ss-gforce-dot").waitFor();
  assert.equal(Number(await meter.locator(".ss-gforce-dot").getAttribute("cx")), 94, "Rightward bike acceleration moves the load dot left");
  assert.equal(Number(await meter.locator(".ss-gforce-dot").getAttribute("cy")), 192);
  const dialSize = await meter.locator(".ss-gforce-dial").boundingBox();
  const mapDiameter = await page.locator(".ss-ride-map-link").evaluate(el => parseFloat(getComputedStyle(el).width));
  assert(Math.abs(dialSize.width - mapDiameter) < 0.1 && Math.abs(dialSize.height - mapDiameter) < 0.1, "G-force and map circles have the same diameter");
  assert.deepEqual(await meter.locator(".ss-gforce-peak").allTextContents(), ["0.70 G", "0.80 G", "0.60 G", "0.50 G"]);
  assert.equal(await meter.getByRole("img", { name: /left G-force 0\.60 G, right G-force 0\.50 G/ }).count(), 1, "The meter names load directions, not turn directions");
  assert.equal(await meter.getByRole("img", { name: /^Fixed G-force scale: center 0 G, inner ring 0\.5 G, outer edge 1 G\./ }).count(), 1);
  assert.equal(await meter.locator("h2, output, dl").count(), 0, "The circle has no heading, current reading, or separate peak list");
  assert.equal(await meter.getByText("Swipe for map", { exact: true }).count(), 0);
  assert.equal(await meter.getByRole("status").count(), 0, "The calibrated meter has no explanatory text");
  await page.screenshot({ path: `${out}/gforce-live.png`, fullPage: true });
  const intermediate = await page.evaluate(() => new Promise((resolve, reject) => {
    window.motionFixture.gForceReading = { timestamp: 2, longitudinalG: 0.8, lateralG: -0.6, combinedG: 1 };
    const started = performance.now();
    const sample = () => {
      const x = Number(document.querySelector(".ss-gforce-dot")?.getAttribute("cx"));
      if (x > 95 && x < 233) return resolve(x);
      if (performance.now() - started > 3000) return reject(new Error("Dot did not animate through intermediate positions"));
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));
  assert(intermediate > 94 && intermediate < 234, "The dot glides instead of jumping to the next reading");
  await page.waitForFunction(() => Math.abs(Number(document.querySelector(".ss-gforce-dot")?.getAttribute("cx")) - 234) < 0.1);
  assert(await meter.locator(".ss-gforce-trail path").evaluateAll(paths => paths.some(path => path.getAttribute("d")?.includes("L"))), "Moving G-force readings leave a tracking line");
  assert.equal(await meter.locator(".ss-gforce-trail path").count(), 6, "The fading trail has a fixed drawing budget");
  await page.screenshot({ path: `${out}/gforce-tracking-trail.png`, fullPage: true });
  await page.waitForTimeout(3300);
  assert(await meter.locator(".ss-gforce-trail path").evaluateAll(paths => paths.every(path => {
    const numbers = (path.getAttribute("d") ?? "").match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    return numbers.every((value, index) => Math.abs(value - (index % 2 ? 262 : 234)) < 0.2);
  })), "Old movements fade out instead of building up indefinitely");
  assert.equal(await meter.evaluate(element => element.getAnimations().filter(animation => animation.effect?.target === element).length), 0, "Live readings do not restart the entrance animation");
  assert(Number(await meter.locator(".ss-gforce-dot").getAttribute("cy")) > 150, "A left turn while accelerating moves the dot right and down");
  await page.evaluate(() => { window.motionFixture.gForceReading = { timestamp: 3, longitudinalG: 0, lateralG: 1.2, combinedG: 1.2 }; });
  await page.waitForFunction(() => Math.abs(Number(document.querySelector(".ss-gforce-dot")?.getAttribute("cx")) - 10) < 0.1);
  assert(await meter.locator(".ss-gforce-trail path").evaluateAll(paths => paths.some(path => {
    const numbers = (path.getAttribute("d") ?? "").match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    return numbers.some((value, index) => index % 2 === 0 && Math.abs(value - 234) < 0.2 && Math.abs(numbers[index + 1] - 262) < 0.2);
  })), "Crossing 1 G leaves earlier trail points at their original positions");
  await page.evaluate(() => { window.motionFixture.gForceReading = { timestamp: 4, longitudinalG: 0, lateralG: 0.4, combinedG: 0.4 }; });
  await page.waitForFunction(() => Math.abs(Number(document.querySelector(".ss-gforce-dot")?.getAttribute("cx")) - 94) < 0.1);
  await page.waitForTimeout(1200);
  assert(Math.abs(Number(await meter.locator(".ss-gforce-dot").getAttribute("cx")) - 94) < 0.1, "A lower reading stays on the same scale after the old resizing delay");
  assert.deepEqual(await meter.locator(".ss-gforce-peak").allTextContents(), ["0.70 G", "0.80 G", "0.60 G", "0.50 G"], "Display smoothing does not change recorded peaks");
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await meter.evaluate(element => getComputedStyle(element).animationName), "none", "Reduced Motion disables the panel animation");
  await page.evaluate(() => { window.motionFixture.gForceReading = { timestamp: 4.5, longitudinalG: 2.4, lateralG: -3.2, combinedG: 4 }; });
  await page.waitForFunction(() => Number(document.querySelector(".ss-gforce-dot")?.getAttribute("cx")) === 262
    && Number(document.querySelector(".ss-gforce-dot")?.getAttribute("cy")) === 234);
  assert(await meter.locator(".ss-gforce-trail path").evaluateAll(paths => paths.every(path => {
    const numbers = (path.getAttribute("d") ?? "").match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    return numbers.every((value, index) => index % 2 || Math.hypot(value - 150, numbers[index + 1] - 150) <= 140.02);
  })), "Diagonal over-range readings preserve direction and keep the complete trail inside the dial");
  await page.evaluate(() => { window.motionFixture.gForceReading = { timestamp: 5, longitudinalG: 0, lateralG: -0.4, combinedG: 0.4 }; });
  await page.waitForFunction(() => Number(document.querySelector(".ss-gforce-dot")?.getAttribute("cx")) === 206);
  await page.evaluate(() => { window.motionFixture.gForceReading = { timestamp: 6, longitudinalG: -0.5, lateralG: 0.4, combinedG: Math.hypot(0.5, 0.4) }; });
  await page.waitForFunction(() => Number(document.querySelector(".ss-gforce-dot")?.getAttribute("cx")) === 94
    && Number(document.querySelector(".ss-gforce-dot")?.getAttribute("cy")) === 80);
  assert.deepEqual(await meter.locator(".ss-gforce-peak").allTextContents(), ["0.70 G", "0.80 G", "0.60 G", "0.50 G"], "Left load and braking move the dot left/up without altering previously recorded load peaks");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => { window.motionFixture.gForcePaused = true; });
  await meter.getByText("Waiting for motion readings…", { exact: true }).waitFor();
  assert.equal(await meter.locator(".ss-gforce-dot").count(), 0, "Missing readings do not show stale G-force");
  assert.equal(await meter.locator(".ss-gforce-trail").count(), 0, "A sensor pause clears the tracking trail");
  await page.evaluate(() => { window.motionFixture.gForcePaused = false; });
  await meter.locator(".ss-gforce-dot").waitFor();
  await page.evaluate(() => document.dispatchEvent(new Event("pause")));
  await meter.getByText("Waiting for motion readings…", { exact: true }).waitFor();
  const pausedRequests = await page.evaluate(() => window.motionFixture.gForceRequests);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.motionFixture.gForceRequests), pausedRequests, "Backgrounding pauses live bridge requests");
  await page.evaluate(() => document.dispatchEvent(new Event("resume")));
  await meter.locator(".ss-gforce-dot").waitFor();
  await page.setViewportSize({ width: 320, height: 740 });
  const meterBounds = await meter.boundingBox();
  assert(meterBounds.x >= 0 && meterBounds.x + meterBounds.width <= 320);
  const resetGForce = meter.getByRole("button", { name: "Reset peak G-force", exact: true });
  const gForceResetBounds = await resetGForce.boundingBox();
  assert(gForceResetBounds.width >= 44 && gForceResetBounds.height >= 44, "Refresh has a full touch target");
  assert(Math.abs(gForceResetBounds.y - meterBounds.y) < 1
    && Math.abs(gForceResetBounds.x + gForceResetBounds.width - meterBounds.x - meterBounds.width) < 1,
    "G-force refresh stays at the top right on a small phone");
  assert.equal(await resetGForce.textContent(), "", "G-force refresh has no visible text");
  assert.equal(await resetGForce.locator("svg").count(), 1);
  const smallMapDiameter = await page.locator(".ss-ride-map-link").evaluate(el => parseFloat(getComputedStyle(el).width));
  assert(Math.abs(meterBounds.width - smallMapDiameter) < 0.1, "Circle diameters also match on a small phone");
  await page.screenshot({ path: `${out}/gforce-small-phone.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const beforeGForceReset = await page.evaluate(() => JSON.parse(JSON.stringify(window.motionFixture.active)));
  const dotBeforeReset = await meter.locator(".ss-gforce-dot").evaluate(el => {
    window.dotBeforeGForceReset = el;
    return [el.getAttribute("cx"), el.getAttribute("cy")];
  });
  await page.evaluate(() => { window.motionFixture.resetGForceFailure = "Could not save peak G-force."; });
  await resetGForce.click();
  await meter.getByRole("alert").filter({ hasText: "Could not save peak G-force." }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.motionFixture.active), beforeGForceReset, "Failed G-force reset keeps ride data");
  await page.evaluate(() => {
    window.motionFixture.resetGForceFailure = "";
    window.motionFixture.holdGForceReset = true;
  });
  await resetGForce.click();
  assert.equal(await resetGForce.getAttribute("aria-busy"), "true");
  assert.equal(await resetGForce.isDisabled(), true);
  assert.equal(await cal.isDisabled(), true, "Calibration waits for a pending reset");
  await resetGForce.evaluate(el => el.click());
  assert.equal(await page.evaluate(() => window.motionFixture.gForceResetRequests), 2, "Busy refresh prevents duplicate resets");
  await page.evaluate(() => { window.motionFixture.holdGForceReset = false; window.completeGForceReset(); });
  await page.waitForFunction(() => window.motionFixture.active.gForce.sampleCount === 0);
  await page.waitForFunction(() => [...document.querySelectorAll(".ss-gforce-peak")].every(el => el.textContent === "— G"));
  assert.equal(await resetGForce.isDisabled(), true, "No measured peaks remain to reset");
  assert.equal(await meter.getByRole("alert").count(), 0, "Retry clears the reset error");
  const afterGForceReset = await page.evaluate(() => window.motionFixture.active);
  assert.deepEqual({ ...afterGForceReset, gForce: beforeGForceReset.gForce }, beforeGForceReset, "G-force reset preserves angles and other ride statistics");
  assert.equal(afterGForceReset.gForce.calibratedAt, beforeGForceReset.gForce.calibratedAt);
  assert.equal(await cal.getAttribute("aria-pressed"), "true", "G-force reset keeps mounting calibration");
  assert.equal(await meter.locator(".ss-gforce-dot").evaluate(el => el === window.dotBeforeGForceReset), true, "Refresh keeps the existing animated dot");
  assert.deepEqual(await meter.locator(".ss-gforce-dot").evaluate(el => [el.getAttribute("cx"), el.getAttribute("cy")]), dotBeforeReset);
  await page.evaluate(() => {
    window.motionFixture.active.gForce = { ...window.motionFixture.active.gForce,
      maxAccelerationG: 0.2, maxBrakingG: 0.1, maxLeftG: 0.15, maxRightG: 0.25, sampleCount: 2 };
    window.dispatchEvent(new Event("oos:ride-recording"));
  });
  await meter.getByText("0.20 G", { exact: true }).waitFor();
  assert.deepEqual(await meter.locator(".ss-gforce-peak").allTextContents(), ["0.10 G", "0.20 G", "0.15 G", "0.25 G"], "Fresh readings establish smaller peaks after reset");
  assert.equal(await resetGForce.isDisabled(), false);
  await page.screenshot({ path: `${out}/gforce-refreshed.png`, fullPage: true });
  await page.evaluate(() => {
    window.motionFixture.active.gForce = { ...window.motionFixture.active.gForce,
      maxAccelerationG: 0.8, maxBrakingG: 0.7, maxLeftG: 0.6, maxRightG: 0.5, sampleCount: 20 };
    window.dispatchEvent(new Event("oos:ride-recording"));
  });
  await page.getByRole("button", { name: "Show ride stats", exact: true }).click();
  await peaks.waitFor();
  const livePeaks = page.getByRole("region", { name: "Peak G-force", exact: true });
  assert.equal(await livePeaks.count(), 0, "Live Stats does not show G-force peaks");
  assert.equal(await page.getByRole("button", { name: "Show G-force meter", exact: true }).count(), 0, "Stats has no G-force button");
  await page.getByRole("button", { name: "Show ride map", exact: true }).click();
  await meter.waitFor({ state: "detached" });
  await page.getByRole("link", { name: "Open map, keep ride active", exact: true }).waitFor({ state: "visible" });
  await swipe();
  await checkGForceEntrance("Map");
  assert.equal(await page.getByRole("button", { name: "Show ride stats", exact: true }).count(), 1, "The G-force view keeps the Stats button");
  await swipe();
  await meter.waitFor({ state: "detached" });
  await page.getByRole("link", { name: "Open map, keep ride active", exact: true }).waitFor({ state: "visible" });
  const requestsOnMap = await page.evaluate(() => window.motionFixture.gForceRequests);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.motionFixture.gForceRequests), requestsOnMap, "The map does not poll the live meter");
  await page.locator(".ss-ride-view").focus();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.keyboard.press("ArrowLeft");
  await meter.waitFor();
  assert.equal(await meter.evaluate(element => getComputedStyle(element).animationName), "none", "Reduced Motion opens G-force immediately from Map");
  await page.keyboard.press("ArrowRight");
  await meter.waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Show ride stats", exact: true }).click();
  await peaks.waitFor();
  await swipe();
  await meter.waitFor();
  assert.equal(await meter.evaluate(element => getComputedStyle(element).animationName), "none", "Reduced Motion opens G-force immediately from Stats");
  await swipe();
  await meter.waitFor({ state: "detached" });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Show ride stats", exact: true }).click();
  assert.equal(await calibrationPrompt.count(), 0, "Successful calibration restores peak readings");
  await peaks.getByText("32°", { exact: true }).waitFor();
  await page.evaluate(() => {
    window.motionFixture.motion.calibrated = false;
    window.dispatchEvent(new Event("oos:ride-recording"));
  });
  await calibrationPrompt.waitFor();
  assert.equal(await peaks.locator("dd").count(), 0, "Stored peaks cannot hide the need to calibrate again");
  assert.equal(await reset.isDisabled(), true);
  await page.evaluate(() => {
    window.motionFixture.motion.calibrated = true;
    window.dispatchEvent(new Event("oos:ride-recording"));
  });
  await peaks.getByText("32°", { exact: true }).waitFor();
  await reset.waitFor();
  const mphBeforeReset = await page.getByRole("button", { name: /^Your speed: 34 miles per hour\./ }).textContent();
  const beforeReset = await page.evaluate(() => JSON.parse(JSON.stringify(window.motionFixture.active)));
  await page.evaluate(() => { window.motionFixture.resetFailure = "Could not save peak angles."; });
  await reset.click();
  await peaks.getByRole("alert").filter({ hasText: "Could not save peak angles." }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.motionFixture.active), beforeReset, "Failed reset keeps peaks");
  await page.evaluate(() => { window.motionFixture.resetFailure = ""; });
  await reset.click();
  await page.waitForFunction(() => window.motionFixture.active.motion.sampleCount === 0);
  await page.waitForFunction(() => document.querySelectorAll(".ss-ride-summary-angles dd")[0].textContent === "—°");
  assert.equal(await peaks.getByText("—°", { exact: true }).count(), 3);
  assert.equal(await calibrationPrompt.count(), 0, "Resetting peaks does not request calibration again");
  assert.equal(await cal.getAttribute("aria-pressed"), "true", "Reset preserves calibration");
  assert.equal(await page.getByRole("button", { name: /^Your speed: 34 miles per hour\./ }).textContent(), mphBeforeReset, "Reset keeps live MPH");
  const afterReset = await page.evaluate(() => window.motionFixture.active);
  assert.deepEqual({ ...afterReset, motion: beforeReset.motion }, beforeReset, "Reset keeps other ride stats");
  await page.evaluate(() => {
    window.motionFixture.active.motion = { ...window.motionFixture.active.motion,
      maxLeftRollDegrees: 11, maxRightRollDegrees: 12, maxPitchDegrees: 13, sampleCount: 4 };
    window.dispatchEvent(new Event("oos:ride-recording"));
  });
  await peaks.getByText("11°", { exact: true }).waitFor();
  await page.screenshot({ path: `${out}/reset-peak-angles.png`, fullPage: true });
  await page.setViewportSize({ width: 320, height: 740 });
  const resetBounds = await reset.boundingBox();
  assert(resetBounds.x >= 0 && resetBounds.x + resetBounds.width <= 320);
  await page.screenshot({ path: `${out}/reset-peak-angles-small.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });

  await page.getByRole("link", { name: "Home, keep ride active", exact: true }).click();
  await page.getByRole("button", { name: "Resume Ride", exact: true }).click();
  await page.waitForURL("**/ride");
  assert.equal(await cal.getAttribute("aria-pressed"), "true", "Navigating away preserves calibration");
  await page.evaluate(() => { window.motionFixture.unstable = true; });
  await cal.click();
  await page.waitForFunction(() => document.querySelector(".ss-ride-navigation__calibrate").getAttribute("aria-busy") === "true");
  await page.getByRole("link", { name: "Home, keep ride active", exact: true }).click();
  await page.waitForURL("**/home");
  await page.waitForTimeout(300);
  const attemptsAfterHome = await page.evaluate(() => window.motionFixture.calibrationAttempts);
  await page.waitForTimeout(450);
  assert.equal(await page.evaluate(() => window.motionFixture.calibrationAttempts), attemptsAfterHome, "Leaving Ride mode stops the pending native checks");
  await page.getByRole("button", { name: "Resume Ride", exact: true }).click();
  await page.waitForURL("**/ride");
  await page.getByRole("button", { name: "End Ride and return to the main app" }).click();
  const summary = page.getByRole("dialog", { name: "Ride summary", exact: true });
  await summary.waitFor();
  for (const degrees of ["11°", "12°", "13°"]) await summary.getByText(degrees, { exact: true }).waitFor();
  await summary.getByRole("region", { name: "Peak G-force", exact: true }).getByText("0.80", { exact: false }).waitFor();
  const savedGPeaks = summary.getByRole("region", { name: "Peak G-force", exact: true });
  assert.deepEqual(await savedGPeaks.locator("dt").allTextContents(), ["Acceleration", "Braking", "Left", "Right"], "Saved G peaks use load directions, not turn labels");
  assert.equal(await summary.getByRole("button", { name: "Reset peak angles" }).count(), 0, "Saved summaries have no reset button");
  assert.equal(await summary.getByRole("button", { name: "Reset peak G-force" }).count(), 0);
  assert.equal(await summary.locator(".ss-ride-statistics + p").count(), 0, "The summary has no bottom note");
  await page.screenshot({ path: `${out}/angle-summary.png`, fullPage: true });
  await summary.getByRole("button", { name: "Done", exact: true }).click();
  await page.goto(`${base}/settings/display`);
  await toggle.uncheck();
  await page.waitForFunction(() => !window.motionFixture.motion.enabled);
  await page.goto(`${base}/home?rideSummary=angle-ride`);
  await summary.waitFor();
  assert.equal(await summary.getByText("Max lean left", { exact: true }).count(), 0, "Disabled toggle hides angle rows");
  await summary.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Start Ride", exact: true }).click();
  await page.waitForURL("**/ride");
  assert.equal(await cal.count(), 1, "G-force calibration stays available with angles disabled");
  await swipe();
  await meter.waitFor();
  assert.equal(await resetGForce.isDisabled(), true, "G-force refresh waits for calibrated measurements");
  assert.match(await meter.locator(".ss-gforce-message").innerText(), /Use\s+the level button\s+to measure/);
  assert.equal(await meter.locator(".ss-gforce-message svg").count(), 1, "The measurement prompt includes the Level icon");
  await swipe();
  await page.evaluate(() => { window.motionFixture.unstable = false; });
  await cal.click();
  await page.waitForFunction(() => window.motionFixture.motion.gForceCalibrated);
  assert.equal(await page.evaluate(() => window.motionFixture.motion.calibrated), false, "G-force calibration does not enable angles");
  await swipe();
  await meter.locator(".ss-gforce-dot").waitFor();
  await page.screenshot({ path: `${out}/gforce-angles-disabled.png`, fullPage: true });
  await page.getByRole("link", { name: "Home, keep ride active", exact: true }).click();
  await page.goto(`${base}/settings/display`);
  await toggle.check();
  await page.waitForFunction(() => window.motionFixture.motion.enabled);
  await page.goto(`${base}/ride`);
  await cal.waitFor();
  assert.equal(await cal.getAttribute("aria-pressed"), "true", "The shared G-force calibration survives enabling angles");
  await page.evaluate(() => { window.motionFixture.unstable = true; });
  await cal.click();
  await page.waitForFunction(() => document.querySelector(".ss-ride-navigation__calibrate").getAttribute("aria-busy") === "true");
  await page.evaluate(() => document.dispatchEvent(new Event("pause")));
  await page.waitForFunction(() => document.querySelector(".ss-ride-navigation__calibrate").getAttribute("aria-busy") === "false");
  await page.evaluate(() => { window.motionFixture.unstable = false; });
  await page.waitForTimeout(450);
  assert.equal(await page.evaluate(() => window.motionFixture.calibrations), 2, "Locking/backgrounding cancels without a later hidden calibration");
  await page.evaluate(() => document.dispatchEvent(new Event("resume")));
  await page.evaluate(() => {
    window.motionFixture.motion.supported = false;
    window.dispatchEvent(new Event("oos:ride-recording"));
  });
  await page.waitForFunction(() => document.querySelector(".ss-ride-navigation__calibrate").disabled);
  assert.equal(await page.locator(".ss-ride-screen footer p").count(), 0, "Unavailable sensors do not add unsolicited calibration text");
  await page.evaluate(() => {
    window.motionFixture.motion.supported = true;
    window.motionFixture.unstable = true;
    window.dispatchEvent(new Event("oos:ride-recording"));
  });
  await page.waitForFunction(() => !document.querySelector(".ss-ride-navigation__calibrate").disabled);
  await cal.click();
  await page.waitForFunction(() => document.querySelector(".ss-ride-navigation__calibrate").getAttribute("aria-busy") === "true");
  await page.getByRole("button", { name: "End Ride and return to the main app" }).click();
  await summary.waitFor();
  assert.equal(await summary.locator(".ss-ride-statistics + p").count(), 0, "Uncalibrated summaries also have no bottom note");
  assert.equal(await summary.getByRole("region", { name: "Peak angles", exact: true }).count(), 0, "A ride without angle calibration has no peak-angle section");
  assert.equal(await summary.locator(".ss-ride-calibration-prompt").count(), 0, "The live calibration prompt stays out of saved summaries");
  console.log("PASS independent G-force refresh, failure and retry, busy controls, calibration and dot preservation, compact refresh icons; G-force animation, navigation, pause/resume, raw peaks, saved summaries and angle resets");
} catch (error) {
  if (page) {
    await page.screenshot({ path: `${out}/failure.png`, fullPage: true });
    console.error(await page.locator("body").innerText());
  }
  throw error;
} finally { await browser.close(); }
