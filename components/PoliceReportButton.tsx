"use client";
import { useEffect, useRef, useState } from "react";
import { POLICE_COLOR, POLICE_ICON_PATH } from "@/lib/police-sightings";
import { preparePoliceReport, reportPolice, votePolice, type PoliceVote, type PoliceReportResult } from "@/lib/police-client";
import { getDevicePreference, initializeDevicePreferences, updateDevicePreferences } from "@/lib/device-preferences";
import { RideDialog } from "./RideDialog";

export function PoliceReportButton({ disabled = false, alerting = false }: { disabled?: boolean; alerting?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const [dialog, setDialog] = useState<{ kind: "intro" } | { kind: "vote"; sightingId: string } | null>(null);
  const complete = (result: PoliceReportResult) => {
    if (result.status === "confirmation_required" && result.sightingId) {
      setDialog({ kind: "vote", sightingId: result.sightingId });
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
  const report = async () => {
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
        setDialog({ kind: "vote", sightingId: prepared.sightingId });
      } else if (prepared.status === "clear") {
        complete(await reportPolice());
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
    try { complete(await votePolice(dialog.sightingId, choice)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn’t report. Try again."); }
    finally { pending.current = false; setBusy(false); }
  };
  const closeDialog = () => { if (!pending.current) { setDialog(null); setError(""); } };
  return <div style={{ width: 104, position: "relative", flexShrink: 0 }}>
    <button type="button" aria-label={checked ? "Police reported" : "Report police sighting"} aria-busy={busy}
      className={alerting ? "ss-police-report--alerting" : undefined}
      disabled={disabled || busy || now < until} onClick={() => void report()}
      style={{ width: 104, height: 76, boxSizing: "border-box", display: "grid", placeItems: "center", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 14, background: "rgba(0,0,0,0.72)", color: POLICE_COLOR, boxShadow: "0 12px 30px rgba(0,0,0,0.32)", opacity: disabled || busy || (now < until && !checked) ? .45 : 1, cursor: "pointer", touchAction: "manipulation" }}>
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
