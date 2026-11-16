"use client";

import { useEffect, useRef, useState } from "react";
import { getRideOrientationStatus, setRideOrientationLocked, type RideOrientationStatus } from "@/lib/device-ride-orientation";

export function RideOrientationButton({ disabled, onError }: { disabled: boolean; onError: (message: string) => void }) {
  const [status, setStatus] = useState<RideOrientationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);
  const revision = useRef(0);
  useEffect(() => {
    mounted.current = true;
    const sync = () => {
      if (pending.current) return;
      const request = ++revision.current;
      void getRideOrientationStatus().then(value => {
        if (mounted.current && request === revision.current) setStatus(value);
      }).catch(() => {});
    };
    const visible = () => { if (document.visibilityState === "visible") sync(); };
    sync();
    document.addEventListener("resume", sync);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("pageshow", sync);
    return () => {
      mounted.current = false;
      document.removeEventListener("resume", sync);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("pageshow", sync);
    };
  }, []);

  if (!status?.supported || !status.sessionId) return null;
  const toggle = async () => {
    if (disabled || pending.current || !status.sessionId) return;
    pending.current = true;
    ++revision.current;
    setBusy(true);
    onError("");
    try {
      const next = await setRideOrientationLocked(!status.locked, status.sessionId);
      if (mounted.current) setStatus(next);
    } catch {
      if (mounted.current) onError("Could not change screen rotation. Try again.");
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return <button type="button" className="ss-ride-orientation"
    aria-label={status.locked ? "Unlock screen rotation" : "Lock screen rotation"}
    aria-pressed={status.locked} aria-busy={busy} disabled={disabled || busy}
    onClick={() => void toggle()}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {status.locked ? <path d="M7 10V7a5 5 0 0 1 10 0v3" /> : <path d="M7 10V7a5 5 0 0 1 9.6-2" />}
      <rect x="4" y="10" width="16" height="12" rx="3" />
      <path d="M12 15v3" />
    </svg>
  </button>;
}
