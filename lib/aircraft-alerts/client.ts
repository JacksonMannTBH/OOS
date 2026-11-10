"use client";

import {
  getSelectedStateCode,
  stateIdForCode,
  type StateCode,
} from "@/lib/app-states";
import type {
  AircraftAlertPushSubscription,
  AircraftAlertStatus,
} from "./types";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { readNotificationTrackingPreferences } from "./preferences";

import { getDevicePreference, initializeDevicePreferences, updateDevicePreferences } from "@/lib/device-preferences";

const OPT_IN_KEY = "oos_aircraft_alert_opt_in";
const DEVICE_ID_KEY = "oos_aircraft_alert_device_id";
export const AIRCRAFT_ALERT_PREFERENCE_SYNC_EVENT = "oos-aircraft-alert-preference-sync";

const NotificationSetup = registerPlugin<{
  status(): Promise<{ configured: boolean }>;
}>("OOSNotificationSetup");

type StateInput = {
  stateCode?: StateCode;
};

let identityRequest: Promise<string> | null = null;
export function getAircraftAlertUserId(): Promise<string> {
  // Concurrent status checks must share one durably saved identity.
  return identityRequest ??= (async () => {
    if (typeof window === "undefined") return "";
    await initializeDevicePreferences();
    const existing = getDevicePreference(DEVICE_ID_KEY);
    if (existing) return existing;
    const next = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
    await updateDevicePreferences({ [DEVICE_ID_KEY]: next });
    return next;
  })().finally(() => { identityRequest = null; });
}

export async function readAircraftAlertStatus(): Promise<AircraftAlertStatus> {
  await initializeDevicePreferences();
  const status = await readAlertStatus();
  let optedIn = getDevicePreference(OPT_IN_KEY);
  // Preserve enrollment for users upgrading before this flag existed. An
  // expired endpoint does not revoke the user's saved opt-in.
  if (status.enabled && optedIn === null) {
    await updateDevicePreferences({ [OPT_IN_KEY]: "1" });
    optedIn = "1";
  }
  return { ...status, optedIn: isNativeMobile() && optedIn === "1" };
}

function publishStatus(status: AircraftAlertStatus): AircraftAlertStatus {
  if (typeof window !== "undefined" && window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent(AIRCRAFT_ALERT_PREFERENCE_SYNC_EVENT, { detail: { status } }));
  }
  return status;
}

async function readAlertStatus(): Promise<AircraftAlertStatus> {
  if (isNativeMobile()) return readNativeAircraftAlertStatus();
  if (!browserSupportsAircraftAlerts()) {
    return {
      supported: false,
      configured: false,
      enabled: false,
      permission: "unsupported",
      message: "unsupported",
    };
  }
  const userId = await getAircraftAlertUserId();
  const res = await fetch(
    `/api/aircraft-alerts/subscription?userId=${encodeURIComponent(userId)}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error("status_read_failed");
  const server = (await res.json().catch(() => ({}))) as Partial<AircraftAlertStatus>;
  return {
    supported: true,
    configured: Boolean(server.configured),
    enabled: Boolean(server.enabled),
    permission: Notification.permission,
    stateCode: server.stateCode,
    stateId: server.stateCode ? stateIdForCode(server.stateCode) : undefined,
    publicKey: server.publicKey,
    message: server.message,
  };
}

// Serialize enable, disable, and foreground preference/token refreshes so a
// slow registration cannot recreate a subscription after the user disables it.
let alertMutation: Promise<unknown> = Promise.resolve();
function queueAlertMutation<T>(work: () => Promise<T>): Promise<T> {
  const next = alertMutation.catch(() => undefined).then(work);
  alertMutation = next;
  return next;
}

export function enableAircraftAlerts(input: StateInput = {}): Promise<AircraftAlertStatus> {
  return queueAlertMutation(() => enableAlerts(input)).then(publishStatus);
}

async function enableAlerts(
  input: StateInput = {},
): Promise<AircraftAlertStatus> {
  if (isNativeMobile()) return enableNativeAircraftAlerts(input);
  if (!browserSupportsAircraftAlerts()) throw new Error("unsupported");
  const status = await readAircraftAlertStatus();
  const publicKey = status.publicKey ?? "";
  if (!publicKey) throw new Error("not_configured");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("permission_denied");

  await navigator.serviceWorker.register("/sw.js");
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(publicKey),
    });
  }

  const stateCode = input.stateCode ?? getSelectedStateCode();
  const res = await fetch("/api/aircraft-alerts/subscription", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      userId: await getAircraftAlertUserId(),
      subscription: normalizePushSubscription(subscription),
      stateCode,
      excludedAircraftByState: readNotificationTrackingPreferences(stateCode),
    }),
  });
  if (!res.ok) throw new Error("subscribe_failed");
  await updateDevicePreferences({ [OPT_IN_KEY]: "1" });
  return {
    ...(await readAircraftAlertStatus()),
    enabled: true,
    permission,
    stateCode,
    stateId: stateIdForCode(stateCode),
  };
}

export function disableAircraftAlerts(): Promise<AircraftAlertStatus> {
  return queueAlertMutation(disableAlerts).then(publishStatus);
}

async function disableAlerts(): Promise<AircraftAlertStatus> {
  const userId = await getAircraftAlertUserId();
  // Save the user's opt-out before contacting the service so a failed request
  // can be retried without a foreground refresh enrolling the device again.
  await updateDevicePreferences({ [OPT_IN_KEY]: "0" });
  const response = await fetch("/api/aircraft-alerts/subscription", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!response.ok) throw new Error("unsubscribe_failed");
  if (isNativeMobile()) {
    await PushNotifications.unregister().catch(() => undefined);
  }
  if (browserSupportsAircraftAlerts()) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      await subscription?.unsubscribe();
    } catch {
      // The server record has already been removed.
    }
  }
  return { ...(await readAircraftAlertStatus()), enabled: false };
}

export function syncAircraftAlertPreferences(input: StateInput): Promise<AircraftAlertStatus | null> {
  return queueAlertMutation(() => syncPreferences(input));
}

async function syncPreferences(
  input: StateInput,
): Promise<AircraftAlertStatus | null> {
  const current = await readAircraftAlertStatus();
  if (getDevicePreference(OPT_IN_KEY) === "0") {
    return current.enabled ? disableAlerts() : current;
  }
  if (!current.enabled && !(isNativeMobile() && current.optedIn)) return current;
  const stateCode = input.stateCode ?? getSelectedStateCode();
  if (isNativeMobile() && current.permission === "granted" && current.configured) {
    // Called on launch/foreground as well as preference changes. Refreshing the
    // FCM token here recovers from token rotation without requesting permission.
    const token = await registerForNativePush();
    await saveNativeSubscription(token, stateCode);
    return readAircraftAlertStatus();
  }
  if (!current.enabled) return current;
  const res = await fetch("/api/aircraft-alerts/subscription", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      userId: await getAircraftAlertUserId(),
      stateCode,
      excludedAircraftByState: readNotificationTrackingPreferences(stateCode),
    }),
  });
  if (!res.ok) throw new Error("preference_sync_failed");
  return readAircraftAlertStatus();
}

export async function sendAircraftAlertTest(): Promise<void> {
  const res = await fetch("/api/aircraft-alerts/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: await getAircraftAlertUserId() }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
    throw new Error(typeof body?.error === "string" ? body.error : "test_failed");
  }
}

function browserSupportsAircraftAlerts(): boolean {
  return Boolean(
    !Capacitor.isNativePlatform() && typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window,
  );
}

function isNativeMobile(): boolean {
  return Capacitor.isNativePlatform() && ["android", "ios"].includes(Capacitor.getPlatform());
}

async function readNativeAircraftAlertStatus(): Promise<AircraftAlertStatus> {
  const setup = await readNativeNotificationSetup();
  const permission = await PushNotifications.checkPermissions();
  const userId = await getAircraftAlertUserId();
  const res = await fetch(
    `/api/aircraft-alerts/subscription?userId=${encodeURIComponent(userId)}&transport=fcm`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error("status_read_failed");
  const server = (await res.json().catch(() => ({}))) as Partial<AircraftAlertStatus>;
  return {
    supported: true,
    configured: setup.configured && Boolean(server.configured),
    enabled: Boolean(server.enabled),
    permission: nativePermission(permission.receive),
    stateCode: server.stateCode,
    stateId: server.stateCode ? stateIdForCode(server.stateCode) : undefined,
    message: !setup.configured ? setup.message : server.message,
  };
}

async function readNativeNotificationSetup(): Promise<{ configured: boolean; message?: string }> {
  if (Capacitor.getPlatform() !== "ios") return { configured: true };
  if (!Capacitor.isPluginAvailable("OOSNotificationSetup")) {
    return { configured: false, message: "native_update_required" };
  }
  try {
    const status = await NotificationSetup.status();
    return status.configured ? { configured: true } : { configured: false, message: "native_not_configured" };
  } catch {
    return { configured: false, message: "native_not_configured" };
  }
}

async function enableNativeAircraftAlerts(
  input: StateInput,
): Promise<AircraftAlertStatus> {
  const status = await readNativeAircraftAlertStatus();
  if (!status.configured) throw new Error(status.message?.startsWith("native_") ? status.message : "not_configured");
  let permission = await PushNotifications.checkPermissions();
  if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") {
    permission = await PushNotifications.requestPermissions();
  }
  if (permission.receive !== "granted") throw new Error("permission_denied");

  const token = await registerForNativePush();
  const stateCode = input.stateCode ?? getSelectedStateCode();
  await saveNativeSubscription(token, stateCode);
  return {
    ...(await readAircraftAlertStatus()),
    enabled: true,
    permission: "granted",
    stateCode,
    stateId: stateIdForCode(stateCode),
  };
}

async function saveNativeSubscription(token: string, stateCode: StateCode): Promise<void> {
  const res = await fetch("/api/aircraft-alerts/subscription", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      userId: await getAircraftAlertUserId(),
      subscription: { transport: "fcm", token },
      stateCode,
      excludedAircraftByState: readNotificationTrackingPreferences(stateCode),
    }),
  });
  if (!res.ok) throw new Error("subscribe_failed");
  await updateDevicePreferences({ [OPT_IN_KEY]: "1" });
}

async function registerForNativePush(): Promise<string> {
  if (Capacitor.getPlatform() === "android") {
    // Android channel sounds cannot be changed after creation. A new ID also
    // gives existing subscribers the bundled tone when their token refreshes.
    await PushNotifications.createChannel({
      id: "aircraft_alerts_radar_v1",
      name: "Aircraft takeoffs",
      description: "Confirmed takeoffs for the selected state",
      sound: "oos_radar_ping.wav",
      importance: 4,
      vibration: true,
    });
  }
  let resolveToken!: (token: string) => void;
  let rejectToken!: (error: Error) => void;
  const tokenPromise = new Promise<string>((resolve, reject) => {
    resolveToken = resolve;
    rejectToken = reject;
  });
  const registration = await PushNotifications.addListener(
    "registration",
    (token) => resolveToken(token.value),
  );
  const registrationError = await PushNotifications.addListener(
    "registrationError",
    (error) => rejectToken(new Error(error.error || "registration_failed")),
  );
  const timeoutId = setTimeout(
    () => rejectToken(new Error("registration_timeout")),
    20_000,
  );
  try {
    await PushNotifications.register();
    return await tokenPromise;
  } finally {
    clearTimeout(timeoutId);
    await registration.remove();
    await registrationError.remove();
  }
}

function nativePermission(
  permission: "prompt" | "prompt-with-rationale" | "granted" | "denied",
): NotificationPermission {
  if (permission === "granted" || permission === "denied") return permission;
  return "default";
}

function normalizePushSubscription(
  subscription: PushSubscription,
): AircraftAlertPushSubscription {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) throw new Error("invalid_subscription");
  return {
    endpoint: json.endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: { p256dh, auth },
  };
}

function urlBase64ToArrayBuffer(base64Url: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = `${base64Url}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }
  return output.buffer;
}
