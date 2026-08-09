import assert from "node:assert/strict";
import test from "node:test";
import { proximityBandForDistance } from "./proximity-display";

test("proximity bands use configurable Ride Mode thresholds", () => {
  const thresholds = { watchNm: 12, warningNm: 7, stopNm: 2 };

  assert.equal(proximityBandForDistance(1.5, thresholds).band, "stop");
  assert.equal(proximityBandForDistance(5, thresholds).band, "slow");
  assert.equal(proximityBandForDistance(10, thresholds).band, "watch");
});
