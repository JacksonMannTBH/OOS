"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Capacitor } from "@capacitor/core";
import { SS_TOKENS } from "@/lib/tokens";
import {
  AIRCRAFT_ALERT_PREFERENCE_SYNC_EVENT,
  enableAircraftAlerts,
  readAircraftAlertStatus,
} from "@/lib/aircraft-alerts/client";
import { getAppState, getSelectedStateCode } from "@/lib/app-states";
import { aircraftAlertErrorMessage, shouldPromoteAircraftAlerts, type NotificationPlatform } from "@/lib/aircraft-alerts/presentation";

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
    let dismissed = 0;
    try { dismissed = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0); }
    catch { /* Native alert enrollment is independent of web storage. */ }
    if (Number.isFinite(dismissed) && Date.now() - dismissed < COOLDOWN_MS) {
      setPhase("hidden");
      return;
    }
    let cancelled = false;
    readAircraftAlertStatus()
      .then((status) => { if (!cancelled) setPhase(shouldPromoteAircraftAlerts(status) ? "show" : "hidden"); })
      .catch(() => { if (!cancelled) setPhase("hidden"); });
    const onStatus = (event: Event) => {
      const status = (event as CustomEvent<{ status?: { enabled: boolean; optedIn?: boolean } }>).detail?.status;
      if (status?.enabled || status?.optedIn) { cancelled = true; setPhase("hidden"); }
    };
    window.addEventListener(AIRCRAFT_ALERT_PREFERENCE_SYNC_EVENT, onStatus);
    return () => { cancelled = true; window.removeEventListener(AIRCRAFT_ALERT_PREFERENCE_SYNC_EVENT, onStatus); };
  }, []);

  const onDismiss = useCallback(() => {
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(DISMISS_KEY, String(Date.now())); }
      catch { /* Still dismiss for this session. */ }
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
      setMessage(aircraftAlertErrorMessage(error, Capacitor.getPlatform() as NotificationPlatform));
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
          border: 0,
          background: "rgba(13, 14, 11, 0.98)",
          boxShadow: "none",
          color: SS_TOKENS.fg0,
        }}
      >
        <h2
          id={titleId}
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 900,
            lineHeight: 1.08,
          }}
        >
          Turn on Notifications?
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
          Get notified when aircraft you track in {getAppState(getSelectedStateCode()).label} take flight.
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
            boxShadow: "none",
            fontFamily: "var(--font-brand)",
            fontSize: 16,
            fontWeight: 900,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.72 : 1,
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {busy ? "Turning on…" : "Notify me"}
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
