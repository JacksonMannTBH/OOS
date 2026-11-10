import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { GeolocationPlugin, Position, WatchPositionCallback } from "@capacitor/geolocation";
import { createDeviceLocation } from "./device-location";

class PageVisibility extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";
  setVisible(visible: boolean) {
    this.visibilityState = visible ? "visible" : "hidden";
    this.dispatchEvent(new Event("visibilitychange"));
  }
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

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

test("native UI watches stop on background and resume once on return", async () => {
  const page = new PageVisibility();
  const cleared: string[] = [];
  let started = 0;
  const stop = createDeviceLocation(native({
    watchPosition: async () => `watch-${++started}`,
    clearWatch: async ({ id }) => { cleared.push(id); },
  }), undefined, page).watch(() => {}, () => assert.fail());
  await flush();
  // Native pause must stop GPS even before WebKit reports hidden.
  page.dispatchEvent(new Event("pause"));
  assert.deepEqual(cleared, ["watch-1"]);
  page.setVisible(false);
  page.dispatchEvent(new Event("resume"));
  assert.equal(started, 1);
  page.setVisible(true);
  page.dispatchEvent(new Event("resume"));
  assert.equal(started, 2);
  await flush();
  stop();
  stop();
  page.setVisible(false);
  page.setVisible(true);
  assert.equal(started, 2);
  assert.deepEqual(cleared, ["watch-1", "watch-2"]);
});

test("iOS scene lifecycle directly pauses foreground location subscribers", () => {
  const scene = readFileSync("mobile/ios/App/App/SceneDelegate.swift", "utf8");
  const bridge = readFileSync("mobile/ios/App/App/ScreenAwakePlugin.swift", "utf8");
  assert.match(scene, /func sceneWillResignActive[\s\S]*appWillPause\(\)/);
  assert.match(scene, /func sceneDidBecomeActive[\s\S]*appDidResume\(\)/);
  assert.match(bridge, /func appWillPause[\s\S]*triggerDocumentJSEvent\(eventName: "pause"\)/);
  assert.match(bridge, /func appDidResume[\s\S]*triggerDocumentJSEvent\(eventName: "resume"\)/);
});

test("a hidden page never starts GPS until it becomes visible", async () => {
  const page = new PageVisibility();
  page.setVisible(false);
  let started = 0;
  const stop = createDeviceLocation(native({
    watchPosition: async () => `watch-${++started}`,
  }), undefined, page).watch(() => {}, () => assert.fail());
  assert.equal(started, 0);
  page.setVisible(true);
  assert.equal(started, 1);
  await flush();
  stop();
});

test("backgrounding during registration clears only the old watch and ignores late fixes", async () => {
  const page = new PageVisibility();
  const callbacks: WatchPositionCallback[] = [];
  const complete: Array<(id: string) => void> = [];
  const cleared: string[] = [];
  let received = 0;
  const stop = createDeviceLocation(native({
    watchPosition: async (_options, callback) => {
      callbacks.push(callback);
      return new Promise<string>((resolve) => complete.push(resolve));
    },
    clearWatch: async ({ id }) => { cleared.push(id); },
  }), undefined, page).watch(() => received++, () => assert.fail());
  page.setVisible(false);
  page.setVisible(true);
  complete[1]!("current-watch");
  complete[0]!("old-watch");
  await flush();
  callbacks[0]!(position);
  callbacks[0]!(null, { code: "OS-PLUG-GLOC-0003" });
  callbacks[1]!(position);
  assert.equal(received, 1);
  assert.deepEqual(cleared, ["old-watch"]);
  stop();
  assert.deepEqual(cleared, ["old-watch", "current-watch"]);
});

test("all UI subscribers release their own native watch on background", async () => {
  const page = new PageVisibility();
  let started = 0;
  const cleared: string[] = [];
  const client = createDeviceLocation(native({
    watchPosition: async () => `watch-${++started}`,
    clearWatch: async ({ id }) => { cleared.push(id); },
  }), undefined, page);
  const stopHome = client.watch(() => {}, () => assert.fail());
  const stopSpeed = client.watch(() => {}, () => assert.fail());
  await flush();
  page.setVisible(false);
  assert.deepEqual(cleared, ["watch-1", "watch-2"]);
  stopHome();
  page.setVisible(true);
  assert.equal(started, 3);
  await flush();
  stopSpeed();
  assert.deepEqual(cleared, ["watch-1", "watch-2", "watch-3"]);
});

test("browser GPS also pauses on visibility changes", () => {
  const page = new PageVisibility();
  let started = 0;
  const cleared: number[] = [];
  const browser = {
    watchPosition: () => ++started,
    clearWatch: (id: number) => { cleared.push(id); },
  } as unknown as Geolocation;
  const stop = createDeviceLocation(null, browser, page).watch(() => {}, () => assert.fail());
  page.setVisible(false);
  assert.deepEqual(cleared, [1]);
  page.setVisible(true);
  assert.equal(started, 2);
  stop();
  assert.deepEqual(cleared, [1, 2]);
});
