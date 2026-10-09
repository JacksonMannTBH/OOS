"use client";
import { useSyncExternalStore } from "react";
import { readSpeedometerVisible, SPEEDOMETER_CHANGE_EVENT, SPEEDOMETER_STORAGE_KEY } from "../ride-display";

function subscribe(refresh: () => void) {
  const stored = (event: StorageEvent) => { if (!event.key || event.key === SPEEDOMETER_STORAGE_KEY) refresh(); };
  window.addEventListener(SPEEDOMETER_CHANGE_EVENT, refresh);
  window.addEventListener("storage", stored);
  return () => { window.removeEventListener(SPEEDOMETER_CHANGE_EVENT, refresh); window.removeEventListener("storage", stored); };
}

export function useSpeedometerVisible() {
  // Native client rendering reads the saved choice before its first paint.
  return useSyncExternalStore(subscribe, readSpeedometerVisible, () => true);
}
