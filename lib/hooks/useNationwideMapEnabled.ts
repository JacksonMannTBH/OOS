"use client";

import { useSyncExternalStore } from "react";
import { NATIONWIDE_MAP_EVENT, NATIONWIDE_MAP_KEY, readNationwideMapEnabled } from "../nationwide-map-settings";

function subscribe(refresh: () => void) {
  const storage = (event: StorageEvent) => { if (!event.key || event.key === NATIONWIDE_MAP_KEY) refresh(); };
  window.addEventListener(NATIONWIDE_MAP_EVENT, refresh);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(NATIONWIDE_MAP_EVENT, refresh);
    window.removeEventListener("storage", storage);
  };
}

export function useNationwideMapEnabled() {
  return useSyncExternalStore(subscribe, readNationwideMapEnabled, () => false);
}
