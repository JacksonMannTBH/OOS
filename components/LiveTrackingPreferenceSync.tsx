"use client";
import { useEffect } from "react";
import { configureLiveTracking, hasNativeLiveTracking } from "@/lib/live-tracking";
import { AIRCRAFT_TRACKING_CHANGE_EVENT } from "@/lib/aircraft-tracking";
import { STATE_CHANGE_EVENT } from "@/lib/app-states";
import { RIDE_STATUS_THRESHOLDS_EVENT } from "@/lib/ride-settings";

// A Live Activity can continue while Home and Ride are unmounted. Reconcile
// state, aircraft exclusions, and distance bands from anywhere in the app.
export function LiveTrackingPreferenceSync() {
  useEffect(() => {
    if (!hasNativeLiveTracking()) return;
    const sync = () => { void configureLiveTracking().catch(() => { /* Retry on return or the next preference change. */ }); };
    const visible = () => { if (document.visibilityState === "visible") sync(); };
    const events = [AIRCRAFT_TRACKING_CHANGE_EVENT, STATE_CHANGE_EVENT, RIDE_STATUS_THRESHOLDS_EVENT, "storage", "pageshow"];
    for (const event of events) window.addEventListener(event, sync);
    document.addEventListener("visibilitychange", visible);
    sync();
    return () => { for (const event of events) window.removeEventListener(event, sync); document.removeEventListener("visibilitychange", visible); };
  }, []);
  return null;
}
