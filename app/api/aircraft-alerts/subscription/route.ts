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
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubscriptionBody = {
  userId?: unknown;
  subscription?: unknown;
  stateCode?: unknown;
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
  return NextResponse.json(
    baseStatus({
      enabled: Boolean(subscriber?.enabled),
      stateCode: subscriber?.stateCode,
    }),
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
    baseStatus({ enabled: true, stateCode: subscriber.stateCode }),
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
  const subscriber = await updateAircraftAlertSubscriberPreferences(userId, {
    stateCode: body.stateCode.toUpperCase() as StateCode,
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
}) {
  return {
    supported: true,
    configured: isSupabaseConfigured() && isAircraftAlertPushConfigured(),
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
  return {
    ok: true,
    value: {
      userId,
      subscription: body.subscription,
      stateCode: body.stateCode.toUpperCase() as StateCode,
    },
  };
}

function isPushSubscription(value: unknown): value is AircraftAlertPushSubscription {
  if (!value || typeof value !== "object") return false;
  const subscription = value as Partial<AircraftAlertPushSubscription>;
  return Boolean(
    typeof subscription.endpoint === "string" &&
      subscription.endpoint.length > 0 &&
      subscription.endpoint.length <= 2_048 &&
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
