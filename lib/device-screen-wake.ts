import { Capacitor, registerPlugin } from "@capacitor/core";
import type { ScreenWakeLease } from "./screen-wake-session";

const NativeScreenAwake = registerPlugin<{
  acquire(options: { id: string }): Promise<void>;
  release(options: { id: string }): Promise<void>;
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
