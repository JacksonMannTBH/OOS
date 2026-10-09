import type { AircraftAlertStatus } from "./types";

export type NotificationPlatform = "ios" | "android" | "web";

export function canArmAircraftAlerts(status: AircraftAlertStatus | null): boolean {
  return Boolean(status?.supported && status.configured && !status.enabled);
}

export function shouldPromoteAircraftAlerts(status: AircraftAlertStatus): boolean {
  return canArmAircraftAlerts(status) && status.permission !== "denied";
}

export function aircraftAlertErrorMessage(error: unknown, platform: NotificationPlatform): string {
  const message = error instanceof Error ? error.message : "";
  if (message === "native_update_required") return "Update OOS before enabling takeoff notifications.";
  if (message === "native_not_configured") return "Takeoff notifications aren’t available in this app build yet.";
  if (message === "not_configured") return "Takeoff notifications are unavailable right now.";
  if (message === "unsupported") {
    return platform === "web" ? "This browser cannot receive web notifications." : "Notifications aren’t supported on this device.";
  }
  if (message === "permission_denied") {
    return platform === "ios"
      ? "Allow notifications in iPhone Settings → Notifications → Out Of Sight, then try again."
      : platform === "android"
        ? "Allow notifications for Out Of Sight in your device settings, then try again."
        : "Allow notifications in your browser settings, then try again.";
  }
  return "Could not turn on notifications. Try again from Settings.";
}

export function aircraftAlertAvailabilityMessage(status: AircraftAlertStatus, platform: NotificationPlatform): string {
  if (!status.supported) return aircraftAlertErrorMessage(new Error("unsupported"), platform);
  if (!status.configured) return aircraftAlertErrorMessage(new Error(status.message ?? "not_configured"), platform);
  if (status.permission === "denied") return aircraftAlertErrorMessage(new Error("permission_denied"), platform);
  return status.enabled ? "Takeoff notifications are on." : "Receive takeoff notifications while OOS is closed.";
}
