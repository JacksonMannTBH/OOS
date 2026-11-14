import assert from "node:assert/strict";
import { test } from "node:test";
import { getDatabaseSnapshot, getNationalMapSnapshot } from "../../lib/aircraft-data";
import { GET } from "../../app/api/map-aircraft/route";

const now = new Date().toISOString();
const rows = ["WA", "CA", "TX"].map((state, i) => ({ tail: `N${100 + i}TEST`, home_state_code: state,
  observation_status: "airborne", observed_at: now, last_seen_at: now, source: "adsbfi", icao24: "abc123",
  operator: "Patrol", model: "Cessna 182", base: "Airport", role: "fixed_wing", role_confidence: "confirmed",
  latitude: 47.5, longitude: -122.26, altitude_ft: 2500, ground_speed_kt: 100, heading_deg: 90 }));

test("nationwide map endpoint reads all public flight pages without a state filter or notification writes", async t => {
  const previous = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  process.env.SUPABASE_URL = "https://nationwide-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";
  t.after(() => { if (previous.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous.url;
    if (previous.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.key; });
  const offsets: number[] = [];
  let stateRead = false;
  let fail = false;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/read_prepared_aircraft_response")) return Response.json({ status: "claimed", generation: "test" });
    if (url.pathname.endsWith("/finish_prepared_aircraft_response")) return Response.json(true);
    assert.equal(init?.method ?? "GET", "GET");
    if (fail) return Response.json({ message: "unavailable" }, { status: 503 });
    if (url.pathname === "/rest/v1/ingestion_runs") return Response.json({ finished_at: now, source: "adsbfi" });
    assert.equal(url.pathname, "/rest/v1/aircraft_live_public");
    if (url.searchParams.get("home_state_code")) {
      assert.equal(url.searchParams.get("home_state_code"), "eq.CA"); stateRead = true; return Response.json([rows[1]]);
    }
    assert.equal(url.searchParams.get("observation_status"), "in.(airborne,airborne_candidate,landing_candidate)");
    assert.equal(url.searchParams.get("observed_at"), "not.is.null");
    const offset = Number(url.searchParams.get("offset") ?? 0); offsets.push(offset);
    // Simulate a server row cap lower than the requested page size.
    return Response.json(rows.slice(offset, offset + 2));
  });
  const national = await getNationalMapSnapshot();
  assert.deepEqual(national.aircraft.map(p => p.home_state_code), ["WA", "CA", "TX"]);
  assert.deepEqual(offsets, [0, 2, 3]);
  assert(national.aircraft.every(p => p.airborne && p.altitude_ft === 2500));
  const selected = await getDatabaseSnapshot("CA");
  assert(stateRead); assert.deepEqual(selected.aircraft.map(p => p.home_state_code), ["CA"]);
  const response = await GET();
  assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "no-store");
  fail = true;
  const failed = await GET();
  assert.equal(failed.status, 503); assert.deepEqual(await failed.json(), { error: "map_aircraft_unavailable" });
});
