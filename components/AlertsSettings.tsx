"use client";

import { useCallback, useEffect, useState } from "react";
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
  syncAircraftAlertPreferences,
} from "@/lib/aircraft-alerts/client";
import type { AircraftAlertStatus } from "@/lib/aircraft-alerts/types";
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
  const [message, setMessage] = useState<string | null>(null);
  const [stateCode, setStateCode] = useState<StateCode>(
    () => getSelectedStateCode(),
  );

  useEffect(() => {
    readAircraftAlertStatus()
      .then((status) => setDeliveryState(deliveryStateFromStatus(status)))
      .catch(() => {
        setDeliveryState("off");
        setMessage("Could not check notification status.");
      });

    const onStateChange = () => {
      const next = getSelectedStateCode();
      setStateCode(next);
      setMessage(null);
      void syncAircraftAlertPreferences({ stateCode: next })
        .then((status) => {
          if (status) setDeliveryState(deliveryStateFromStatus(status));
        })
        .catch(() =>
          setMessage(
            "State saved on this device, but the notification subscription could not be updated.",
          ),
        );
    };

    window.addEventListener(STATE_CHANGE_EVENT, onStateChange);
    return () => window.removeEventListener(STATE_CHANGE_EVENT, onStateChange);
  }, []);

  const onArm = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const status = await enableAircraftAlerts({ stateCode });
      setDeliveryState(deliveryStateFromStatus(status));
      setMessage(`Takeoff notifications are on for ${stateCode}.`);
    } catch (error) {
      const next = deliveryStateFromError(error);
      setDeliveryState(next);
      setMessage(messageForDeliveryState(next));
    } finally {
      setBusy(false);
    }
  }, [stateCode]);

  const onDisarm = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      await disableAircraftAlerts();
      setDeliveryState("off");
      setMessage("Takeoff notifications are off.");
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

      {deliveryState === "on" && (
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
  if (!status.configured) return "not_configured";
  if (status.permission === "denied") return "denied";
  return status.enabled ? "on" : "off";
}

function deliveryStateFromError(error: unknown): DeliveryState {
  const message = error instanceof Error ? error.message : "";
  if (message === "unsupported") return "unsupported";
  if (message === "not_configured") return "not_configured";
  if (message === "permission_denied") return "denied";
  return "off";
}

function messageForDeliveryState(state: DeliveryState): string {
  if (state === "unsupported") {
    return "This browser cannot receive web push notifications.";
  }
  if (state === "not_configured") {
    return "Takeoff notifications are not available right now.";
  }
  if (state === "denied") {
    return "Notifications are blocked in this browser’s settings.";
  }
  return "Could not turn on notifications. Try again.";
}

function deliveryDescription(state: DeliveryState): string {
  if (state === "checking") return "Checking notification support on this device.";
  if (state === "unsupported") {
    return "This browser cannot receive web push notifications.";
  }
  if (state === "not_configured") {
    return "Takeoff notifications are not available right now.";
  }
  if (state === "denied") {
    return "Allow notifications in your browser settings, then try again.";
  }
  if (state === "on") return "This device will receive confirmed takeoff notifications.";
  return "Notifications are off on this device.";
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
