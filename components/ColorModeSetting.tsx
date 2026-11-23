"use client";

import { useState, useSyncExternalStore } from "react";
import { COLOR_MODE_EVENT, COLOR_MODE_KEY, DEFAULT_COLOR_MODE, readColorMode, writeColorMode, type ColorMode } from "@/lib/color-mode";
import { COLOR_MODE_OPTIONS } from "@/lib/color-mode-palette";
import { SS_TOKENS } from "@/lib/tokens";
import { RideDialog } from "./RideDialog";

function subscribe(refresh: () => void) {
  const storage = (event: StorageEvent) => { if (!event.key || event.key === COLOR_MODE_KEY) refresh(); };
  window.addEventListener(COLOR_MODE_EVENT, refresh);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(COLOR_MODE_EVENT, refresh);
    window.removeEventListener("storage", storage);
  };
}

export function ColorModeSetting() {
  const current = useSyncExternalStore(subscribe, readColorMode, () => DEFAULT_COLOR_MODE);
  const selected = COLOR_MODE_OPTIONS.find(option => option.value === current)!;
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const close = () => { if (!saving) setOpen(false); };
  const change = async (mode: ColorMode) => {
    if (saving) return;
    if (mode === current) { setOpen(false); return; }
    setSaving(true);
    setError(false);
    try { await writeColorMode(mode); setOpen(false); }
    catch { setError(true); }
    finally { setSaving(false); }
  };
  return <>
    <button type="button" className="ss-settings-card ss-color-mode-row"
      aria-haspopup="dialog" aria-expanded={open} disabled={saving}
      onClick={event => {
        event.currentTarget.focus({ preventScroll: true });
        setError(false);
        setOpen(true);
      }}>
      <span className="ss-color-mode-row__label">Color Mode</span>
      <span className="ss-color-mode-row__value">
        <span className="ss-color-mode-swatch" style={{ background: selected.swatch }} aria-hidden="true" />
        <span>{selected.label}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
    {open && <RideDialog title="Color Mode" className="ss-color-mode-menu" onClose={close} dismissOnBackdrop>
      <div className="ss-color-mode-options" role="group" aria-label="Color modes" aria-busy={saving}>
        {COLOR_MODE_OPTIONS.map(({ value: mode, label, swatch }) =>
          <button key={mode} type="button" className="ss-color-mode-option" aria-pressed={current === mode}
            disabled={saving} onClick={() => void change(mode)}>
            <span className="ss-color-mode-swatch" style={{ background: swatch }} aria-hidden="true" />
            <span>{label}</span>
            {current === mode && <svg className="ss-color-mode-option__check" width="20" height="20" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>}
          </button>)}
      </div>
      {error && <p role="alert" style={{ color: SS_TOKENS.danger, fontSize: 13 }}>Could not save color mode. Please try again.</p>}
      <button type="button" className="ss-ride-secondary" disabled={saving} onClick={close}>Cancel</button>
    </RideDialog>}
  </>;
}
