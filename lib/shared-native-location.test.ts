import assert from "node:assert/strict";
import { test } from "node:test";
import { createSharedNativeLocation } from "./shared-native-location";
import type { Position } from "@capacitor/geolocation";

const position: Position = { timestamp: Date.now(), coords: { latitude: 47, longitude: -122,
  accuracy: 10, altitude: 0, altitudeAccuracy: 10, speed: 2, heading: 0,
  magneticHeading: null, trueHeading: null, headingAccuracy: null, course: 0 } };

test("one-shot preflight releases only its subscription while the map keeps receiving shared fixes", async () => {
  const callbacks = new Map<string, (event: { position?: Position }) => void>();
  const cleared: string[] = [];
  let nextId = 0;
  const location = createSharedNativeLocation({
    watchPosition: async (_, callback) => { const id = String(++nextId); callbacks.set(id, callback); return id; },
    clearWatch: async ({ id }) => { cleared.push(id); callbacks.delete(id); },
  });
  const received: Position[] = [];
  const map = await location.watchPosition({}, p => { if (p) received.push(p); });
  const pending = location.getCurrentPosition();
  await Promise.resolve();
  for (const callback of callbacks.values()) callback({ position });
  assert.equal(await pending, position);
  assert.deepEqual(cleared, ["2"]);
  assert.equal(callbacks.has(map), true);
  callbacks.get(map)!({ position });
  assert.equal(received.length, 2);
  await location.clearWatch({ id: map });
  assert.equal(callbacks.size, 0);
});

test("an immediate shared fix cleans up even when watch registration resolves later", async () => {
  const cleared: string[] = [];
  const location = createSharedNativeLocation({
    watchPosition: async (_, callback) => { callback({ position }); return "late"; },
    clearWatch: async ({ id }) => { cleared.push(id); },
  });
  assert.equal(await location.getCurrentPosition(), position);
  await Promise.resolve();
  assert.deepEqual(cleared, ["late"]);
});

test("permission failures and timeouts both release their own watches", async () => {
  for (const denied of [true, false]) {
    const cleared: string[] = [];
    const location = createSharedNativeLocation({
      watchPosition: async (_, callback) => {
        if (denied) callback({ error: { code: 1, message: "Denied" } });
        return "temporary";
      },
      clearWatch: async ({ id }) => { cleared.push(id); },
    });
    await assert.rejects(location.getCurrentPosition({ timeout: 5 }),
      (error: { code?: number }) => error.code === (denied ? 1 : 3));
    await Promise.resolve();
    assert.deepEqual(cleared, ["temporary"]);
  }
});
