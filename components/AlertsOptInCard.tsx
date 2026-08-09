"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { SS_TOKENS } from "@/lib/tokens";
import {
  enableAircraftAlerts,
  readAircraftAlertStatus,
} from "@/lib/aircraft-alerts/client";
import { getSelectedStateCode } from "@/lib/app-states";

const DISMISS_KEY = "oos_alerts_promo_dismissed_at";
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
type Phase = "checking" | "show" | "hidden";

export function AlertsOptInCard({ frameless = false }: { frameless?: boolean }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
    if (Number.isFinite(dismissed) && Date.now() - dismissed < COOLDOWN_MS) {
      setPhase("hidden");
      return;
    }
    readAircraftAlertStatus()
      .then((status) => setPhase(status.enabled ? "hidden" : "show"))
      .catch(() => setPhase("show"));
  }, []);

  const onDismiss = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    setPhase("hidden");
  }, []);

  const onArm = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      await enableAircraftAlerts({
        stateCode: getSelectedStateCode(),
      });
      setMessage("Alerts armed.");
    } catch (error) {
      setMessage(messageForArmError(error));
    } finally {
      setBusy(false);
    }
  }, []);

  if (phase === "checking" || phase === "hidden") return null;

  return (
    <Wrapper frameless={frameless}>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: SS_TOKENS.fg0,
          margin: 0,
          lineHeight: 1.2,
        }}
      >
        Want a ping when tracked aircraft launch?
      </h3>
      {message && (
        <p
          role="status"
          style={{
            fontSize: 12,
            color: SS_TOKENS.alert,
            margin: "10px 0 0",
            lineHeight: 1.45,
          }}
        >
          {message}
        </p>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: frameless ? 6 : 12,
        }}
      >
        <button
          type="button"
          onClick={onArm}
          disabled={busy}
          style={{
            minHeight: frameless ? 40 : undefined,
            padding: frameless ? "0 18px" : "8px 14px",
            borderRadius: 999,
            border: frameless ? `2.6px solid ${SS_TOKENS.alert}` : 0,
            background: frameless ? "#fffdf8" : SS_TOKENS.alert,
            color: frameless ? "#000000" : "#fffdf8",
            boxShadow: frameless
              ? "0 8px 22px rgba(0, 0, 0, 0.24)"
              : "none",
            fontFamily: "var(--font-brand)",
            fontSize: 12.5,
            fontWeight: 700,
            letterSpacing: ".02em",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.72 : 1,
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {busy ? "Arming" : "Arm alerts"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            minHeight: frameless ? 40 : undefined,
            padding: frameless ? "0 14px" : "8px 14px",
            borderRadius: frameless ? 0 : 999,
            border: frameless ? 0 : `.5px solid ${SS_TOKENS.hairline2}`,
            background: "transparent",
            color: SS_TOKENS.fg1,
            fontFamily: "var(--font-brand)",
            fontSize: 12.5,
            fontWeight: 600,
            letterSpacing: ".02em",
            cursor: "pointer",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Not now
        </button>
      </div>
    </Wrapper>
  );
}

function messageForArmError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message === "permission_denied") return "Notification permission was not granted.";
  if (message === "unsupported") return "This browser cannot receive web notifications.";
  if (message === "not_configured") return "Notification keys are not configured yet.";
  return "Could not arm alerts. Try again from Settings.";
}

function Wrapper({
  children,
  frameless,
}: {
  children: ReactNode;
  frameless: boolean;
}) {
  return (
    <section
      style={{
        background: frameless ? "transparent" : SS_TOKENS.bg1,
        border: frameless ? 0 : `.5px solid ${SS_TOKENS.hairline}`,
        borderRadius: frameless ? 0 : 22,
        boxShadow: frameless ? "none" : SS_TOKENS.shadowSm,
        padding: frameless ? "0 4px" : "14px 16px",
        marginBottom: frameless ? -5 : 0,
      }}
    >
      {children}
    </section>
  );
}
