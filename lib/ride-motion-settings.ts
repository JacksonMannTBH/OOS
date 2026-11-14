import { getDevicePreference, updateDevicePreferences } from "./device-preferences";

export const RIDE_ANGLES_STORAGE_KEY = "oos_ride_angles_enabled";
export const RIDE_ANGLES_CHANGE_EVENT = "oos-ride-angles-change";

export function readRideAnglesEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return getDevicePreference(RIDE_ANGLES_STORAGE_KEY) !== "0";
}

export async function writeRideAnglesEnabled(enabled: boolean): Promise<void> {
  await updateDevicePreferences({ [RIDE_ANGLES_STORAGE_KEY]: enabled ? "1" : "0" });
  window.dispatchEvent(new Event(RIDE_ANGLES_CHANGE_EVENT));
}
