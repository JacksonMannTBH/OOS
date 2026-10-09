"use client";

import { useEffect, useState } from "react";
import { readStoredWakeLockEnabled, WAKE_LOCK_CHANGE_EVENT, WAKE_LOCK_STORAGE_KEY } from "@/lib/wake-lock";
import { createScreenWakeSession } from "@/lib/screen-wake-session";
import { requestScreenWake } from "@/lib/device-screen-wake";

// Mounted only by Ride Mode. Read the preference before acquiring anything.
export function ScreenAwake() {
  const [enabled, setEnabled] = useState(readStoredWakeLockEnabled);
  useEffect(() => {
    const sync = () => setEnabled(readStoredWakeLockEnabled());
    sync();
    const onStorage = (event: StorageEvent) => {
      if (event.key === WAKE_LOCK_STORAGE_KEY || event.key === null) sync();
    };
    window.addEventListener(WAKE_LOCK_CHANGE_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(WAKE_LOCK_CHANGE_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let pageActive = true;
    const session = createScreenWakeSession(requestScreenWake, () => pageActive && document.visibilityState === "visible");
    const sync = () => { void session.sync(); };
    const onHide = () => { pageActive = false; sync(); };
    const onShow = () => { pageActive = true; sync(); };
    sync();
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("pageshow", onShow);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("pageshow", onShow);
      session.stop();
    };
  }, [enabled]);
  return null;
}
