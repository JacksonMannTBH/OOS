import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { DevicePreferenceStore, DEVICE_PREFERENCE_KEYS } from "./device-preference-store";

let store: DevicePreferenceStore | undefined;
function preferences(): DevicePreferenceStore {
  return store ??= new DevicePreferenceStore(
    () => window.localStorage,
    Capacitor.isNativePlatform() ? Preferences : null,
  );
}

export function initializeDevicePreferences(): Promise<void> {
  return preferences().initialize();
}

export function getDevicePreference(key: string): string | null {
  if (typeof window === "undefined") return null;
  return preferences().get(key);
}

export function updateDevicePreferences(changes: Record<string, string | null>): Promise<void> {
  return preferences().update(changes);
}

export function resetDevicePreferences(): Promise<void> {
  return updateDevicePreferences(Object.fromEntries(DEVICE_PREFERENCE_KEYS.map((key) => [key, null])));
}
