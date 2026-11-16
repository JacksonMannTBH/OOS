// Run against the packaged mobile preview; native sessions and all remote data
// are fixtures. Controls must fit before Playwright can scroll them into view.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fixture } from "../fixtures/ride.mjs";

const { chromium, webkit } = await import(process.env.OOS_PLAYWRIGHT_MODULE ?? "@playwright/test");
const base = process.env.OOS_VISUAL_BASE_URL ?? "http://127.0.0.1:4183";
const out = process.env.OOS_REVIEW_OUTPUT ?? ".local/landscape-review";
await mkdir(out, { recursive: true });
const browser = await (process.env.OOS_WEBKIT === "1" ? webkit : chromium).launch({ headless: true });

async function onScreen(locator) {
  await locator.waitFor({ state: "visible" });
  assert(await locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight + 1 &&
      r.left >= 0 && r.right <= innerWidth + 1 && el.contains(hit);
  }), `${await locator.getAttribute("aria-label") || await locator.textContent()} fits and is unobstructed without scrolling`);
}

async function rideFits(page) {
  for (const locator of [
    page.locator(".ss-ride-aircraft-status"),
    page.locator('[aria-label^="Your speed:"]'),
    page.getByRole("button", { name: "Report police sighting", exact: true }),
    page.getByRole("link", { name: "Home, keep ride active", exact: true }),
    page.getByRole("button", { name: "Calibrate phone", exact: true }),
    page.locator(".ss-ride-navigation__view"),
    page.locator(".ss-ride-end"),
    page.locator(".ss-ride-orientation"),
  ]) await onScreen(locator);
  assert(await page.locator(".ss-ride-screen").evaluate(el =>
    el.scrollTop === 0 && el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1),
  "The Ride screen itself never needs to scroll in landscape");
  const footer = await Promise.all([
    ".ss-ride-navigation__home", ".ss-ride-navigation__calibrate", ".ss-ride-navigation__view", ".ss-ride-end",
  ].map(selector => page.locator(selector).boundingBox()));
  for (let index = 1; index < footer.length; index++) {
    const previous = footer[index - 1], current = footer[index];
    assert(Math.abs((current.y + current.height / 2) - (previous.y + previous.height / 2)) < 1,
      "Home, calibration, stats and End Ride share one row");
    const gap = current.x - previous.x - previous.width;
    assert(gap >= 0 && (index === footer.length - 1 || gap <= 12),
      "Home, calibration and stats stay grouped, with End Ride to their right");
  }
  assert(footer.at(-1).width <= 140, "End Ride stays compact in landscape");
  const footerBounds = await page.locator(".ss-ride-footer").boundingBox();
  const footerPadding = await page.locator(".ss-ride-footer").evaluate(el => parseFloat(getComputedStyle(el).paddingRight));
  assert(Math.abs(footer.at(-1).x + footer.at(-1).width - footerBounds.x - footerBounds.width + footerPadding) < 1,
    "End Ride aligns with the right edge of the footer");
  const lock = await page.locator(".ss-ride-orientation").boundingBox();
  assert(lock.x >= footer.at(-1).x + footer.at(-1).width + 7,
    "The orientation control sits to the right of End Ride without overlap");
  assert(await page.locator(".ss-ride-orientation").evaluate(el => {
    const r = el.getBoundingClientRect(), screen = document.querySelector(".ss-ride-screen");
    const c = getComputedStyle(screen);
    return Math.abs(innerWidth - r.right - parseFloat(c.paddingRight)) < 1 &&
      Math.abs(innerHeight - r.bottom - parseFloat(c.paddingBottom)) < 1;
  }), "The orientation control stays in the safe bottom-right corner");
  const speed = await page.locator('[aria-label^="Your speed:"]').boundingBox();
  const police = await page.getByRole("button", { name: "Report police sighting", exact: true }).boundingBox();
  assert(Math.abs(speed.x + speed.width / 2 - footer[1].x - footer[1].width / 2) < 1,
    "MPH is centered directly above the Level button");
  assert(Math.abs(police.x + police.width / 2 - footer[3].x - footer[3].width / 2) < 1,
    "Police reporting is centered directly above End Ride");
  const aircraftBar = page.locator(".ss-ride-aircraft-bar");
  const hasAircraftBar = await aircraftBar.count();
  const upperRow = await (hasAircraftBar ? aircraftBar : page.locator(".ss-ride-header")).boundingBox();
  const middle = hasAircraftBar
    ? (upperRow.y + upperRow.height / 2 + footer[0].y + footer[0].height / 2) / 2
    : (upperRow.y + upperRow.height + footerBounds.y) / 2;
  for (const box of [speed, police]) {
    assert(Math.abs(box.y + box.height / 2 - middle) < 1,
      "MPH and police reporting sit halfway between the aircraft bar and Home row");
    assert(box.y >= upperRow.y + upperRow.height && box.y + box.height <= footer[0].y,
      "The centered instruments clear both rows");
  }
  const distance = page.locator(".ss-ride-distance:visible");
  if (await distance.count()) {
    assert.equal(await distance.count(), 1, "Only the distance readout for the current orientation is visible");
    const reading = await distance.boundingBox(), status = await page.locator(".ss-ride-aircraft-status").boundingBox();
    assert(reading.x >= status.x + status.width + 19,
      "Status and aircraft distance have a clear horizontal gap");
    assert(Math.abs((reading.y + reading.height / 2) - (status.y + status.height / 2)) < 1,
      "Aircraft distance is vertically centered beside the status");
  }
}

async function startRide(page) {
  await page.getByRole("button", { name: "Start Ride", exact: true }).click();
  await page.getByRole("dialog", { name: "Record your ride", exact: true })
    .getByRole("button", { name: "Start Ride", exact: true }).click();
  await page.waitForURL("**/ride");
  await page.locator(".ss-ride-map canvas").waitFor();
  await page.locator("[data-oos-map-transition]").waitFor({ state: "detached" });
}

try {
  for (const [name, width, height, options = {}] of [
    ["small-phone", 568, 320], ["phone", 667, 375], ["large-phone", 844, 390],
    ["tablet-small", 1024, 768], ["tablet", 1180, 820],
    ["notch-left", 844, 390, { safe: { left: 44, right: 0, bottom: 21, top: 0 } }],
    ["notch-right", 844, 390, { safe: { left: 0, right: 44, bottom: 21, top: 0 } }],
    ["large-text", 667, 375, { large: true }],
    ["police-nearby", 568, 320, { police: true }],
    ["no-aircraft", 667, 375, { aircraftCount: 0, noRoute: true }],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await fixture(page, true, options.aircraftCount ?? 1);
    if (options.safe) {
      // Browser viewports have zero device insets. Substitute values in the
      // served asset copies to exercise the app's actual safe-area expressions.
      await page.route(`${base}/assets/**`, async route => {
        if (!/\.(css|js)$/.test(new URL(route.request().url()).pathname)) return route.fallback();
        const response = await route.fetch();
        const body = (await response.text()).replace(/env\(safe-area-inset-(left|right|top|bottom)(?:,\s*0px)?\)/g,
          (_match, edge) => `${options.safe[edge]}px`);
        return route.fulfill({ response, body });
      });
    }
    if (options.large) await page.addInitScript(() => {
      const style = document.createElement("style");
      style.textContent = "button, a { font-size: 22px !important; } .ss-home-aircraft h1 { font-size: 32px !important; } .ss-ride-aircraft-status { font-size: 44px !important; } .ss-ride-live-stats dd { font-size: 32px !important; } .ss-ride-statistics dt { font-size: 16px !important; }";
      const install = () => document.documentElement.append(style);
      if (document.documentElement) install();
      else document.addEventListener("DOMContentLoaded", install, { once: true });
    });
    if (options.police) await page.route("**/oos-police*", route => route.fulfill({ json: {
      serverTime: Date.now(), sightings: [{ id: "landscape-police", stateCode: "WA", lat: 47.501, lon: -122.26,
        reportCount: 1, lastReportedAt: Date.now(), expiresAt: Date.now() + 900000 }],
    } }));
    await page.goto(`${base}/home`);
    await page.locator(".ss-home-map-preview canvas").waitFor();
    await page.evaluate(() => document.fonts.ready);
    for (const locator of [page.locator(".ss-home-map-preview"),
      page.getByRole("button", { name: "Start Ride", exact: true }),
      page.getByRole("button", { name: "Recent Rides", exact: true }),
      page.getByRole("link", { name: "Settings", exact: true }),
      page.getByRole("heading", { name: options.aircraftCount === 0 ? "No Eyes" : "Active Air Support", exact: true }),
    ]) await onScreen(locator);
    const home = await page.locator(".ss-home").boundingBox();
    assert(home.width > 430, "Home uses the landscape width");
    const preview = await page.locator(".ss-home-map-preview").boundingBox();
    const overview = await page.locator(".ss-home-overview").boundingBox();
    assert(preview.x >= overview.x + overview.width, "The map sits beside the overview");
    await page.screenshot({ path: `${out}/${name}-home.png` });

    await startRide(page);
    await rideFits(page);
    if (options.aircraftCount !== 0) await onScreen(page.locator('[aria-label^="Distance to nearest aircraft:"]:visible'));
    if (options.police) await onScreen(page.getByText("POLICE NEARBY", { exact: true }));
    if (options.noRoute) await page.evaluate(() => { delete window.rideFixture.active.route; });
    const header = await page.locator(".ss-ride-header").boundingBox();
    const panel = await page.locator(".ss-ride-panel").boundingBox();
    assert(panel.x >= header.x + header.width, "Ride map sits beside status and instruments");
    const circle = await page.locator(".ss-ride-map-link").boundingBox();
    assert(Math.abs(circle.x + circle.width / 2 - panel.x - panel.width / 2) < 1,
      "The map is horizontally centered in its panel");
    assert(Math.abs(circle.y + circle.height / 2 - panel.y - panel.height / 2) < 1,
      "The map is vertically centered in its panel");
    if (width >= 800) {
      const screen = await page.locator(".ss-ride-screen").boundingBox();
      assert(Math.abs(circle.y + circle.height / 2 - screen.y - screen.height / 2) <= 16,
        "On wide landscape screens the map centers over the full screen height");
    }
    await page.screenshot({ path: `${out}/${name}-ride.png` });
    await page.locator(".ss-ride-view").focus();
    await page.keyboard.press("ArrowRight");
    await page.locator(".ss-gforce-view").waitFor();
    await rideFits(page);
    await page.locator(".ss-gforce-view").evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
    const gforce = await page.locator(".ss-gforce-view").boundingBox();
    assert(Math.abs(circle.width - gforce.width) < 1 && Math.abs(circle.height - gforce.height) < 1,
      "The map and G-force dial have the same diameter");
    assert(Math.abs(circle.x - gforce.x) < 1 && Math.abs(circle.y - gforce.y) < 1,
      "Switching views keeps the circle centered in the same position");
    await onScreen(page.locator(".ss-gforce-view"));
    await page.screenshot({ path: `${out}/${name}-gforce.png` });
    await page.getByRole("button", { name: "Show ride stats", exact: true }).click();
    await page.getByRole("region", { name: "Current ride stats", exact: true }).waitFor();
    await page.locator(".ss-ride-live-stats").evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
    await rideFits(page);
    await page.screenshot({ path: `${out}/${name}-stats.png` });

    // Save failures must preserve both the active recording and End Ride.
    await page.evaluate(() => { window.rideFixture.failure = "Could not save this ride. Please try again."; });
    await page.locator(".ss-ride-end").click();
    await page.getByRole("alert").filter({ hasText: "Could not save" }).waitFor();
    await onScreen(page.locator(".ss-ride-end"));
    await page.evaluate(() => { window.rideFixture.failure = ""; });
    await page.locator(".ss-ride-end").click();
    const summary = page.getByRole("dialog", { name: "Ride summary", exact: true });
    await summary.waitFor();
    await summary.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
    await onScreen(summary.getByRole("button", { name: "Done", exact: true }));
    if (!options.noRoute) {
      await summary.locator(".ss-ride-route-map[data-ready=true]").waitFor();
      await onScreen(summary.locator(".ss-ride-route-map"));
      const map = await summary.locator(".ss-ride-route-map").boundingBox();
      const details = await summary.locator(".ss-ride-summary-details").boundingBox();
      assert(details.x >= map.x + map.width, "Summary route and statistics sit side by side");
    } else assert.equal(await summary.locator(".ss-ride-route-map").count(), 0, "Old rides never acquire a fictional route");
    const doneBefore = await summary.getByRole("button", { name: "Done", exact: true }).boundingBox();
    await summary.locator(".ss-ride-summary-details").evaluate(el => { el.scrollTop = el.scrollHeight; });
    assert.deepEqual(await summary.getByRole("button", { name: "Done", exact: true }).boundingBox(), doneBefore);
    await summary.locator(".ss-ride-summary-details").evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: `${out}/${name}-summary.png` });
    await summary.getByRole("button", { name: "Done", exact: true }).click();

    await page.goto(`${base}/map`);
    await page.getByRole("button", { name: "Toggle distance rings" }).waitFor();
    await page.locator(".ss-map-heading-cone").waitFor();
    for (const label of ["Toggle distance rings", "Toggle flight paths", "Return to my location"])
      await onScreen(page.getByRole("button", { name: label, exact: true }));
    if (height <= 600) assert.equal((await page.locator(".ss-map-header").boundingBox()).height, 60);
    await page.screenshot({ path: `${out}/${name}-map.png` });
    await page.goto(`${base}/settings/display`);
    await page.locator(".ss-settings-page").waitFor();
    await onScreen(page.locator(".ss-settings-back"));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: `${out}/${name}-settings.png` });
    assert.deepEqual(errors, [], "No browser errors during landscape navigation");
    await page.close();
    console.log(`PASS ${name}: Home, all Ride views, save failure, summary, map and Settings`);
  }

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await fixture(page, true, 1);
  await page.goto(`${base}/home`);
  await page.locator(".ss-home-map-preview canvas").waitFor();
  const homeCanvas = await page.locator(".ss-home-map-preview canvas").elementHandle();
  await page.setViewportSize({ width: 844, height: 390 });
  await onScreen(page.locator(".ss-home-map-preview"));
  assert(await homeCanvas.evaluate(el => el.isConnected), "Home rotation keeps its map mounted");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal((await page.locator(".ss-home-map-preview").boundingBox()).height, 276.5);
  await startRide(page);
  const orientationButton = page.locator(".ss-ride-orientation");
  await onScreen(orientationButton);
  const portraitHome = await page.locator(".ss-ride-navigation__home").boundingBox();
  const portraitLock = await orientationButton.boundingBox();
  assert(portraitLock.x >= portraitHome.x + portraitHome.width &&
    portraitLock.x <= portraitHome.x + portraitHome.width + 12 && Math.abs(portraitLock.y - portraitHome.y) < 1,
  "In portrait, orientation lock is immediately to the right of Home");
  assert.equal((await orientationButton.textContent()).trim(), "", "The control uses an icon without visible text");
  await page.getByRole("button", { name: "Unlock screen rotation", exact: true }).click();
  await page.getByRole("button", { name: "Lock screen rotation", exact: true }).waitFor();
  assert.equal(await orientationButton.getAttribute("aria-pressed"), "false");
  await page.evaluate(() => { window.orientationFixture.failure = "Unavailable"; });
  await orientationButton.click();
  await page.getByRole("alert").filter({ hasText: "Could not change screen rotation" }).waitFor();
  assert.equal(await orientationButton.getAttribute("aria-pressed"), "false", "A failed request cannot claim to lock");
  await page.evaluate(() => { window.orientationFixture.failure = ""; });
  await orientationButton.click();
  await page.getByRole("button", { name: "Unlock screen rotation", exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.orientationFixture.changes), [false, true]);
  const rideCanvas = await page.locator(".ss-ride-map canvas").elementHandle();
  const id = await page.evaluate(() => window.rideFixture.active.id);
  for (const viewport of [{ width: 844, height: 390 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport);
    await rideFits(page);
    assert(await rideCanvas.evaluate(el => el.isConnected), "Ride rotation keeps the original map canvas");
    assert.equal(await page.evaluate(() => window.rideFixture.active.id), id);
  }
  await page.getByRole("button", { name: "Show ride stats", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("region", { name: "Current ride stats", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.rideFixture.starts), 1);
  assert.equal(await page.evaluate(() => window.rideFixture.finishes), 0);
  await page.setViewportSize({ width: 844, height: 390 });
  await rideFits(page);
  await page.screenshot({ path: `${out}/rotated-stats.png` });
  await page.close();
  console.log("PASS rotation retains map instances, the selected Ride view and one active recording");
} finally {
  await browser.close();
}
