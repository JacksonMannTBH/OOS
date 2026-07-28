import { NextResponse } from "next/server";
import { FLEET } from "@/lib/seed";
import { liveDataHeaders } from "@/lib/http-cache";
import { getLastAirborneTs, getLastSource, peekHealthSnapshot } from "@/lib/snapshot";
import {
  getSupabaseAdmin,
  isSupabaseConfigured,
  requireSupabaseHealth,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATABASE_TIMEOUT_MS = 8_000;
const INGESTION_STALE_AFTER_SECONDS = 180;

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

async function databaseHealth(): Promise<
  "ok" | "err" | "not_configured"
> {
  if (!isSupabaseConfigured()) return "not_configured";
  try {
    await Promise.race([
      requireSupabaseHealth(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("database timeout")),
          DATABASE_TIMEOUT_MS,
        ),
      ),
    ]);
    return "ok";
  } catch {
    return "err";
  }
}

async function operationalHealth() {
  if (!isSupabaseConfigured()) {
    return {
      last_ingestion_at: null,
      last_ingestion_status: null,
      source: null,
      error: null,
      source_aircraft_count: null,
      tracked_aircraft_count: null,
      positions_inserted: null,
      takeoffs_created: null,
      catalog_aircraft_count: null,
      unhealthy_states: [] as string[],
      states: [] as StateIngestionReport[],
      pending_notifications: null,
      failed_notifications: null,
    };
  }

  const db = getSupabaseAdmin();
  const [runResult, pendingResult, failedResult, catalogResult] =
    await Promise.all([
    db
      .from("ingestion_runs")
      .select(
        "finished_at,status,source,error,source_aircraft_count,tracked_aircraft_count,positions_inserted,takeoffs_created,metadata",
      )
      .not("finished_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("notification_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    db
      .from("notification_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
    db
      .from("aircraft")
      .select("id", { count: "exact", head: true })
      .eq("active", true),
    ]);

  const metadata = isRecord(runResult.data?.metadata)
    ? runResult.data.metadata
    : {};
  const states = normalizeStateReports(metadata.states);
  const unhealthyStates = Array.isArray(metadata.unhealthy_states)
    ? metadata.unhealthy_states.filter(
        (value): value is string => typeof value === "string",
      )
    : states
        .filter((state) => !state.source_ok)
        .map((state) => state.state_code);

  return {
    last_ingestion_at: runResult.data?.finished_at ?? null,
    last_ingestion_status: runResult.data?.status ?? null,
    source: runResult.data?.source ?? null,
    error: runResult.data?.error ?? null,
    source_aircraft_count: runResult.data?.source_aircraft_count ?? null,
    tracked_aircraft_count: runResult.data?.tracked_aircraft_count ?? null,
    positions_inserted: runResult.data?.positions_inserted ?? null,
    takeoffs_created: runResult.data?.takeoffs_created ?? null,
    catalog_aircraft_count: catalogResult.count ?? null,
    unhealthy_states: unhealthyStates,
    states,
    pending_notifications: pendingResult.count ?? null,
    failed_notifications: failedResult.count ?? null,
  };
}

export async function GET() {
  const [database, operations, snapshot, lastAirborneTs] =
    await Promise.all([
      databaseHealth(),
      operationalHealth(),
      peekHealthSnapshot(),
      getLastAirborneTs(),
    ]);

  const airborneCount = snapshot
    ? snapshot.aircraft.filter((aircraft) => aircraft.airborne).length
    : null;
  const snapshotAgeSeconds = snapshot
    ? Math.max(0, Math.round((Date.now() - snapshot.fetched_at) / 1_000))
    : null;
  const lastIngestionAgeSeconds = operations.last_ingestion_at
    ? Math.max(
        0,
        Math.round(
          (Date.now() - Date.parse(operations.last_ingestion_at)) / 1_000,
        ),
      )
    : null;
  const ingestionIsFresh =
    lastIngestionAgeSeconds != null &&
    lastIngestionAgeSeconds <= INGESTION_STALE_AFTER_SECONDS;
  const ingestionHasHealthyState =
    operations.states.length > 0
      ? operations.states.some((state) => state.source_ok)
      : operations.last_ingestion_status === "succeeded" ||
        operations.last_ingestion_status === "partial";
  const ingestionIsUsable =
    ingestionIsFresh &&
    ingestionHasHealthyState &&
    (operations.last_ingestion_status === "succeeded" ||
      operations.last_ingestion_status === "partial");
  const ok = database === "ok" && ingestionIsUsable;
  const degraded =
    ok &&
    (operations.last_ingestion_status === "partial" ||
      operations.states.some(
        (state) => state.source_ok && state.source !== "adsbfi",
      ));
  const adsbfi = adsbFiHealth(operations.states, operations.source);

  return NextResponse.json(
    {
      ok,
      status: ok ? (degraded ? "degraded" : "ok") : "down",
      database,
      adsbfi,
      ingestion: {
        last_finished_at: operations.last_ingestion_at,
        last_status: operations.last_ingestion_status,
        age_seconds: lastIngestionAgeSeconds,
        stale_after_seconds: INGESTION_STALE_AFTER_SECONDS,
        source: operations.source,
        error: operations.error,
        source_aircraft_count: operations.source_aircraft_count,
        tracked_aircraft_count: operations.tracked_aircraft_count,
        positions_inserted: operations.positions_inserted,
        takeoffs_created: operations.takeoffs_created,
        unhealthy_states: operations.unhealthy_states,
        states: operations.states,
      },
      notifications: {
        pending: operations.pending_notifications,
        failed: operations.failed_notifications,
      },
      airborne_count: airborneCount,
      live_seen_count: snapshot?.live_seen_count ?? null,
      snapshot_age_seconds: snapshotAgeSeconds,
      last_airborne_at: lastAirborneTs
        ? new Date(lastAirborneTs).toISOString()
        : null,
      tracked_aircraft: operations.catalog_aircraft_count ?? FLEET.length,
      source_last: getLastSource(),
      checked_at: new Date().toISOString(),
    },
    { headers: liveDataHeaders() },
  );
}

function adsbFiHealth(
  states: StateIngestionReport[],
  source: string | null,
): "ok" | "err" | "unknown" {
  if (states.length === 0) {
    return source?.split(",").includes("adsbfi") ? "ok" : "unknown";
  }
  return states.every(
    (state) => state.source_ok && state.source === "adsbfi",
  )
    ? "ok"
    : "err";
}

function normalizeStateReports(value: unknown): StateIngestionReport[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((report) => ({
      state_code: stringValue(report.state_code),
      source:
        typeof report.source === "string" ? report.source : null,
      source_ok: report.source_ok === true,
      source_error:
        typeof report.source_error === "string"
          ? report.source_error
          : null,
      source_aircraft_count: numberValue(report.source_aircraft_count),
      tracked_aircraft_count: numberValue(report.tracked_aircraft_count),
      queried_icao_count: numberValue(report.queried_icao_count),
      matched_aircraft_count: numberValue(report.matched_aircraft_count),
      positions_inserted: numberValue(report.positions_inserted),
      takeoffs_created: numberValue(report.takeoffs_created),
      duration_ms: numberValue(report.duration_ms),
    }))
    .filter((report) => report.state_code.length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
