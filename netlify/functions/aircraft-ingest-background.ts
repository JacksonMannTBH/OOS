import type { Config } from "@netlify/functions";
import { APP_STATES } from "../../lib/app-states";
import { buildFleetBatchSnapshot } from "../../lib/adsb";
import {
  ensureCatalogSeeded, getAircraftCatalogEntries, getPriorityAircraftTails,
  ingestSnapshot, type AircraftCatalogEntry,
} from "../../lib/aircraft-data";
import { readAllCatalogPages } from "../../lib/catalog-pagination";
import { runPriorityIngestion, type IngestionBatch } from "../../lib/priority-ingestion";
import { fleetHex } from "../../lib/seed";
import { dispatchPendingTakeoffNotifications } from "../../lib/aircraft-alerts/dispatcher";
import { getSupabaseAdmin } from "../../lib/supabase/server";
import {
  normalizeAircraftSampleInterval,
} from "../../lib/ingestion-schedule";

const LEASE_SECONDS = 150;

type StateIngestionReport = {
  state_code: string;
  source: string | null;
  source_ok: boolean;
  source_error: string | null;
  source_aircraft_count: number;
  tracked_aircraft_count: number;
  queried_icao_count: number;
  matched_aircraft_count: number;
  positions_inserted: number;
  takeoffs_created: number;
  duration_ms: number;
};

export default async function aircraftIngestBackground(
  request: Request,
): Promise<void> {
  const secret = Netlify.env.get("CRON_SECRET");
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    throw new Error("Unauthorized aircraft ingestion request");
  }

  const db = getSupabaseAdmin();
  const workerId = crypto.randomUUID();
  // A final slow batch may cross the minute boundary. Give the previous
  // worker time to publish and release its lease instead of losing this
  // entire minute's invocation. The database still permits just one owner.
  const claimDeadline = Date.now() + 45_000;
  for (;;) {
    const { data: claimed, error: claimError } = await db.rpc("claim_worker_lease", {
      lease_name: "aircraft-ingestion",
      lease_owner: workerId,
      lease_seconds: LEASE_SECONDS,
    });
    if (claimError) throw new Error(`Worker lease failed: ${claimError.message}`);
    if (claimed) break;
    if (Date.now() >= claimDeadline) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  try {
    await ensureCatalogSeeded();
    const [catalog, priorityTails, lastAttemptByTail] = await Promise.all([
      getAircraftCatalogEntries(), getPriorityAircraftTails(), recentBatchAttempts(),
    ]);
    const catalogByTail = new Map(catalog
      .filter((entry) => /^[0-9a-f]{6}$/i.test(fleetHex(entry.aircraft)))
      .map((entry) => [entry.aircraft.tail, entry]));
    let notificationWorkerRuns = 0;
    let sampleIndex = 0;
    await runPriorityIngestion({
      tails: [...catalogByTail.keys()],
      priorityTails,
      lastAttemptByTail,
      priorityIntervalMs: configuredSampleIntervalMs(),
      sample: async (batch) => {
        const result = await sampleAircraftBatch(
          workerId, sampleIndex++, batch,
          batch.tails.map((tail) => catalogByTail.get(tail)!),
        );
        if (result.takeoffsCreated > 0) {
          await runNotificationWorker(workerId);
          notificationWorkerRuns += 1;
        }
        return result.priorityTails;
      },
    });

    // Retry pending deliveries once per minute even when no new takeoff was
    // detected. A takeoff-triggered run already satisfies this minute's pass.
    if (notificationWorkerRuns === 0) {
      await runNotificationWorker(workerId);
    }
  } finally {
    await db.rpc("release_worker_lease", {
      lease_name: "aircraft-ingestion",
      lease_owner: workerId,
    });
  }
}

function configuredSampleIntervalMs(): number {
  return normalizeAircraftSampleInterval(
    Netlify.env.get("AIRCRAFT_SAMPLE_INTERVAL_MS"),
  );
}

export const config: Config = {
  method: "POST",
};

async function sampleAircraftBatch(
  workerId: string,
  sampleIndex: number,
  batch: IngestionBatch,
  catalog: AircraftCatalogEntry[],
): Promise<{ takeoffsCreated: number; priorityTails: string[] | undefined }> {
  const { intervalMs: sampleIntervalMs, scheduledAt } = batch;
  const startLagMs = Math.max(0, Date.now() - scheduledAt);
  const db = getSupabaseAdmin();
  const startedAt = new Date().toISOString();
  const { data: run, error: runError } = await db
    .from("ingestion_runs")
    .insert({
      worker_id: workerId,
      started_at: startedAt,
      status: "running",
      metadata: {
        batch_kind: batch.kind,
        queried_tails: batch.tails,
        sample_index: sampleIndex,
        sample_interval_ms: sampleIntervalMs,
        scheduled_at: new Date(scheduledAt).toISOString(),
        start_lag_ms: startLagMs,
      },
    })
    .select("id")
    .single();
  if (runError) throw new Error(`Ingestion run create failed: ${runError.message}`);

  try {
    const cycleStartedAt = Date.now();
    const snapshot = await buildFleetBatchSnapshot(catalog);
    // This write publishes immediately, before another provider batch begins.
    const result = await ingestSnapshot(snapshot, workerId, { catalogSeeded: true });
    const coveredStates = new Set(catalog.map((entry) => entry.homeStateCode));
    const reports: StateIngestionReport[] = APP_STATES.filter((state) => coveredStates.has(state.code)).map((state) => {
      const aircraft = snapshot.aircraft.filter(
        (item) => item.home_state_code === state.code,
      );
      const stateSummary = result.byState[state.code];
      return {
        state_code: state.code,
        source: snapshot.source,
        source_ok: result.sourceHealthy,
        source_error: snapshot.source_error ?? null,
        source_aircraft_count: aircraft.filter((item) => item.observed).length,
        tracked_aircraft_count: aircraft.length,
        queried_icao_count: new Set(
          aircraft
            .map((item) => item.icao24.toLowerCase())
            .filter((icao24) => /^[0-9a-f]{6}$/.test(icao24)),
        ).size,
        matched_aircraft_count: aircraft.filter((item) => item.observed).length,
        positions_inserted: stateSummary?.positionsInserted ?? 0,
        takeoffs_created: stateSummary?.takeoffsCreated ?? 0,
        duration_ms: Date.now() - cycleStartedAt,
      };
    });

    const unhealthyReports = reports.filter((report) => !report.source_ok);
    const successfulReports = reports.filter((report) => report.source_ok);
    const status =
      successfulReports.length === 0
        ? "failed"
        : unhealthyReports.length > 0
          ? "partial"
          : "succeeded";
    const runError =
      unhealthyReports.length > 0
        ? unhealthyReports
            .map(
              (report) =>
                `${report.state_code}: ${report.source_error ?? "live sources unavailable"}`,
            )
            .join("; ")
        : null;
    const { error: updateError } = await db
      .from("ingestion_runs")
      .update({
        finished_at: new Date().toISOString(),
        status,
        source: [...new Set(successfulReports.map((report) => report.source))]
          .filter(Boolean)
          .join(","),
        source_aircraft_count: snapshot.live_seen_count,
        tracked_aircraft_count: snapshot.aircraft.length,
        positions_inserted: result.positionsInserted,
        takeoffs_created: result.takeoffsCreated,
        error: runError,
        metadata: {
          batch_kind: batch.kind,
          queried_tails: batch.tails,
          sample_index: sampleIndex,
          sample_interval_ms: sampleIntervalMs,
          scheduled_at: new Date(scheduledAt).toISOString(),
          start_lag_ms: startLagMs,
          unhealthy_states: unhealthyReports.map((report) => report.state_code),
          states: reports,
        },
      })
      .eq("id", run.id);
    if (updateError) {
      throw new Error(`Ingestion run update failed: ${updateError.message}`);
    }
    return {
      takeoffsCreated: result.takeoffsCreated,
      priorityTails: result.sourceHealthy ? result.priorityAircraftTails : undefined,
    };
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

/** Attempt history also preserves discovery progress if a worker runs out of
 * time or a provider fails. Unqueried tails stay oldest and run next minute. */
async function recentBatchAttempts(): Promise<Map<string, number>> {
  const db = getSupabaseAdmin();
  const since = new Date(Date.now() - 5 * 60_000).toISOString();
  const runs = await readAllCatalogPages(
    (from, to) => db.from("ingestion_runs").select("id,started_at,metadata")
      .gte("started_at", since).order("id").range(from, to),
    "Recent aircraft batches read failed",
  );
  const attempts = new Map<string, number>();
  for (const run of runs) {
    const at = Date.parse(String(run.started_at));
    const tails = run.metadata?.queried_tails;
    if (!Number.isFinite(at) || !Array.isArray(tails)) continue;
    for (const tail of tails) {
      if (typeof tail === "string") attempts.set(tail, Math.max(attempts.get(tail) ?? 0, at));
    }
  }
  return attempts;
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
