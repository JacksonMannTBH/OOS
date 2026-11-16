import assert from "node:assert/strict";
import { test } from "node:test";
import { getCurrentFlightTime } from "./flight-utils";
import type { AircraftLive } from "./types";

const now = Date.parse("2026-11-15T12:40:00Z");
const flight: AircraftLive = {
  tail: "N422CT", icao24: "A5041D", airborne: true,
  as_of: now, tracking_started_at: "2026-11-15T12:10:00Z",
};

test("current flight time uses the recorded start without takeoff confirmation", () => {
  assert.deepEqual(getCurrentFlightTime({ ...flight, takeoff_confidence: "low" }, now), {
    seconds: 1800, basis: "tracking",
  });
});

test("a confirmed takeoff supplies airborne time even without the legacy duration", () => {
  for (const takeoff_confidence of ["medium", "high"] as const) {
    assert.deepEqual(getCurrentFlightTime({ ...flight, takeoff_confidence,
      detected_takeoff_at: "2026-11-15T12:05:00Z" }, now), { seconds: 2100, basis: "takeoff" });
  }
});

test("an unconfirmed takeoff does not replace the known tracking start", () => {
  assert.deepEqual(getCurrentFlightTime({ ...flight, takeoff_confidence: "low",
    detected_takeoff_at: "2026-11-15T11:00:00Z" }, now), { seconds: 1800, basis: "tracking" });
});

test("last-known flight duration freezes at the last observation", () => {
  assert.deepEqual(getCurrentFlightTime({ ...flight, airborne: false, last_known_airborne: true,
    observed_at: "2026-11-15T12:20:00Z" }, now), { seconds: 600, basis: "tracking" });
});

test("older snapshots use their own timestamp and finite reported time as a fallback", () => {
  assert.deepEqual(getCurrentFlightTime({ ...flight, as_of: undefined }, now), { seconds: 1800, basis: "tracking" });
  assert.deepEqual(getCurrentFlightTime({ ...flight, tracking_started_at: null,
    time_aloft_min: 12.5 }, now), { seconds: 750, basis: "reported" });
  assert.deepEqual(getCurrentFlightTime({ ...flight, tracking_started_at: null,
    time_aloft_min: 0 }, now), { seconds: 0, basis: "reported" });
});

test("invalid or future takeoff times fall back without inventing elapsed time", () => {
  for (const detected_takeoff_at of ["invalid", "2026-11-15T13:00:00Z"]) {
    assert.deepEqual(getCurrentFlightTime({ ...flight, detected_takeoff_at,
      takeoff_confidence: "high" }, now), { seconds: 1800, basis: "tracking" });
  }
  for (const time_aloft_min of [undefined, -1, NaN, Infinity]) {
    assert.equal(getCurrentFlightTime({ ...flight, tracking_started_at: "invalid", time_aloft_min }, now), null);
  }
});

test("grounded aircraft never display a current-flight duration", () => {
  assert.equal(getCurrentFlightTime({ ...flight, airborne: false, time_aloft_min: 30 }, now), null);
});
