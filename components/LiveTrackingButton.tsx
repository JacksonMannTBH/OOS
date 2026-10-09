"use client";

import { useEffect, useState } from "react";
import {
  configureLiveTracking,
  getLiveTrackingStatus,
  hasNativeLiveTracking,
  startLiveTracking,
  stopLiveTracking,
  type LiveTrackingStatus,
} from "@/lib/live-tracking";
import { AIRCRAFT_TRACKING_CHANGE_EVENT } from "@/lib/aircraft-tracking";
import { STATE_CHANGE_EVENT } from "@/lib/app-states";
import { RIDE_STATUS_THRESHOLDS_EVENT } from "@/lib/ride-settings";

export function LiveTrackingButton({ mockOn = false }: { mockOn?: boolean }) {
  const [status, setStatus] = useState<LiveTrackingStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hasNativeLiveTracking()) return;
    let mounted = true;
    const refresh = async () => {
      try {
        const next = await getLiveTrackingStatus();
        if (mounted) setStatus(next);
      } catch {
        if (mounted) setError("Live tracking is unavailable. Try reopening OOS.");
      }
    };
    const preferencesChanged = () => {
      void configureLiveTracking().catch(() => {
        if (mounted) setError("Tracking settings could not update. Stop tracking and try again.");
      });
    };
    const visibilityChanged = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 5000);
    document.addEventListener("visibilitychange", visibilityChanged);
    window.addEventListener("pageshow", refresh);
    const events = [AIRCRAFT_TRACKING_CHANGE_EVENT, STATE_CHANGE_EVENT, RIDE_STATUS_THRESHOLDS_EVENT, "storage"];
    for (const event of events) window.addEventListener(event, preferencesChanged);
    // Reconcile preferences when returning to a session that continued outside OOS.
    preferencesChanged();
    return () => {
      mounted = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visibilityChanged);
      window.removeEventListener("pageshow", refresh);
      for (const event of events) window.removeEventListener(event, preferencesChanged);
    };
  }, []);

  if (!status?.supported) return error ? <p role="alert">{error}</p> : null;

  async function toggle() {
    if (busy || !status) return;
    setBusy(true);
    setError("");
    try {
      if (status.active) {
        await stopLiveTracking();
        setStatus(await getLiveTrackingStatus());
      } else {
        setStatus(await startLiveTracking());
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Live tracking could not start. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ width: "min(100%, 460px)", textAlign: "center" }}>
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy || (mockOn && !status.active) || (!status.enabled && !status.active)}
        aria-pressed={status.active}
        aria-describedby="live-tracking-description"
        style={{
          width: "100%", minHeight: 48, borderRadius: 16,
          border: "1px solid rgba(246,196,49,.6)",
          background: status.active ? "#f6c431" : "rgba(246,196,49,.08)",
          color: status.active ? "#050505" : "#f6c431",
          font: "inherit", fontWeight: 850, cursor: busy ? "wait" : "pointer",
          opacity: busy || !status.enabled || (mockOn && !status.active) ? 0.6 : 1,
        }}
      >
        {busy ? "Please wait…" : status.active ? "Stop live tracking" : "Turn on live tracking"}
      </button>
      <p id="live-tracking-description" style={{ fontSize: 12, lineHeight: 1.4, color: "#a9a28a", margin: "8px 0 0" }}>
        {!status.enabled
          ? "Enable Live Activities for OOS in iPhone Settings."
          : mockOn && !status.active
            ? "Live tracking is available with real aircraft data."
            : status.active
              ? "Tracking on your Lock Screen and Dynamic Island. Stop tracking or End Ride to finish."
              : "Shows the nearest tracked aircraft, distance, and ride state outside OOS. Uses location while tracking, including while you use other apps."}
      </p>
      {(error || status.message) && <p role="alert" style={{ fontSize: 13, color: "#f6c431", margin: "8px 0 0" }}>{error || status.message}</p>}
    </div>
  );
}
