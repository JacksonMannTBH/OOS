// Read-only checks. Does not register devices or send notifications.
import assert from "node:assert/strict";
import fs from "node:fs";
const backend = JSON.parse(fs.readFileSync(new URL("../backend.json", import.meta.url), "utf8"));
const headers = { apikey: backend.publishableKey };
async function read(path, init = {}) {
  const response = await fetch(`${backend.url}/${path}`, { headers, signal: AbortSignal.timeout(30_000), ...init });
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  return response.json();
}
for (const state of ["WA", "CA", "TX"]) {
  const snapshot = await read(`aircraft?state=${state}`);
  assert.ok(snapshot.aircraft.length > 0, `${state}: missing aircraft`);
  console.log(`${state}: ${snapshot.aircraft.length} aircraft`);
}
const catalog = await read("mobile?kind=catalog");
assert.ok(catalog.length >= 343);
await Promise.all(["mobile?kind=settings", "mobile?kind=recent-flight&tail=N60TX", "activity?limit=1&state_id=texas", "trails?tails=N60TX", "flight-paths?state=TX&tails=N60TX"].map(path => read(path)));
const status = await read("aircraft-alerts/subscription?userId=11111111-1111-4111-8111-111111111111&transport=fcm");
for (const [path, expected] of [["predict", 404], ["mobile?kind=forecast", 400]]) {
  const response = await fetch(`${backend.url}/${path}`, { headers, signal: AbortSignal.timeout(10_000) });
  assert.equal(response.status, expected, `${path}: retired feature must not run`);
}
assert.equal(status.enabled, false);
const unauthorized = await fetch(`${backend.url}/aircraft`, { signal: AbortSignal.timeout(10_000) });
assert.equal(unauthorized.status, 401);
const options = await fetch(`${backend.url}/aircraft`, { method: "OPTIONS", headers: { Origin: "capacitor://localhost", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "apikey" }, signal: AbortSignal.timeout(10_000) });
assert.equal(options.status, 204);
assert.equal(options.headers.get("Access-Control-Allow-Origin"), "capacitor://localhost");
assert.equal(status.configured, true, "Native push credentials must be configured in Supabase before release");
console.log("Supabase app API checks passed; no notifications sent.");
