import {
  DEFAULT_STATE_CODE,
  stateIdForCode,
  type StateCode,
} from "@/lib/app-states";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  AircraftAlertPushSubscription,
  AircraftAlertSubscriber,
} from "./types";

type UpsertInput = {
  userId: string;
  subscription: AircraftAlertPushSubscription;
  stateCode: StateCode;
  userAgent?: string | null;
};

type PreferenceUpdate = Partial<{
  enabled: boolean;
  stateCode: StateCode;
}>;

export async function upsertAircraftAlertSubscriber(
  input: UpsertInput,
): Promise<AircraftAlertSubscriber> {
  const db = getSupabaseAdmin();
  const now = new Date().toISOString();

  await db
    .from("push_endpoints")
    .delete()
    .eq("device_id", input.userId)
    .neq("endpoint", input.subscription.endpoint);

  const { data: endpoint, error: endpointError } = await db
    .from("push_endpoints")
    .upsert(
      {
        device_id: input.userId,
        endpoint: input.subscription.endpoint,
        p256dh: input.subscription.keys.p256dh,
        auth: input.subscription.keys.auth,
        user_agent: input.userAgent ?? null,
        enabled: true,
        disabled_at: null,
        updated_at: now,
      },
      { onConflict: "endpoint" },
    )
    .select("id,created_at")
    .single();
  if (endpointError) {
    throw new Error(`Push endpoint write failed: ${endpointError.message}`);
  }

  const { error: subscriptionError } = await db
    .from("notification_subscriptions")
    .upsert(
      {
        push_endpoint_id: endpoint.id,
        state_code: input.stateCode,
        enabled: true,
        updated_at: now,
      },
      { onConflict: "push_endpoint_id" },
    );
  if (subscriptionError) {
    throw new Error(`Notification subscription write failed: ${subscriptionError.message}`);
  }

  return {
    userId: input.userId,
    enabled: true,
    subscription: input.subscription,
    stateCode: input.stateCode,
    createdAt: String(endpoint.created_at ?? now),
    updatedAt: now,
    disabledAt: null,
  };
}

export async function updateAircraftAlertSubscriberPreferences(
  userId: string,
  update: PreferenceUpdate,
): Promise<AircraftAlertSubscriber | null> {
  const existing = await getAircraftAlertSubscriber(userId);
  if (!existing) return null;
  const db = getSupabaseAdmin();
  const { data: endpoint, error } = await db
    .from("push_endpoints")
    .select("id")
    .eq("device_id", userId)
    .maybeSingle();
  if (error || !endpoint) return null;

  const now = new Date().toISOString();
  const enabled = update.enabled ?? existing.enabled;
  const stateCode = update.stateCode ?? existing.stateCode;
  const { error: subscriptionError } = await db
    .from("notification_subscriptions")
    .update({ enabled, state_code: stateCode, updated_at: now })
    .eq("push_endpoint_id", endpoint.id);
  if (subscriptionError) {
    throw new Error(`Notification preference write failed: ${subscriptionError.message}`);
  }
  await db
    .from("push_endpoints")
    .update({
      enabled,
      disabled_at: enabled ? null : now,
      updated_at: now,
    })
    .eq("id", endpoint.id);
  return {
    ...existing,
    enabled,
    stateCode,
    updatedAt: now,
    disabledAt: enabled ? null : now,
  };
}

export async function getAircraftAlertSubscriber(
  userId: string,
): Promise<AircraftAlertSubscriber | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("push_endpoints")
    .select(
      "device_id,endpoint,p256dh,auth,enabled,created_at,updated_at,disabled_at,notification_subscriptions(state_code,enabled)",
    )
    .eq("device_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const nested = Array.isArray(data.notification_subscriptions)
    ? data.notification_subscriptions[0]
    : data.notification_subscriptions;
  const stateCode =
    nested?.state_code && typeof nested.state_code === "string"
      ? nested.state_code as StateCode
      : DEFAULT_STATE_CODE;
  return {
    userId: String(data.device_id),
    enabled: Boolean(data.enabled && nested?.enabled),
    subscription: {
      endpoint: String(data.endpoint),
      keys: {
        p256dh: String(data.p256dh),
        auth: String(data.auth),
      },
    },
    stateCode,
    createdAt: String(data.created_at),
    updatedAt: String(data.updated_at),
    disabledAt: data.disabled_at ? String(data.disabled_at) : null,
  };
}

export async function deleteAircraftAlertSubscriber(
  userId: string,
): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("push_endpoints")
    .delete()
    .eq("device_id", userId);
  if (error) throw new Error(`Push endpoint delete failed: ${error.message}`);
}

export async function listEnabledAircraftAlertSubscribersForState(
  stateCode: StateCode,
): Promise<AircraftAlertSubscriber[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("notification_subscriptions")
    .select(
      "state_code,enabled,push_endpoints(device_id,endpoint,p256dh,auth,enabled,created_at,updated_at,disabled_at)",
    )
    .eq("state_code", stateCode)
    .eq("enabled", true);
  if (error) return [];
  return (data ?? []).flatMap((row) => {
    const endpoint = Array.isArray(row.push_endpoints)
      ? row.push_endpoints[0]
      : row.push_endpoints;
    if (!endpoint?.enabled) return [];
    return [{
      userId: String(endpoint.device_id),
      enabled: true,
      stateCode,
      subscription: {
        endpoint: String(endpoint.endpoint),
        keys: {
          p256dh: String(endpoint.p256dh),
          auth: String(endpoint.auth),
        },
      },
      createdAt: String(endpoint.created_at),
      updatedAt: String(endpoint.updated_at),
      disabledAt: endpoint.disabled_at ? String(endpoint.disabled_at) : null,
    }];
  });
}

export function defaultAircraftAlertSubscriber(
  userId: string,
  subscription: AircraftAlertPushSubscription,
): AircraftAlertSubscriber {
  const now = new Date().toISOString();
  return {
    userId,
    enabled: false,
    subscription,
    stateCode: DEFAULT_STATE_CODE,
    createdAt: now,
    updatedAt: now,
    disabledAt: now,
  };
}

export function subscriberStateId(
  subscriber: AircraftAlertSubscriber,
) {
  return stateIdForCode(subscriber.stateCode);
}
