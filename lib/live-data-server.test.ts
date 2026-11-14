import assert from "node:assert/strict";
import { test } from "node:test";
import { SUPPORTED_STATE_CODES } from "./app-states";
import { type LiveFrame, type LiveDelta } from "./live-data-protocol";

const flush = () => new Promise<void>(resolve => setImmediate(resolve));

test("nationwide broadcasts share reads, send only inserted points, and bootstrap complete paginated trails", async t => {
  const globals = globalThis as any;
  const previousDeno = globals.Deno, previousNetlify = globals.Netlify;
  const env = { SUPABASE_URL: "https://live-test.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-only" };
  globals.Deno = { env: { get: (key: keyof typeof env) => env[key] }, serve: () => {} };
  globals.Netlify = { env: { get: (key: keyof typeof env) => env[key] } };
  t.after(() => { globals.Deno = previousDeno; globals.Netlify = previousNetlify; });
  const { broadcastLiveStates, getLiveState } = await import(process.env.OOS_LIVE_DATA_TEST_ENTRY ?? "./live-data-server");
  const now = Date.now(), cursor = now - 1_000, base = now - 25_000;
  const iso = (time: number) => new Date(time).toISOString();
  t.mock.method(Date, "now", () => now);
  const rows = Array.from({ length: 1104 }, (_, i) => ({
    tail: `N${String(i).padStart(4, "0")}`, icao24: i.toString(16).padStart(6, "0"),
    home_state_code: i === 0 ? "WA" : i === 1 ? "CA" : SUPPORTED_STATE_CODES[i % 50],
    observation_status: i < 2 ? "airborne" : "grounded", observed_at: iso(now - 5_000),
    flight_session_id: i < 2 ? `flight-${i}` : null, latitude: 47, longitude: -122,
    role_description: i === 0 ? "large state payload ".repeat(12_000) : "test",
  }));
  const points = [
    ...Array.from({ length: 1105 }, (_, i) => ({
      id: i + 1, flight_session_id: "flight-0", latitude: 47, longitude: -122,
      observed_at: iso(now - 2_000_000 + i * 1_000), created_at: iso(now - 2_000_000 + i * 1_000),
    })),
    // An old observation arriving now must still be delivered.
    { id: 1106, flight_session_id: "flight-0", latitude: 48, longitude: -123, observed_at: iso(now - 90_000), created_at: iso(now - 5_000) },
    { id: 1107, flight_session_id: "flight-1", latitude: 38, longitude: -121, observed_at: iso(now - 4_000), created_at: iso(now - 4_000) },
  ];
  let counters = { aircraft: 0, runs: 0, positions: 0, broadcasts: 0 };
  let phase: "delta" | "full" = "delta", failState: string | null = null;
  let active = 0, peak = 0;
  const framesByState = new Map<string, LiveFrame[]>();
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "live-test.supabase.co");
    if (url.pathname.endsWith("/read_prepared_aircraft_response")) return Response.json({ status: "claimed", generation: "test" });
    if (url.pathname.endsWith("/finish_prepared_aircraft_response")) return Response.json(true);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 500);
    if (url.pathname.endsWith("/aircraft_live_public")) {
      counters.aircraft++;
      const scope = url.searchParams.get("home_state_code")!;
      if (phase === "delta") assert.ok(scope.startsWith("in.("), "one shared nationwide read, never one query per state");
      const selected = scope.startsWith("eq.") ? rows.filter(r => r.home_state_code === scope.slice(3)) : rows;
      return Response.json(selected.slice(offset, offset + limit));
    }
    if (url.pathname.endsWith("/ingestion_runs")) {
      counters.runs++;
      assert.equal(url.searchParams.get("limit"), "2");
      return Response.json([{ finished_at: iso(cursor), source: "adsbfi" }, { finished_at: iso(base), source: "adsbfi" }]);
    }
    if (url.pathname.endsWith("/aircraft_positions")) {
      counters.positions++;
      const ids = url.searchParams.get("flight_session_id")!.slice(4, -1).split(",");
      const lower = url.searchParams.getAll("created_at").find(v => v.startsWith("gte."));
      assert.equal(Boolean(lower), phase === "delta");
      if (lower) assert.equal(Date.parse(lower.slice(4)), base);
      assert.ok(url.searchParams.getAll("created_at").some(v => v.startsWith("lte.")));
      const selected = points.filter(p => ids.includes(p.flight_session_id) && (!lower || Date.parse(p.created_at) >= base));
      return Response.json(selected.slice(offset, offset + limit));
    }
    assert.equal(url.pathname, "/realtime/v1/api/broadcast", "no per-aircraft ID/session lookups are allowed");
    counters.broadcasts++;
    peak = Math.max(peak, ++active);
    const { messages } = JSON.parse(String(init?.body));
    assert.ok(messages.length >= 1 && messages.length <= 4);
    const state = messages[0].payload.state;
    for (const message of messages) {
      assert.equal(message.private, true);
      assert.equal(message.topic, `oos-live:${state}`);
      assert.equal(message.event, "state");
      if (!framesByState.has(state)) framesByState.set(state, []);
      framesByState.get(state)!.push(message.payload);
    }
    await flush(); active--;
    return new Response(null, { status: state === failState ? 503 : 202 });
  });
  const decoded = () => new Map([...framesByState].map(([state, frames]) =>
    [state, JSON.parse(frames.sort((a, b) => a.index - b.index).map(f => f.data).join("")) as LiveDelta]));

  await t.test("one shared paginated read and one new-points batch for all 50 states", { skip: !!process.env.OOS_LIVE_BOOTSTRAP_ONLY }, async () => {
    await broadcastLiveStates();
    assert.equal(counters.aircraft, 4, "1104 rows plus the terminating page");
    assert.equal(counters.runs, 1);
    assert.equal(counters.positions, 2, "new points plus the terminating page");
    assert.equal(peak, 4);
    const updates = decoded();
    assert.equal(updates.size, 50);
    assert.equal([...updates.values()].reduce((sum, u) => sum + u.snapshot.aircraft.length, 0), 1104);
    const wa = updates.get("WA")!;
    assert.equal(wa.version, 2); assert.equal(wa.cursor, cursor); assert.equal(wa.baseCursor, base);
    assert.equal(wa.trails.N0000!.length, 1, "1105 historic points must not be reread or resent");
    assert.equal(wa.trails.N0000![0]!.ts, Math.floor((now - 90_000) / 1_000));
    assert.ok(framesByState.get("WA")!.length > 4, "large state snapshots retain complete framing");
  });

  await t.test("full connection/recovery reads paginate past 1000 history points", async () => {
    phase = "full";
    counters = { aircraft: 0, runs: 0, positions: 0, broadcasts: 0 };
    const full = await getLiveState("WA");
    assert.equal(full.cursor, cursor);
    assert.deepEqual(full.sessions, { N0000: "flight-0" });
    assert.equal(full.trails.N0000.length, 1106);
    assert.equal(counters.positions, 4);
    assert.equal(counters.broadcasts, 0);
  });

  await t.test("a failed broadcast does not skip later states, and source outages keep the cursor", { skip: !!process.env.OOS_LIVE_BOOTSTRAP_ONLY }, async () => {
    phase = "delta"; failState = SUPPORTED_STATE_CODES[0]!;
    framesByState.clear();
    await assert.rejects(broadcastLiveStates(true), /Live broadcast failed/);
    assert.equal(framesByState.size, 50);
    for (const update of decoded().values()) {
      assert.equal(update.snapshot.source_ok, false);
      assert.equal(update.cursor, cursor);
    }
  });
});
