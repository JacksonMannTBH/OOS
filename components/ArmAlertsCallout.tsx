"use client";

import { useCallback, useState } from "react";
import { SS_TOKENS } from "@/lib/tokens";
import {
  enableAircraftAlerts,
} from "@/lib/aircraft-alerts/client";
import { getSelectedStateCode } from "@/lib/app-states";

const DISMISS_KEY = "oos_arm_alerts_dismissed_at";
const DISMISS_DAYS = 14;
const DISMISS_MS = DISMISS_DAYS * 24 * 60 * 60 * 1000;

export function ArmAlertsCallout() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) ?? "0");
    return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_MS;
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("State takeoff alerts work while the app is closed.");

  const onArm = useCallback(async () => {
    setBusy(true);
    try {
      await enableAircraftAlerts({
        stateCode: getSelectedStateCode(),
      });
      setMessage("Alerts armed.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "";
      setMessage(
        text === "permission_denied"
          ? "Notification permission was not granted."
          : text === "unsupported"
            ? "This browser cannot receive web notifications."
            : text === "not_configured"
              ? "Notification keys are not configured yet."
              : "Could not arm alerts. Try Settings.",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  if (dismissed) return null;

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
        <div className="ss-eyebrow" style={{ marginBottom: 4 }}>
          OPT IN
        </div>
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
          disabled={busy}
          style={{
            background: SS_TOKENS.alert,
            color: "#fffdf8",
            padding: "8px 14px",
            borderRadius: 999,
            border: 0,
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: "nowrap",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.72 : 1,
          }}
        >
          {busy ? "Arming" : "Arm alerts"}
        </button>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
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
