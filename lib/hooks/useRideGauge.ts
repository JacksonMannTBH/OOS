"use client";

import { useSyncExternalStore } from "react";
import { readRideGauge, RIDE_GAUGE_CHANGE_EVENT, RIDE_GAUGE_STORAGE_KEY } from "../ride-gauge-settings";

function subscribe(refresh: () => void) {
  const stored = (event: StorageEvent) => { if (!event.key || event.key === RIDE_GAUGE_STORAGE_KEY) refresh(); };
  window.addEventListener(RIDE_GAUGE_CHANGE_EVENT, refresh);
  window.addEventListener("storage", stored);
  return () => {
    window.removeEventListener(RIDE_GAUGE_CHANGE_EVENT, refresh);
    window.removeEventListener("storage", stored);
  };
}

export function useRideGauge() {
  return useSyncExternalStore(subscribe, readRideGauge, () => "gforce" as const);
}
