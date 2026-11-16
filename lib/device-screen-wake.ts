import { Capacitor, registerPlugin } from "@capacitor/core";
import type { ScreenWakeLease } from "./screen-wake-session";

export type RideOrientationStatus = {
  supported: boolean;
  locked: boolean;
  sessionId?: string | null;
};

export const NativeScreenAwake = registerPlugin<{
  acquire(options: { id: string }): Promise<void>;
  release(options: { id: string }): Promise<void>;
  orientationStatus(): Promise<RideOrientationStatus>;
  setOrientationLocked(options: { locked: boolean; sessionId: string }): Promise<RideOrientationStatus>;
}>("OOSScreenAwake");

export async function requestScreenWake(): Promise<ScreenWakeLease> {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios" && Capacitor.isPluginAvailable("OOSScreenAwake")) {
    // Early iOS 15 WebViews lack randomUUID. This ID only distinguishes leases.
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    await NativeScreenAwake.acquire({ id });
    let released = false;
    return {
      get released() { return released; },
      async release() {
        if (released) return;
        released = true;
        await NativeScreenAwake.release({ id });
      },
    };
  }
  if (!navigator.wakeLock) throw new Error("Screen wake unavailable");
  return navigator.wakeLock.request("screen");
}
