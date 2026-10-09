import test from "node:test";
import assert from "node:assert/strict";
import { finiteHeading, headingFromOrientationEvent } from "./device-heading";

test("missing and invalid headings stay unavailable instead of pointing north", () => {
  for (const value of [null, undefined, "", "0", false, NaN, Infinity, -1]) assert.equal(finiteHeading(value), null);
  assert.equal(finiteHeading(0), 0);
  assert.equal(finiteHeading(360), 0);
  assert.equal(finiteHeading(270), 270);
});

test("compass readings use valid absolute data only", () => {
  assert.equal(headingFromOrientationEvent({ alpha: null, absolute: true }), null);
  assert.equal(headingFromOrientationEvent({ alpha: 90, absolute: false }), null);
  assert.equal(headingFromOrientationEvent({ alpha: 90, absolute: true }), 270);
  assert.equal(headingFromOrientationEvent({ webkitCompassHeading: 30, webkitCompassAccuracy: 5, alpha: 90, absolute: false }), 30);
  assert.equal(headingFromOrientationEvent({ webkitCompassHeading: 30, webkitCompassAccuracy: -1, alpha: null, absolute: false }), null);
});
