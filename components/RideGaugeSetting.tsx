"use client";

import { useId, useState } from "react";
import { useRideGauge } from "@/lib/hooks/useRideGauge";
import { writeRideGauge, type RideGauge } from "@/lib/ride-gauge-settings";
import { SS_TOKENS } from "@/lib/tokens";
import { RideDialog } from "./RideDialog";

const OPTIONS = [
  { value: "gforce", label: "G-force", description: "Acceleration, braking, and cornering." },
  { value: "lean", label: "Lean arc", description: "Your left and right lean angle." },
  { value: "pitch", label: "Moving horizon", description: "Your pitch angle against the horizon." },
] as const;

export function RideGaugeSetting() {
  const id = useId();
  const current = useRideGauge();
  const selected = OPTIONS.find(option => option.value === current)!;
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const close = () => { if (!saving) setOpen(false); };
  const change = async (gauge: RideGauge) => {
    if (saving) return;
    if (gauge === current) { setOpen(false); return; }
    setSaving(true);
    setError(false);
    try { await writeRideGauge(gauge); setOpen(false); }
    catch { setError(true); }
    finally { setSaving(false); }
  };

  return <>
    <button type="button" className="ss-settings-card ss-ride-gauge-row"
      aria-haspopup="dialog" aria-expanded={open} disabled={saving}
      aria-labelledby={`${id}-label ${id}-current`} aria-describedby={`${id}-hint`}
      onClick={event => {
        event.currentTarget.focus({ preventScroll: true });
        setError(false);
        setOpen(true);
      }}>
      <span id={`${id}-label`} className="ss-ride-gauge-row__label">Swipe gauge</span>
      <span className="ss-ride-gauge-row__value">
        <span id={`${id}-current`}>{selected.label}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span id={`${id}-hint`} className="ss-ride-gauge-row__hint">Shown when you swipe the Ride map.</span>
    </button>
    {open && <RideDialog title="Swipe gauge" className="ss-ride-gauge-menu" onClose={close} dismissOnBackdrop>
      <div className="ss-ride-gauge-options" role="group" aria-label="Available gauges" aria-busy={saving}>
        {OPTIONS.map(({ value, label, description }) => <button key={value} type="button"
          className="ss-ride-gauge-option" aria-pressed={current === value} disabled={saving}
          aria-labelledby={`${id}-${value}-label`} aria-describedby={`${id}-${value}-description`}
          onClick={() => void change(value)}>
          <GaugePreview gauge={value} />
          <span className="ss-ride-gauge-option__copy">
            <strong id={`${id}-${value}-label`}>{label}</strong>
            <span id={`${id}-${value}-description`}>{description}</span>
          </span>
          <span className="ss-ride-gauge-option__selection" aria-hidden="true">
            {current === value && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>}
          </span>
        </button>)}
      </div>
      {error && <p role="alert" style={{ color: SS_TOKENS.warn, fontSize: 13 }}>Could not save your gauge choice. Please try again.</p>}
      <button type="button" className="ss-ride-secondary ss-ride-gauge-cancel" disabled={saving} onClick={close}>Cancel</button>
    </RideDialog>}
  </>;
}

function GaugePreview({ gauge }: { gauge: RideGauge }) {
  const clipId = useId();
  return <svg className="ss-ride-gauge-preview" width="48" height="48" viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
    <circle cx="32" cy="32" r="28" className="ss-ride-gauge-preview__rim" />
    {gauge === "gforce" ? <>
      <circle cx="32" cy="32" r="14" className="ss-ride-gauge-preview__grid" />
      <path d="M8 32h48M32 8v48" className="ss-ride-gauge-preview__grid" />
      <path d="m23 40 5-4 3-7 9-6" className="ss-ride-gauge-preview__active" />
      <circle cx="40" cy="23" r="3" fill="currentColor" />
    </> : gauge === "lean" ? <>
      <path d="M11 29a22 22 0 0 1 42 0M32 10v39" className="ss-ride-gauge-preview__grid" />
      <path d="M13 24a22 22 0 0 1 19-14M32 48 21 18" className="ss-ride-gauge-preview__active" />
      <circle cx="32" cy="48" r="2.5" fill="currentColor" />
    </> : <>
      <defs><clipPath id={clipId}><circle cx="32" cy="32" r="26" /></clipPath></defs>
      <g clipPath={`url(#${clipId})`}>
        <path d="M6 36h52v24H6Z" className="ss-ride-gauge-preview__ground" />
        <path d="M6 36h52M26 17h12" className="ss-ride-gauge-preview__grid" />
      </g>
      <path d="M17 27h9l3 4h6l3-4h9" className="ss-ride-gauge-preview__active" />
      <circle cx="32" cy="25" r="1.5" fill="currentColor" />
    </>}
  </svg>;
}
