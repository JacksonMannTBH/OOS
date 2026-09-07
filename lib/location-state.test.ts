import assert from "node:assert/strict";
import test from "node:test";
import {
  stateCodeFromCensusResponse,
  validCoordinates,
} from "./location-state";
import { shouldAutoDetectStateSelection } from "./app-states";

test("validCoordinates accepts real coordinates and rejects invalid ranges", () => {
  assert.equal(validCoordinates(47.6062, -122.3321), true);
  assert.equal(validCoordinates(91, -122.3321), false);
  assert.equal(validCoordinates(47.6062, -181), false);
  assert.equal(validCoordinates(Number.NaN, -122.3321), false);
});

test("stateCodeFromCensusResponse reads supported postal abbreviations", () => {
  assert.equal(
    stateCodeFromCensusResponse({
      result: { geographies: { States: [{ STUSAB: "WA" }] } },
    }),
    "WA",
  );
  assert.equal(
    stateCodeFromCensusResponse({
      result: { geographies: { States: [{ STUSAB: "DC" }] } },
    }),
    null,
  );
  assert.equal(stateCodeFromCensusResponse({}), null);
});

test("automatic state detection never overrides a saved selection", () => {
  assert.equal(shouldAutoDetectStateSelection(null, null), true);
  assert.equal(shouldAutoDetectStateSelection("WA", "automatic"), false);
  assert.equal(shouldAutoDetectStateSelection("CA", "manual"), false);
  assert.equal(shouldAutoDetectStateSelection("TX", null), false);
});
