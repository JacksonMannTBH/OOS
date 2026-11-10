import { useSyncExternalStore } from "react";
import { CALIFORNIA_REGION_EVENT, CALIFORNIA_REGION_KEY, getSelectedCaliforniaRegion, type CaliforniaRegion } from "../california-regions";

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === CALIFORNIA_REGION_KEY || event.key === null) listener();
  };
  window.addEventListener(CALIFORNIA_REGION_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CALIFORNIA_REGION_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCaliforniaRegion(): CaliforniaRegion {
  return useSyncExternalStore(subscribe, getSelectedCaliforniaRegion, () => "north");
}
