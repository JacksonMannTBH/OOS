import assert from "node:assert/strict";
import { test } from "node:test";

test("ending a ride stops only Live Tracking owned by that ride", async () => {
  Object.defineProperty(globalThis, "CapacitorCustomPlatform", { configurable: true, value: { name: "ios" } });
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    },
    dispatchEvent: () => true,
  } });
  const { registerPlugin } = await import("@capacitor/core");
  registerPlugin("Preferences", { ios: {
    get: async ({ key }: { key: string }) => ({ value: values.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => { values.set(key, value); },
    remove: async ({ key }: { key: string }) => { values.delete(key); },
  } });
  let stops = 0;
  registerPlugin("OOSLiveTracking", { ios: {
    start: async () => ({ supported: true, enabled: true, active: true }),
    stop: async () => { stops++; },
  } });
  let rideId = "ride-1";
  registerPlugin("OOSRideRecorder", { ios: {
    start: async () => ({ active: { id: rideId } }),
    finish: async ({ id }: { id: string }) => ({ ride: { id } }),
  } });
  const { initializeDevicePreferences } = await import("./device-preferences");
  await initializeDevicePreferences();
  const { startRideRecording, finishRideRecording } = await import("./ride-recording");
  const { startLiveTracking, stopLiveTracking, stopRideLiveTracking } = await import("./live-tracking");

  await startRideRecording(true, true);
  await startRideRecording(); // Resuming must preserve the owning ride.
  await stopRideLiveTracking("another-ride");
  assert.equal(stops, 0);
  await finishRideRecording("ride-1");
  assert.equal(stops, 1);
  await stopRideLiveTracking("ride-1");
  assert.equal(stops, 1);

  rideId = "ride-2";
  await startRideRecording(true, false); // Live Tracking was already on.
  await finishRideRecording(rideId);
  assert.equal(stops, 1);

  rideId = "ride-3";
  await startRideRecording(true, true);
  await stopLiveTracking();
  await startLiveTracking(); // A manual restart belongs to the user.
  await finishRideRecording(rideId);
  assert.equal(stops, 2);
});
