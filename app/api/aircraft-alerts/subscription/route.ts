import { NextResponse } from "next/server";
import { isStateCode, stateIdForCode, type StateCode } from "@/lib/app-states";
import {
  deleteAircraftAlertSubscriber,
  getAircraftAlertSubscriber,
  updateAircraftAlertSubscriberPreferences,
  upsertAircraftAlertSubscriber,
} from "@/lib/aircraft-alerts/store";
import type { AircraftAlertPushSubscription } from "@/lib/aircraft-alerts/types";
import {
  getAircraftAlertPublicKey,
  isAircraftAlertPushConfigured,
} from "@/lib/aircraft-alerts/web-push";
import { isFcmConfigured } from "@/lib/aircraft-alerts/fcm";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { parseAircraftTrackingPreferences, type AircraftTrackingPreferences } from "@/lib/aircraft-tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubscriptionBody = {
  userId?: unknown;
  subscription?: unknown;
  stateCode?: unknown;
  excludedAircraftByState?: unknown;
};

export async function GET(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(baseStatus({ enabled: false, message: "database_not_configured" }));
  }
  const userId = new URL(req.url).searchParams.get("userId");
  if (!isValidUserId(userId)) {
    return NextResponse.json(baseStatus({ enabled: false, message: "missing_user" }));
  }
  const subscriber = await getAircraftAlertSubscriber(userId);
  const requestedTransport = new URL(req.url).searchParams.get("transport");
  return NextResponse.json(
    baseStatus({
      enabled: Boolean(subscriber?.enabled),
      stateCode: subscriber?.stateCode,
    }, requestedTransport === "fcm" ? "fcm" : subscriber?.subscription.transport),
  );
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as SubscriptionBody | null;
  const parsed = parseSubscriptionBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const subscriber = await upsertAircraftAlertSubscriber({
    ...parsed.value,
    userAgent: req.headers.get("user-agent"),
  });
  return NextResponse.json(
    baseStatus(
      { enabled: true, stateCode: subscriber.stateCode },
      subscriber.subscription.transport === "fcm" ? "fcm" : "web_push",
    ),
  );
}

export async function PATCH(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as SubscriptionBody | null;
  const userId = typeof body?.userId === "string" ? body.userId : null;
  if (!isValidUserId(userId) || !isStateCode(body?.stateCode)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const preferences = body.excludedAircraftByState === undefined ? undefined : parseAircraftTrackingPreferences(body.excludedAircraftByState);
  if (preferences === null) {
    return NextResponse.json({ error: "invalid_aircraft_preferences" }, { status: 400 });
  }
  const subscriber = await updateAircraftAlertSubscriberPreferences(userId, {
    stateCode: body.stateCode.toUpperCase() as StateCode,
    ...(preferences !== undefined ? { excludedAircraftByState: preferences } : {}),
  });
  if (!subscriber) {
    return NextResponse.json({ error: "not_subscribed" }, { status: 404 });
  }
  return NextResponse.json(
    baseStatus({ enabled: subscriber.enabled, stateCode: subscriber.stateCode }),
  );
}

export async function DELETE(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(baseStatus({ enabled: false }));
  }
  const url = new URL(req.url);
  let userId = url.searchParams.get("userId");
  if (!userId) {
    const body = (await req.json().catch(() => null)) as { userId?: unknown } | null;
    userId = typeof body?.userId === "string" ? body.userId : null;
  }
  if (!isValidUserId(userId)) {
    return NextResponse.json({ error: "invalid_user" }, { status: 400 });
  }
  await deleteAircraftAlertSubscriber(userId);
  return NextResponse.json(baseStatus({ enabled: false }));
}

function baseStatus(update: {
  enabled: boolean;
  stateCode?: StateCode;
  message?: string;
}, transport?: "fcm" | "web_push") {
  return {
    supported: true,
    configured:
      isSupabaseConfigured() &&
      (transport === "fcm" ? isFcmConfigured() : isAircraftAlertPushConfigured()),
    publicKey: getAircraftAlertPublicKey(),
    stateId: update.stateCode ? stateIdForCode(update.stateCode) : undefined,
    ...update,
  };
}

function parseSubscriptionBody(body: SubscriptionBody | null):
  | {
      ok: true;
      value: {
        userId: string;
        subscription: AircraftAlertPushSubscription;
        stateCode: StateCode;
        excludedAircraftByState?: AircraftTrackingPreferences;
      };
    }
  | { ok: false; error: string } {
  const userId = typeof body?.userId === "string" ? body.userId : null;
  if (!isValidUserId(userId)) return { ok: false, error: "invalid_user" };
  if (!isPushSubscription(body?.subscription)) {
    return { ok: false, error: "invalid_subscription" };
  }
  if (!isStateCode(body?.stateCode)) {
    return { ok: false, error: "invalid_state" };
  }
  const preferences = body?.excludedAircraftByState === undefined ? undefined : parseAircraftTrackingPreferences(body.excludedAircraftByState);
  if (preferences === null) return { ok: false, error: "invalid_aircraft_preferences" };
  return {
    ok: true,
    value: {
      userId,
      subscription: body.subscription,
      stateCode: body.stateCode.toUpperCase() as StateCode,
      excludedAircraftByState: preferences,
    },
  };
}

function isPushSubscription(value: unknown): value is AircraftAlertPushSubscription {
  if (!value || typeof value !== "object") return false;
  const subscription = value as Partial<AircraftAlertPushSubscription>;
  if (
    "transport" in subscription &&
    subscription.transport === "fcm" &&
    "token" in subscription
  ) {
    return Boolean(
      typeof subscription.token === "string" &&
        subscription.token.length >= 20 &&
        subscription.token.length <= 4_096,
    );
  }
  return Boolean(
    "endpoint" in subscription &&
    typeof subscription.endpoint === "string" &&
      subscription.endpoint.length > 0 &&
      subscription.endpoint.length <= 2_048 &&
      "keys" in subscription &&
      subscription.keys &&
      typeof subscription.keys.p256dh === "string" &&
      subscription.keys.p256dh.length > 0 &&
      subscription.keys.p256dh.length <= 512 &&
      typeof subscription.keys.auth === "string" &&
      subscription.keys.auth.length > 0 &&
      subscription.keys.auth.length <= 512,
  );
}

function isValidUserId(value: string | null | undefined): value is string {
  return Boolean(value && /^[a-f0-9-]{20,80}$/i.test(value));
}
