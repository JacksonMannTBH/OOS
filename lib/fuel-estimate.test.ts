// Run: npx tsx --test lib/fuel-estimate.test.ts

import { test } from "node:test";
import assert from "node:assert";
import {
  estimateFuelRemaining,
  formatFuelRemaining,
  getAircraftFuelProfile,
  normalizeTailNumber,
} from "./fuel-estimate";

test("formatFuelRemaining labels the value as an endurance estimate", () => {
  assert.equal(formatFuelRemaining(125), "Est. 2h 5min");
  assert.equal(formatFuelRemaining(60), "Est. 1h 0min");
  assert.equal(formatFuelRemaining(1), "Est. 0h 1min");
  assert.equal(formatFuelRemaining(0), "Est. 0h 0min");
});

test("normalizeTailNumber accepts small tail-number formatting differences", () => {
  assert.equal(normalizeTailNumber(" n-305 dk "), "N305DK");
  assert.equal(getAircraftFuelProfile("n305dk")?.meanMaxDurationMin, 420);
  assert.equal(getAircraftFuelProfile("N00000"), null);
});

test("estimateFuelRemaining hides unknown and grounded aircraft", () => {
  assert.equal(
    estimateFuelRemaining({
      tail: "N00000",
      airborne: true,
      tracking_started_at: "2026-08-08T12:00:00.000Z",
      takeoff_confidence: "high",
      as_of: "2026-08-08T12:05:00.000Z",
    }),
    null,
  );
  assert.equal(
    estimateFuelRemaining({
      tail: "N305DK",
      airborne: false,
      tracking_started_at: "2026-08-08T12:00:00.000Z",
      takeoff_confidence: "high",
      as_of: "2026-08-08T12:05:00.000Z",
    }),
    null,
  );
});

test("estimateFuelRemaining requires first-observed and as-of timestamps", () => {
  assert.equal(
    estimateFuelRemaining({
      tail: "N305DK",
      airborne: true,
      takeoff_confidence: "high",
      time_aloft_min: 5,
    }),
    null,
  );
});

test("estimateFuelRemaining clamps exhausted duration at zero", () => {
  const estimate = estimateFuelRemaining({
    tail: "N305DK",
    airborne: true,
    tracking_started_at: "2026-08-01T00:00:00.000Z",
    takeoff_confidence: "high",
    as_of: "2026-08-08T00:00:00.000Z",
  });
  assert.equal(
    estimate?.label,
    "Est. 0h 0min",
  );
  assert.equal(estimate?.minutesRemaining, 0);
  assert.equal(estimate?.remainingSeconds, 0);
});

test("estimateFuelRemaining subtracts exact elapsed time from the catalog upper bound", () => {
  const estimate = estimateFuelRemaining({
    tail: "N422CT",
    airborne: true,
    tracking_started_at: "2026-08-08T12:00:00.000Z",
    takeoff_confidence: "high",
    as_of: "2026-08-08T12:05:00.000Z",
  });

  assert.equal(estimate?.basis, "catalog_upper_bound");
  assert.equal(estimate?.catalogUpperBoundMinutes, 240);
  assert.equal(estimate?.maxDurationMinutes, 240);
  assert.equal(estimate?.elapsedSeconds, 300);
  assert.equal(estimate?.elapsedMinutes, 5);
  assert.equal(estimate?.remainingSeconds, 14_100);
  assert.equal(estimate?.minutesRemaining, 235);
  assert.equal(
    estimate?.label,
    "Est. 3h 55min",
  );
});

test("estimateFuelRemaining uses mean duration for aircraft with duration ranges", () => {
  const estimate = estimateFuelRemaining({
    tail: "N9446P",
    airborne: true,
    tracking_started_at: "2026-08-08T12:00:00.000Z",
    takeoff_confidence: "medium",
    as_of: "2026-08-08T12:42:00.000Z",
  });

  assert.equal(estimate?.maxDurationMinutes, 282);
  assert.equal(estimate?.minutesRemaining, 240);
  assert.equal(
    estimate?.label,
    "Est. 4h 0min",
  );
});

test("estimateFuelRemaining floors only the final display after 5m59s", () => {
  const estimate = estimateFuelRemaining({
    tail: "N422CT",
    airborne: true,
    tracking_started_at: "2026-08-08T12:00:00.000Z",
    takeoff_confidence: "high",
    as_of: "2026-08-08T12:05:59.000Z",
    time_aloft_min: 9_999,
  });

  assert.equal(estimate?.elapsedSeconds, 359);
  assert.equal(estimate?.elapsedMinutes, 359 / 60);
  assert.equal(estimate?.remainingSeconds, 14_041);
  assert.equal(estimate?.minutesRemaining, 14_041 / 60);
  assert.equal(
    estimate?.label,
    "Est. 3h 54min",
  );
});

test("estimateFuelRemaining always uses first observation regardless of takeoff confidence", () => {
  const times = {
    tail: "N422CT", airborne: true,
    tracking_started_at: "2026-08-08T12:00:00.000Z",
    detected_takeoff_at: "2026-08-08T11:45:00.000Z",
    as_of: "2026-08-08T12:05:00.000Z",
  } as const;
  for (const takeoff_confidence of ["low", "medium", "high", null] as const) {
    assert.equal(estimateFuelRemaining({ ...times, takeoff_confidence })?.minutesRemaining, 235);
  }
  assert.equal(estimateFuelRemaining({ ...times, detected_takeoff_at: null })?.minutesRemaining, 235);
  assert.equal(estimateFuelRemaining({ ...times, tracking_started_at: null }), null);
});

test("remaining time continues from the same flight start after a data gap and resets for a new flight", () => {
  const flight = { tail: "N422CT", airborne: true,
    tracking_started_at: "2026-08-08T12:00:00.000Z" };
  assert.equal(estimateFuelRemaining({ ...flight, as_of: "2026-08-08T12:01:00Z" })?.minutesRemaining, 239);
  assert.equal(estimateFuelRemaining({ ...flight, as_of: "2026-08-08T12:04:00Z" })?.minutesRemaining, 236);
  assert.equal(estimateFuelRemaining({ ...flight, tracking_started_at: "2026-08-08T13:00:00Z",
    as_of: "2026-08-08T13:01:00Z" })?.minutesRemaining, 239);
  for (const tracking_started_at of ["invalid", "2026-08-08T14:00:00Z"]) {
    assert.equal(estimateFuelRemaining({ ...flight, tracking_started_at, as_of: "2026-08-08T13:01:00Z" }), null);
  }
});
