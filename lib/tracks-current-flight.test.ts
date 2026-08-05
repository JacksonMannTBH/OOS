// Run: npx tsx --test lib/tracks-current-flight.test.ts

import { test } from "node:test";
import assert from "node:assert";
import {
  CURRENT_FLIGHT_GAP_SECONDS,
  getCurrentFlightDurationFromPoints,
  getCurrentFlightTrackFromPoints,
  type TrackPoint,
} from "./tracks";

function point(ts: number): TrackPoint {
  return {
    lat: 47.6,
    lon: -122.3,
    alt: null,
    spd: null,
    trk: null,
    ts,
  };
}

test("getCurrentFlightDurationFromPoints uses the latest continuous persisted session", () => {
  const nowSec = 10_000;
  const points = [
    point(nowSec - 8_000),
    point(nowSec - 90),
    point(nowSec - 60),
    point(nowSec - 30),
    point(nowSec),
  ];
  const estimate = getCurrentFlightDurationFromPoints(
    points,
    nowSec * 1000,
  );
  const track = getCurrentFlightTrackFromPoints(points, nowSec * 1000);

  assert.equal(estimate?.elapsedMinutes, 1);
  assert.equal(estimate?.startedAtMs, (nowSec - 90) * 1000);
  assert.equal(estimate?.sampleCount, 4);
  assert.deepEqual(
    track?.points.map((p) => p.ts),
    [nowSec - 90, nowSec - 60, nowSec - 30, nowSec],
  );
});

test("getCurrentFlightTrackFromPoints does not stitch separate flights inside retention window", () => {
  const nowSec = 10_000;
  const points = [
    point(nowSec - 45 * 60),
    point(nowSec - 44 * 60),
    point(nowSec - 90),
    point(nowSec - 60),
    point(nowSec - 30),
  ];
  const track = getCurrentFlightTrackFromPoints(points, nowSec * 1000);

  assert.deepEqual(
    track?.points.map((p) => p.ts),
    [nowSec - 90, nowSec - 60, nowSec - 30],
  );
});

test("getCurrentFlightDurationFromPoints ignores stale track history", () => {
  const nowSec = 10_000;
  const estimate = getCurrentFlightDurationFromPoints(
    [point(nowSec - CURRENT_FLIGHT_GAP_SECONDS - 1)],
    nowSec * 1000,
  );

  assert.equal(estimate, null);
});
