import type { Config } from "@netlify/functions";
import { APP_STATES } from "../../lib/app-states";
import { buildSnapshot } from "../../lib/adsb";
import { ingestSnapshot } from "../../lib/aircraft-data";
import { dispatchPendingTakeoffNotifications } from "../../lib/aircraft-alerts/dispatcher";
import { getSupabaseAdmin } from "../../lib/supabase/server";

const SAMPLE_INTERVAL_MS = 30_000;
// adsb.fi's public API allows one request per second. Keep a small safety
// margin so all state-scoped ICAO batches remain below that limit.
const UPSTREAM_REQUEST_SPACING_MS = 1_100;
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
    let positionsInserted = 0;
    let takeoffsCreated = 0;
    let trackedAircraftCount = 0;
    let sourceAircraftCount = 0;
    const reports: StateIngestionReport[] = [];

    for (const [index, state] of APP_STATES.entries()) {
      if (index > 0) await wait(UPSTREAM_REQUEST_SPACING_MS);
      const stateStartedAt = Date.now();
      try {
        const snapshot = await buildSnapshot(state.code);
        const result = await ingestSnapshot(snapshot, workerId);
        const queriedIcaos = new Set(
          snapshot.aircraft
            .map((aircraft) => aircraft.icao24.toLowerCase())
            .filter((icao24) => /^[0-9a-f]{6}$/.test(icao24)),
        );
        const matchedAircraftCount = snapshot.aircraft.filter(
          (aircraft) => aircraft.observed,
        ).length;
        const stateTrackedAircraftCount = snapshot.aircraft.length;

        positionsInserted += result.positionsInserted;
        takeoffsCreated += result.takeoffsCreated;
        trackedAircraftCount += stateTrackedAircraftCount;
        sourceAircraftCount += snapshot.live_seen_count;
        reports.push({
          state_code: state.code,
          source: snapshot.source,
          source_ok: result.sourceHealthy,
          source_error: snapshot.source_error ?? null,
          source_aircraft_count: snapshot.live_seen_count,
          tracked_aircraft_count: stateTrackedAircraftCount,
          queried_icao_count: queriedIcaos.size,
          matched_aircraft_count: matchedAircraftCount,
          positions_inserted: result.positionsInserted,
          takeoffs_created: result.takeoffsCreated,
          duration_ms: Date.now() - stateStartedAt,
        });
      } catch (error) {
        reports.push({
          state_code: state.code,
          source: null,
          source_ok: false,
          source_error: errorMessage(error),
          source_aircraft_count: 0,
          tracked_aircraft_count: 0,
          queried_icao_count: 0,
          matched_aircraft_count: 0,
          positions_inserted: 0,
          takeoffs_created: 0,
          duration_ms: Date.now() - stateStartedAt,
        });
      }
    }

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
        source_aircraft_count: sourceAircraftCount,
        tracked_aircraft_count: trackedAircraftCount,
        positions_inserted: positionsInserted,
        takeoffs_created: takeoffsCreated,
        error: runError,
        metadata: {
          sample_index: sampleIndex,
          unhealthy_states: unhealthyReports.map((report) => report.state_code),
          states: reports,
        },
      })
      .eq("id", run.id);
    if (updateError) {
      throw new Error(`Ingestion run update failed: ${updateError.message}`);
    }
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

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}
