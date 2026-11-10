import assert from "node:assert/strict";
import { test } from "node:test";

test("cloud API routes Texas activity separately and keeps unsupported states closed", async (t) => {
  let handler!: (request: Request) => Promise<Response>;
  const globals = globalThis as any;
  const oldDeno = globals.Deno;
  const oldNetlify = globals.Netlify;
  globals.Deno = {
    env: { get: (key: string) => ({ SUPABASE_URL: "https://texas-api-test.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-only" })[key] },
    serve: (fn: typeof handler) => { handler = fn; },
  };
  t.after(() => { globals.Deno = oldDeno; globals.Netlify = oldNetlify; });
  let reads = 0;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "texas-api-test.supabase.co");
    assert.equal(url.pathname, "/rest/v1/flight_sessions");
    reads++;
    return Response.json(["N60TX", "N153HP", "N305DK"].map(tail => ({
      detected_takeoff_at: "2026-10-18T12:00:00Z", detected_landing_at: null,
      aircraft: { tail, role: "patrol", icao24: "abcdef", nickname: null },
    })));
  });
  await import(process.env.OOS_API_TEST_ENTRY ?? "../src/api");
  for (const [code, tail] of [["TX", "N60TX"], ["CA", "N153HP"], ["WA", "N305DK"]]) {
    const response = await handler(new Request(`https://local.test/oos-api/activity?state=${code}`));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.deepEqual(data.entries.map((row: { tail: string }) => row.tail), [tail]);
  }
  assert.equal((await handler(new Request("https://local.test/oos-api/aircraft?state=NY"))).status, 400);
  assert.equal((await handler(new Request("https://local.test/oos-api/aircraft?state=TX", { method: "POST" }))).status, 405);
  assert.equal(reads, 3);
});
