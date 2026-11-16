import { Capacitor } from "@capacitor/core";
import { NativeScreenAwake, type RideOrientationStatus } from "./device-screen-wake";

export type { RideOrientationStatus } from "./device-screen-wake";

export async function getRideOrientationStatus(): Promise<RideOrientationStatus> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios" || !Capacitor.isPluginAvailable("OOSScreenAwake")) {
    return { supported: false, locked: false };
  }
  return NativeScreenAwake.orientationStatus();
}

export async function setRideOrientationLocked(locked: boolean, sessionId: string): Promise<RideOrientationStatus> {
  return NativeScreenAwake.setOrientationLocked({ locked, sessionId });
}
