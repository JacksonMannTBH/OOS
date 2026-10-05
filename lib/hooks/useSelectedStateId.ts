import { useSyncExternalStore } from "react";
import {
  DEFAULT_STATE_CODE,
  STATE_CHANGE_EVENT,
  STATE_PREFERENCE_KEY,
  getSelectedStateCode,
  stateIdForCode,
  type AppStateId,
} from "../app-states";

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STATE_PREFERENCE_KEY || event.key === null) listener();
  };
  window.addEventListener(STATE_CHANGE_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(STATE_CHANGE_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

function snapshot(): AppStateId {
  try { return stateIdForCode(getSelectedStateCode()); }
  catch { return stateIdForCode(DEFAULT_STATE_CODE); }
}

export function useSelectedStateId(): AppStateId {
  return useSyncExternalStore(subscribe, snapshot, () => stateIdForCode(DEFAULT_STATE_CODE));
}
