import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFleetBatchSnapshot } from "./adsb";
import { ingestSnapshot, type AircraftCatalogEntry } from "./aircraft-data";
import { FLEET, fleetHex } from "./seed";
import type { Aircraft, Snapshot } from "./types";

const entry = FLEET[0]!;
const other = FLEET[1]!;

test("a batch snapshot only contains queried aircraft, including missing provider rows", async (t) => {
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "opendata.adsb.fi");
    assert.equal(url.pathname.split("/").at(-1), fleetHex(entry));
    // An unrelated row must never enter the batch, even if returned upstream.
    return Response.json({ now: Date.now(), ac: [{ hex: fleetHex(other), alt_baro: 2000 }] });
  });
  const catalog: AircraftCatalogEntry[] = [{
    aircraft: entry, homeStateCode: "WA", nominalEnduranceMin: null,
    usableFuelGallons: null, lowBurnGph: null, highBurnGph: null, reserveMin: null,
  }];
  const snapshot = await buildFleetBatchSnapshot(catalog);
  assert.deepEqual(snapshot.aircraft.map((a) => a.tail), [entry.tail]);
  assert.equal(snapshot.aircraft[0]?.observed, false);
});

test("partial persistence preserves other aircraft and retains priority until landing is confirmed", async (t) => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "https://batch-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-key";
  t.after(() => {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  });
  const start = Date.parse("2026-10-09T12:00:00Z");
  let state: Record<string, unknown> = {
    aircraft_id: "aircraft-1", flight_session_id: "flight-1",
    observation_status: "airborne", consecutive_airborne: 2, consecutive_grounded: 0,
    observed_at: new Date(start).toISOString(), last_seen_at: new Date(start).toISOString(),
    last_airborne_at: new Date(start).toISOString(),
  };
  const writes: Array<Record<string, any>> = [];
  let catalogReads = 0;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "batch-test.supabase.co");
    if (url.pathname.endsWith("/aircraft")) {
      catalogReads++;
      assert.equal(url.searchParams.get("tail"), `in.(${entry.tail})`);
      return Response.json([{ ...entry, id: "aircraft-1", icao24: fleetHex(entry), home_state_code: "WA" }]);
    }
    if (url.pathname.endsWith("/aircraft_current_state")) {
      assert.equal(url.searchParams.get("aircraft_id"), "in.(aircraft-1)");
      return Response.json([state]);
    }
    if (url.pathname.endsWith("/flight_sessions")) {
      return Response.json([{ id: "flight-1", tracking_started_at: new Date(start - 60_000).toISOString(), closed_at: null }]);
    }
    if (url.pathname.endsWith("/apply_aircraft_lifecycle_batch")) {
      const body = JSON.parse(String(init?.body));
      writes.push(body);
      for (const row of body.input_state_rows) {
        assert.equal(row.aircraft_id, "aircraft-1", "no other aircraft may be changed");
        state = row;
      }
      return Response.json({ positions_inserted: 0, inserted_aircraft_ids: [] });
    }
    if (url.pathname.endsWith("/data_source_health")) return new Response(null, { status: 201 });
    throw new Error(`Unexpected database query: ${url.pathname}`);
  });
  const snapshot = (offset: number, updates: Partial<Aircraft> = {}): Snapshot => ({
    source: "adsbfi", source_ok: true, fetched_at: start + offset,
    live_seen_count: 1,
    aircraft: [{ ...entry, icao24: fleetHex(entry), observed: true, airborne: false,
      observation_status: "grounded", observed_at: new Date(start + offset).toISOString(),
      ...updates }],
  });
  const ingest = (s: Snapshot) => ingestSnapshot(s, "test-worker", { catalogSeeded: true });
  const landing = await ingest(snapshot(10_000));
  assert.equal(state.observation_status, "landing_candidate");
  assert.deepEqual(landing.priorityAircraftTails, [entry.tail]);
  // Duplicate upstream observations must not count as a second landing sample.
  await ingest(snapshot(10_000));
  assert.equal(state.observation_status, "landing_candidate");
  // A coverage gap keeps the active session and its priority.
  const missing = await ingest(snapshot(15_000, { observed: false }));
  assert.deepEqual(missing.priorityAircraftTails, [entry.tail]);
  const landed = await ingest(snapshot(20_000));
  assert.deepEqual(landed.priorityAircraftTails, []);
  assert.equal(state.observation_status, "grounded");
  assert.equal(writes.at(-1)?.input_finalizations[0].flight_session_id, "flight-1");
  const takingOff = await ingest(snapshot(30_000, { airborne: true, observation_status: "airborne_candidate" }));
  assert.deepEqual(takingOff.priorityAircraftTails, [entry.tail]);
  assert.equal(state.observation_status, "airborne_candidate");
  const before = catalogReads;
  const failed = await ingest({ ...snapshot(40_000), source_ok: false });
  assert.equal(failed.sourceHealthy, false);
  assert.equal(catalogReads, before, "source failure must not clear current aircraft state");
});
