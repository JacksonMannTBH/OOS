"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_RIDE_STATUS_THRESHOLDS,
  type RideStatusThresholds,
} from "@/lib/ride-mode";
import {
  getRideStatusThresholds,
  setRideStatusThresholds,
} from "@/lib/ride-settings";
import { SS_TOKENS } from "@/lib/tokens";
import {
  readStoredWakeLockEnabled,
  writeStoredWakeLockEnabled,
} from "@/lib/wake-lock";
import { useSpeedometerVisible } from "@/lib/hooks/useSpeedometerVisible";
import { writeSpeedometerVisible } from "@/lib/ride-display";
import { useRideAnglesEnabled } from "@/lib/hooks/useRideAnglesEnabled";
import { writeRideAnglesEnabled } from "@/lib/ride-motion-settings";
import { configureRideMotion } from "@/lib/ride-recording";
import { SettingsCard } from "./SettingsCard";
import { RideDialog } from "./RideDialog";
import { RideGaugeSetting } from "./RideGaugeSetting";
import { usePro } from "@/lib/hooks/usePro";

type ThresholdKey = keyof RideStatusThresholds;
type ThresholdDrafts = Record<ThresholdKey, string>;

const DISTANCE_FIELDS: ReadonlyArray<{
  key: ThresholdKey;
  label: string;
}> = [
  {
    key: "watchNm",
    label: "Watch",
  },
  {
    key: "warningNm",
    label: "Warning",
  },
  {
    key: "stopNm",
    label: "Stop",
  },
];

export function RideSettings() {
  const plan = usePro();
  const showSpeedometer = useSpeedometerVisible();
  const showRideAngles = useRideAnglesEnabled();
  const [savingAngles, setSavingAngles] = useState(false);
  const [anglesError, setAnglesError] = useState("");
  const [anglesInfoOpen, setAnglesInfoOpen] = useState(false);
  const changeRideAngles = async (enabled: boolean) => {
    setSavingAngles(true);
    setAnglesError("");
    try {
      await writeRideAnglesEnabled(enabled);
      await configureRideMotion(enabled);
    } catch {
      setAnglesError("Could not update angle tracking. Please try again.");
    } finally { setSavingAngles(false); }
  };
  const [wakeMode, setWakeMode] = useState(true);
  const [thresholds, setThresholds] = useState<RideStatusThresholds>(
    DEFAULT_RIDE_STATUS_THRESHOLDS,
  );
  const [drafts, setDrafts] = useState<ThresholdDrafts>(() =>
    draftsFromThresholds(DEFAULT_RIDE_STATUS_THRESHOLDS),
  );

  useEffect(() => {
    setWakeMode(readStoredWakeLockEnabled());
    const storedThresholds = getRideStatusThresholds();
    setThresholds(storedThresholds);
    setDrafts(draftsFromThresholds(storedThresholds));
  }, []);

  const commitThreshold = (key: ThresholdKey) => {
    const value = Number(drafts[key]);
    if (!Number.isFinite(value) || value <= 0) {
      setDrafts(draftsFromThresholds(thresholds));
      return;
    }

    const next = setRideStatusThresholds({ ...thresholds, [key]: value });
    setThresholds(next);
    setDrafts(draftsFromThresholds(next));
  };

  return (
    <>
      <SettingsCard title="Distance bands">
        <p
          style={{
            margin: 0,
            color: SS_TOKENS.fg1,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          Set when Ride mode moves from Watch to Warning to Stop. Values adjust
          automatically to keep Watch farther out than Warning and Stop.
        </p>

        <div style={{ display: "grid", gap: 8 }}>
          {DISTANCE_FIELDS.map((field) => (
            <label
              key={field.key}
              style={{
                minHeight: 64,
                padding: "8px 0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 14,
                borderBottom:
                  field.key === "stopNm"
                    ? 0
                    : `1px solid ${SS_TOKENS.hairline}`,
                color: SS_TOKENS.fg0,
              }}
            >
              <span style={{ minWidth: 0 }}>
                <strong
                  style={{ display: "block", fontSize: 14, fontWeight: 800 }}
                >
                  {field.label}
                </strong>
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  flexShrink: 0,
                  color: SS_TOKENS.fg1,
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.,]?[0-9]*"
                  enterKeyHint="done"
                  autoComplete="off"
                  spellCheck={false}
                  value={drafts[field.key]}
                  onChange={(event) => {
                    const nextDraft = normalizeDistanceDraft(
                      event.target.value,
                    );
                    if (nextDraft == null) return;
                    setDrafts((current) => ({
                      ...current,
                      [field.key]: nextDraft,
                    }));
                  }}
                  onFocus={(event) => event.currentTarget.select()}
                  onClick={(event) => event.currentTarget.select()}
                  onBlur={() => commitThreshold(field.key)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                  aria-label={`${field.label} distance in nautical miles`}
                  style={{
                    width: 82,
                    minHeight: 48,
                    boxSizing: "border-box",
                    padding: "0 10px",
                    borderRadius: 10,
                    border: `1px solid ${SS_TOKENS.hairline2}`,
                    background: SS_TOKENS.bg2,
                    color: SS_TOKENS.fg0,
                    fontFamily: "var(--font-mono)",
                    fontSize: 16,
                    fontWeight: 800,
                    textAlign: "right",
                  }}
                />
                nm
              </span>
            </label>
          ))}
        </div>
      </SettingsCard>

      {plan.pro && <><SettingsCard title="Wake mode">
        <label
          style={{
            minHeight: 52,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            color: SS_TOKENS.fg0,
            cursor: "pointer",
          }}
        >
          <span style={{ minWidth: 0 }}>
            <strong style={{ display: "block", fontSize: 14, fontWeight: 800 }}>
              Keep the screen awake
            </strong>
            <small
              style={{
                display: "block",
                marginTop: 4,
                color: SS_TOKENS.fg2,
                fontSize: 12,
                lineHeight: 1.4,
              }}
            >
              Prevent the display from sleeping while Ride mode is open.
            </small>
          </span>
          <input
            type="checkbox"
            checked={wakeMode}
            onChange={(event) => {
              setWakeMode(event.target.checked);
              writeStoredWakeLockEnabled(event.target.checked);
            }}
            style={{
              width: 22,
              height: 22,
              flexShrink: 0,
              accentColor: SS_TOKENS.alert,
              cursor: "pointer",
            }}
          />
        </label>
      </SettingsCard>

      <SettingsCard title="Speedometer">
        <label style={{ minHeight: 52, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, color: SS_TOKENS.fg0, cursor: "pointer" }}>
          <span><strong style={{ display: "block", fontSize: 14, fontWeight: 800 }}>Show speedometer</strong><small style={{ display: "block", marginTop: 4, color: SS_TOKENS.fg2, fontSize: 12, lineHeight: 1.4 }}>Display your speed in miles per hour in Ride mode.</small></span>
          <input type="checkbox" checked={showSpeedometer} onChange={event => writeSpeedometerVisible(event.target.checked)} style={{ width: 22, height: 22, flexShrink: 0, accentColor: SS_TOKENS.alert, cursor: "pointer" }} />
        </label>
      </SettingsCard>

      <RideGaugeSetting />

      <SettingsCard title="Lean and Pitch" headerAccessory={
        <button type="button" className="ss-ride-angles-info-button" aria-label="About Lean and Pitch"
          aria-haspopup="dialog" aria-expanded={anglesInfoOpen} onClick={() => setAnglesInfoOpen(true)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v6" strokeLinecap="round" />
            <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" />
          </svg>
        </button>
      }>
        <label style={{ minHeight: 52, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, color: SS_TOKENS.fg0, cursor: "pointer" }}>
          <span style={{ fontSize: 14, lineHeight: 1.4 }}>Track your maximum left/right lean and nose-up pitch.</span>
          <input type="checkbox" aria-label="Show Lean and Pitch angles in summary" checked={showRideAngles} disabled={savingAngles} onChange={event => void changeRideAngles(event.target.checked)} style={{ width: 22, height: 22, flexShrink: 0, accentColor: SS_TOKENS.alert, cursor: "pointer" }} />
        </label>
        {anglesError && <p role="alert" style={{ margin: 0, color: SS_TOKENS.warn, fontSize: 12 }}>{anglesError}</p>}
      </SettingsCard>
      {anglesInfoOpen && <RideDialog title="Lean and Pitch" className="ss-ride-angles-info" onClose={() => setAnglesInfoOpen(false)}>
        <p>Lean is how far your bike tilts left or right. Pitch is how far the front of the bike tilts upward, including beyond 90°. Ride Stats and your ride summary show the highest recorded angle for each.</p>
        <p><strong>Mount your phone.</strong> Secure it to the bike in portrait, facing you and aligned with the bike. Calibration accounts for the mount’s starting tilt.</p>
        <p><strong>Calibrate your phone.</strong> Tap Calibrate beside Home in Ride mode. It blinks yellow until readings settle briefly; gentle movement is allowed. For the best reference, keep the bike upright and stop on level ground. Calibrating while leaned or on a slope can offset the readings. Calibrate for every ride and after moving the phone. Leaving Ride mode or locking the phone cancels a pending attempt.</p>
        <p><strong>Live lean.</strong> Choose Lean arc under Swipe gauge, then swipe the Ride map to view your current left or right lean. The live arc works with peak recording turned off.</p>
        <p><strong>Live pitch.</strong> Choose Moving horizon under Swipe gauge to see pitch with a large degree reading. Negative values show downward pitch. The horizon uses the same calibration and works with peak recording turned off.</p>
        <p><strong>View and reset peaks.</strong> Tap Stats in Ride mode to see your angles. The refresh icon starts new peak measurements without changing your calibration or the rest of your ride stats.</p>
        <p><strong>Recording.</strong> Angle recording pauses while the phone is locked or OOS is in the background. A dash means no calibrated readings have been saved.</p>
        <p>Angles are estimates. Road slopes and movement can affect readings; pitch alone does not confirm a wheelie.</p>
        <button type="button" className="ss-ride-primary" onClick={() => setAnglesInfoOpen(false)}>Done</button>
      </RideDialog>}
      </>}
    </>
  );
}

function draftsFromThresholds(
  thresholds: RideStatusThresholds,
): ThresholdDrafts {
  return {
    watchNm: String(thresholds.watchNm),
    warningNm: String(thresholds.warningNm),
    stopNm: String(thresholds.stopNm),
  };
}

function normalizeDistanceDraft(value: string): string | null {
  const normalized = value.replace(",", ".").trim();
  if (normalized === "") return "";
  return /^\d{0,2}(?:\.\d?)?$/.test(normalized) ? normalized : null;
}
