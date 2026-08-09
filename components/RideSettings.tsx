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
import { SettingsCard } from "./SettingsCard";

type ThresholdKey = keyof RideStatusThresholds;
type ThresholdDrafts = Record<ThresholdKey, string>;

const DISTANCE_FIELDS: ReadonlyArray<{
  key: ThresholdKey;
  label: string;
  description: string;
}> = [
  {
    key: "watchNm",
    label: "Watch",
    description: "Start tracking the aircraft closely.",
  },
  {
    key: "warningNm",
    label: "Warning",
    description: "Show the stronger proximity warning.",
  },
  {
    key: "stopNm",
    label: "Stop",
    description: "Show the closest-range stop warning.",
  },
];

export function RideSettings() {
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
      <SettingsCard title="Wake mode" eyebrow="Device">
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

      <SettingsCard title="Distance bands" eyebrow="Ride mode">
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
                <small
                  style={{
                    display: "block",
                    marginTop: 3,
                    color: SS_TOKENS.fg2,
                    fontSize: 12,
                    lineHeight: 1.35,
                  }}
                >
                  {field.description}
                </small>
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
