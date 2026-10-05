import assert from "node:assert/strict";
import { test } from "node:test";
import { filterTrackedAircraft, isAircraftTracked, parseAircraftTrackingPreferences, withAircraftTracked, withStateAircraftExclusions } from "./aircraft-tracking";
import { isTakeoffDeliverySelected } from "./aircraft-alerts/eligibility";
import { dispatchPendingTakeoffNotifications } from "./aircraft-alerts/dispatcher";
import { updateAircraftAlertSubscriberPreferences } from "./aircraft-alerts/store";
import { PATCH } from "../app/api/aircraft-alerts/subscription/route";
import { computeStatus } from "./status";
import { getRideContacts } from "./ride-mode";
import type { Aircraft, Snapshot } from "./types";

test("all existing and newly added aircraft are tracked until explicitly excluded", () => {
  const preferences = withAircraftTracked({}, "WA", " n102lp ", false);
  assert.equal(isAircraftTracked({}, "WA", "N102LP"), true);
  assert.equal(isAircraftTracked(preferences, "WA", "n102lp"), false);
  assert.equal(isAircraftTracked(preferences, "WA", "N305DK"), true);
  assert.equal(isAircraftTracked(preferences, "CA", "N102LP"), true);
});

test("reselecting and resetting a state preserve the other state's choices", () => {
  const original = { WA: ["N102LP", "N305DK"], CA: ["N103CG"] };
  const reselected = withAircraftTracked(original, "WA", "N102LP", true);
  assert.deepEqual(reselected, { WA: ["N305DK"], CA: ["N103CG"] });
  assert.deepEqual(withStateAircraftExclusions(reselected, "WA", []), { CA: ["N103CG"] });
  assert.deepEqual(original, { WA: ["N102LP", "N305DK"], CA: ["N103CG"] });
});

test("preferences survive JSON storage and reject malformed state/tail data", () => {
  assert.deepEqual(parseAircraftTrackingPreferences(JSON.parse(JSON.stringify({ wa: [" n102lp", "N102LP"], WA: ["N305DK"], CA: [] }))), { WA: ["N102LP", "N305DK"] });
  for (const invalid of [null, [], { ZZ: ["N102LP"] }, { WA: "N102LP" }, { WA: [17] }, { WA: ["<script>"] }, { WA: Array(2001).fill("N102LP") }]) {
    assert.equal(parseAircraftTrackingPreferences(invalid), null);
  }
});

test("excluding the only airborne aircraft clears home and Ride Mode without mutating the feed", () => {
  const plane = { tail: "N102LP", operator: "WSP", model: "Cessna 182T", role: "fixed_wing", airborne: true, lat: 47.6, lon: -122.3 } as Aircraft;
  const original: Snapshot = { fetched_at: Date.now(), source: "mock", aircraft: [plane], live_seen_count: 1 };
  const fleet = new Map([[plane.tail, plane]]);
  assert.equal(computeStatus(original, fleet).kind, "alert");
  const filtered = { ...original, aircraft: filterTrackedAircraft(original.aircraft, { WA: [plane.tail] }, "WA") };
  assert.equal(computeStatus(filtered, fleet).kind, "clear");
  assert.equal(getRideContacts(original.aircraft, { lat: 47.6, lon: -122.3 }).length, 1);
  assert.equal(getRideContacts(filtered.aircraft, { lat: 47.6, lon: -122.3 }).length, 0);
  assert.equal(original.aircraft.length, 1);
  assert.equal(filterTrackedAircraft(original.aircraft, {}, "WA").length, 1);
});

test("notification eligibility honors current state, enabled status and per-state exclusions", () => {
  const subscription = { enabled: true, stateCode: "WA", excludedAircraftByState: { WA: ["N102LP"], CA: ["N305DK"] } };
  assert.equal(isTakeoffDeliverySelected(subscription, "WA", "N102LP"), false);
  assert.equal(isTakeoffDeliverySelected(subscription, "WA", "N305DK"), true);
  assert.equal(isTakeoffDeliverySelected(subscription, "CA", "N305DK"), false);
  assert.equal(isTakeoffDeliverySelected({ ...subscription, enabled: false }, "WA", "N305DK"), false);
  assert.equal(isTakeoffDeliverySelected({ ...subscription, excludedAircraftByState: {} }, "WA", "N102LP"), true);
  assert.equal(isTakeoffDeliverySelected({ ...subscription, excludedAircraftByState: null }, "WA", "N102LP"), false);
});

test("queued and retried notifications check the latest selection before contacting either push transport", async (t) => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  t.after(() => {
    if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  });
  process.env.SUPABASE_URL = "https://tracking-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  const writes: Array<{ path: string; body: Record<string, unknown> }> = [];
  let preferenceReads = 0;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "tracking-test.supabase.co", "No push provider should be contacted");
    if (init?.method === "PATCH") {
      const body = JSON.parse(String(init.body));
      writes.push({ path: url.pathname, body });
      return Response.json(body.status === "processing" ? { id: "delivery" } : null);
    }
    if (url.pathname.endsWith("notification_subscriptions")) {
      preferenceReads++;
      if (preferenceReads >= 3) return Response.json({ message: "temporary database failure" }, { status: 503 });
      return Response.json({ enabled: preferenceReads !== 2, state_code: "WA", excluded_aircraft_by_state: { WA: ["N102LP"] }, push_endpoints: { enabled: true } });
    }
    assert.equal(url.pathname, "/rest/v1/notification_deliveries");
    return Response.json([0, 1, 2].map((index) => ({
      id: `delivery-${index}`, attempt_count: index,
      notification_events: { state_code: "WA", occurred_at: new Date().toISOString(), payload: { tail: index === 0 ? "N102LP" : "N305DK" } },
      push_endpoints: { id: `endpoint-${index}`, endpoint: "test-only-endpoint", transport: index === 1 ? "fcm" : "web_push", p256dh: "test", auth: "test" },
    })));
  });
  const summary = await dispatchPendingTakeoffNotifications();
  assert.deepEqual(summary, { claimed: 3, sent: 0, failed: 1, expired: 0, skipped: 2 });
  assert.ok(preferenceReads >= 3);
  assert.deepEqual(writes.filter(w => w.body.status !== "processing").map(w => [w.body.status, w.body.failure_reason]), [["expired", "not_selected_for_tracking"], ["expired", "not_selected_for_tracking"], ["failed", "preference_read_failed"]]);
  assert.ok(writes.every(w => w.path.endsWith("notification_deliveries")), "Skipping an aircraft must not disable the device endpoint");
});

test("state-only updates preserve exclusions, and selection updates persist every state", async (t) => {
  const subscriptionWrites: Array<Record<string, unknown>> = [];
  const saved = { WA: ["N102LP"], CA: ["N103CG"] };
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "tracking-test.supabase.co");
    if (init?.method === "PATCH") {
      if (url.pathname.endsWith("notification_subscriptions")) subscriptionWrites.push(JSON.parse(String(init.body)));
      return new Response(null, { status: 204 });
    }
    return Response.json({ id: "endpoint", device_id: "test-device", endpoint: "test-only-endpoint", enabled: true, transport: "fcm", notification_subscriptions: { state_code: "WA", enabled: true, excluded_aircraft_by_state: saved } });
  });
  await updateAircraftAlertSubscriberPreferences("test-device", { stateCode: "CA" });
  assert.deepEqual(subscriptionWrites[0]?.excluded_aircraft_by_state, saved);
  await updateAircraftAlertSubscriberPreferences("test-device", { excludedAircraftByState: { CA: ["N103CG"] } });
  assert.deepEqual(subscriptionWrites[1]?.excluded_aircraft_by_state, { CA: ["N103CG"] });
});

test("subscription API rejects invalid selections before any database write", async (t) => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  t.after(() => {
    if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  });
  process.env.SUPABASE_URL = "https://tracking-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  t.mock.method(globalThis, "fetch", async () => { throw new Error("Database must not be called"); });
  const response = await PATCH(new Request("https://local.test/api/aircraft-alerts/subscription", {
    method: "PATCH", headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "00000000-0000-4000-8000-000000000000", stateCode: "WA", excludedAircraftByState: { WA: "N102LP" } }),
  }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_aircraft_preferences" });
});
