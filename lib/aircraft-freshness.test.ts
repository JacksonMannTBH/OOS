import assert from "node:assert/strict";
import { test } from "node:test";
import { AIRCRAFT_REPORT_TIMEOUT_MS, ageAircraftSnapshot, isAircraftStateResolved, isVisibleFlight, retainAircraftSnapshot } from "./aircraft-freshness";
import { getDatabaseSnapshot } from "./aircraft-data";
import { computeStatus, makeFleetMap } from "./status";
import { getRideContacts, getRideDisplayContacts } from "./ride-mode";
import { FLEET } from "./seed";
import type { Aircraft, Snapshot } from "./types";

const now = Date.parse("2026-10-16T20:00:00Z");
const plane: Aircraft = { ...FLEET[0]!, icao24: "a00001", airborne: true, observed: true,
  observed_at: new Date(now - 360_000).toISOString(), lat: 34, lon: -118 };
const snapshot: Snapshot = { fetched_at: now - 360_000, source: "adsblol", aircraft: [plane], live_seen_count: 1 };

test("a saved aircraft state opens Home regardless of feed health", () => {
  assert.equal(isAircraftStateResolved({ ...snapshot, fetched_at: 0, aircraft: [] }), false);
  assert.equal(isAircraftStateResolved({ ...snapshot, source_ok: false, aircraft: [] }), true);
  assert.equal(isAircraftStateResolved(ageAircraftSnapshot(snapshot, now + 86_400_000)), true);
});

test("four minutes without a report displays an aircraft as landed without blocking Home", () => {
  const reportedAt = now;
  const fresh = { ...snapshot, fetched_at: now, aircraft: [{ ...plane, observed_at: new Date(reportedAt).toISOString() }] };
  assert.equal(isVisibleFlight(ageAircraftSnapshot(fresh, now + AIRCRAFT_REPORT_TIMEOUT_MS - 1).aircraft[0]!), true);
  const expired = ageAircraftSnapshot(fresh, now + AIRCRAFT_REPORT_TIMEOUT_MS);
  assert.equal(expired.aircraft[0]!.airborne, false);
  assert.equal(expired.aircraft[0]!.observation_status, "grounded");
  assert.equal(computeStatus(expired, makeFleetMap(expired.aircraft)).headline, "No Eyes");
  assert.deepEqual(getRideContacts(expired.aircraft, { lat: 34, lon: -118 }), []);
  assert.deepEqual(getRideDisplayContacts(expired.aircraft, { lat: 34, lon: -118 }), []);
  assert.equal(isAircraftStateResolved(expired), true);
});

test("new reports for other aircraft do not reset an individual aircraft's four-minute deadline", () => {
  const freshPlane = { ...plane, tail: "NNEW", observed_at: new Date(now).toISOString() };
  const result = ageAircraftSnapshot({ ...snapshot, fetched_at: now, aircraft: [plane, freshPlane] }, now);
  assert.equal(result.aircraft[0]!.observation_status, "grounded");
  assert.equal(result.aircraft[1]!.airborne, true);
});

test("a new airborne report restores an aircraft after its four-minute timeout", () => {
  const expired = ageAircraftSnapshot(snapshot, now);
  assert.equal(expired.aircraft[0]!.airborne, false);
  const incoming = { ...snapshot, fetched_at: now, source_ok: true,
    aircraft: [{ ...plane, observed_at: new Date(now).toISOString() }] };
  const recovered = ageAircraftSnapshot(retainAircraftSnapshot(expired, incoming), now);
  assert.equal(recovered.aircraft[0]!.airborne, true);
  assert.equal(isVisibleFlight(recovered.aircraft[0]!), true);
});

test("a newer landing replaces the retained flight, while a failed request preserves it", () => {
  const retained = retainAircraftSnapshot(snapshot, { ...snapshot, fetched_at: now, source_ok: false, aircraft: [] });
  assert.deepEqual(retained.aircraft, snapshot.aircraft);
  const landed = retainAircraftSnapshot(retained, { ...snapshot, fetched_at: now + 1, source_ok: false,
    aircraft: [{ ...plane, airborne: false, observation_status: "grounded" }] });
  assert.equal(isVisibleFlight(landed.aircraft[0]!), false);
  assert.equal(computeStatus(landed, makeFleetMap(landed.aircraft)).headline, "No Eyes");
});

test("a fresh app load reads the latest saved position and flight even after a long provider gap", async t => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "https://freshness-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-key";
  t.after(() => {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  });
  t.mock.method(Date, "now", () => now);
  let status = "airborne";
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "freshness-test.supabase.co");
    if (url.pathname.endsWith("/aircraft_live_public")) return Response.json([{
      ...plane, observation_status: status, home_state_code: "CA", flight_session_id: "flight-1",
      observed_at: plane.observed_at, last_seen_at: plane.observed_at, latitude: plane.lat, longitude: plane.lon,
    }]);
    if (url.pathname.endsWith("/ingestion_runs")) return Response.json({ source: "adsblol", finished_at: plane.observed_at });
    throw new Error(`Unexpected query: ${url.pathname}`);
  });
  const result = await getDatabaseSnapshot("CA");
  assert.equal(result.aircraft[0]?.airborne, true);
  assert.equal(result.aircraft[0]?.observed, true);
  assert.equal(result.aircraft[0]?.lat, plane.lat);
  assert.equal(result.aircraft[0]?.lon, plane.lon);
  assert.equal(result.source_ok, false, "source health stays truthful without hiding the saved state");
  status = "grounded";
  const landed = await getDatabaseSnapshot("CA");
  assert.equal(landed.aircraft[0]?.airborne, false);
  assert.equal(landed.aircraft[0]?.observation_status, "grounded");
});


test("an older response cannot replace the most recent saved state", () => {
  const latest = { ...snapshot, fetched_at: now, aircraft: [{ ...plane, airborne: false }] };
  assert.deepEqual(retainAircraftSnapshot(latest, snapshot).aircraft, latest.aircraft);
});
