import assert from "node:assert/strict";
import { test } from "node:test";

test("ingestion reuses its catalog and resolves only fresh positioned observations in batches", async t => {
  const env = { SUPABASE_URL: "https://ingest-efficiency-test.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-only" };
  const globals = globalThis as any;
  const previousDeno = globals.Deno, previousNetlify = globals.Netlify;
  globals.Deno = { env: { get: (key: keyof typeof env) => env[key] }, serve: () => {} };
  globals.Netlify = { env: { get: (key: keyof typeof env) => env[key] } };
  t.after(() => { globals.Deno = previousDeno; globals.Netlify = previousNetlify; });
  const { ingestSnapshot } = await import(process.env.OOS_INGEST_EFFICIENCY_ENTRY ?? "./aircraft-data");
  const now = Date.now(), previousAt = new Date(now - 10_000).toISOString();
  const catalog = Array.from({ length: 203 }, (_, i) => ({ id: String(i), tail: `N${i}TEST`, home_state_code: "WA", icao24: "abc123" }));
  const batchSizes: number[] = []; let lifecycle: any;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "ingest-efficiency-test.supabase.co");
    if (url.pathname.endsWith("/aircraft_current_state")) {
      const ids = url.searchParams.get("aircraft_id")!.slice(4, -1).split(",");
      return Response.json(ids.map(id => ({ aircraft_id: id, observed_at: previousAt, last_seen_at: previousAt, observation_status: "grounded", consecutive_grounded: 2, consecutive_airborne: 0, flight_session_id: null })));
    }
    if (url.pathname.endsWith("/resolve_aircraft_states_batch")) {
      const positions = JSON.parse(String(init?.body)).input_positions;
      batchSizes.push(positions.length);
      return Response.json(positions.map((p: any) => ({ aircraft_id: p.aircraft_id, state_code: "OR" })));
    }
    if (url.pathname.endsWith("/apply_aircraft_lifecycle_batch")) {
      lifecycle = JSON.parse(String(init?.body));
      return Response.json({ positions_inserted: 0, inserted_aircraft_ids: [] });
    }
    if (url.pathname.endsWith("/data_source_health")) return new Response(null, { status: 201 });
    throw Error(`Unexpected reread or individual lookup: ${url.pathname}`);
  });
  await ingestSnapshot({ source: "adsbfi", source_ok: true, fetched_at: now, live_seen_count: 202,
    aircraft: catalog.map((row, i) => ({ ...row, observed: i !== 202, observed_at: i === 201 ? previousAt : new Date(now).toISOString(),
      airborne: false, observation_status: "grounded", lat: 45, lon: -123 })) }, "test-worker", { catalogSeeded: true, catalog });
  assert.deepEqual(batchSizes, [100, 100, 1]);
  const positioned = lifecycle.input_state_rows.filter((row: any) => row.latitude != null);
  assert.equal(positioned.length, 201);
  assert.ok(positioned.every((row: any) => row.current_state_code === "OR"));
  assert.ok(!lifecycle.input_state_rows.some((row: any) => row.aircraft_id === "201"), "duplicate observations cannot affect takeoff/landing counts");
});
