import { ingestSnapshot } from "./aircraft-data";
import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase/server";
import type { Snapshot } from "./types";

export type TrackPoint = {
  lat: number;
  lon: number;
  alt: number | null;
  spd: number | null;
  trk: number | null;
  ts: number;
};

export const CURRENT_FLIGHT_GAP_SECONDS = 2 * 60;

export type CurrentFlightDuration = {
  elapsedMinutes: number;
  startedAtMs: number;
  lastSampleMs: number;
  sampleCount: number;
};

export type CurrentFlightTrack = {
  points: TrackPoint[];
  startedAtMs: number;
  lastSampleMs: number;
};

/** Compatibility entry point for callers that already have a feed snapshot. */
export async function logTracks(snap: Snapshot): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await ingestSnapshot(snap, "legacy-log-tracks");
}

export async function listTrackKeys(tail: string): Promise<string[]> {
  const points = await readCurrentFlightPoints(tail);
  return [...new Set(points.map((point) => utcDateKey(new Date(point.ts * 1000))))]
    .sort()
    .reverse();
}

export async function getTracksForDay(
  tail: string,
  date: string,
): Promise<TrackPoint[]> {
  return (await readCurrentFlightPoints(tail)).filter(
    (point) => utcDateKey(new Date(point.ts * 1000)) === date,
  );
}

export function getCurrentFlightDurationFromPoints(
  points: TrackPoint[],
  nowMs = Date.now(),
  gapSeconds = CURRENT_FLIGHT_GAP_SECONDS,
): CurrentFlightDuration | null {
  const track = getCurrentFlightTrackFromPoints(points, nowMs, gapSeconds);
  if (!track) return null;
  return {
    elapsedMinutes: Math.max(0, Math.floor((nowMs - track.startedAtMs) / 60_000)),
    startedAtMs: track.startedAtMs,
    lastSampleMs: track.lastSampleMs,
    sampleCount: track.points.length,
  };
}

export function getCurrentFlightTrackFromPoints(
  points: TrackPoint[],
  nowMs = Date.now(),
  gapSeconds = CURRENT_FLIGHT_GAP_SECONDS,
): CurrentFlightTrack | null {
  const sorted = points
    .filter((point) => Number.isFinite(point.ts))
    .sort((a, b) => a.ts - b.ts);
  const latest = sorted.at(-1);
  if (!latest) return null;

  const gapMs = gapSeconds * 1000;
  if (Math.abs(nowMs - latest.ts * 1000) > gapMs) return null;

  const session: TrackPoint[] = [];
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index]!;
    session.unshift(point);
    const previous = sorted[index - 1];
    if (!previous || point.ts - previous.ts > gapSeconds) break;
  }
  const first = session[0];
  if (!first) return null;
  return {
    points: session,
    startedAtMs: first.ts * 1000,
    lastSampleMs: latest.ts * 1000,
  };
}

export async function getCurrentFlightDuration(
  tail: string,
  nowMs = Date.now(),
): Promise<CurrentFlightDuration | null> {
  const track = await getCurrentFlightTrack(tail, nowMs);
  if (!track) return null;
  return {
    elapsedMinutes: Math.max(0, Math.floor((nowMs - track.startedAtMs) / 60_000)),
    startedAtMs: track.startedAtMs,
    lastSampleMs: track.lastSampleMs,
    sampleCount: track.points.length,
  };
}

export async function getCurrentFlightTrack(
  tail: string,
  nowMs = Date.now(),
): Promise<CurrentFlightTrack | null> {
  const points = await readCurrentFlightPoints(tail);
  const track = getCurrentFlightTrackFromPoints(
    points,
    nowMs,
    Number.MAX_SAFE_INTEGER,
  );
  if (!track || nowMs - track.lastSampleMs > CURRENT_FLIGHT_GAP_SECONDS * 1_000) {
    return null;
  }
  return track;
}

export async function getLiveTrackWindow(
  tail: string,
  _nowMs = Date.now(),
  _windowSeconds?: number,
): Promise<TrackPoint[]> {
  return readCurrentFlightPoints(tail);
}

export type TrackSummary = {
  totalSamples: number;
  daysWithData: number;
  firstSampleTs: number | null;
  lastSampleTs: number | null;
};

export async function getTrackSummary(tail: string): Promise<TrackSummary> {
  const points = await readCurrentFlightPoints(tail);
  return {
    totalSamples: points.length,
    daysWithData: new Set(
      points.map((point) => utcDateKey(new Date(point.ts * 1000))),
    ).size,
    firstSampleTs: points[0]?.ts ?? null,
    lastSampleTs: points.at(-1)?.ts ?? null,
  };
}

async function readCurrentFlightPoints(tail: string): Promise<TrackPoint[]> {
  if (!isSupabaseConfigured()) return [];
  const db = getSupabaseAdmin();
  const { data: aircraft, error: aircraftError } = await db
    .from("aircraft")
    .select("id")
    .eq("tail", tail.trim().toUpperCase())
    .maybeSingle();
  if (aircraftError || !aircraft) return [];

  const { data: current, error: currentError } = await db
    .from("aircraft_current_state")
    .select("flight_session_id")
    .eq("aircraft_id", aircraft.id)
    .maybeSingle();
  if (currentError || !current?.flight_session_id) return [];

  const { data, error } = await db
    .from("aircraft_positions")
    .select(
      "latitude,longitude,altitude_ft,ground_speed_kt,heading_deg,observed_at",
    )
    .eq("flight_session_id", current.flight_session_id)
    .order("observed_at", { ascending: true });
  if (error) {
    console.warn(`[tracks] read failed for ${tail}:`, error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    lat: Number(row.latitude),
    lon: Number(row.longitude),
    alt: nullableNumber(row.altitude_ft),
    spd: nullableNumber(row.ground_speed_kt),
    trk: nullableNumber(row.heading_deg),
    ts: Math.floor(Date.parse(String(row.observed_at)) / 1000),
  }));
}

function utcDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
