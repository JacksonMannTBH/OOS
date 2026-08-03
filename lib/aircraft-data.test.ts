import assert from "node:assert";
import { test } from "node:test";
import {
  isNewerAircraftObservation,
  shouldClearUnobservedState,
} from "./aircraft-data";

test("an already-unknown aircraft does not need another clearing write", () => {
  assert.equal(shouldClearUnobservedState(undefined), true);
  assert.equal(
    shouldClearUnobservedState({
      observation_status: "airborne",
      observed_at: "2026-08-02T12:00:00.000Z",
    }),
    true,
  );
  assert.equal(
    shouldClearUnobservedState({
      observation_status: "unknown",
      observed_at: null,
    }),
    false,
  );
});

test("duplicate and out-of-order provider observations are ignored", () => {
  const previous = {
    observed_at: "2026-08-02T12:00:10.000Z",
    last_seen_at: "2026-08-02T12:00:10.000Z",
  };

  assert.equal(
    isNewerAircraftObservation(previous, "2026-08-02T12:00:10.000Z"),
    false,
  );
  assert.equal(
    isNewerAircraftObservation(previous, "2026-08-02T12:00:09.000Z"),
    false,
  );
  assert.equal(
    isNewerAircraftObservation(previous, "2026-08-02T12:00:11.000Z"),
    true,
  );
});
