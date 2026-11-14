import assert from "node:assert/strict";
import { test } from "node:test";

test("prepared downloads coalesce a rush of callers, refresh generations, and recover from errors", async t => {
  const env = { SUPABASE_URL: "https://prepared-test.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-only" };
  const globals = globalThis as any;
  const previousDeno = globals.Deno, previousNetlify = globals.Netlify;
  globals.Deno = { env: { get: (key: keyof typeof env) => env[key] }, serve: () => {} };
  globals.Netlify = { env: { get: (key: keyof typeof env) => env[key] } };
  t.after(() => { globals.Deno = previousDeno; globals.Netlify = previousNetlify; });
  const { getPreparedAircraftResponse } = await import(process.env.OOS_PREPARED_TEST_ENTRY ?? "./prepared-aircraft-response");
  const cache = new Map<string, { generation: string; payload: unknown }>();
  let generation = "one", reads = 0, builds = 0, unavailable = false, busy = 0;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(new URL(String(input)).hostname, "prepared-test.supabase.co");
    const args = JSON.parse(String(init?.body));
    if (unavailable) return Response.json({ message: "cache unavailable" }, { status: 503 });
    if (String(input).endsWith("/read_prepared_aircraft_response")) {
      reads++;
      if (busy-- > 0) return Response.json({ status: "busy" });
      const item = cache.get(args.input_key);
      return Response.json(item?.generation === generation ? { status: "ready", payload: item.payload }
        : { status: "claimed", generation });
    }
    assert.ok(String(input).endsWith("/finish_prepared_aircraft_response"));
    if (args.input_payload != null && args.input_generation === generation) cache.set(args.input_key, { generation, payload: args.input_payload });
    return Response.json(true);
  });
  const build = async () => { builds++; await new Promise<void>(resolve => setImmediate(resolve)); return { version: 1, state: "WA", cursor: generation, trails: { N1: [{ lat: 47, lon: -122, ts: 1 }] } }; };
  const key = "oos-prepared-v1:live:WA";
  const responses = await Promise.all(Array.from({ length: 100 }, () => getPreparedAircraftResponse(key, build)));
  assert.equal(builds, 1); assert.equal(reads, 1);
  for (const response of responses) assert.deepEqual(response, responses[0]);
  await getPreparedAircraftResponse(key, build);
  assert.equal(builds, 1, "another request reuses the shared result");
  generation = "two";
  assert.equal((await getPreparedAircraftResponse(key, build)).cursor, "two");
  assert.equal(builds, 2);
  await getPreparedAircraftResponse("oos-prepared-v1:live:CA", async () => ({ state: "CA" }));
  assert.equal((await getPreparedAircraftResponse(key, build)).state, "WA");
  generation = "three"; busy = 1;
  await getPreparedAircraftResponse(key, build);
  assert.equal(builds, 3, "a competing worker only delays the load briefly");
  generation = "four";
  await assert.rejects(getPreparedAircraftResponse(key, async () => { throw Error("load failed"); }), /load failed/);
  await getPreparedAircraftResponse(key, build);
  assert.equal(builds, 4, "failed builds do not poison subsequent requests");
  unavailable = true;
  assert.equal((await getPreparedAircraftResponse(key, build)).state, "WA", "cache failures use the normal data path");
});
