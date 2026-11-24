import assert from "node:assert/strict";
import test from "node:test";
import { sampleAircraftMotion, updateAircraftMotion, type AircraftMotionTarget } from "./aircraft-map-motion";

const fix = (lon: number, observedAtMs = 1_000, heading = 90): AircraftMotionTarget => ({
  position: [lon, 47.5], heading, observedAtMs,
});
const pixels = (from: [number, number], to: [number, number]) => Math.abs(to[0] - from[0]) * 10_000;

test("an aircraft starts at its reported fix and remains there between updates", () => {
  const target = fix(-122.26);
  const motion = updateAircraftMotion(undefined, target, 0, pixels);
  for (const now of [0, 100, 3_000, 31_000, 60_000]) {
    const frame = sampleAircraftMotion(motion, now);
    assert.deepEqual(frame.position, target.position);
    assert.equal(frame.active, false);
  }
});

test("small movements catch up faster, large movements finish within 2400ms, and neither overshoots", () => {
  const start = updateAircraftMotion(undefined, fix(-122.26), 0, pixels);
  const small = updateAircraftMotion(start, fix(-122.259, 2_000), 100, pixels);
  const large = updateAircraftMotion(start, fix(-122.16, 2_000), 100, pixels);
  assert(small.durationMs < large.durationMs);
  assert(small.durationMs >= 900 && small.durationMs < 1_200);
  assert(large.durationMs <= 2_400);
  assert.deepEqual(sampleAircraftMotion(small, 100).position, start.to);
  for (const motion of [small, large]) {
    let previous = start.to[0];
    for (let elapsed = 0; elapsed <= 2_600; elapsed += 10) {
      const frame = sampleAircraftMotion(motion, 100 + elapsed);
      assert(frame.position[0] >= previous);
      assert(frame.position[0] <= motion.to[0]);
      previous = frame.position[0];
    }
    assert.deepEqual(sampleAircraftMotion(motion, 2_500).position, motion.to);
    assert.equal(sampleAircraftMotion(motion, 2_500).active, false);
  }
});

test("an update received during movement continues from the currently displayed position", () => {
  const start = updateAircraftMotion(undefined, fix(-122.26), 0, pixels);
  const moving = updateAircraftMotion(start, fix(-122.25, 2_000), 100, pixels);
  const before = sampleAircraftMotion(moving, 200);
  const next = updateAircraftMotion(moving, fix(-122.24, 3_000), 200, pixels);
  assert(before.active);
  assert.deepEqual(sampleAircraftMotion(next, 200).position, before.position);
  assert.deepEqual(sampleAircraftMotion(next, next.startedAt + next.durationMs).position, [-122.24, 47.5]);
});

test("repeated fixes and fleet refreshes do not restart or prolong movement", () => {
  const target = fix(-122.25, 2_000);
  const start = updateAircraftMotion(undefined, fix(-122.26), 0, pixels);
  const moving = updateAircraftMotion(start, target, 100, pixels);
  assert.equal(updateAircraftMotion(moving, target, 150, pixels), moving);
  const refreshed = updateAircraftMotion(moving, { ...target, observedAtMs: 3_000 }, 200, pixels);
  assert.equal(refreshed.startedAt, moving.startedAt);
  assert.equal(refreshed.durationMs, moving.durationMs);
  assert.deepEqual(sampleAircraftMotion(refreshed, 400), sampleAircraftMotion(moving, 400));
});

test("older position reports cannot rewind an aircraft, including after it stops", () => {
  const start = updateAircraftMotion(undefined, fix(-122.26), 0, pixels);
  const moving = updateAircraftMotion(start, fix(-122.25, 2_000), 100, pixels);
  for (const now of [200, 1_000, 31_000]) {
    assert.equal(updateAircraftMotion(moving, fix(-122.26), now, pixels), moving);
  }
  assert.deepEqual(sampleAircraftMotion(moving, 31_000).position, [-122.25, 47.5]);
});

test("heading crosses north by the short turn and a turn in place remains smooth", () => {
  const start = updateAircraftMotion(undefined, fix(-122.26, 1_000, 359), 0, pixels);
  const turning = updateAircraftMotion(start, fix(-122.26, 2_000, 1), 100, pixels);
  const halfway = sampleAircraftMotion(turning, 100 + turning.durationMs / 2);
  assert(halfway.heading < 2 || halfway.heading > 358);
  assert(halfway.active);
  assert.deepEqual(halfway.position, start.to);
  assert.equal(sampleAircraftMotion(turning, turning.startedAt + turning.durationMs).heading, 1);
});
