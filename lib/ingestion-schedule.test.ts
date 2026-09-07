import assert from "node:assert";
import { test } from "node:test";
import {
  buildSampleOffsets,
  normalizeAircraftSampleInterval,
  fleetSampleInterval,
} from "./ingestion-schedule";

test("ten-second ingestion produces six deadline-based samples per minute", () => {
  assert.deepEqual(buildSampleOffsets(10_000), [
    0,
    10_000,
    20_000,
    30_000,
    40_000,
    50_000,
  ]);
});

test("national polling budgets request spacing and finishes scheduled samples within the minute", () => {
  assert.equal(fleetSampleInterval(10_000, 1100), 30_000);
  assert.equal(fleetSampleInterval(60_000, 1100), 60_000);
  assert.deepEqual(buildSampleOffsets(fleetSampleInterval(10_000, 1100)), [0, 30_000]);
  assert.deepEqual(buildSampleOffsets(25_000), [0, 25_000]);
});

test("aircraft sample interval is configurable within safe bounds", () => {
  assert.equal(normalizeAircraftSampleInterval("15000"), 15_000);
  assert.equal(normalizeAircraftSampleInterval("4999"), 10_000);
  assert.equal(normalizeAircraftSampleInterval("invalid"), 10_000);
});
