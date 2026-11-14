import test from "node:test";
import assert from "node:assert/strict";
import { activePoliceSightings, hasNearbyPolice, type PoliceSighting } from "./police-sightings";
import { createPoliceHandler } from "../cloud-backend/src/police-handler";
import { backendUrl } from "../mobile/frontend/network";

const sample: PoliceSighting = { id: "test", stateCode: "WA", lat: 47.5, lon: -122.26, reportCount: 2, lastReportedAt: 1_000, expiresAt: 1_801_000 };
test("sightings expire at 30 minutes and never cross the selected state", () => {
  assert.equal(activePoliceSightings([sample], "WA", 1_800_999).length, 1);
  assert.equal(activePoliceSightings([sample], "WA", 1_801_000).length, 0);
  assert.equal(activePoliceSightings([sample], "CA", 2_000).length, 0);
});
test("nearby is 0.3 statute miles in any direction", () => {
  assert.equal(hasNearbyPolice([sample], null), false);
  assert.equal(hasNearbyPolice([sample], { lat: 47.50434, lon: -122.26 }), true);
  assert.equal(hasNearbyPolice([sample], { lat: 47.50435, lon: -122.26 }), false);
  assert.equal(hasNearbyPolice([sample], { lat: 47.49566, lon: -122.26 }), true);
  assert.equal(hasNearbyPolice([sample], { lat: 47.49565, lon: -122.26 }), false);
  assert.equal(hasNearbyPolice([sample], { lat: 47.5, lon: -122.25359 }), true);
  assert.equal(hasNearbyPolice([sample], { lat: 47.5, lon: -122.25357 }), false);
});
test("only police requests use the isolated function", () => {
  assert.match(backendUrl("/api/police?state=WA", "capacitor://localhost/ride"), /\/oos-police\?state=WA$/);
  assert.match(backendUrl("/api/aircraft?state=WA", "capacitor://localhost/ride"), /\/oos-app\/aircraft\?state=WA$/);
  assert.equal(backendUrl("https://other.example/api/police", "capacitor://localhost/ride"), "https://other.example/api/police");
});

const key = "sb_publishable_test";
const calls: { name: string; args: Record<string, unknown> }[] = [];
let stateLookups = 0;
let cooldown = 0;
const handler = createPoliceHandler(() => JSON.stringify({ default: key }), async (name, args) => {
  calls.push({ name, args });
  return name === "oos_police_cooldown" ? cooldown : name === "oos_police_read" ? [] : { status: "reported" };
}, async () => { stateLookups++; return "WA"; });
const makeRequest = (method = "GET", body?: unknown, headers: Record<string, string> = {}) => new Request("https://test/oos-police?state=WA", {
  method, headers: { apikey: key, origin: "capacitor://localhost", ...headers }, body: body === undefined ? undefined : JSON.stringify(body),
});
const report = () => ({ reporterToken: "a".repeat(64), lat: 47.5, lon: -122.26, accuracy: 5, capturedAt: Date.now(), stateCode: "TX" });
test("police API rejects untrusted origins, missing keys, and malformed writes", async () => {
  assert.equal((await handler(makeRequest("GET", undefined, { origin: "https://untrusted.example" }))).status, 403);
  assert.equal((await handler(makeRequest("GET", undefined, { apikey: "" }))).status, 401);
  assert.equal((await handler(makeRequest("OPTIONS", undefined, { apikey: "" }))).status, 204);
  assert.equal((await handler(makeRequest("POST", null))).status, 400);
  assert.equal((await handler(makeRequest("POST", { ...report(), accuracy: 101 }))).status, 400);
  assert.equal((await handler(makeRequest("POST", { ...report(), capturedAt: Date.now() - 31_000 }))).status, 400);
  assert.equal((await handler(makeRequest("POST", { ...report(), lat: 91 }))).status, 400);
});
test("server resolves the actual state and only sends a hashed capability to storage", async () => {
  calls.length = 0;
  const response = await handler(makeRequest("POST", report()));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "capacitor://localhost");
  const write = calls.find(c => c.name === "oos_police_report")!;
  assert.equal(write.args.p_state, "WA");
  assert.notEqual(write.args.p_reporter, "a".repeat(64));
  assert.match(String(write.args.p_reporter), /^[a-f0-9]{64}$/);
});
test("cooldown skips geocoding; unsupported coordinates never publish", async () => {
  cooldown = 20_000;
  const before = stateLookups;
  const data = await (await handler(makeRequest("POST", report()))).json();
  assert.equal(data.status, "cooldown");
  assert.equal(stateLookups, before);
  cooldown = 0;
  const outside = createPoliceHandler(() => JSON.stringify({ default: key }), async () => 0, async () => null);
  assert.equal((await outside(makeRequest("POST", report()))).status, 422);
});
test("read and undo stay behind the API and undo retains owner identity", async () => {
  calls.length = 0;
  const data = await (await handler(makeRequest())).json();
  assert.deepEqual(data.sightings, []);
  assert.equal(calls[0]?.args.p_state, "WA");
  const id = "11111111-1111-4111-8111-111111111111";
  assert.equal((await handler(makeRequest("DELETE", { reporterToken: "a".repeat(64), reportId: id }))).status, 200);
  assert.equal(calls.at(-1)?.args.p_report_id, id);
  assert.match(String(calls.at(-1)?.args.p_reporter), /^[a-f0-9]{64}$/);
});

test("preparing a police tap is read-only and requires fresh actual-state coordinates", async () => {
  calls.length = 0;
  assert.equal((await handler(makeRequest("POST", { ...report(), action: "prepare" }))).status, 200);
  assert.deepEqual(calls.map(c => c.name), ["oos_police_prepare"]);
  assert.equal(calls[0]?.args.p_state, "WA");
});
test("voting requires a target and an explicit choice; new reports require confirmation on a race", async () => {
  for (const extra of [{ action: "invalid" }, { action: "vote" }, { action: "vote", sightingId: "bad", vote: "not_seen" }, { action: "vote", sightingId: "11111111-1111-4111-8111-111111111111", vote: "no" }]) {
    calls.length = 0;
    assert.equal((await handler(makeRequest("POST", { ...report(), ...extra }))).status, 400);
    assert.equal(calls.length, 0);
  }
  calls.length = 0;
  await handler(makeRequest("POST", { ...report(), action: "vote", sightingId: "11111111-1111-4111-8111-111111111111", vote: "not_seen" }));
  assert.equal(calls.at(-1)?.name, "oos_police_submit");
  assert.equal(calls.at(-1)?.args.p_vote, "not_seen");
  assert.equal(calls.at(-1)?.args.p_require_new, false);
  assert.equal(calls.at(-1)?.args.p_sighting, "11111111-1111-4111-8111-111111111111");
  await handler(makeRequest("POST", { ...report(), action: "report" }));
  assert.equal(calls.at(-1)?.args.p_require_new, true);
  assert.equal(calls.at(-1)?.args.p_sighting, null);
});
