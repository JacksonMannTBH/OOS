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
  const [wakeMode, setWakeMode] = useState(true);
  const [rideThresholds, setRideThresholdsState] =
    useState<RideStatusThresholds>(DEFAULT_RIDE_STATUS_THRESHOLDS);

  useEffect(() => {
    setWakeMode(readStoredWakeLockEnabled());
    setRideThresholdsState(getRideStatusThresholds());
    readAircraftAlertStatus()
      .then((status) => setDeliveryState(deliveryStateFromStatus(status)))
      .catch(() => setDeliveryState("off"));
    const onStateChange = () => {
      const next = getSelectedStateCode();
      setStateCode(next);
      void syncAircraftAlertPreferences({ stateCode: next });
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
      setMessage(`Takeoff alerts armed for ${stateCode}.`);
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
    try {
      await disableAircraftAlerts();
      setDeliveryState("off");
      setMessage("Takeoff alerts disarmed.");
    } finally {
      setBusy(false);
    }
  }, []);

  const updateThreshold = (
    key: keyof RideStatusThresholds,
    rawValue: string,
  ) => {
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value <= 0) return;
    const next = setRideStatusThresholds({ ...rideThresholds, [key]: value });
    setRideThresholdsState(next);
  };

  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "22px 20px 170px",
        maxWidth: 430,
        margin: "0 auto -154px",
        display: "grid",
        alignContent: "start",
        gap: 18,
      }}
    >
      <h1 style={{ margin: 0, fontSize: 28, color: SS_TOKENS.fg0 }}>
        Settings
      </h1>

      <Card title="Takeoff notifications">
        <p style={copyStyle}>
          Receive one notification whenever a tracked aircraft assigned to
          your selected state begins a confirmed flight.
        </p>
        <StateSelector style={{ width: "100%" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <strong className="ss-mono" style={{ color: SS_TOKENS.fg1 }}>
            {deliveryLabel(deliveryState)}
          </strong>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            onClick={deliveryState === "on" ? onDisarm : onArm}
            disabled={
              busy ||
              deliveryState === "unsupported" ||
              deliveryState === "not_configured"
            }
            style={buttonStyle}
          >
            {busy ? "Working" : deliveryState === "on" ? "Disarm" : "Arm"}
          </button>
        </div>
        {deliveryState === "on" && (
          <button
            type="button"
            onClick={() =>
              void sendAircraftAlertTest()
                .then(() => setMessage("Test notification sent."))
                .catch(() => setMessage("Test notification failed."))
            }
            style={secondaryButtonStyle}
          >
            Send test notification
          </button>
        )}
        {message && <p role="status" style={copyStyle}>{message}</p>}
      </Card>

      <Card title="Device">
        <label style={rowStyle}>
          <span>
            <strong>Wake mode</strong>
            <small style={{ display: "block", color: SS_TOKENS.fg2 }}>
              Keep the screen awake while using ride mode.
            </small>
          </span>
          <input
            type="checkbox"
            checked={wakeMode}
            onChange={(event) => {
              setWakeMode(event.target.checked);
              writeStoredWakeLockEnabled(event.target.checked);
            }}
          />
        </label>
      </Card>

      <Card title="Ride distance bands">
        <p style={copyStyle}>
          Range of Ride mode warning signs
        </p>
        {(
          [
            ["watchNm", "Watch distance"],
            ["warningNm", "Warning distance"],
            ["stopNm", "Stop distance"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} style={rowStyle}>
            <span>{label}</span>
            <span>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={rideThresholds[key]}
                onChange={(event) => updateThreshold(key, event.target.value)}
                style={numberInputStyle}
              />{" "}
              nm
            </span>
          </label>
        ))}
      </Card>
    </main>
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
  if (state === "unsupported") return "This browser does not support Web Push.";
  if (state === "not_configured") return "VAPID keys are not configured.";
  if (state === "denied") return "Notification permission is blocked.";
  return "Could not arm alerts.";
}

function deliveryLabel(state: DeliveryState): string {
  return state === "on"
    ? "ARMED"
    : state === "checking"
      ? "CHECKING"
      : state.replace("_", " ").toUpperCase();
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        display: "grid",
        gap: 14,
        padding: 18,
        borderRadius: 20,
        background: SS_TOKENS.bg1,
        border: `.5px solid ${SS_TOKENS.hairline}`,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 17, color: SS_TOKENS.fg0 }}>{title}</h2>
      {children}
    </section>
  );
}

const copyStyle = {
  margin: 0,
  color: SS_TOKENS.fg1,
  fontSize: 13,
  lineHeight: 1.5,
} as const;

const rowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  color: SS_TOKENS.fg0,
  fontSize: 13,
} as const;

const buttonStyle = {
  minHeight: 42,
  padding: "0 18px",
  border: 0,
  borderRadius: 999,
  background: SS_TOKENS.alert,
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
} as const;

const secondaryButtonStyle = {
  ...buttonStyle,
  background: SS_TOKENS.bg2,
  color: SS_TOKENS.fg0,
} as const;

const numberInputStyle = {
  width: 72,
  minHeight: 38,
  padding: "0 8px",
  borderRadius: 8,
  border: `.5px solid ${SS_TOKENS.hairline2}`,
  background: SS_TOKENS.bg2,
  color: SS_TOKENS.fg0,
} as const;
