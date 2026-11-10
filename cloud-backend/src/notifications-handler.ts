import { getSupabaseAdmin } from "../../lib/supabase/server";
import { dispatchPendingTakeoffNotifications } from "../../lib/aircraft-alerts/dispatcher";
import { isFcmConfigured } from "../../lib/aircraft-alerts/fcm";
import { isAircraftAlertPushConfigured, verifyAircraftAlertPushRuntime } from "../../lib/aircraft-alerts/web-push";

const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
type Dependencies = {
  authorize(token: string): Promise<boolean>;
  ready(): boolean;
  run(dryRun: boolean): Promise<unknown>;
};

export async function authorizeScheduledWorker(token: string): Promise<boolean> {
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))))
      .map(byte => byte.toString(16).padStart(2, "0")).join("");
    const { data, error } = await getSupabaseAdmin().from("app_settings").select("value")
      .eq("key", "notification_worker_token_hash").single();
    return !error && data?.value === digest;
}

export function createNotificationsHandler(dependencies: Dependencies = {
  authorize: authorizeScheduledWorker,
  ready: () => isFcmConfigured() && isAircraftAlertPushConfigured(),
  run: runNotificationWorker,
}) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
    const token = request.headers.get("x-oos-notification-token") ?? "";
    if (!/^[a-f0-9]{64}$/.test(token)) return reply({ error: "unauthorized" }, 401);
    try {
      if (!await dependencies.authorize(token)) return reply({ error: "unauthorized" }, 401);
      if (!dependencies.ready()) return reply({ error: "push_credentials_not_configured" }, 503);
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object" || Array.isArray(body) || (body.dryRun !== undefined && typeof body.dryRun !== "boolean")) return reply({ error: "invalid_request" }, 400);
      return reply(await dependencies.run(body.dryRun === true));
    } catch (error) {
      console.error("[notifications] worker failed", error instanceof Error ? error.message : "unknown");
      return reply({ error: "worker_failed" }, 503);
    }
  };
}

async function runNotificationWorker(dryRun: boolean) {
  const db = getSupabaseAdmin();
  if (dryRun) {
    verifyAircraftAlertPushRuntime();
    const queue = await db.from("notification_deliveries").select("id", { count: "exact", head: true }).in("status", ["pending", "failed"]);
    if (queue.error) throw new Error("Queue unavailable");
    return { ok: true, dry_run: true, pending: queue.count, fcm_configured: true, web_push_configured: true, web_push_crypto_verified: true };
  }
  const setting = await db.from("app_settings").select("value").eq("key", "notification_worker_backend").single();
  if (setting.error) throw new Error("Worker configuration unavailable");
  if (setting.data?.value !== "supabase") return { skipped: "worker_not_enabled" };
  const workerId = `supabase:${crypto.randomUUID()}`;
  const claim = await db.rpc("claim_worker_lease", { lease_name: "notification-delivery", lease_owner: workerId, lease_seconds: 120 });
  if (claim.error) throw new Error("Worker lease unavailable");
  if (!claim.data) return { skipped: "another_worker_is_active" };
  let runId: string | undefined;
  try {
    const run = await db.from("notification_worker_runs").insert({ worker_id: workerId, status: "running" }).select("id").single();
    if (run.error) throw new Error("Worker log unavailable");
    runId = run.data.id;
    const result = await dispatchPendingTakeoffNotifications({ maxDurationMs: 45_000 });
    const saved = await db.from("notification_worker_runs").update({
      status: "succeeded", finished_at: new Date().toISOString(), deliveries_claimed: result.claimed,
      deliveries_sent: result.sent, deliveries_failed: result.failed + result.expired,
    }).eq("id", runId);
    if (saved.error) throw new Error("Worker result log failed");
    return { ok: true, ...result };
  } catch (error) {
    if (runId) await db.from("notification_worker_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: "notification_dispatch_failed" }).eq("id", runId);
    throw error;
  } finally {
    const released = await db.rpc("release_worker_lease", { lease_name: "notification-delivery", lease_owner: workerId });
    if (released.error) console.error("[notifications] lease release failed");
  }
}
