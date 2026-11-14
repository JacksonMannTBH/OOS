import assert from "node:assert/strict";
import { test } from "node:test";
import { appRoutes, createAppHandler } from "../src/app-handler";

const key = "sb_publishable_test";
const env = () => JSON.stringify({ default: key });
const url = "https://example.supabase.co/functions/v1/oos-app/aircraft-alerts/subscription";

test("native API authenticates before any handler and fails closed on missing configuration", async () => {
  let calls = 0;
  const routes = { "aircraft-alerts/subscription": { GET: async () => { calls++; return Response.json({ enabled: true }); } } };
  for (const apikey of [undefined, "wrong", "sb_secret_not_allowed"]) {
    const result = await createAppHandler(routes, env)(new Request(url, { headers: apikey ? { apikey } : {} }));
    assert.equal(result.status, 401);
  }
  assert.equal(calls, 0);
  for (const value of [undefined, "{}", "invalid", "null"]) {
    assert.equal((await createAppHandler(routes, () => value)(new Request(url, { headers: { apikey: key } }))).status, 503);
  }
});

test("native API preserves subscription write bodies and serves uncached CORS responses", async () => {
  const payload = { userId: "11111111-1111-4111-8111-111111111111", stateCode: "TX", excludedAircraftByState: { texas: ["N60TX"] } };
  const handler = createAppHandler({ "aircraft-alerts/subscription": { PATCH: async request => {
    assert.deepEqual(await request.json(), payload);
    return Response.json({ enabled: true, stateCode: "TX" }, { headers: { "Cache-Control": "public, max-age=300", "Netlify-CDN-Cache-Control": "public" } });
  } } }, env);
  const headers = { apikey: key, origin: "capacitor://localhost", "content-type": "application/json" };
  const response = await handler(new Request(url, { method: "PATCH", headers, body: JSON.stringify(payload) }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), headers.origin);
  assert.equal(response.headers.get("Netlify-CDN-Cache-Control"), null);
  const preflight = await handler(new Request(url, { method: "OPTIONS", headers: { origin: headers.origin } }));
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get("Access-Control-Allow-Headers")!, /apikey/);
  assert.equal((await handler(new Request(url, { headers: { ...headers, origin: "https://other.example" } }))).status, 403);
});

test("native API exposes only explicit routes and methods, with sanitized failures", async () => {
  const headers = { apikey: key };
  const handler = createAppHandler({ aircraft: { GET: async () => { throw new Error("database failure"); } } }, env);
  assert.equal((await handler(new Request(url, { headers }))).status, 404);
  assert.equal((await handler(new Request(url.replace("aircraft-alerts/subscription", "constructor"), { headers }))).status, 404);
  const path = url.replace("aircraft-alerts/subscription", "aircraft");
  assert.equal((await handler(new Request(path, { headers, method: "POST" }))).status, 405);
  const failed = await handler(new Request(path, { headers }));
  assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), { error: "request_unavailable" });
  assert.deepEqual(Object.keys(appRoutes).sort(), ["activity", "aircraft", "aircraft-alerts/subscription", "aircraft-alerts/test", "flight-paths", "live", "location-state", "map-aircraft", "mobile", "trails"]);
});

test("removed forecasts cannot be requested through either native API path", async () => {
  const handler = createAppHandler(appRoutes, env);
  const headers = { apikey: key };
  const base = "https://example.supabase.co/functions/v1/oos-app/";
  assert.equal((await handler(new Request(base + "predict", { headers }))).status, 404);
  assert.equal((await handler(new Request(base + "mobile?kind=forecast", { headers }))).status, 400);
});
