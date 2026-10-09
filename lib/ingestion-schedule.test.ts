import assert from "node:assert";
import { test } from "node:test";
import { normalizeAircraftSampleInterval } from "./ingestion-schedule";

test("aircraft sample interval is configurable within safe bounds", () => {
  assert.equal(normalizeAircraftSampleInterval("15000"), 15_000);
  assert.equal(normalizeAircraftSampleInterval("4999"), 10_000);
  assert.equal(normalizeAircraftSampleInterval("invalid"), 10_000);
});
