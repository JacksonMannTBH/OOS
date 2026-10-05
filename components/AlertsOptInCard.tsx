"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { SS_TOKENS } from "@/lib/tokens";
import {
  enableAircraftAlerts,
  readAircraftAlertStatus,
} from "@/lib/aircraft-alerts/client";
import { getSelectedStateCode } from "@/lib/app-states";

const DISMISS_KEY = "oos_alerts_promo_dismissed_at";
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
type Phase = "checking" | "show" | "hidden";

export function AlertsOptInCard() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (typeof window === "undefined") return;
    setMounted(true);
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
      setPhase("hidden");
    } catch (error) {
      setMessage(messageForArmError(error));
    } finally {
      setBusy(false);
    }
  }, []);

  if (!mounted || phase === "checking" || phase === "hidden") return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "grid",
        placeItems: "center",
        boxSizing: "border-box",
        padding:
          "max(20px, env(safe-area-inset-top, 0px)) max(18px, env(safe-area-inset-right, 0px)) max(20px, env(safe-area-inset-bottom, 0px)) max(18px, env(safe-area-inset-left, 0px))",
        background: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        style={{
          width: "min(100%, 380px)",
          boxSizing: "border-box",
          padding: "24px 22px 20px",
          borderRadius: 24,
          border: `1px solid ${SS_TOKENS.hairline2}`,
          background: "rgba(13, 14, 11, 0.98)",
          boxShadow: "0 28px 80px rgba(0, 0, 0, 0.62)",
          color: SS_TOKENS.fg0,
        }}
      >
        <div
          aria-hidden
          style={{
            width: 42,
            height: 4,
            marginBottom: 18,
            borderRadius: 999,
            background: SS_TOKENS.alert,
          }}
        />
        <h2
          id={titleId}
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 900,
            lineHeight: 1.08,
          }}
        >
          Stay ahead of takeoffs
        </h2>
        <p
          id={descriptionId}
          style={{
            margin: "12px 0 0",
            color: SS_TOKENS.fg1,
            fontSize: 15,
            lineHeight: 1.5,
          }}
        >
          Get a notification when tracked aircraft in your selected state launch.
        </p>
        {message && (
          <p
            role="status"
            style={{
              margin: "12px 0 0",
              color: SS_TOKENS.alert,
              fontSize: 13,
              lineHeight: 1.4,
            }}
          >
            {message}
          </p>
        )}
        <button
          type="button"
          onClick={onArm}
          disabled={busy}
          style={{
            width: "100%",
            minHeight: 52,
            marginTop: 22,
            padding: "0 18px",
            borderRadius: 16,
            border: 0,
            background: SS_TOKENS.alert,
            color: "#050607",
            boxShadow: "0 12px 30px rgba(246, 196, 49, 0.18)",
            fontFamily: "var(--font-brand)",
            fontSize: 16,
            fontWeight: 900,
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
            width: "100%",
            minHeight: 46,
            marginTop: 6,
            padding: "0 14px",
            borderRadius: 14,
            border: 0,
            background: "transparent",
            color: SS_TOKENS.fg1,
            fontFamily: "var(--font-brand)",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Not now
        </button>
      </section>
    </div>,
    document.body,
  );
}

function messageForArmError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message === "permission_denied") return "Notification permission was not granted.";
  if (message === "unsupported") return "This browser cannot receive web notifications.";
  if (message === "not_configured") return "Notification keys are not configured yet.";
  return "Could not arm alerts. Try again from Settings.";
}
