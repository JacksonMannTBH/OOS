import assert from "node:assert/strict";
import { test } from "node:test";

test("every scheduled tick retries after failures, without old backoff or Retry-After delays", async (t) => {
  const token = "a".repeat(64);
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
  let handler: (request: Request) => Promise<Response>;
  const globals = globalThis as any;
  const previousDeno = globals.Deno;
  const previousNetlify = globals.Netlify;
  globals.Deno = {
    env: { get: (key: string) => ({ SUPABASE_URL: "https://polling-test.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-only" })[key] },
    serve: (fn: typeof handler) => { handler = fn; },
  };
  t.after(() => { globals.Deno = previousDeno; globals.Netlify = previousNetlify; });
  let now = Date.parse("2026-10-16T23:00:00Z");
  t.mock.method(Date, "now", () => now);
  t.mock.method(console, "error", () => {});
  let providerCalls = 0;
  let releases = 0;
  let leaseAvailable = true;
  const failures = ["timeout", "500", "429", "timeout", "500"];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname === "opendata.adsb.fi") {
      const failure = failures[providerCalls++];
      if (failure === "timeout") throw new DOMException("Signal timed out.", "TimeoutError");
      return new Response("", { status: Number(failure), headers: { "Retry-After": "300" } });
    }
    assert.equal(url.hostname, "polling-test.supabase.co");
    if (url.pathname.endsWith("/app_settings")) {
      assert.equal(url.searchParams.get("key"), "eq.adsblol_ingest_token_hash", "old backoff settings must not gate or delay attempts");
      return Response.json({ value: digest });
    }
    if (url.pathname.endsWith("/claim_worker_lease")) return Response.json(leaseAvailable);
    if (url.pathname.endsWith("/release_worker_lease")) { releases++; return Response.json(true); }
    if (url.pathname.endsWith("/aircraft_catalog_public")) {
      assert.deepEqual(new Set(url.searchParams.get("home_state_code")!.slice(4, -1).split(",")), new Set(["WA", "CA", "TX"]));
      return Response.json([{ tail: "N60TX", icao24: "a7c15c", home_state_code: "TX" }]);
    }
    if (url.pathname.endsWith("/ingestion_runs") && init?.method === "POST") {
      assert.equal(JSON.parse(String(init.body)).source, "adsbfi");
      return Response.json({ id: "test-run" });
    }
    if (url.pathname.endsWith("/ingestion_runs") || url.pathname.endsWith("/data_source_health")) return new Response(null, { status: 204 });
    throw new Error(`Unexpected request: ${url.pathname}`);
  });
  await import(process.env.OOS_INGEST_TEST_ENTRY ?? "../src/ingest");
  const invoke = () => handler(new Request("https://local.test/oos-ingest", {
    method: "POST", headers: { "x-oos-ingest-token": token },
  }));
  for (let i = 0; i < failures.length; i++) {
    const response = await invoke();
    assert.equal(response.status, 503);
    assert.equal((await response.json()).retry_after_seconds, 30);
    assert.equal(providerCalls, i + 1, "each 30-second tick must contact the provider after any previous failure");
    assert.equal(releases, i + 1);
    now += 30_000;
  }
  leaseAvailable = false;
  assert.equal((await (await invoke()).json()).skipped, "another worker is active");
  assert.equal(providerCalls, failures.length, "overlapping requests remain blocked");
  assert.equal((await handler!(new Request("https://local.test/oos-ingest", { method: "POST" }))).status, 401);
});
