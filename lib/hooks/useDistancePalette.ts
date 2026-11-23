"use client";

import { useSyncExternalStore } from "react";
import { readDistancePalette, DISTANCE_PALETTE_EVENT, DISTANCE_PALETTE_KEY } from "../distance-colors";
import { DEFAULT_DISTANCE_PALETTE } from "../distance-color-palette";

function subscribe(refresh: () => void) {
  const stored = (event: StorageEvent) => { if (!event.key || event.key === DISTANCE_PALETTE_KEY) refresh(); };
  window.addEventListener(DISTANCE_PALETTE_EVENT, refresh);
  window.addEventListener("storage", stored);
  return () => {
    window.removeEventListener(DISTANCE_PALETTE_EVENT, refresh);
    window.removeEventListener("storage", stored);
  };
}

export function useDistancePalette() {
  return useSyncExternalStore(subscribe, readDistancePalette, () => DEFAULT_DISTANCE_PALETTE);
}
