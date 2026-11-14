"use client";

import { useEffect, useState } from "react";
import { getRideGForceStatus, RIDE_RECORDING_CHANGED, type RideGForceStatus } from "../ride-recording";

export function useRideGForce(visible: boolean) {
  const [status, setStatus] = useState<RideGForceStatus | null>(null);
  useEffect(() => {
    setStatus(null);
    if (!visible) return;
    let mounted = true;
    let pending = false;
    let paused = document.visibilityState !== "visible";
    let revision = 0;
    const refresh = async () => {
      if (pending || paused) return;
      pending = true;
      const requestRevision = revision;
      try {
        const next = await getRideGForceStatus();
        if (mounted && !paused && requestRevision === revision) setStatus(next);
      } catch {
        if (mounted && !paused && requestRevision === revision) setStatus(current => ({
          supported: current?.supported ?? true, calibrated: current?.calibrated ?? false,
          receiving: false, reading: null, peaks: current?.peaks ?? null,
          message: "G-force readings are unavailable.",
        }));
      } finally { pending = false; }
    };
    const pause = () => {
      paused = true;
      revision++;
      setStatus(current => current ? { ...current, receiving: false, reading: null } : null);
    };
    const resume = () => { paused = document.visibilityState !== "visible"; void refresh(); };
    const visibility = () => document.visibilityState === "visible" ? resume() : pause();
    void refresh();
    // Only the small live payload crosses the bridge; ride history stays on its
    // existing two-second refresh. These readings stay raw; the plot animates them.
    const timer = window.setInterval(refresh, 80);
    document.addEventListener("pause", pause);
    document.addEventListener("resume", resume);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener(RIDE_RECORDING_CHANGED, refresh);
    return () => {
      mounted = false;
      window.clearInterval(timer);
      document.removeEventListener("pause", pause);
      document.removeEventListener("resume", resume);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener(RIDE_RECORDING_CHANGED, refresh);
    };
  }, [visible]);
  return status;
}
