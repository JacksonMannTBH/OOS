import assert from "node:assert/strict";
import { test } from "node:test";
import { DevicePreferenceStore } from "./device-preference-store";

function fixture() {
  const web = new Map<string, string>();
  const native = new Map<string, string>();
  let unavailable = false;
  let failSave = false;
  let failLoad = false;
  const browser = () => {
    if (unavailable) throw new Error("web storage unavailable");
    return {
      getItem: (key: string) => web.get(key) ?? null,
      setItem: (key: string, value: string) => { web.set(key, value); },
      removeItem: (key: string) => { web.delete(key); },
    };
  };
  const bridge = {
    get: async ({ key }: { key: string }) => {
      if (failLoad) throw new Error("load failed");
      return { value: native.get(key) ?? null };
    },
    set: async ({ key, value }: { key: string; value: string }) => {
      if (failSave) throw new Error("save failed");
      native.set(key, value);
    },
  };
  return { web, native, restart: () => new DevicePreferenceStore(browser, bridge), browser,
    blockWeb: () => { unavailable = true; }, failSave: (value: boolean) => { failSave = value; }, failLoad: (value: boolean) => { failLoad = value; } };
}
const aircraft = "oos_aircraft_tracking";
const device = "oos_aircraft_alert_device_id";
const optIn = "oos_aircraft_alert_opt_in";

test("migration retains choices and identity across repeated web-storage loss and app restarts", async () => {
  const f = fixture();
  const saved = JSON.stringify({ WA: ["N102LP"], CA: ["N103CG"] });
  f.web.set(aircraft, saved);
  f.web.set(device, "existing-device-identity");
  f.web.set("oos_state_code", "CA");
  const first = f.restart();
  assert.throws(() => first.get(aircraft), /not_ready/);
  await first.initialize();
  assert.equal(first.get(aircraft), saved);
  await first.update({ [optIn]: "1" });
  for (let day = 0; day < 3; day++) {
    f.web.clear();
    const app = f.restart();
    await app.initialize();
    assert.equal(app.get(aircraft), saved);
    assert.equal(app.get(device), "existing-device-identity");
    assert.equal(app.get(optIn), "1");
    assert.equal(app.get("oos_state_code"), "CA");
  }
  f.blockWeb();
  const blockedWeb = f.restart();
  await blockedWeb.initialize();
  await blockedWeb.update({ [aircraft]: "{}" });
  assert.equal(blockedWeb.get(aircraft), "{}");
});

test("durable writes are serialized and failed writes keep the last saved selections", async () => {
  const f = fixture();
  const app = f.restart();
  await app.initialize();
  await Promise.all([app.update({ [aircraft]: '{"WA":["N102LP"]}' }), app.update({ [device]: "stable-id" })]);
  f.failSave(true);
  await assert.rejects(app.update({ [aircraft]: "{}" }), /save failed/);
  assert.equal(app.get(aircraft), '{"WA":["N102LP"]}');
  f.failSave(false);
  await app.update({ [optIn]: "0" });
  const restarted = f.restart();
  await restarted.initialize();
  assert.equal(restarted.get(device), "stable-id");
  assert.equal(restarted.get(aircraft), '{"WA":["N102LP"]}');
  assert.equal(restarted.get(optIn), "0");
});

test("an intentional reset cannot resurrect stale web preferences", async () => {
  const f = fixture();
  f.web.set(aircraft, '{"WA":["N102LP"]}');
  const app = f.restart();
  await app.initialize();
  f.blockWeb();
  await app.update({ [aircraft]: null, [device]: null, [optIn]: null });
  const restarted = f.restart();
  await restarted.initialize();
  assert.equal(restarted.get(aircraft), null);
  assert.equal(restarted.get(device), null);
});

test("failed initialization is retryable and corrupt native data never falls back to defaults", async () => {
  const f = fixture();
  f.failLoad(true);
  const app = f.restart();
  await assert.rejects(app.initialize(), /load failed/);
  assert.throws(() => app.get(aircraft), /not_ready/);
  f.failLoad(false);
  await app.initialize();
  const key = [...f.native.keys()][0]!;
  f.native.set(key, "broken JSON");
  await assert.rejects(f.restart().initialize());
  assert.equal(f.native.get(key), "broken JSON");
});

test("website preferences continue to read browser changes directly", async () => {
  const f = fixture();
  const app = new DevicePreferenceStore(f.browser, null);
  await app.update({ [aircraft]: "{}" });
  f.web.set(aircraft, '{"CA":["N103CG"]}');
  assert.equal(app.get(aircraft), '{"CA":["N103CG"]}');
  await app.update({ [aircraft]: null });
  assert.equal(app.get(aircraft), null);
});

test("an opened subscription announcement stays dismissed after web-storage loss and restart", async () => {
  const f = fixture();
  const first = f.restart();
  await first.initialize();
  assert.equal(first.get("oos_subscription_announcement_seen"), null);
  await first.update({ oos_subscription_announcement_seen: "1" });
  f.web.clear();
  const reopened = f.restart();
  await reopened.initialize();
  assert.equal(reopened.get("oos_subscription_announcement_seen"), "1");
});

test("ride angle opt-in defaults off on upgrade and survives web-storage loss", async () => {
  const f = fixture();
  const app = f.restart();
  await app.initialize();
  assert.equal(app.get("oos_ride_angles_enabled"), null);
  await app.update({ oos_ride_angles_enabled: "1" });
  f.web.clear();
  const reopened = f.restart();
  await reopened.initialize();
  assert.equal(reopened.get("oos_ride_angles_enabled"), "1");
  await reopened.update({ oos_ride_angles_enabled: "0" });
  const disabled = f.restart();
  await disabled.initialize();
  assert.equal(disabled.get("oos_ride_angles_enabled"), "0");
});

test("nationwide map preference survives restart and never changes notification state or aircraft exclusions", async () => {
  const f = fixture();
  const app = f.restart();
  await app.initialize();
  await app.update({ oos_state_code: "WA", [aircraft]: '{"WA":["N102LP"]}', [device]: "stable-id", [optIn]: "1" });
  assert.equal(app.get("oos_nationwide_map_enabled"), null);
  await app.update({ oos_nationwide_map_enabled: "1" });
  f.web.clear();
  const reopened = f.restart();
  await reopened.initialize();
  assert.equal(reopened.get("oos_nationwide_map_enabled"), "1");
  assert.equal(reopened.get("oos_state_code"), "WA");
  assert.equal(reopened.get(aircraft), '{"WA":["N102LP"]}');
  assert.equal(reopened.get(device), "stable-id");
  assert.equal(reopened.get(optIn), "1");
  f.failSave(true);
  await assert.rejects(reopened.update({ oos_nationwide_map_enabled: "0" }));
  assert.equal(reopened.get("oos_nationwide_map_enabled"), "1");
  f.failSave(false);
  await reopened.update({ oos_nationwide_map_enabled: null });
  const reset = f.restart();
  await reset.initialize();
  assert.equal(reset.get("oos_nationwide_map_enabled"), null);
});
