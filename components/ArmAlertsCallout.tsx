"use client";

import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { SS_TOKENS } from "@/lib/tokens";
import {
  enableAircraftAlerts,
  readAircraftAlertStatus,
} from "@/lib/aircraft-alerts/client";
import type { AircraftAlertStatus } from "@/lib/aircraft-alerts/types";
import { aircraftAlertAvailabilityMessage, aircraftAlertErrorMessage, canArmAircraftAlerts, type NotificationPlatform } from "@/lib/aircraft-alerts/presentation";
import { getSelectedStateCode } from "@/lib/app-states";

const DISMISS_KEY = "oos_arm_alerts_dismissed_at";
const DISMISS_DAYS = 14;
const DISMISS_MS = DISMISS_DAYS * 24 * 60 * 60 * 1000;

export function ArmAlertsCallout() {
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<AircraftAlertStatus | null>(null);
  const [message, setMessage] = useState("");
  const platform = Capacitor.getPlatform() as NotificationPlatform;

  useEffect(() => {
    let mounted = true;
    try {
      const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) ?? "0");
      setDismissed(Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_MS);
    } catch { /* Storage can be unavailable; keep the session's dismiss button usable. */ }
    void readAircraftAlertStatus().then((next) => {
      if (!mounted) return;
      setStatus(next);
      setMessage(aircraftAlertAvailabilityMessage(next, platform));
    }).catch(() => {
      if (mounted) setMessage("Notification status is unavailable. Open Settings to retry.");
    });
    return () => { mounted = false; };
  }, [platform]);

  const onArm = useCallback(async () => {
    if (busy || !canArmAircraftAlerts(status)) return;
    setBusy(true);
    try {
      const next = await enableAircraftAlerts({
        stateCode: getSelectedStateCode(),
      });
      setStatus(next);
      setMessage("Alerts armed.");
    } catch (error) {
      setMessage(aircraftAlertErrorMessage(error, platform));
      setStatus(await readAircraftAlertStatus().catch(() => null));
    } finally {
      setBusy(false);
    }
  }, [busy, platform, status]);

  if (dismissed || !canArmAircraftAlerts(status)) return null;
  const actionDisabled = busy;

  return (
    <div
      style={{
        background: SS_TOKENS.bg1,
        border: `.5px solid ${SS_TOKENS.alert}`,
        borderRadius: 22,
        boxShadow: SS_TOKENS.shadowSm,
        padding: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: SS_TOKENS.fg0,
            lineHeight: 1.3,
          }}
        >
          Get a ping when tracked aircraft launch.
        </div>
        <div style={{ marginTop: 4, fontSize: 12, color: SS_TOKENS.fg2 }}>
          {message}
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onArm}
          disabled={actionDisabled}
          style={{
            background: SS_TOKENS.alert,
            color: "#fffdf8",
            padding: "8px 14px",
            borderRadius: 999,
            border: 0,
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: "nowrap",
            cursor: actionDisabled ? "default" : "pointer",
            opacity: actionDisabled ? 0.5 : 1,
          }}
        >
          {busy ? "Arming" : "Arm alerts"}
        </button>
        <button
          type="button"
          onClick={() => {
            try { window.localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* Dismiss for this session. */ }
            setDismissed(true);
          }}
          aria-label="Dismiss for 14 days"
          style={{
            background: "none",
            border: "none",
            color: SS_TOKENS.fg2,
            fontSize: 12,
            cursor: "pointer",
            padding: "8px 6px",
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
