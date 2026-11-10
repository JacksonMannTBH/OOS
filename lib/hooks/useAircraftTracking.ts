"use client";

import { getDevicePreference } from "../device-preferences";
import { useMemo, useSyncExternalStore } from "react";
import { AIRCRAFT_TRACKING_CHANGE_EVENT, AIRCRAFT_TRACKING_STORAGE_KEY, parseAircraftTrackingPreferences } from "../aircraft-tracking";

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === AIRCRAFT_TRACKING_STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener(AIRCRAFT_TRACKING_CHANGE_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(AIRCRAFT_TRACKING_CHANGE_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

function snapshot() {
  return getDevicePreference(AIRCRAFT_TRACKING_STORAGE_KEY) ?? "{}";
}

export function useAircraftTracking() {
  const serialized = useSyncExternalStore(subscribe, snapshot, () => "{}");
  return useMemo(() => {
    const parsed = parseAircraftTrackingPreferences(JSON.parse(serialized));
    if (!parsed) throw new Error("aircraft_preferences_invalid");
    return parsed;
  }, [serialized]);
}
