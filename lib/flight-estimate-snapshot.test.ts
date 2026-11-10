import assert from "node:assert/strict";
import { test } from "node:test";
import { getDatabaseSnapshot } from "./aircraft-data";
import { estimateFuelRemaining } from "./fuel-estimate";

test("snapshot carries first-seen time into estimates for low-confidence flights", async (t) => {
  const now = Date.now();
  t.mock.method(Date, "now", () => now);
  const env = { SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY };
  process.env.SUPABASE_URL = "https://first-seen-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";
  t.after(() => {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const start = new Date(now - 10 * 60_000).toISOString();
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "first-seen-test.supabase.co");
    if (url.pathname.endsWith("/ingestion_runs")) {
      return Response.json({ finished_at: new Date(now).toISOString(), source: "adsblol" });
    }
    assert.ok(url.pathname.endsWith("/aircraft_live_public"));
    return Response.json([{
      tail: "N422CT", observation_status: "airborne", home_state_code: "WA",
      observed_at: new Date(now - 30_000).toISOString(),
      flight_session_id: "existing-flight", tracking_started_at: start,
      detected_takeoff_at: null, takeoff_confidence: "low", nominal_endurance_min: 240,
    }]);
  });
  const snapshot = await getDatabaseSnapshot("WA");
  const aircraft = snapshot.aircraft[0];
  assert.ok(aircraft);
  assert.equal(aircraft.tracking_started_at, start);
  assert.equal(estimateFuelRemaining(aircraft)?.minutesRemaining, 230);
});
