import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendAircraftAlertPush } from "./web-push";

const MAX_DELIVERIES_PER_RUN = 100;
const NOTIFICATION_TAG_WINDOW_MS = 30 * 60 * 1_000;

export type NotificationDispatchSummary = {
  claimed: number;
  sent: number;
  failed: number;
  expired: number;
};

export async function dispatchPendingTakeoffNotifications(): Promise<NotificationDispatchSummary> {
  const db = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data: deliveries, error } = await db
    .from("notification_deliveries")
    .select(
      "id,attempt_count,notification_events(payload,occurred_at),push_endpoints(id,endpoint,p256dh,auth)",
    )
    .in("status", ["pending", "failed"])
    .lte("next_attempt_at", now)
    .order("created_at")
    .limit(MAX_DELIVERIES_PER_RUN);
  if (error) throw new Error(`Notification queue read failed: ${error.message}`);

  const summary: NotificationDispatchSummary = {
    claimed: deliveries?.length ?? 0,
    sent: 0,
    failed: 0,
    expired: 0,
  };

  for (const delivery of deliveries ?? []) {
    const claimToken = crypto.randomUUID();
    const { data: claimed } = await db
      .from("notification_deliveries")
      .update({
        status: "processing",
        claimed_at: now,
        claim_token: claimToken,
        attempt_count: Number(delivery.attempt_count ?? 0) + 1,
        updated_at: now,
      })
      .eq("id", delivery.id)
      .in("status", ["pending", "failed"])
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    const event = Array.isArray(delivery.notification_events)
      ? delivery.notification_events[0]
      : delivery.notification_events;
    const endpoint = Array.isArray(delivery.push_endpoints)
      ? delivery.push_endpoints[0]
      : delivery.push_endpoints;
    if (!event || !endpoint) {
      await markFailed(String(delivery.id), claimToken, "missing_related_record", 15);
      summary.failed += 1;
      continue;
    }
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const tail = String(payload.tail ?? "Aircraft");
    const label = String(payload.nickname ?? tail);
    const detailUrl = `/map?tail=${encodeURIComponent(tail)}`;
    const result = await sendAircraftAlertPush(
      {
        endpoint: String(endpoint.endpoint),
        keys: {
          p256dh: String(endpoint.p256dh),
          auth: String(endpoint.auth),
        },
      },
      {
        title: `${label} took off`,
        body: `${tail} began a tracked flight.`,
        url: detailUrl,
        tag: takeoffNotificationTag(tail, event.occurred_at),
        aircraftTail: tail,
      },
    );

    if (result.ok) {
      await db
        .from("notification_deliveries")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          response_status: 201,
          failure_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", delivery.id)
        .eq("claim_token", claimToken);
      await db
        .from("push_endpoints")
        .update({ last_success_at: new Date().toISOString() })
        .eq("id", endpoint.id);
      summary.sent += 1;
      continue;
    }

    if (result.reason === "expired") {
      await db
        .from("notification_deliveries")
        .update({
          status: "expired",
          response_status: result.statusCode ?? null,
          failure_reason: "expired_subscription",
          updated_at: new Date().toISOString(),
        })
        .eq("id", delivery.id)
        .eq("claim_token", claimToken);
      await db
        .from("push_endpoints")
        .update({
          enabled: false,
          disabled_at: new Date().toISOString(),
          last_failure_at: new Date().toISOString(),
        })
        .eq("id", endpoint.id);
      summary.expired += 1;
      continue;
    }

    await markFailed(
      String(delivery.id),
      claimToken,
      result.reason,
      Math.min(60, 2 ** (Number(delivery.attempt_count ?? 0) + 1)),
      result.statusCode,
    );
    summary.failed += 1;
  }
  return summary;
}

export function takeoffNotificationTag(
  tail: string,
  occurredAt: unknown,
): string {
  const normalizedTail = tail.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const occurredMs = typeof occurredAt === "string"
    ? Date.parse(occurredAt)
    : NaN;
  const windowMs = Number.isFinite(occurredMs)
    ? Math.floor(occurredMs / NOTIFICATION_TAG_WINDOW_MS) *
      NOTIFICATION_TAG_WINDOW_MS
    : 0;
  return `takeoff-${normalizedTail || "AIRCRAFT"}-${windowMs}`;
}

async function markFailed(
  deliveryId: string,
  claimToken: string,
  reason: string,
  retryMinutes: number,
  statusCode?: number,
): Promise<void> {
  await getSupabaseAdmin()
    .from("notification_deliveries")
    .update({
      status: "failed",
      next_attempt_at: new Date(Date.now() + retryMinutes * 60_000).toISOString(),
      response_status: statusCode ?? null,
      failure_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", deliveryId)
    .eq("claim_token", claimToken);
}
