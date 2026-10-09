"use client";

import { useEffect, useId, useState } from "react";
import {
  getLiveTrackingStatus,
  hasNativeLiveTracking,
  startLiveTracking,
  stopLiveTracking,
  type LiveTrackingStatus,
} from "@/lib/live-tracking";
import type { CSSProperties } from "react";

export function LiveTrackingButton({ mockOn = false, style }: { mockOn?: boolean; style?: CSSProperties }) {
  const descriptionId = useId();
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
    const visibilityChanged = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 5000);
    document.addEventListener("visibilitychange", visibilityChanged);
    window.addEventListener("pageshow", refresh);
    return () => {
      mounted = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visibilityChanged);
      window.removeEventListener("pageshow", refresh);
    };
  }, []);

  if (!status?.supported) return null;

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

  const disabled = busy || (mockOn && !status.active);
  const description = status.active
    ? "Live tracking is on. Tap Live to stop. Tracking continues when you leave Ride Mode."
    : "Show the nearest aircraft, distance, and ride state on your Lock Screen and Dynamic Island. Uses location while tracking, including in other apps.";
  return (
    <div style={style}>
      <button
        type="button"
        onClick={() => { if (!status.enabled && !status.active) setError("Enable Live Activities for OOS in iPhone Settings."); else void toggle(); }}
        disabled={disabled}
        aria-label={busy ? "Updating live tracking" : status.active ? "Stop live tracking" : "Start live tracking"}
        aria-pressed={status.active}
        aria-describedby={descriptionId}
        title={description}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 44, minHeight: 44, padding: "0 3px", border: 0, background: "transparent", color: "#f6c431", cursor: busy ? "wait" : "pointer", font: "inherit", opacity: disabled ? 0.6 : 1, touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 20, border: "1px solid rgba(246,196,49,.55)", background: status.active ? "#f6c431" : "rgba(5,6,7,.6)", color: status.active ? "#050505" : "#f6c431", fontSize: 12, fontWeight: 800 }}>
          <span aria-hidden style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", opacity: status.active ? 1 : 0.35 }} />Live
        </span>
      </button>
      <span id={descriptionId} className="sr-only">{description}</span>
      {(error || status.message) && <p role="alert" style={{ position: "absolute", left: 0, top: "100%", width: "min(270px, 78vw)", padding: 12, borderRadius: 12, background: "#11120e", border: "1px solid rgba(246,196,49,.5)", color: "#f6c431", fontSize: 12, lineHeight: 1.5, margin: 0 }}>{error || status.message}</p>}
    </div>
  );
}
