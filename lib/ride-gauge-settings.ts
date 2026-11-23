import { getDevicePreference, updateDevicePreferences } from "./device-preferences";

export type RideGauge = "gforce" | "lean" | "pitch";
export const RIDE_GAUGE_STORAGE_KEY = "oos_ride_gauge";
export const RIDE_GAUGE_CHANGE_EVENT = "oos-ride-gauge-change";

export function readRideGauge(): RideGauge {
  const stored = typeof window !== "undefined" ? getDevicePreference(RIDE_GAUGE_STORAGE_KEY) : null;
  return stored === "lean" || stored === "pitch" ? stored : "gforce";
}

export async function writeRideGauge(gauge: RideGauge): Promise<void> {
  await updateDevicePreferences({ [RIDE_GAUGE_STORAGE_KEY]: gauge });
  window.dispatchEvent(new Event(RIDE_GAUGE_CHANGE_EVENT));
}
