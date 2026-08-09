"use client";

import { useState } from "react";
import { resetPreferenceCookiesAction } from "@/app/(tabs)/settings/actions";
import { SettingsCard } from "@/components/SettingsCard";
import { disableAircraftAlerts } from "@/lib/aircraft-alerts/client";
import { SS_TOKENS } from "@/lib/tokens";

const ALERT_DEVICE_ID_KEY = "oos_aircraft_alert_device_id";

const LOCAL_STORAGE_KEYS = [
  "ss_wake_lock",
  "ss_ride_status_thresholds",
  "ss_flight_paths_visible",
  "ss_install_dismissed",
  "ss_post_install_dismissed",
  "ss_first_standalone_visit",
  "ss_distance_rings_visible",
  "oos_state_code",
  "oos_distance_rings_visible",
  "oos_alerts_promo_dismissed_at",
  "oos_arm_alerts_dismissed_at",
  ALERT_DEVICE_ID_KEY,
] as const;

function clearLocalStorage(): void {
  if (typeof window === "undefined") return;
  for (const key of LOCAL_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Best effort after the server-readable preferences are reset.
    }
  }
}

async function hasBrowserPushSubscription(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    return Boolean(subscription);
  } catch {
    return false;
  }
}

export function ResetPreferencesButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onReset = async () => {
    if (typeof window === "undefined") return;
    if (
      !window.confirm(
        "Turn off notifications and reset all preferences on this device?",
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage(null);
    let notificationsWereDisabled = false;

    try {
      const hasAlertIdentity = Boolean(
        window.localStorage.getItem(ALERT_DEVICE_ID_KEY),
      );
      const hasPushSubscription = await hasBrowserPushSubscription();
      if (hasAlertIdentity || hasPushSubscription) {
        await disableAircraftAlerts();
        notificationsWereDisabled = true;
      }

      await resetPreferenceCookiesAction();
      clearLocalStorage();
      window.location.assign("/settings");
    } catch {
      setMessage(
        notificationsWereDisabled
          ? "Notifications were turned off, but the remaining preferences could not be reset. Try again."
          : "Preferences were not reset because notifications could not be turned off. Try again.",
      );
      setBusy(false);
    }
  };

  return (
    <SettingsCard title="Restore defaults" eyebrow="Reset">
      <p
        style={{
          margin: 0,
          color: SS_TOKENS.fg1,
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        Turn off takeoff notifications and clear display, Ride mode, state, and
        dismissed-prompt preferences on this device.
      </p>

      {message && (
        <p
          role="alert"
          style={{
            margin: 0,
            color: SS_TOKENS.warn,
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          {message}
        </p>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={() => void onReset()}
        style={{
          padding: "0 16px",
          minHeight: 46,
          borderRadius: 12,
          border: `1px solid ${SS_TOKENS.hairline2}`,
          background: SS_TOKENS.bg2,
          color: SS_TOKENS.fg0,
          fontFamily: "inherit",
          fontSize: 13,
          fontWeight: 800,
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.6 : 1,
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {busy ? "Resetting…" : "Reset preferences"}
      </button>
    </SettingsCard>
  );
}
