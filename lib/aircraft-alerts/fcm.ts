import { readServerEnv } from "@/lib/supabase/server";
import type {
  AircraftAlertPushPayload,
  AircraftAlertPushResult,
} from "./web-push";

export function isFcmConfigured(): boolean {
  return Boolean(
    readServerEnv("FCM_RELAY_URL") && readServerEnv("FCM_RELAY_SECRET"),
  );
}

export async function sendAircraftAlertFcm(
  token: string,
  payload: AircraftAlertPushPayload,
): Promise<AircraftAlertPushResult> {
  const relayUrl = readServerEnv("FCM_RELAY_URL");
  const relaySecret = readServerEnv("FCM_RELAY_SECRET");
  if (!relayUrl || !relaySecret) return { ok: false, reason: "not_configured" };

  try {
    const response = await fetch(relayUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${relaySecret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ token, payload }),
      cache: "no-store",
    });
    if (response.ok) return { ok: true };
    if (response.status === 404 || response.status === 410) {
      return { ok: false, reason: "expired", statusCode: response.status };
    }
    console.warn("[aircraft-alerts] FCM relay rejected delivery:", response.status);
    return { ok: false, reason: "failed", statusCode: response.status };
  } catch (error) {
    console.warn("[aircraft-alerts] FCM relay failed:", error);
    return { ok: false, reason: "failed" };
  }
}
