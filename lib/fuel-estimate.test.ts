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
  assert.equal(formatFuelRemaining(125), "Est. Endurance - 2 Hours 5 Minutes");
  assert.equal(formatFuelRemaining(60), "Est. Endurance - 1 Hour 0 Minutes");
  assert.equal(formatFuelRemaining(1), "Est. Endurance - 0 Hours 1 Minute");
  assert.equal(formatFuelRemaining(0), "Est. Endurance - 0 Hours 0 Minutes");
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
      time_aloft_min: 5,
    }),
    null,
  );
  assert.equal(
    estimateFuelRemaining({
      tail: "N305DK",
      airborne: false,
      time_aloft_min: 5,
    }),
    null,
  );
});

test("estimateFuelRemaining hides airborne aircraft without source-derived elapsed duration", () => {
  assert.equal(
    estimateFuelRemaining({
      tail: "N305DK",
      airborne: true,
    }),
    null,
  );
});

test("estimateFuelRemaining clamps exhausted duration at zero", () => {
  const estimate = estimateFuelRemaining({
    tail: "N305DK",
    airborne: true,
    time_aloft_min: 9999,
  });
  assert.equal(estimate?.label, "Est. Endurance - 0 Hours 0 Minutes");
  assert.equal(estimate?.minutesRemaining, 0);
});

test("estimateFuelRemaining subtracts elapsed current-flight duration from mean max duration", () => {
  const estimate = estimateFuelRemaining({
    tail: "N422CT",
    airborne: true,
    time_aloft_min: 5,
  });

  assert.equal(estimate?.maxDurationMinutes, 240);
  assert.equal(estimate?.elapsedMinutes, 5);
  assert.equal(estimate?.minutesRemaining, 235);
  assert.equal(estimate?.label, "Est. Endurance - 3 Hours 55 Minutes");
});

test("estimateFuelRemaining uses mean duration for aircraft with duration ranges", () => {
  const estimate = estimateFuelRemaining({
    tail: "N9446P",
    airborne: true,
    time_aloft_min: 42,
  });

  assert.equal(estimate?.maxDurationMinutes, 282);
  assert.equal(estimate?.minutesRemaining, 240);
  assert.equal(estimate?.label, "Est. Endurance - 4 Hours 0 Minutes");
});
