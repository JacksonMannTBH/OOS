import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase/server";
import type { TrackPoint } from "./tracks";

const LOOKBACK_DAYS = 7;
const ACTIVE_SESSION_WINDOW_MS = 5 * 60 * 1000;
const FLIGHT_LOOKUP_TOLERANCE_MS = 30_000;

export type FlightSession = {
  tail: string;
  nickname: string | null;
  date: string;
  start_ts: number;
  end_ts: number;
  duration_s: number;
  sample_count: number;
  max_alt_ft: number;
  start_coord: { lat: number; lon: number };
  end_coord: { lat: number; lon: number };
};

export type RecentFlightForTail = {
  session: FlightSession;
  points: TrackPoint[];
  inProgress: boolean;
};

type SessionRow = {
  id: string;
  status: string;
  tracking_started_at: string;
  detected_takeoff_at: string | null;
  detected_landing_at: string | null;
  last_seen_at: string;
  aircraft: { tail: string; nickname: string | null } | null;
};

export async function getRecentFlights(limit = 20): Promise<FlightSession[]> {
  if (!isSupabaseConfigured()) return [];
  const cutoff = new Date(
    Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("flight_sessions")
    .select(
      "id,status,tracking_started_at,detected_takeoff_at,detected_landing_at,last_seen_at,aircraft(tail,nickname)",
    )
    .gte("last_seen_at", cutoff)
    .order("last_seen_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)));
  if (error) {
    console.warn("[flights] recent-flight read failed:", error.message);
    return [];
  }

  return Promise.all(
    ((data ?? []) as unknown as SessionRow[]).map((row) =>
      sessionFromDatabase(row),
    ),
  );
}

export async function getMostRecentFlightForTail(
  tail: string,
  nickname: string | null,
): Promise<RecentFlightForTail | null> {
  if (!isSupabaseConfigured()) return null;
  const db = getSupabaseAdmin();
  const { data: aircraft, error: aircraftError } = await db
    .from("aircraft")
    .select("id,tail,nickname")
    .eq("tail", tail.trim().toUpperCase())
    .maybeSingle();
  if (aircraftError || !aircraft) return null;

  const { data, error } = await db
    .from("flight_sessions")
    .select(
      "id,status,tracking_started_at,detected_takeoff_at,detected_landing_at,last_seen_at",
    )
    .eq("aircraft_id", aircraft.id)
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;

  const row: SessionRow = {
    ...data,
    aircraft: {
      tail: String(aircraft.tail),
      nickname:
        typeof aircraft.nickname === "string" ? aircraft.nickname : nickname,
    },
  };
  const [session, points] = await Promise.all([
    sessionFromDatabase(row),
    pointsForFlightSession(row.id),
  ]);
  return {
    session,
    points,
    inProgress:
      !row.detected_landing_at &&
      Date.now() - Date.parse(row.last_seen_at) < ACTIVE_SESSION_WINDOW_MS,
  };
}

export async function getFlightById(
  tail: string,
  nickname: string | null,
  flightId: string,
): Promise<RecentFlightForTail | null> {
  const parsed = parseFlightId(flightId);
  if (!parsed || !isSupabaseConfigured()) return null;
  const db = getSupabaseAdmin();
  const { data: aircraft, error: aircraftError } = await db
    .from("aircraft")
    .select("id,tail,nickname")
    .eq("tail", tail.trim().toUpperCase())
    .maybeSingle();
  if (aircraftError || !aircraft) return null;

  const lower = new Date(parsed.tsMs - FLIGHT_LOOKUP_TOLERANCE_MS).toISOString();
  const upper = new Date(parsed.tsMs + FLIGHT_LOOKUP_TOLERANCE_MS).toISOString();
  const { data, error } = await db
    .from("flight_sessions")
    .select(
      "id,status,tracking_started_at,detected_takeoff_at,detected_landing_at,last_seen_at",
    )
    .eq("aircraft_id", aircraft.id)
    .gte("tracking_started_at", lower)
    .lte("tracking_started_at", upper)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;

  const row: SessionRow = {
    ...data,
    aircraft: {
      tail: String(aircraft.tail),
      nickname:
        typeof aircraft.nickname === "string" ? aircraft.nickname : nickname,
    },
  };
  const [session, points] = await Promise.all([
    sessionFromDatabase(row),
    pointsForFlightSession(row.id),
  ]);
  return {
    session,
    points,
    inProgress:
      !row.detected_landing_at &&
      Date.now() - Date.parse(row.last_seen_at) < ACTIVE_SESSION_WINDOW_MS,
  };
}

async function sessionFromDatabase(row: SessionRow): Promise<FlightSession> {
  const startAt = row.detected_takeoff_at ?? row.tracking_started_at;
  const endAt = row.detected_landing_at ?? row.last_seen_at;
  const points = await pointsForFlightSession(row.id);
  const first = points[0];
  const last = points.at(-1);
  const startTs = Date.parse(startAt);
  const endTs = Date.parse(endAt);

  return {
    tail: row.aircraft?.tail ?? "UNKNOWN",
    nickname: row.aircraft?.nickname ?? null,
    date: utcDateKey(new Date(startTs)),
    start_ts: startTs,
    end_ts: endTs,
    duration_s: Math.max(0, Math.round((endTs - startTs) / 1_000)),
    sample_count: points.length,
    max_alt_ft: points.reduce(
      (maximum, point) => Math.max(maximum, point.alt ?? 0),
      0,
    ),
    start_coord: first
      ? { lat: first.lat, lon: first.lon }
      : { lat: 0, lon: 0 },
    end_coord: last
      ? { lat: last.lat, lon: last.lon }
      : { lat: 0, lon: 0 },
  };
}

async function pointsForFlightSession(
  flightSessionId: string,
): Promise<TrackPoint[]> {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("aircraft_positions")
    .select(
      "latitude,longitude,altitude_ft,ground_speed_kt,heading_deg,observed_at",
    )
    .eq("flight_session_id", flightSessionId)
    .gte("observed_at", cutoff)
    .order("observed_at", { ascending: true });
  if (error) return [];
  return (data ?? []).map((row) => ({
    lat: Number(row.latitude),
    lon: Number(row.longitude),
    alt: nullableNumber(row.altitude_ft),
    spd: nullableNumber(row.ground_speed_kt),
    trk: nullableNumber(row.heading_deg),
    ts: Math.floor(Date.parse(String(row.observed_at)) / 1_000),
  }));
}

export function averageGroundSpeedKt(points: TrackPoint[]): number | null {
  const validSpeeds = points
    .map((point) => point.spd)
    .filter(
      (speed): speed is number =>
        typeof speed === "number" && Number.isFinite(speed) && speed >= 0,
    );
  if (validSpeeds.length === 0) return null;

  let weightedSpeedSeconds = 0;
  let totalSeconds = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    if (
      typeof previous.spd !== "number" ||
      typeof current.spd !== "number" ||
      !Number.isFinite(previous.spd) ||
      !Number.isFinite(current.spd)
    ) {
      continue;
    }
    const seconds = current.ts - previous.ts;
    if (seconds <= 0) continue;
    weightedSpeedSeconds += ((previous.spd + current.spd) / 2) * seconds;
    totalSeconds += seconds;
  }
  return totalSeconds > 0
    ? weightedSpeedSeconds / totalSeconds
    : validSpeeds.reduce((sum, speed) => sum + speed, 0) /
        validSpeeds.length;
}

export function flightIdFromTs(tsMs: number): string {
  const date = new Date(tsMs);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}${month}${day}T${hour}${minute}`;
}

export function parseFlightId(
  flightId: string,
): { dateKey: string; tsMs: number } | null {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})$/.exec(flightId);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const tsMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  return Number.isFinite(tsMs)
    ? { dateKey: `${year}${month}${day}`, tsMs }
    : null;
}

function utcDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function nullableNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
