import assert from "node:assert/strict";
import { test } from "node:test";
import { readAircraftCache, saveAircraftCache } from "./aircraft-cache";
import { ageAircraftSnapshot, isVisibleFlight, retainAircraftSnapshot } from "./aircraft-freshness";
import { FLEET } from "./seed";
import type { Snapshot } from "./types";

test("Home shows a flight as landed after four minutes without a report", () => {
  const now = Date.now();
  const snapshot: Snapshot = { fetched_at: now, source: "adsblol", source_ok: true,
    aircraft: [{ ...FLEET[0]!, icao24: "a00001", airborne: true, heading: 42 }], live_seen_count: 1 };
  const outage = ageAircraftSnapshot(retainAircraftSnapshot(snapshot,
    { ...snapshot, fetched_at: now + 1, source_ok: false, aircraft: [] }), now + 3_600_000);
  assert.equal(outage.aircraft.filter(isVisibleFlight).length, 0);
  assert.equal(outage.aircraft[0]!.heading, 42);
  assert.equal(outage.aircraft[0]!.airborne, false);
  const landed = retainAircraftSnapshot(outage, { ...snapshot, fetched_at: now + 3_600_000,
    aircraft: [{ ...snapshot.aircraft[0]!, airborne: false }] });
  assert.deepEqual(landed.aircraft.filter(isVisibleFlight), []);
});

test("saved aircraft survive relaunch, stay separate by state, and recover from invalid storage", t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  t.after(() => { if (previous) Object.defineProperty(globalThis, "window", previous); else Reflect.deleteProperty(globalThis, "window"); });
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  } } });
  const snapshot: Snapshot = { fetched_at: Date.now(), source: "adsblol", source_ok: true,
    aircraft: [{ ...FLEET[0]!, icao24: "a00001", airborne: true }], live_seen_count: 1 };
  saveAircraftCache("/api/aircraft?state=CA", snapshot);
  assert.deepEqual(readAircraftCache("/api/aircraft?state=CA")?.aircraft, snapshot.aircraft);
  assert.equal(readAircraftCache("/api/aircraft?state=CA")?.source_ok, false);
  assert.equal(readAircraftCache("/api/aircraft?state=WA"), null);
  saveAircraftCache("/api/aircraft?state=CA&mock=up", snapshot);
  assert.equal(readAircraftCache("/api/aircraft?state=CA&mock=up"), null);
  saveAircraftCache("/api/aircraft?state=CA", { ...snapshot, aircraft: [] });
  assert.deepEqual(readAircraftCache("/api/aircraft?state=CA")?.aircraft, []);
  storage.set("oos-aircraft-snapshot-v1:/api/aircraft?state=CA", "broken");
  assert.equal(readAircraftCache("/api/aircraft?state=CA"), null);
});
