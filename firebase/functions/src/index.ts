import { timingSafeEqual } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { defineSecret } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";

initializeApp();

const relaySecret = defineSecret("FCM_RELAY_SECRET");

type AlertRequest = {
  token?: unknown;
  payload?: {
    title?: unknown;
    body?: unknown;
    url?: unknown;
    tag?: unknown;
    aircraftTail?: unknown;
  };
};

export const sendAircraftAlert = onRequest(
  {
    region: "us-west1",
    cors: false,
    timeoutSeconds: 30,
    memory: "256MiB",
    minInstances: 0,
    maxInstances: 3,
    secrets: [relaySecret],
  },
  async (request, response) => {
    if (request.method !== "POST") {
      response.set("Allow", "POST").status(405).json({ error: "method_not_allowed" });
      return;
    }
    if (!authorized(request.get("authorization"), relaySecret.value())) {
      response.status(401).json({ error: "unauthorized" });
      return;
    }

    const input = request.body as AlertRequest | null;
    const parsed = parseAlertRequest(input);
    if (!parsed) {
      response.status(400).json({ error: "invalid_request" });
      return;
    }

    try {
      const messageId = await getMessaging().send({
        token: parsed.token,
        notification: {
          title: parsed.payload.title,
          body: parsed.payload.body,
        },
        data: {
          url: parsed.payload.url,
          tag: parsed.payload.tag,
          aircraftTail: parsed.payload.aircraftTail,
        },
        android: {
          priority: "high",
          ttl: 30 * 60 * 1_000,
          notification: {
            channelId: "aircraft_alerts_radar_v1",
            tag: parsed.payload.tag,
            sound: "oos_radar_ping",
          },
        },
        apns: {
          headers: {
            "apns-push-type": "alert",
            "apns-priority": "10",
            "apns-expiration": String(Math.floor(Date.now() / 1_000) + 30 * 60),
          },
          payload: { aps: { sound: "oos_radar_ping.wav" } },
        },
      });
      response.status(200).json({ ok: true, messageId });
    } catch (error) {
      const code = firebaseErrorCode(error);
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        response.status(410).json({ error: "expired" });
        return;
      }
      console.error("FCM relay failed", code ?? error);
      response.status(502).json({ error: "delivery_failed" });
    }
  },
);

function authorized(header: string | undefined, expectedSecret: string): boolean {
  const provided = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expectedSecret);
  return (
    providedBytes.length === expectedBytes.length &&
    expectedBytes.length >= 32 &&
    timingSafeEqual(providedBytes, expectedBytes)
  );
}

function parseAlertRequest(input: AlertRequest | null) {
  if (!input || typeof input.token !== "string") return null;
  if (input.token.length < 20 || input.token.length > 4_096) return null;
  const payload = input.payload;
  if (!payload) return null;
  const title = boundedString(payload.title, 120);
  const body = boundedString(payload.body, 500);
  const url = boundedString(payload.url, 500);
  const tag = boundedString(payload.tag, 200);
  const aircraftTail = optionalBoundedString(payload.aircraftTail, 40);
  if (!title || !body || !url?.startsWith("/") || !tag) return null;
  return { token: input.token, payload: { title, body, url, tag, aircraftTail } };
}

function boundedString(value: unknown, maxLength: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength
    ? value
    : null;
}

function optionalBoundedString(value: unknown, maxLength: number): string {
  return typeof value === "string" && value.length <= maxLength ? value : "";
}

function firebaseErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}
