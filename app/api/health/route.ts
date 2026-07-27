import { NextResponse } from "next/server";
import { FLEET } from "@/lib/seed";
import { getLastAirborneTs, getLastSource, peekHealthSnapshot } from "@/lib/snapshot";
import {
  getSupabaseAdmin,
  isSupabaseConfigured,
  requireSupabaseHealth,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PING_TIMEOUT_MS = 8_000;

async function pingUrl(url: string): Promise<"ok" | "err"> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    });
    return response.ok ? "ok" : "err";
  } catch {
    return "err";
  } finally {
    clearTimeout(timeout);
  }
}

async function databaseHealth(): Promise<
  "ok" | "err" | "not_configured"
> {
  if (!isSupabaseConfigured()) return "not_configured";
  try {
    await Promise.race([
      requireSupabaseHealth(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("database timeout")), PING_TIMEOUT_MS),
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
      pending_notifications: null,
      failed_notifications: null,
    };
  }

  const db = getSupabaseAdmin();
  const [runResult, pendingResult, failedResult] = await Promise.all([
    db
      .from("ingestion_runs")
      .select("finished_at,status")
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
  ]);

  return {
    last_ingestion_at: runResult.data?.finished_at ?? null,
    last_ingestion_status: runResult.data?.status ?? null,
    pending_notifications: pendingResult.count ?? null,
    failed_notifications: failedResult.count ?? null,
  };
}

export async function GET() {
  const [database, adsbfi, operations, snapshot, lastAirborneTs] =
    await Promise.all([
      databaseHealth(),
      pingUrl("https://opendata.adsb.fi/api/v2/lat/47.6/lon/-122.3/dist/1"),
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

  return NextResponse.json({
    ok:
      database === "ok" &&
      adsbfi === "ok" &&
      operations.last_ingestion_status === "succeeded",
    database,
    adsbfi,
    ingestion: {
      last_finished_at: operations.last_ingestion_at,
      last_status: operations.last_ingestion_status,
      age_seconds: lastIngestionAgeSeconds,
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
    tracked_aircraft: FLEET.length,
    source_last: getLastSource(),
    checked_at: new Date().toISOString(),
  });
}
