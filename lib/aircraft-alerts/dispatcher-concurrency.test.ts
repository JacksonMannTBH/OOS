import assert from "node:assert/strict";
import { test } from "node:test";

test("notification delivery caps concurrency, honors claims/preferences, and leaves work after its deadline", async t => {
  const env = { SUPABASE_URL: "https://dispatch-test.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-only", FCM_RELAY_URL: "https://relay.test/send", FCM_RELAY_SECRET: "test-only" };
  const globals = globalThis as any;
  const previousDeno = globals.Deno, previousNetlify = globals.Netlify;
  globals.Deno = { env: { get: (key: keyof typeof env) => env[key] }, serve: () => {} };
  globals.Netlify = { env: { get: (key: keyof typeof env) => env[key] } };
  t.after(() => { globals.Deno = previousDeno; globals.Netlify = previousNetlify; });
  const { dispatchPendingTakeoffNotifications } = await import(process.env.OOS_DISPATCH_TEST_ENTRY ?? "./dispatcher");
  let now = 1_000, active = 0, peak = 0, phase = "normal";
  t.mock.method(Date, "now", () => now);
  const sent: string[] = [], claimed: string[] = [], writes: any[] = [];
  const deliveries = Array.from({ length: 12 }, (_, i) => ({
    id: String(i), attempt_count: 0,
    notification_events: { state_code: "WA", flight_session_id: `flight-${i}`, payload: { tail: `N${i}`, model: "Cessna 182" }, occurred_at: new Date().toISOString(), flight_sessions: { status: "airborne" } },
    push_endpoints: { id: String(i), endpoint: `token-${i}`, transport: "fcm" },
  }));
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname === "relay.test") {
      const token = JSON.parse(String(init?.body)).token;
      sent.push(token); peak = Math.max(peak, ++active);
      await new Promise<void>(resolve => setTimeout(resolve, 5)); active--;
      if (phase === "deadline") now = 10_000;
      return new Response(null, { status: token === "token-8" ? 503 : token === "token-9" ? 410 : 200 });
    }
    assert.equal(url.hostname, "dispatch-test.supabase.co");
    const id = url.searchParams.get("id")?.slice(3);
    if (url.pathname.endsWith("/notification_deliveries") && (!init?.method || init.method === "GET")) return Response.json(deliveries);
    if (url.pathname.endsWith("/notification_subscriptions")) {
      const endpoint = url.searchParams.get("push_endpoint_id")?.slice(3);
      return Response.json({ enabled: endpoint !== "10", state_code: "WA", excluded_aircraft_by_state: {}, push_endpoints: { enabled: true } });
    }
    if (url.pathname.endsWith("/notification_deliveries")) {
      const body = JSON.parse(String(init?.body)); writes.push({ id, ...body });
      if (body.status === "processing") { claimed.push(id!); return Response.json(id === "11" ? [] : [{ id }]); }
      assert.ok(url.searchParams.get("claim_token"), "completion writes must retain claim ownership");
      return new Response(null, { status: 204 });
    }
    assert.ok(url.pathname.endsWith("/push_endpoints"));
    return new Response(null, { status: 204 });
  });
  const result = await dispatchPendingTakeoffNotifications();
  assert.equal(peak, 4); assert.equal(active, 0);
  assert.equal(sent.length, 10); assert.equal(new Set(sent).size, 10);
  assert.ok(!sent.includes("token-10") && !sent.includes("token-11"));
  assert.deepEqual(result, { claimed: 11, sent: 8, failed: 1, expired: 1, skipped: 1 });
  assert.ok(writes.some(w => w.id === "8" && w.status === "failed" && w.next_attempt_at));
  phase = "deadline"; claimed.length = 0; sent.length = 0; peak = 0;
  await dispatchPendingTakeoffNotifications({ maxDurationMs: 100 });
  assert.equal(claimed.length, 4, "no new delivery claimed once the deadline passes");
  assert.equal(active, 0, "all in-flight sends settle before the worker returns");
});
