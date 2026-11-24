"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { POLICE_COLOR, POLICE_ICON_PATH, type PoliceSightingIcon } from "@/lib/police-sightings";
import { preparePoliceReport, reportPolice, votePolice, type PoliceVote, type PoliceReportResult } from "@/lib/police-client";
import { getDevicePreference, initializeDevicePreferences, updateDevicePreferences } from "@/lib/device-preferences";
import { RideDialog } from "./RideDialog";
import { playPigSound, preloadPigSound, preparePigSound } from "@/lib/pig-sound";

const HOLD_MS = 700;

export function PoliceReportButton({ disabled = false, alerting = false }: { disabled?: boolean; alerting?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const button = useRef<HTMLButtonElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>();
  const press = useRef<{ pointerId?: number; x: number; y: number }>();
  const ignoreClickUntil = useRef(0);
  const soundAttempt = useRef<Promise<boolean>>();
  const blocked = disabled || busy || now < until;
  const cancelHold = useCallback(() => {
    if (press.current) ignoreClickUntil.current = Infinity;
    clearTimeout(holdTimer.current);
    press.current = undefined;
  }, []);
  useEffect(() => {
    void preloadPigSound().catch(() => undefined);
    const element = button.current;
    // React touch listeners may be passive. iOS needs a cancellable native
    // touchstart to suppress the selection loupe as well as the text callout.
    const preventSelection = (event: Event) => { event.preventDefault(); window.getSelection()?.removeAllRanges(); };
    element?.addEventListener("touchstart", preventSelection, { passive: false });
    element?.addEventListener("selectstart", preventSelection);
    const hide = () => { if (document.hidden) cancelHold(); };
    const otherPointer = (event: PointerEvent) => {
      if (press.current && event.pointerId !== press.current.pointerId) cancelHold();
    };
    window.addEventListener("blur", cancelHold);
    document.addEventListener("visibilitychange", hide);
    document.addEventListener("pointerdown", otherPointer, true);
    return () => {
      cancelHold();
      element?.removeEventListener("touchstart", preventSelection);
      element?.removeEventListener("selectstart", preventSelection);
      window.removeEventListener("blur", cancelHold);
      document.removeEventListener("visibilitychange", hide);
      document.removeEventListener("pointerdown", otherPointer, true);
    };
  }, [cancelHold]);
  useEffect(() => { if (blocked) cancelHold(); }, [blocked, cancelHold]);
  const holdAction = useRef(() => {});
  holdAction.current = () => {
    ignoreClickUntil.current = Infinity;
    soundAttempt.current = playPigSound();
  };
  const startHold = (pointerId?: number, x = 0, y = 0) => {
    if (blocked || press.current) return;
    ignoreClickUntil.current = 0;
    soundAttempt.current = undefined;
    press.current = { pointerId, x, y };
    try { void preparePigSound().catch(() => undefined); } catch { /* Reporting still works without audio. */ }
    holdTimer.current = setTimeout(() => holdAction.current(), HOLD_MS);
  };
  const finishHold = () => {
    if (!press.current) return;
    clearTimeout(holdTimer.current);
    press.current = undefined;
    if (soundAttempt.current) {
      ignoreClickUntil.current = Date.now() + 700;
      void report("pig");
      // Some iPhones unlock audio on release. Retry once without a second oink.
      try {
        const resumed = preparePigSound().catch(() => undefined);
        void soundAttempt.current.then(async played => {
          if (!played) {
            await resumed;
            if (!await playPigSound()) setError("Couldn’t play the oink. Check your media volume and try again.");
          }
        });
      } catch { /* Reporting still works without audio. */ }
    }
  };
  const [dialog, setDialog] = useState<{ kind: "intro" } | { kind: "vote"; sightingId: string; icon: PoliceSightingIcon } | null>(null);
  const complete = (result: PoliceReportResult, icon: PoliceSightingIcon) => {
    if (result.status === "confirmation_required" && result.sightingId) {
      setDialog({ kind: "vote", sightingId: result.sightingId, icon });
      return;
    }
    if (result.status === "gone") throw new Error("This sighting has expired or been removed.");
    if (result.status === "too_far") throw new Error("Move within 0.3 miles of this sighting to respond.");
    if (!["reported", "voted", "duplicate", "cooldown"].includes(result.status)) throw new Error("Couldn’t report. Try again.");
    setUntil(Date.now() + (result.retryAfterMs ?? 0));
    setChecked(result.status !== "cooldown");
    setDialog(null);
  };
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!checked) return;
    const timer = window.setTimeout(() => setChecked(false), 1800);
    return () => clearTimeout(timer);
  }, [checked]);
  const report = async (icon: PoliceSightingIcon = "police") => {
    if (pending.current || Date.now() < until || disabled) return;
    pending.current = true; setBusy(true); setError("");
    try {
      await initializeDevicePreferences();
      if (getDevicePreference("oos_police_intro_seen") !== "1") {
        setDialog({ kind: "intro" });
        return;
      }
      const prepared = await preparePoliceReport();
      if (prepared.status === "nearby" && prepared.sightingId) {
        setDialog({ kind: "vote", sightingId: prepared.sightingId, icon });
      } else if (prepared.status === "clear") {
        complete(await reportPolice(icon), icon);
      } else {
        throw new Error("Couldn’t check nearby sightings. Try again.");
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn’t report. Try again."); }
    finally { pending.current = false; setBusy(false); }
  };
  const acknowledge = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      await updateDevicePreferences({ oos_police_intro_seen: "1" });
      setDialog(null);
    } catch { setError("Couldn’t save. Try again."); }
    finally { pending.current = false; setBusy(false); }
  };
  const vote = async (choice: PoliceVote) => {
    if (pending.current || disabled || dialog?.kind !== "vote") return;
    pending.current = true; setBusy(true); setError("");
    try { complete(await votePolice(dialog.sightingId, choice, dialog.icon), dialog.icon); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn’t report. Try again."); }
    finally { pending.current = false; setBusy(false); }
  };
  const closeDialog = () => { if (!pending.current) { setDialog(null); setError(""); } };
  return <div style={{ width: "var(--ss-ride-instrument-width, 104px)", position: "relative", flexShrink: 0 }}>
    <button ref={button} type="button" aria-label={checked ? "Police reported" : "Report police sighting"} aria-busy={busy}
      title="Tap to report police. Hold to report with a pig icon."
      className={`ss-police-report${alerting ? " ss-police-report--alerting" : ""}`}
      disabled={blocked}
      onClick={event => {
        if (Date.now() < ignoreClickUntil.current) {
          if (ignoreClickUntil.current === Infinity) ignoreClickUntil.current = Date.now() + 700;
          event.preventDefault(); return;
        }
        void report();
      }}
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0 || blocked) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        startHold(event.pointerId, event.clientX, event.clientY);
      }}
      onPointerMove={event => {
        const origin = press.current;
        if (origin?.pointerId === event.pointerId && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 12) cancelHold();
      }}
      onPointerUp={event => {
        if (!press.current && ignoreClickUntil.current === Infinity) { ignoreClickUntil.current = Date.now() + 700; return; }
        const shortTouch = event.pointerType === "touch" && !!press.current && !soundAttempt.current;
        finishHold();
        // Cancelling touchstart also suppresses the synthetic click on iOS.
        if (shortTouch) { ignoreClickUntil.current = Date.now() + 700; void report(); }
      }}
      onPointerCancel={cancelHold} onLostPointerCapture={cancelHold}
      onContextMenu={event => event.preventDefault()}
      onKeyDown={event => {
        if (event.key !== " " && event.key !== "Enter") return;
        event.preventDefault();
        if (!event.repeat) startHold();
      }}
      onKeyUp={event => {
        if (event.key !== " " && event.key !== "Enter") return;
        event.preventDefault();
        const active = !!press.current;
        const held = !!soundAttempt.current;
        finishHold();
        if (!active && ignoreClickUntil.current === Infinity) ignoreClickUntil.current = Date.now() + 700;
        if (active && !held) void report();
      }}
      onBlur={cancelHold}
      style={{ width: "var(--ss-ride-instrument-width, 104px)", height: "var(--ss-ride-instrument-height, 76px)", boxSizing: "border-box", display: "grid", placeItems: "center", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 14, background: "rgba(0,0,0,0.72)", color: POLICE_COLOR, boxShadow: "0 12px 30px rgba(0,0,0,0.32)", opacity: disabled || busy || (now < until && !checked) ? .45 : 1, cursor: "pointer", touchAction: "none", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}>
      {checked ? <svg width="42" height="42" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        : <svg width="42" height="42" viewBox="0 0 24 26" aria-hidden="true"><path d={POLICE_ICON_PATH} fill="currentColor" /></svg>}
    </button>
    {!dialog && error && <div role="alert" style={{ position: "absolute", right: 0, top: 80, width: 210, padding: 10, background: "#191919", borderRadius: 10, zIndex: 6, fontSize: 13, textAlign: "right" }}>{error}</div>}
    {dialog && <RideDialog title={dialog.kind === "intro" ? "Report police sightings" : "Are police still here?"} onClose={closeDialog} className={`ss-police-dialog${dialog.kind === "vote" ? " ss-police-dialog--vote" : ""}`}>
      <button className="ss-police-dialog__close" type="button" aria-label="Close" onClick={closeDialog} disabled={busy}>×</button>
      {dialog.kind === "intro" ? <>
        <p>Report police you see on the road.</p>
        <p className="ss-ride-muted">Tap the police button again to report or respond to a nearby sighting.</p>
        <button type="button" className="ss-ride-primary ss-police-dialog__positive" onClick={() => void acknowledge()} disabled={busy}>Got it</button>
      </> : <>
        <button type="button" className="ss-ride-primary ss-police-dialog__positive ss-police-dialog__vote" onClick={() => void vote("still_here")} disabled={busy || disabled}>Still Here</button>
        <button type="button" className="ss-ride-secondary ss-police-dialog__vote" onClick={() => void vote("not_seen")} disabled={busy || disabled}>Not Seen</button>
      </>}
      {error && <p role="alert" className="ss-ride-error">{error}</p>}
    </RideDialog>}
  </div>;
}
