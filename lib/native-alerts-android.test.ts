import assert from "node:assert/strict";
import { test } from "node:test";

test("Android subscribers receive the sound channel before token enrollment and refresh", async (t) => {
  Object.defineProperty(globalThis, "CapacitorCustomPlatform", { configurable: true, value: { name: "android" } });
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) },
  } });
  const { registerPlugin } = await import("@capacitor/core");
  const listeners = new Map<string, (event: { value: string }) => void>();
  const sequence: string[] = [];
  let failChannel = false;
  let enabled = true; // An existing subscriber upgrading from the default sound.
  registerPlugin("PushNotifications", { android: {
    checkPermissions: async () => ({ receive: "granted" }),
    createChannel: async (channel: { id: string; sound: string }) => {
      sequence.push("channel");
      assert.notEqual(channel.id, "aircraft_alerts");
      assert.equal(channel.id, "aircraft_alerts_radar_v1");
      assert.equal(channel.sound, "oos_radar_ping.wav");
      if (failChannel) throw new Error("channel_failed");
    },
    deleteChannel: async () => assert.fail("Keep existing channels and user preferences"),
    addListener: async (name: string, callback: (event: { value: string }) => void) => {
      listeners.set(name, callback);
      return { remove: async () => { listeners.delete(name); } };
    },
    register: async () => {
      sequence.push("register");
      listeners.get("registration")?.({ value: "fcm-android-test-device-token" });
    },
  } });
  t.mock.method(globalThis, "fetch", async (_url: string, options?: RequestInit) => {
    if ((options?.method ?? "GET") === "POST") {
      sequence.push("subscribe");
      assert.equal(JSON.parse(String(options?.body)).subscription.transport, "fcm");
      enabled = true;
      return Response.json({ ok: true });
    }
    return Response.json({ configured: true, enabled, stateCode: "WA" });
  });
  const client = await import("./aircraft-alerts/client");
  await client.syncAircraftAlertPreferences({ stateCode: "WA" });
  assert.deepEqual(sequence, ["channel", "register", "subscribe"]);
  assert.equal(listeners.size, 0);

  enabled = false;
  sequence.length = 0;
  await client.enableAircraftAlerts({ stateCode: "WA" });
  assert.deepEqual(sequence, ["channel", "register", "subscribe"]);
  assert.equal(listeners.size, 0);

  // A channel failure must not enroll a device that cannot present its sound.
  failChannel = true;
  sequence.length = 0;
  await assert.rejects(client.syncAircraftAlertPreferences({ stateCode: "WA" }), /channel_failed/);
  assert.deepEqual(sequence, ["channel"]);
  assert.equal(listeners.size, 0);
});
