import assert from "node:assert/strict";
import { test } from "node:test";
import { formatPitchDegrees, projectPitchHorizon } from "./ride-pitch-display";

test("level reference moves below the fixed marker for positive pitch and above for negative pitch", () => {
  assert.deepEqual(projectPitchHorizon(0), { offset: 0, groundAbove: false });
  assert(Math.abs(projectPitchHorizon(45)!.offset - 85) < 0.000001);
  assert(Math.abs(projectPitchHorizon(-45)!.offset + 85) < 0.000001);
});

test("vertical and inverted poses keep finite geometry and the correct ground side", () => {
  for (const angle of [89.999999, 90, 90.000001, -90, 180, 270, 360, 450]) {
    const view = projectPitchHorizon(angle)!;
    assert(Number.isFinite(view.offset));
    assert(Math.abs(view.offset) <= 1000);
  }
  assert.equal(projectPitchHorizon(90)!.offset, 1000);
  assert.equal(projectPitchHorizon(-90)!.offset, -1000);
  assert.equal(projectPitchHorizon(120)!.groundAbove, true);
  assert.equal(projectPitchHorizon(180)!.groundAbove, true);
  assert.equal(projectPitchHorizon(360)!.groundAbove, false);
  assert(Math.abs(projectPitchHorizon(384)!.offset - projectPitchHorizon(24)!.offset) < 0.000001);
  assert.equal(projectPitchHorizon(NaN), null);
  assert.equal(projectPitchHorizon(Infinity), null);
});

test("pitch retains its sign and full angle without a negative zero or fabricated reading", () => {
  assert.equal(formatPitchDegrees(-24.4), "−24°");
  assert.equal(formatPitchDegrees(-0.4), "0°");
  assert.equal(formatPitchDegrees(120.3), "120°");
  assert.equal(formatPitchDegrees(null), "—");
  assert.equal(formatPitchDegrees(NaN), "—");
});
