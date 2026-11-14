import { getDevicePreference, updateDevicePreferences } from "./device-preferences";

export const NATIONWIDE_MAP_KEY = "oos_nationwide_map_enabled";
export const NATIONWIDE_MAP_EVENT = "oos-nationwide-map-change";

export function readNationwideMapEnabled(): boolean {
  return typeof window !== "undefined" && getDevicePreference(NATIONWIDE_MAP_KEY) === "1";
}

export async function writeNationwideMapEnabled(enabled: boolean): Promise<void> {
  await updateDevicePreferences({ [NATIONWIDE_MAP_KEY]: enabled ? "1" : "0" });
  window.dispatchEvent(new Event(NATIONWIDE_MAP_EVENT));
}
