import type { Config } from "@netlify/functions";
import { APP_STATES } from "../../lib/app-states";
import { buildSnapshot } from "../../lib/adsb";
import { ingestSnapshot } from "../../lib/aircraft-data";
import { dispatchPendingTakeoffNotifications } from "../../lib/aircraft-alerts/dispatcher";
import { getSupabaseAdmin } from "../../lib/supabase/server";

const SAMPLE_INTERVAL_MS = 30_000;
const LEASE_SECONDS = 90;

export default async function aircraftIngestBackground(
  request: Request,
): Promise<void> {
  const secret = Netlify.env.get("CRON_SECRET");
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    throw new Error("Unauthorized aircraft ingestion request");
  }

  const db = getSupabaseAdmin();
  const workerId = crypto.randomUUID();
  const { data: claimed, error: claimError } = await db.rpc("claim_worker_lease", {
    lease_name: "aircraft-ingestion",
    lease_owner: workerId,
    lease_seconds: LEASE_SECONDS,
  });
  if (claimError) throw new Error(`Worker lease failed: ${claimError.message}`);
  if (!claimed) return;

  try {
    for (let sampleIndex = 0; sampleIndex < 2; sampleIndex += 1) {
      if (sampleIndex > 0) await wait(SAMPLE_INTERVAL_MS);
      await sampleAllStates(workerId, sampleIndex);
      await runNotificationWorker(workerId);
    }
  } finally {
    await db.rpc("release_worker_lease", {
      lease_name: "aircraft-ingestion",
      lease_owner: workerId,
    });
  }
}

export const config: Config = {
  method: "POST",
};

async function sampleAllStates(workerId: string, sampleIndex: number) {
  const db = getSupabaseAdmin();
  const startedAt = new Date().toISOString();
  const { data: run, error: runError } = await db
    .from("ingestion_runs")
    .insert({
      worker_id: workerId,
      started_at: startedAt,
      status: "running",
      metadata: { sample_index: sampleIndex },
    })
    .select("id")
    .single();
  if (runError) throw new Error(`Ingestion run create failed: ${runError.message}`);

  try {
    const snapshots = await Promise.all(
      APP_STATES.map((state) => buildSnapshot(state.code)),
    );
    let positionsInserted = 0;
    let takeoffsCreated = 0;
    let trackedAircraftCount = 0;
    let sourceAircraftCount = 0;
    const unhealthyStates: string[] = [];
    for (const [index, snapshot] of snapshots.entries()) {
      const result = await ingestSnapshot(snapshot, workerId);
      positionsInserted += result.positionsInserted;
      takeoffsCreated += result.takeoffsCreated;
      trackedAircraftCount += result.trackedAircraftCount;
      sourceAircraftCount += snapshot.live_seen_count;
      if (!result.sourceHealthy) unhealthyStates.push(APP_STATES[index]!.code);
    }
    await db
      .from("ingestion_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: unhealthyStates.length > 0 ? "partial" : "succeeded",
        source: snapshots.map((snapshot) => snapshot.source).join(","),
        source_aircraft_count: sourceAircraftCount,
        tracked_aircraft_count: trackedAircraftCount,
        positions_inserted: positionsInserted,
        takeoffs_created: takeoffsCreated,
        error:
          unhealthyStates.length > 0
            ? `Live sources unavailable for: ${unhealthyStates.join(", ")}`
            : null,
        metadata: {
          sample_index: sampleIndex,
          unhealthy_states: unhealthyStates,
        },
      })
      .eq("id", run.id);
  } catch (error) {
    await db
      .from("ingestion_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      })
      .eq("id", run.id);
    throw error;
  }
}

async function runNotificationWorker(workerId: string) {
  const db = getSupabaseAdmin();
  const { data: run } = await db
    .from("notification_worker_runs")
    .insert({ worker_id: workerId, status: "running" })
    .select("id")
    .single();
  try {
    const result = await dispatchPendingTakeoffNotifications();
    if (run?.id) {
      await db
        .from("notification_worker_runs")
        .update({
          finished_at: new Date().toISOString(),
          status: "succeeded",
          deliveries_claimed: result.claimed,
          deliveries_sent: result.sent,
          deliveries_failed: result.failed + result.expired,
        })
        .eq("id", run.id);
    }
  } catch (error) {
    if (run?.id) {
      await db
        .from("notification_worker_runs")
        .update({
          finished_at: new Date().toISOString(),
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        })
        .eq("id", run.id);
    }
    throw error;
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
