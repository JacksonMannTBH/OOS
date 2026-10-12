import assert from "node:assert/strict";
import { test } from "node:test";
import { getDatabaseSnapshot } from "./aircraft-data";
import { filterNationwideTrackedAircraft } from "./aircraft-tracking";

test("nationwide tracking applies exclusions using each aircraft's home state", () => {
  const planes = [
    { tail: "N123", home_state_code: "WA" },
    { tail: "N456", home_state_code: "CA" },
    { tail: "N789", home_state_code: "TX" },
  ];
  assert.deepEqual(filterNationwideTrackedAircraft(planes, { WA: ["N456"], CA: ["N456"] }), [planes[0], planes[2]]);
});

test("nationwide snapshots read past database row caps while state snapshots stay scoped", async (t) => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "https://nationwide-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-key";
  t.after(() => {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  });
  const rows = Array.from({ length: 1101 }, (_, i) => ({
    tail: `N${String(i).padStart(4, "0")}`,
    home_state_code: i < 500 ? "WA" : "CA",
    observed_at: new Date().toISOString(),
    observation_status: "airborne",
    latitude: 40, longitude: -120,
  }));
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/ingestion_runs")) return Response.json({ finished_at: new Date().toISOString() });
    assert.ok(url.pathname.endsWith("/aircraft_live_public"));
    const state = url.searchParams.get("home_state_code")?.replace("eq.", "");
    const selected = state ? rows.filter((row) => row.home_state_code === state) : rows;
    const offset = Number(url.searchParams.get("offset") ?? 0);
    // Simulate a project with a lower cap than the requested page size.
    return Response.json(selected.slice(offset, offset + 200));
  });
  const nationwide = await getDatabaseSnapshot(null);
  assert.equal(nationwide.aircraft.length, 1101);
  assert.deepEqual([...new Set(nationwide.aircraft.map((a) => a.home_state_code))], ["WA", "CA"]);
  const selected = await getDatabaseSnapshot("WA");
  assert.equal(selected.aircraft.length, 500);
  assert.ok(selected.aircraft.every((a) => a.home_state_code === "WA"));
});
