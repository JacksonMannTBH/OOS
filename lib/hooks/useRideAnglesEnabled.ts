"use client";

import { useSyncExternalStore } from "react";
import { readRideAnglesEnabled, RIDE_ANGLES_CHANGE_EVENT, RIDE_ANGLES_STORAGE_KEY } from "../ride-motion-settings";

function subscribe(refresh: () => void) {
  const stored = (event: StorageEvent) => { if (!event.key || event.key === RIDE_ANGLES_STORAGE_KEY) refresh(); };
  window.addEventListener(RIDE_ANGLES_CHANGE_EVENT, refresh);
  window.addEventListener("storage", stored);
  return () => {
    window.removeEventListener(RIDE_ANGLES_CHANGE_EVENT, refresh);
    window.removeEventListener("storage", stored);
  };
}

export function useRideAnglesEnabled() {
  return useSyncExternalStore(subscribe, readRideAnglesEnabled, () => true);
}
