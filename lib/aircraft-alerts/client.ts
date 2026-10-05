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
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { readAircraftTrackingPreferences } from "@/lib/aircraft-tracking";

const DEVICE_ID_KEY = "oos_aircraft_alert_device_id";
export const AIRCRAFT_ALERT_PREFERENCE_SYNC_EVENT = "oos-aircraft-alert-preference-sync";

type StateInput = {
  stateCode?: StateCode;
};

export function getAircraftAlertUserId(): string {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const next =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(DEVICE_ID_KEY, next);
  return next;
}

export async function readAircraftAlertStatus(): Promise<AircraftAlertStatus> {
  if (isNativeAndroid()) return readNativeAircraftAlertStatus();
  if (!browserSupportsAircraftAlerts()) {
    return {
      supported: false,
      configured: false,
      enabled: false,
      permission: "unsupported",
      message: "unsupported",
    };
  }
  const userId = getAircraftAlertUserId();
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

export async function enableAircraftAlerts(
  input: StateInput = {},
): Promise<AircraftAlertStatus> {
  if (isNativeAndroid()) return enableNativeAircraftAlerts(input);
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
      userId: getAircraftAlertUserId(),
      subscription: normalizePushSubscription(subscription),
      stateCode,
      excludedAircraftByState: readAircraftTrackingPreferences(),
    }),
  });
  if (!res.ok) throw new Error("subscribe_failed");
  return {
    ...(await readAircraftAlertStatus()),
    enabled: true,
    permission,
    stateCode,
    stateId: stateIdForCode(stateCode),
  };
}

export async function disableAircraftAlerts(): Promise<AircraftAlertStatus> {
  const userId = getAircraftAlertUserId();
  if (isNativeAndroid()) {
    await PushNotifications.unregister().catch(() => undefined);
  }
  if (browserSupportsAircraftAlerts()) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      await subscription?.unsubscribe();
    } catch {
      // The server record is still removed below.
    }
  }
  await fetch("/api/aircraft-alerts/subscription", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  return { ...(await readAircraftAlertStatus()), enabled: false };
}

let preferenceSync: Promise<AircraftAlertStatus | null> = Promise.resolve(null);

export function syncAircraftAlertPreferences(input: StateInput): Promise<AircraftAlertStatus | null> {
  // Serialize state/toggle writes; each queued update uses the latest exclusions.
  preferenceSync = preferenceSync.catch(() => null).then(() => syncPreferences(input));
  return preferenceSync;
}

async function syncPreferences(
  input: StateInput,
): Promise<AircraftAlertStatus | null> {
  const current = await readAircraftAlertStatus();
  if (!current.enabled) return current;
  const stateCode = input.stateCode ?? getSelectedStateCode();
  const res = await fetch("/api/aircraft-alerts/subscription", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      userId: getAircraftAlertUserId(),
      stateCode,
      excludedAircraftByState: readAircraftTrackingPreferences(),
    }),
  });
  if (!res.ok) throw new Error("preference_sync_failed");
  return readAircraftAlertStatus();
}

export async function sendAircraftAlertTest(): Promise<void> {
  const res = await fetch("/api/aircraft-alerts/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: getAircraftAlertUserId() }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
    throw new Error(typeof body?.error === "string" ? body.error : "test_failed");
  }
}

function browserSupportsAircraftAlerts(): boolean {
  return Boolean(
    typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window,
  );
}

function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

async function readNativeAircraftAlertStatus(): Promise<AircraftAlertStatus> {
  const permission = await PushNotifications.checkPermissions();
  const userId = getAircraftAlertUserId();
  const res = await fetch(
    `/api/aircraft-alerts/subscription?userId=${encodeURIComponent(userId)}&transport=fcm`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error("status_read_failed");
  const server = (await res.json().catch(() => ({}))) as Partial<AircraftAlertStatus>;
  return {
    supported: true,
    configured: Boolean(server.configured),
    enabled: Boolean(server.enabled),
    permission: nativePermission(permission.receive),
    stateCode: server.stateCode,
    stateId: server.stateCode ? stateIdForCode(server.stateCode) : undefined,
    message: server.message,
  };
}

async function enableNativeAircraftAlerts(
  input: StateInput,
): Promise<AircraftAlertStatus> {
  const status = await readNativeAircraftAlertStatus();
  if (!status.configured) throw new Error("not_configured");
  let permission = await PushNotifications.checkPermissions();
  if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") {
    permission = await PushNotifications.requestPermissions();
  }
  if (permission.receive !== "granted") throw new Error("permission_denied");

  await PushNotifications.createChannel({
    id: "aircraft_alerts",
    name: "Aircraft takeoffs",
    description: "Confirmed takeoffs for the selected state",
    importance: 4,
    vibration: true,
  });
  const token = await registerForNativePush();
  const stateCode = input.stateCode ?? getSelectedStateCode();
  const res = await fetch("/api/aircraft-alerts/subscription", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      userId: getAircraftAlertUserId(),
      subscription: { transport: "fcm", token },
      stateCode,
      excludedAircraftByState: readAircraftTrackingPreferences(),
    }),
  });
  if (!res.ok) throw new Error("subscribe_failed");
  return {
    ...(await readNativeAircraftAlertStatus()),
    enabled: true,
    permission: "granted",
    stateCode,
    stateId: stateIdForCode(stateCode),
  };
}

async function registerForNativePush(): Promise<string> {
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
