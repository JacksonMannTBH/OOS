import { Capacitor, registerPlugin } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
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
const RIDE_OWNER_KEY = "oos_live_tracking_ride_id";

export async function assignLiveTrackingToRide(rideId: string): Promise<void> {
  await Preferences.set({ key: RIDE_OWNER_KEY, value: rideId });
}

export async function stopRideLiveTracking(rideId: string): Promise<void> {
  const { value } = await Preferences.get({ key: RIDE_OWNER_KEY });
  if (value === rideId) await stopLiveTracking();
}

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
  const status = await NativeLiveTracking.start(liveTrackingConfiguration());
  await Preferences.remove({ key: RIDE_OWNER_KEY });
  return status;
}

export async function configureLiveTracking(): Promise<void> {
  if (hasNativeLiveTracking()) await NativeLiveTracking.configure(liveTrackingConfiguration());
}

export async function stopLiveTracking(): Promise<void> {
  if (hasNativeLiveTracking()) {
    await NativeLiveTracking.stop();
    await Preferences.remove({ key: RIDE_OWNER_KEY });
  }
}
