"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SS_TOKENS } from "@/lib/tokens";
import { useRideLaunchPreflight } from "@/lib/hooks/useRideLaunchPreflight";
import { getRideRecorderStatus, startRideRecording } from "@/lib/ride-recording";
import { useRideRecorder } from "@/lib/hooks/useRideRecorder";
import { RideDialog } from "./RideDialog";
import { getLiveTrackingStatus, hasNativeLiveTracking, startLiveTracking, stopLiveTracking } from "@/lib/live-tracking";

type Props = {
  variant?: "hero" | "compact" | "plain" | "map";
  style?: CSSProperties;
  children?: ReactNode;
};

export function TakeOffButton({ variant = "hero", style, children }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const runRideLaunchPreflight = useRideLaunchPreflight();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const { status } = useRideRecorder();
  const compact = variant === "compact";
  const plain = variant === "plain";

  const onTakeOff = async (consent = false) => {
    if (busy) return;
    setBusy(true);
    setError("");
    let startedLiveTracking = false;
    try {
      const recording = await getRideRecorderStatus();
      if (recording.supported && !recording.active && recording.consentRequired && !consent) {
        setConfirm(true);
        return;
      }
      await runRideLaunchPreflight();
      const mock = searchParams.get("mock");
      if (!mock && hasNativeLiveTracking()) {
        const tracking = await getLiveTrackingStatus();
        if (tracking.supported && !tracking.active) {
          await startLiveTracking();
          startedLiveTracking = true;
        }
      }
      if (recording.supported) await startRideRecording(consent, startedLiveTracking);
      setConfirm(false);
      router.push(mock ? `/ride?mock=${encodeURIComponent(mock)}` : "/ride");
    } catch (cause) {
      if (startedLiveTracking) await stopLiveTracking().catch(() => undefined);
      setError(cause instanceof Error ? cause.message : "Could not start this ride. Please try again.");
    } finally { setBusy(false); }
  };
  const label = status?.active ? "Resume Ride" : "Start Ride";

  return (
    <>
    <button
      type="button"
      onClick={() => void onTakeOff()}
      disabled={busy}
      aria-label={label}
      style={{
        boxSizing: "border-box",
        width: compact || plain ? "auto" : "min(100%, 460px)",
        minHeight: compact || plain ? 48 : 56,
        padding: compact ? "0 18px" : plain ? "0 6px" : "0 18px",
        borderRadius: compact || plain ? 0 : 18,
        border: plain
          ? 0
          : compact
          ? "1px solid rgba(246, 196, 49, 0.34)"
          : "1px solid #f6c431",
        background: plain ? "transparent" : busy ? "#1b1608" : "#f6c431",
        color: plain ? SS_TOKENS.alert : busy ? "#f6c431" : "#050505",
        boxShadow: plain
          ? "none"
          : compact
          ? "0 3px 10px rgba(0, 0, 0, 0.26)"
          : "0 16px 50px rgba(0, 0, 0, 0.28)",
        cursor: busy ? "wait" : "pointer",
        opacity: busy ? 0.72 : 1,
        fontFamily: "inherit",
        fontSize: compact || plain ? 16 : 18,
        fontWeight: compact || plain ? 800 : 900,
        letterSpacing: 0,
        display: "inline-flex",
        alignItems: "center",
        alignSelf: compact ? undefined : "center",
        justifyContent: "center",
        gap: compact ? 8 : 10,
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
        ...style,
      }}
    >
      {children ?? <span>{busy ? "Starting Ride…" : label}</span>}
    </button>
    {error && !confirm && (variant === "map"
      ? <RideDialog title="Could not start ride" onClose={() => setError("")}>
          <p role="alert" className="ss-ride-error">{error}</p>
          <button className="ss-ride-primary" onClick={() => setError("")}>Done</button>
        </RideDialog>
      : <p role="alert" className="ss-ride-error">{error}</p>)}
    {confirm && <RideDialog title="Record your ride" className="ss-ride-consent" onClose={busy ? undefined : () => { setConfirm(false); setError(""); }}>
      <p>Uses your location to record speed, distance, duration, and your route.</p>
      {error && <p role="alert" className="ss-ride-error">{error}</p>}
      <button className="ss-ride-primary" disabled={busy} onClick={() => void onTakeOff(true)}>{busy ? "Starting Ride…" : "Start Ride"}</button>
      <button className="ss-ride-secondary" disabled={busy} onClick={() => { setConfirm(false); setError(""); }}>Cancel</button>
    </RideDialog>}
    </>
  );
}
