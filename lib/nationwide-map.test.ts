import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeMapAircraft, parseNationwideMapSnapshot } from "./nationwide-map";
import { computeStatus, makeFleetMap } from "./status";
import type { Aircraft, Snapshot } from "./types";

const plane = (tail: string, state: string, fields: Partial<Aircraft> = {}) => ({ tail, home_state_code: state,
  airborne: true, observed: true, role: "fixed_wing", model: "Cessna 182", ...fields }) as Aircraft;

test("nationwide markers never mutate the selected-state snapshot or its air-support status", () => {
  const selected = [plane("N100WA", "WA", { airborne: false })];
  const nationwide = [plane("N200CA", "CA"), plane("N300TX", "TX"), plane("N100WA", "WA")];
  const before = structuredClone(selected);
  const markers = mergeMapAircraft(selected, nationwide);
  assert.deepEqual(markers.map(p => p.tail), ["N200CA", "N300TX"]);
  assert.deepEqual(selected, before);
  const snapshot = { aircraft: selected, fetched_at: Date.now(), source: "adsbfi" } as Snapshot;
  assert.equal(computeStatus(snapshot, makeFleetMap(selected)).kind, "clear");
  assert.equal(computeStatus(snapshot, makeFleetMap(selected)).alertCount, 0);
});

test("selected-state live readings win duplicates; landed and unobserved national aircraft stay hidden", () => {
  const current = plane("N100WA", "WA", { altitude_ft: 3200 });
  const markers = mergeMapAircraft([current], [plane("N100WA", "WA", { altitude_ft: 2000 }),
    plane("N200CA", "CA"), plane("N300TX", "TX", { observed: false }), plane("N400NY", "NY", { airborne: false })]);
  assert.equal(markers.length, 2);
  assert.equal(markers.find(p => p.tail === "N100WA")?.altitude_ft, 3200);
  assert.deepEqual(mergeMapAircraft([current], []).map(p => p.tail), ["N100WA"]);
});

test("national map reads reject invalid payloads and unsupported state assignments", () => {
  const valid = { fetched_at: Date.now(), source: "adsbfi", aircraft: [plane("N200CA", "CA")] };
  assert.equal(parseNationwideMapSnapshot(valid), valid);
  for (const value of [null, {}, { ...valid, aircraft: {} }, { ...valid, fetched_at: NaN },
    { ...valid, aircraft: [plane("N200CA", "XX")] }, { ...valid, aircraft: [null] }]) {
    assert.throws(() => parseNationwideMapSnapshot(value), /Invalid nationwide/);
  }
});

test("a newer national observation beats an older state reading, and a newer state landing removes it", () => {
  const older = plane("N100WA", "WA", { observed_at: "2026-11-13T16:00:00Z", airborne: false });
  const newer = plane("N100WA", "WA", { observed_at: "2026-11-13T16:00:30Z", altitude_ft: 4000 });
  assert.equal(mergeMapAircraft([older], [newer])[0]?.altitude_ft, 4000);
  const landed = { ...newer, observed_at: "2026-11-13T16:01:00Z", airborne: false };
  assert.deepEqual(mergeMapAircraft([landed], [newer]), []);
});
