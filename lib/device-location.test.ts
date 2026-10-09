import assert from "node:assert/strict";
import { test } from "node:test";
import type { GeolocationPlugin, Position, WatchPositionCallback } from "@capacitor/geolocation";
import { createDeviceLocation } from "./device-location";

const position = { timestamp: 1, coords: { latitude: 47, longitude: -122 } } as Position;
function native(overrides: Partial<GeolocationPlugin> = {}) {
  return {
    getCurrentPosition: async () => position,
    watchPosition: async () => "watch-1",
    clearWatch: async () => undefined,
    ...overrides,
  };
}

test("native location works without browser geolocation", async () => {
  assert.equal(await createDeviceLocation(native()).current(), position);
});

test("denied native permissions and timeouts retain actionable error codes", async () => {
  for (const [nativeCode, expected] of [["OS-PLUG-GLOC-0003", 1], ["OS-PLUG-GLOC-0010", 3], ["OS-PLUG-GLOC-0007", 2]] as const) {
    await assert.rejects(createDeviceLocation(native({
      getCurrentPosition: async () => { throw { code: nativeCode }; },
    })).current(), (error: { code?: number }) => error.code === expected);
  }
});

test("unmount before native registration completes clears the eventual watch and ignores callbacks", async () => {
  let finish!: (id: string) => void;
  let callback!: WatchPositionCallback;
  const cleared: string[] = [];
  let received = 0;
  const client = createDeviceLocation(native({
    watchPosition: async (_options, handler) => {
      callback = handler;
      return new Promise<string>((resolve) => { finish = resolve; });
    },
    clearWatch: async ({ id }) => { cleared.push(id); },
  }));
  const stop = client.watch(() => received++, () => received++);
  stop();
  callback(position);
  callback(null, { code: "OS-PLUG-GLOC-0003" });
  finish("late-watch");
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(cleared, ["late-watch"]);
  assert.equal(received, 0);
});

test("browser watch still works and cleanup is idempotent", () => {
  const cleared: number[] = [];
  const browser = {
    watchPosition: (success: PositionCallback) => { success(position as unknown as GeolocationPosition); return 4; },
    clearWatch: (id: number) => { cleared.push(id); },
  } as Geolocation;
  let received = 0;
  const stop = createDeviceLocation(null, browser).watch(() => received++, () => assert.fail());
  stop();
  stop();
  assert.equal(received, 1);
  assert.deepEqual(cleared, [4]);
});

test("missing location support fails gracefully", async () => {
  const client = createDeviceLocation(null);
  await assert.rejects(client.current(), (error: { code?: number }) => error.code === 2);
  let errorCode = 0;
  client.watch(() => assert.fail(), (error) => { errorCode = error.code; })();
  assert.equal(errorCode, 2);
});
