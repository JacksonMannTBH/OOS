"use client";

import { useId, useState } from "react";
import { DISTANCE_PALETTES, DISTANCE_STATES, distancePalette, type DistancePalette } from "@/lib/distance-color-palette";
import { writeDistancePalette } from "@/lib/distance-colors";
import { useDistancePalette } from "@/lib/hooks/useDistancePalette";
import { SS_TOKENS } from "@/lib/tokens";
import { RideDialog } from "./RideDialog";

export function DistanceColorSetting() {
  const id = useId();
  const current = useDistancePalette();
  const selected = distancePalette(current);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const close = () => { if (!saving) setOpen(false); };
  const change = async (value: DistancePalette) => {
    if (saving) return;
    if (value === current) { setOpen(false); return; }
    setSaving(true);
    setError(false);
    try { await writeDistancePalette(value); setOpen(false); }
    catch { setError(true); }
    finally { setSaving(false); }
  };

  return <>
    <button type="button" className="ss-settings-card ss-ride-gauge-row ss-distance-color-row"
      aria-haspopup="dialog" aria-expanded={open} disabled={saving}
      aria-label={`Distance colors, ${selected.label}`} aria-describedby={`${id}-hint`}
      onClick={event => {
        event.currentTarget.focus({ preventScroll: true });
        setError(false);
        setOpen(true);
      }}>
      <span id={`${id}-label`} className="ss-ride-gauge-row__label">Distance colors</span>
      <span className="ss-ride-gauge-row__value">
        <span className="ss-distance-color-dots" aria-hidden="true">
          {DISTANCE_STATES.map(state => <span key={state} style={{ background: selected.colors[state] }} />)}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span id={`${id}-hint`} className="ss-ride-gauge-row__hint">Colors for Clear, Watch, Warning, and Stop.</span>
    </button>
    {open && <RideDialog title="Distance colors" className="ss-ride-gauge-menu ss-distance-color-menu" onClose={close} dismissOnBackdrop>
      <p className="ss-distance-color-intro">Choose your distance indicators. Your distance bands and Color Mode stay the same.</p>
      <div className="ss-ride-gauge-options" role="group" aria-label="Available distance palettes" aria-busy={saving}>
        {DISTANCE_PALETTES.map(palette => <button key={palette.id} type="button"
          className="ss-ride-gauge-option ss-distance-color-option" aria-pressed={current === palette.id} disabled={saving}
          aria-label={palette.label} onClick={() => void change(palette.id)}>
          <span className="ss-distance-color-swatches" role="img" aria-label="Clear, Watch, Warning, and Stop colors">
            {DISTANCE_STATES.map(state => <span key={state} className="ss-distance-color-swatch" style={{ background: palette.colors[state] }} />)}
          </span>
          <span className="ss-ride-gauge-option__selection" aria-hidden="true">
            {current === palette.id && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>}
          </span>
        </button>)}
      </div>
      {error && <p role="alert" style={{ color: SS_TOKENS.warn, fontSize: 13 }}>Could not save your distance colors. Please try again.</p>}
      <button type="button" className="ss-ride-secondary ss-ride-gauge-cancel" disabled={saving} onClick={close}>Cancel</button>
    </RideDialog>}
  </>;
}
