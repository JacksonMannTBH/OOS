import test from "node:test";
import assert from "node:assert/strict";
import { rideDistance, rideDuration, rideSpeed } from "./ride-history-format";
import type { RecordedRide } from "./ride-recording";
const ride: RecordedRide = { id: "test", startedAt: 0, updatedAt: 1000, endedAt: 1000,
  distanceMeters: 1609.344, topSpeedMps: 10, durationSeconds: 1, sampleCount: 2, hasGaps: false, interrupted: false };
test("ride values use miles and rider MPH, not aircraft nautical miles", () => {
  assert.equal(rideDistance(ride), "1.0 mi");
  assert.equal(rideSpeed(ride), "22 mph");
});
test("no GPS is distinct from a measured zero speed or distance", () => {
  assert.equal(rideDistance({ ...ride, sampleCount: 0 }), "— mi");
  assert.equal(rideSpeed({ ...ride, topSpeedMps: null }), "— mph");
  assert.equal(rideSpeed({ ...ride, topSpeedMps: 0 }), "0 mph");
});
test("short and multi-hour rides have readable durations", () => {
  assert.equal(rideDuration(12), "<1 min");
  assert.equal(rideDuration(1680), "28 min");
  assert.equal(rideDuration(3720), "1 hr 2 min");
});
