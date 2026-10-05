"use client";

import { useEffect } from "react";
import { STATE_CHANGE_EVENT, STATE_PREFERENCE_KEY } from "@/lib/app-states";
import { AIRCRAFT_TRACKING_CHANGE_EVENT, AIRCRAFT_TRACKING_STORAGE_KEY } from "@/lib/aircraft-tracking";
import { AIRCRAFT_ALERT_PREFERENCE_SYNC_EVENT, syncAircraftAlertPreferences } from "@/lib/aircraft-alerts/client";

// Keep server notifications in sync even after leaving the settings page.
export function AircraftAlertPreferenceSync() {
  useEffect(() => {
    const sync = () => {
      void syncAircraftAlertPreferences({})
        .then((status) => window.dispatchEvent(new CustomEvent(AIRCRAFT_ALERT_PREFERENCE_SYNC_EVENT, { detail: { status } })))
        .catch(() => window.dispatchEvent(new CustomEvent(AIRCRAFT_ALERT_PREFERENCE_SYNC_EVENT, { detail: { error: true } })));
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === AIRCRAFT_TRACKING_STORAGE_KEY || event.key === STATE_PREFERENCE_KEY) sync();
    };
    const onVisible = () => { if (document.visibilityState === "visible") sync(); };
    window.addEventListener(STATE_CHANGE_EVENT, sync);
    window.addEventListener(AIRCRAFT_TRACKING_CHANGE_EVENT, sync);
    window.addEventListener("storage", onStorage);
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", onVisible);
    sync();
    return () => {
      window.removeEventListener(STATE_CHANGE_EVENT, sync);
      window.removeEventListener(AIRCRAFT_TRACKING_CHANGE_EVENT, sync);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
