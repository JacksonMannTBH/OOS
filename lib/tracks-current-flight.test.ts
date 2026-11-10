// Run: npx tsx --test lib/tracks-current-flight.test.ts

import { test } from "node:test";
import assert from "node:assert";
import {
  CURRENT_FLIGHT_GAP_SECONDS,
  getCurrentFlightDurationFromPoints,
  getCurrentFlightTrackFromPoints,
  getCurrentFlightTrack,
  type TrackPoint,
} from "./tracks";
import { GET as getTrails } from "../app/api/trails/route";

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

test("map trails retain the latest recorded points until the session closes", async (t) => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "https://tracks-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-key";
  t.after(() => {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  });
  const now = Date.parse("2026-11-02T20:14:00Z");
  t.mock.method(Date, "now", () => now);
  let session: string | null = "n13sd-flight";
  let latestPosition = "2026-11-02T20:09:00Z";
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "tracks-test.supabase.co");
    if (url.pathname.endsWith("/aircraft")) return Response.json({ id: "n13sd" });
    if (url.pathname.endsWith("/aircraft_current_state")) return Response.json({ flight_session_id: session });
    if (url.pathname.endsWith("/aircraft_positions")) {
      assert.equal(url.searchParams.get("flight_session_id"), "eq.n13sd-flight");
      return Response.json([
        { latitude: 48.01, longitude: -121.95, observed_at: "2026-11-02T19:56:02Z" },
        { latitude: 48.008, longitude: -121.76, observed_at: latestPosition },
      ]);
    }
    throw new Error(`Unexpected query: ${url.pathname}`);
  });
  assert.equal((await getCurrentFlightTrack("N13SD", now))?.points.length, 2);
  const request = new Request("https://app.test/api/trails?tails=N13SD");
  assert.equal((await (await getTrails(request)).json()).trails.N13SD.length, 2);
  latestPosition = "2026-11-02T20:13:59Z";
  const response = await getTrails(request);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.trails.N13SD.length, 2);
  assert.equal(body.trails.N13SD[1].ts, Date.parse(latestPosition) / 1000);
  session = null;
  assert.deepEqual(await (await getTrails(request)).json(), { trails: {} });
});
