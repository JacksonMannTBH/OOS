import assert from "node:assert/strict";
import { test } from "node:test";

// Exercise the public alert flows with a fake Capacitor bridge. No device tokens
// or production services are used by these tests.
test("iOS alerts use FCM, refresh tokens, and serialize disabling safely", async (t) => {
  Object.defineProperty(globalThis, "CapacitorCustomPlatform", { configurable: true, value: { name: "ios" } });
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) },
  } });
  const { registerPlugin } = await import("@capacitor/core");
  const listeners = new Map<string, (event: { value?: string; error?: string }) => void>();
  let permission = "prompt";
  let token = "fcm-test-registration-token-1";
  let registrationFailure = false;
  let nativeConfigured = false;
  let gate: Promise<void> | undefined;
  let registrationStarted: (() => void) | undefined;
  const calls: string[] = [];
  registerPlugin("OOSNotificationSetup", { ios: {
    status: async () => ({ configured: nativeConfigured }),
  } });
  registerPlugin("PushNotifications", { ios: {
    checkPermissions: async () => ({ receive: permission }),
    requestPermissions: async () => { permission = "granted"; return { receive: permission }; },
    createChannel: async () => assert.fail("Android channels must never be created on iOS"),
    addListener: async (name: string, callback: (event: { value?: string; error?: string }) => void) => {
      listeners.set(name, callback);
      return { remove: async () => { listeners.delete(name); } };
    },
    register: async () => {
      registrationStarted?.();
      await gate;
      if (registrationFailure) listeners.get("registrationError")?.({ error: "not_configured" });
      else listeners.get("registration")?.({ value: token });
    },
    unregister: async () => { calls.push("unregister"); },
  } });
  let enabled = false;
  let failDelete = false;
  const postedTokens: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, options?: RequestInit) => {
    const method = options?.method ?? "GET";
    if (method === "GET") {
      assert.match(url, /transport=fcm/);
      return Response.json({ configured: true, enabled, stateCode: "WA" });
    }
    calls.push(method);
    if (method === "POST") {
      const body = JSON.parse(String(options?.body));
      assert.equal(body.subscription.transport, "fcm");
      postedTokens.push(body.subscription.token);
      enabled = true;
    }
    if (method === "DELETE") {
      if (failDelete) return new Response(null, { status: 503 });
      enabled = false;
    }
    return Response.json({ ok: true });
  });
  const client = await import("./aircraft-alerts/client");
  await t.test("missing iPhone setup blocks enrollment before permission or token registration", async () => {
    const status = await client.readAircraftAlertStatus();
    assert.equal(status.configured, false);
    assert.equal(status.message, "native_not_configured");
    await assert.rejects(client.enableAircraftAlerts({ stateCode: "WA" }), /native_not_configured/);
    assert.equal(permission, "prompt");
    assert.equal(postedTokens.length, 0);
    assert.equal(listeners.size, 0);
  });
  await t.test("older iPhone builds fail closed when the readiness plugin is missing", async () => {
    const { Capacitor } = await import("@capacitor/core");
    const available = Capacitor.isPluginAvailable.bind(Capacitor);
    const mock = t.mock.method(Capacitor, "isPluginAvailable", (name: string) => name !== "OOSNotificationSetup" && available(name));
    assert.equal((await client.readAircraftAlertStatus()).message, "native_update_required");
    await assert.rejects(client.enableAircraftAlerts({ stateCode: "WA" }), /native_update_required/);
    assert.equal(permission, "prompt");
    mock.mock.restore();
  });
  nativeConfigured = true;
  assert.equal((await client.enableAircraftAlerts({ stateCode: "WA" })).enabled, true);
  assert.deepEqual(postedTokens, [token]);
  assert.equal(listeners.size, 0);

  token = "fcm-test-registration-token-2";
  await client.syncAircraftAlertPreferences({ stateCode: "WA" });
  assert.equal(postedTokens.at(-1), token);

  // A refresh started before disable must finish before DELETE, preventing
  // a late POST from re-enabling notifications against the user's choice.
  let release!: () => void;
  gate = new Promise<void>((resolve) => { release = resolve; });
  const started = new Promise<void>((resolve) => { registrationStarted = resolve; });
  const refresh = client.syncAircraftAlertPreferences({ stateCode: "WA" });
  await started;
  const disable = client.disableAircraftAlerts();
  release();
  await Promise.all([refresh, disable]);
  assert.equal(enabled, false);
  assert.deepEqual(calls.slice(-3), ["POST", "DELETE", "unregister"]);
  assert.equal(listeners.size, 0);

  failDelete = true;
  await assert.rejects(client.disableAircraftAlerts(), /unsubscribe_failed/);
  failDelete = false;
  gate = undefined;
  registrationFailure = true;
  await assert.rejects(client.enableAircraftAlerts({ stateCode: "WA" }), /not_configured/);
  assert.equal(enabled, false);
  assert.equal(listeners.size, 0);
});
