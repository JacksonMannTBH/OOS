import assert from "node:assert/strict";
import { test } from "node:test";
import { AircraftDisplay } from "./aircraft-display";
import { AIRCRAFT_REPORT_TIMEOUT_MS } from "./aircraft-freshness";
import { readAircraftDisplayCache, saveAircraftDisplayCache } from "./aircraft-cache";
import { FLEET } from "./seed";
import type { Snapshot } from "./types";

const start = Date.parse("2026-11-04T21:00:00Z");
const feed = (at = start): Snapshot => ({ fetched_at: at, source: "adsbfi", source_ok: true,
  aircraft: [{ ...FLEET[0]!, icao24: "a00001", airborne: true, observed: true,
    observed_at: new Date(at).toISOString(), lat: 47.5, lon: -122.2 }], live_seen_count: 1 });

test("background and reconnect hold the last displayed state until a real refresh completes", () => {
  const display = new AircraftDisplay(null);
  display.receive(feed(), true, start);
  display.tick(start + 60_000);
  const shown = display.snapshot;
  display.hold();
  display.tick(start + 20 * 60_000);
  assert.equal(display.snapshot, shown);
  assert.equal(display.snapshot!.aircraft[0]!.airborne, true);
  display.receive(feed(), false, start + 20 * 60_000);
  display.tick(start + 21 * 60_000);
  assert.equal(display.snapshot, shown, "a replay from the connection cache must not end the hold");
  display.receive({ ...feed(), fetched_at: start + 21 * 60_000 }, true, start + 21 * 60_000);
  assert.equal(display.snapshot!.aircraft[0]!.airborne, false);
  assert.equal(display.snapshot!.aircraft[0]!.observation_status, "grounded");
  assert.equal(display.snapshot!.aircraft[0]!.observed_at, new Date(start).toISOString());
});

test("the four-minute rule still operates normally while foreground updates are active", () => {
  const display = new AircraftDisplay(null);
  display.receive(feed(), true, start);
  display.tick(start + AIRCRAFT_REPORT_TIMEOUT_MS - 1);
  assert.equal(display.snapshot!.aircraft[0]!.airborne, true);
  display.tick(start + AIRCRAFT_REPORT_TIMEOUT_MS);
  assert.equal(display.snapshot!.aircraft[0]!.airborne, false);
  display.receive(feed(start + 300_000), true, start + 300_000);
  assert.equal(display.snapshot!.aircraft[0]!.airborne, true);
});

test("resuming does not resurrect an aircraft already displayed as landed before pausing", () => {
  const display = new AircraftDisplay(null);
  display.receive(feed(), true, start);
  display.tick(start + AIRCRAFT_REPORT_TIMEOUT_MS);
  const landed = display.snapshot;
  display.hold();
  display.receive(feed(), false, start + 3_600_000);
  assert.equal(display.snapshot, landed);
  const restored = new AircraftDisplay(feed(), landed);
  restored.tick(start + 3_600_000);
  assert.equal(restored.snapshot!.aircraft[0]!.airborne, false);
});

test("saved display survives a remount separately from the underlying feed", t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  t.after(() => { if (previous) Object.defineProperty(globalThis, "window", previous); else Reflect.deleteProperty(globalThis, "window"); });
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  } } });
  saveAircraftDisplayCache("/api/aircraft?state=WA", feed());
  const restored = new AircraftDisplay(feed(), readAircraftDisplayCache("/api/aircraft?state=WA"));
  restored.tick(start + 86_400_000);
  assert.equal(restored.snapshot!.aircraft[0]!.airborne, true);
  assert.equal(readAircraftDisplayCache("/api/aircraft?state=CA"), null);
});
