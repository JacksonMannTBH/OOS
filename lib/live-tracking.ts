import { Capacitor, registerPlugin } from "@capacitor/core";
import { getAppState, getSelectedStateCode } from "./app-states";
import { readAircraftTrackingPreferences } from "./aircraft-tracking";
import { getRideStatusThresholds } from "./ride-settings";

export type LiveTrackingStatus = {
  supported: boolean;
  enabled: boolean;
  active: boolean;
  message?: string;
};

const NativeLiveTracking = registerPlugin<{
  status(): Promise<LiveTrackingStatus>;
  start(options: ReturnType<typeof liveTrackingConfiguration>): Promise<LiveTrackingStatus>;
  configure(options: ReturnType<typeof liveTrackingConfiguration>): Promise<void>;
  stop(): Promise<void>;
}>("OOSLiveTracking");

export function hasNativeLiveTracking(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios" &&
    Capacitor.isPluginAvailable("OOSLiveTracking");
}

function liveTrackingConfiguration() {
  const stateCode = getSelectedStateCode();
  return {
    stateCode,
    stateName: getAppState(stateCode).label,
    excludedTails: readAircraftTrackingPreferences()[stateCode] ?? [],
    ...getRideStatusThresholds(),
  };
}

export async function getLiveTrackingStatus(): Promise<LiveTrackingStatus> {
  if (!hasNativeLiveTracking()) return { supported: false, enabled: false, active: false };
  return NativeLiveTracking.status();
}

export async function startLiveTracking(): Promise<LiveTrackingStatus> {
  return NativeLiveTracking.start(liveTrackingConfiguration());
}

export async function configureLiveTracking(): Promise<void> {
  if (hasNativeLiveTracking()) await NativeLiveTracking.configure(liveTrackingConfiguration());
}

export async function stopLiveTracking(): Promise<void> {
  if (hasNativeLiveTracking()) await NativeLiveTracking.stop();
}
