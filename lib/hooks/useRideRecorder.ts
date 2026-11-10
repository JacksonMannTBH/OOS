"use client";

import { useEffect, useState } from "react";
import { getRideRecorderStatus, hasRideRecorder, RIDE_RECORDING_CHANGED, type RideRecorderStatus } from "@/lib/ride-recording";

export function useRideRecorder() {
  const [status, setStatus] = useState<RideRecorderStatus | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!hasRideRecorder()) return;
    let mounted = true;
    let pending = false;
    const refresh = async () => {
      if (pending || document.visibilityState !== "visible") return;
      pending = true;
      try {
        const value = await getRideRecorderStatus();
        if (mounted) { setStatus(value); setError(""); }
      } catch (cause) {
        if (mounted) setError(cause instanceof Error ? cause.message : "Could not load rides. Reopen OOS to try again.");
      } finally { pending = false; }
    };
    void refresh();
    const timer = window.setInterval(refresh, 2000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener(RIDE_RECORDING_CHANGED, refresh);
    return () => {
      mounted = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener(RIDE_RECORDING_CHANGED, refresh);
    };
  }, []);
  return { status, error };
}
