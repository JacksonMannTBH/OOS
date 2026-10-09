"use client";

import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  STATE_CHANGE_EVENT,
  getSelectedStateCode,
  type StateCode,
} from "@/lib/app-states";
import {
  disableAircraftAlerts,
  enableAircraftAlerts,
  readAircraftAlertStatus,
  sendAircraftAlertTest,
  AIRCRAFT_ALERT_PREFERENCE_SYNC_EVENT,
} from "@/lib/aircraft-alerts/client";
import type { AircraftAlertStatus } from "@/lib/aircraft-alerts/types";
import { aircraftAlertAvailabilityMessage, aircraftAlertErrorMessage, type NotificationPlatform } from "@/lib/aircraft-alerts/presentation";
import { SS_TOKENS } from "@/lib/tokens";
import { SettingsCard } from "./SettingsCard";
import { StateSelector } from "./StateSelector";

type DeliveryState =
  | "checking"
  | "off"
  | "on"
  | "unsupported"
  | "not_configured"
  | "denied";

export function AlertsSettings() {
  const [deliveryState, setDeliveryState] =
    useState<DeliveryState>("checking");
  const [busy, setBusy] = useState(false);
  const [deliveryConfigured, setDeliveryConfigured] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [stateCode, setStateCode] = useState<StateCode>(
    () => getSelectedStateCode(),
  );

  useEffect(() => {
    readAircraftAlertStatus()
      .then((status) => {
        setDeliveryState(deliveryStateFromStatus(status));
        setDeliveryConfigured(status.configured);
        if (!status.configured) setMessage(aircraftAlertAvailabilityMessage(status, Capacitor.getPlatform() as NotificationPlatform));
      })
      .catch(() => {
        setDeliveryState("not_configured");
        setMessage("Could not check notification status. Reopen this screen to try again.");
      });

    const onStateChange = () => {
      const next = getSelectedStateCode();
      setStateCode(next);
      setMessage(null);
    };

    window.addEventListener(STATE_CHANGE_EVENT, onStateChange);
    const onPreferenceSync = (event: Event) => {
      const detail = (event as CustomEvent<{ status?: AircraftAlertStatus; error?: boolean }>).detail;
      if (detail.error) {
        setMessage("Selections are saved on this device, but takeoff notifications could not be updated. We’ll retry when the app reconnects.");
      } else {
        if (detail.status) {
          setDeliveryState(deliveryStateFromStatus(detail.status));
          setDeliveryConfigured(detail.status.configured);
        }
        setMessage(detail.status && !detail.status.configured
          ? aircraftAlertAvailabilityMessage(detail.status, Capacitor.getPlatform() as NotificationPlatform)
          : null);
      }
    };
    window.addEventListener(AIRCRAFT_ALERT_PREFERENCE_SYNC_EVENT, onPreferenceSync);
    return () => {
      window.removeEventListener(STATE_CHANGE_EVENT, onStateChange);
      window.removeEventListener(AIRCRAFT_ALERT_PREFERENCE_SYNC_EVENT, onPreferenceSync);
    };
  }, []);

  const onArm = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const status = await enableAircraftAlerts({ stateCode });
      setDeliveryState(deliveryStateFromStatus(status));
      setDeliveryConfigured(status.configured);
      setMessage(`Takeoff notifications are on for ${stateCode}.`);
    } catch (error) {
      const next = deliveryStateFromError(error);
      setDeliveryState(next);
      setMessage(aircraftAlertErrorMessage(error, Capacitor.getPlatform() as NotificationPlatform));
    } finally {
      setBusy(false);
    }
  }, [stateCode]);

  const onDisarm = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const status = await disableAircraftAlerts();
      setDeliveryState(deliveryStateFromStatus(status));
      setDeliveryConfigured(status.configured);
      setMessage(status.configured ? "Takeoff notifications are off."
        : aircraftAlertAvailabilityMessage(status, Capacitor.getPlatform() as NotificationPlatform));
    } catch {
      setMessage("Could not turn off notifications. Try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  const actionDisabled =
    busy ||
    deliveryState === "checking" ||
    deliveryState === "unsupported" ||
    deliveryState === "not_configured";
  const statusColor =
    deliveryState === "on"
      ? SS_TOKENS.alert
      : deliveryState === "denied"
        ? SS_TOKENS.danger
        : SS_TOKENS.fg1;

  return (
    <SettingsCard title="Takeoff notifications" eyebrow="Alerts">
      <p style={copyStyle}>
        Receive one notification when a tracked aircraft assigned to your
        selected state begins a confirmed flight.
      </p>

      <label
        style={{
          display: "grid",
          gap: 7,
          color: SS_TOKENS.fg0,
          fontSize: 13,
          fontWeight: 800,
        }}
      >
        State to track
        <StateSelector
          style={{ width: "100%", minHeight: 48, borderRadius: 12 }}
        />
        <small
          style={{
            color: SS_TOKENS.fg2,
            fontSize: 12,
            fontWeight: 600,
            lineHeight: 1.4,
          }}
        >
          If notifications are on, changing state also updates this device’s
          subscription.
        </small>
      </label>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          minHeight: 48,
        }}
      >
        <span style={{ minWidth: 0, flex: 1 }}>
          <span
            className="ss-eyebrow"
            style={{ display: "block", marginBottom: 4, color: SS_TOKENS.fg2 }}
          >
            Delivery
          </span>
          <strong
            className="ss-mono"
            style={{ color: statusColor, fontSize: 12, letterSpacing: ".04em" }}
          >
            {deliveryLabel(deliveryState)}
          </strong>
        </span>
        <button
          type="button"
          onClick={deliveryState === "on" ? onDisarm : onArm}
          disabled={actionDisabled}
          style={{
            minHeight: 46,
            padding: "0 18px",
            border: 0,
            borderRadius: 999,
            background: SS_TOKENS.alert,
            color: "#050607",
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 900,
            cursor: actionDisabled ? "default" : "pointer",
            opacity: actionDisabled ? 0.45 : 1,
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {busy
            ? "Working"
            : deliveryState === "checking"
              ? "Checking"
              : deliveryState === "unsupported" ||
                  deliveryState === "not_configured"
                ? "Unavailable"
                : deliveryState === "on"
                  ? "Turn off"
                  : "Turn on"}
        </button>
      </div>

      <p role={message ? "status" : undefined} style={copyStyle}>
        {message ?? deliveryDescription(deliveryState)}
      </p>

      {deliveryState === "on" && deliveryConfigured && (
        <button
          type="button"
          onClick={() => {
            setMessage(null);
            void sendAircraftAlertTest()
              .then(() => setMessage("Test notification sent."))
              .catch(() => setMessage("Test notification failed."));
          }}
          style={{
            minHeight: 46,
            padding: "0 16px",
            borderRadius: 12,
            border: `1px solid ${SS_TOKENS.hairline2}`,
            background: SS_TOKENS.bg2,
            color: SS_TOKENS.fg0,
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Send test notification
        </button>
      )}
    </SettingsCard>
  );
}

function deliveryStateFromStatus(
  status: AircraftAlertStatus,
): DeliveryState {
  if (!status.supported) return "unsupported";
  if (status.enabled) return "on";
  if (!status.configured) return "not_configured";
  if (status.permission === "denied") return "denied";
  return "off";
}

function deliveryStateFromError(error: unknown): DeliveryState {
  const message = error instanceof Error ? error.message : "";
  if (message === "unsupported") return "unsupported";
  if (message === "not_configured" || message.startsWith("native_")) return "not_configured";
  if (message === "permission_denied") return "denied";
  return "off";
}

function deliveryDescription(state: DeliveryState): string {
  if (state === "checking") return "Checking notification support on this device.";
  if (state === "unsupported") {
    return aircraftAlertErrorMessage(new Error("unsupported"), Capacitor.getPlatform() as NotificationPlatform);
  }
  if (state === "not_configured") {
    return "Takeoff notifications are not available right now.";
  }
  if (state === "denied") {
    return notificationPermissionHelp();
  }
  if (state === "on") return "This device will receive confirmed takeoff notifications.";
  return "Notifications are off on this device.";
}

function notificationPermissionHelp(): string {
  if (Capacitor.isNativePlatform()) {
    return Capacitor.getPlatform() === "ios"
      ? "Open iPhone Settings → Notifications → Out Of Sight and allow notifications, then return here and try again."
      : "Allow notifications for Out Of Sight in your device settings, then return here and try again.";
  }
  return "Allow notifications in your browser settings, then try again.";
}

function deliveryLabel(state: DeliveryState): string {
  return state === "on"
    ? "ON"
    : state === "off"
      ? "OFF"
      : state === "checking"
        ? "CHECKING"
        : state.replace("_", " ").toUpperCase();
}

const copyStyle = {
  margin: 0,
  color: SS_TOKENS.fg1,
  fontSize: 13,
  lineHeight: 1.5,
} as const;
