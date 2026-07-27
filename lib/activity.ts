import { filterOpsAircraftByState } from "./aircraft-directory";
import { type AppStateId } from "./app-states";
import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase/server";
import type { FleetRole, Snapshot } from "./types";

export type ActivityKind =
  | "takeoff"
  | "landing"
  | "first_seen"
  | "squawk_emergency"
  | "altitude_change";

export type ActivityEntry = {
  ts: number;
  tail: string;
  icao24?: string;
  role?: FleetRole;
  stateId?: AppStateId;
  kind: ActivityKind;
  squawk?: string | null;
  lat?: number | null;
  lon?: number | null;
  alt_ft?: number | null;
  description: string;
};

export function describeEvent(
  tail: string,
  nickname: string | null | undefined,
  kind: ActivityKind,
  squawk?: string | null,
  role: FleetRole = "unknown",
): string {
  const name = nickname ?? tail;
  if (kind === "takeoff") {
    if (role === "fixed_wing") return `${name} off the deck`;
    if (role === "sar") return `${name} on a run`;
    return `${name} up`;
  }
  if (kind === "landing") return `${name} down`;
  if (kind === "first_seen") return `${name} on watch`;
  if (kind === "squawk_emergency") {
    const meaning =
      squawk === "7700"
        ? "emergency"
        : squawk === "7600"
          ? "radio failure"
          : squawk === "7500"
            ? "hijack"
            : "alert";
    return `${name} squawking ${meaning}`;
  }
  return `${tail} ${kind}`;
}

/** Activity is produced by confirmed flight-session transitions during ingestion. */
export async function recordActivity(
  _snapshot: Snapshot,
  _state?: string,
): Promise<void> {
  return;
}

export async function getRecentActivity(
  limit = 50,
  stateId?: AppStateId,
): Promise<ActivityEntry[]> {
  if (!isSupabaseConfigured()) return [];
  const readLimit = Math.max(limit * 2, 50);
  const { data, error } = await getSupabaseAdmin()
    .from("flight_sessions")
    .select(
      "detected_takeoff_at,detected_landing_at,aircraft(tail,icao24,nickname,role)",
    )
    .or("detected_takeoff_at.not.is.null,detected_landing_at.not.is.null")
    .order("last_seen_at", { ascending: false })
    .limit(readLimit);
  if (error) {
    console.warn("[activity] read failed:", error.message);
    return [];
  }

  const entries: ActivityEntry[] = [];
  for (const row of data ?? []) {
    const aircraft = Array.isArray(row.aircraft) ? row.aircraft[0] : row.aircraft;
    if (!aircraft) continue;
    const tail = String(aircraft.tail);
    const role = aircraft.role as FleetRole;
    if (
      stateId &&
      filterOpsAircraftByState([{ tail }], stateId).length === 0
    ) {
      continue;
    }
    if (row.detected_takeoff_at) {
      entries.push({
        ts: Date.parse(String(row.detected_takeoff_at)),
        tail,
        icao24: String(aircraft.icao24),
        role,
        stateId,
        kind: "takeoff",
        description: describeEvent(
          tail,
          aircraft.nickname ? String(aircraft.nickname) : null,
          "takeoff",
          null,
          role,
        ),
      });
    }
    if (row.detected_landing_at) {
      entries.push({
        ts: Date.parse(String(row.detected_landing_at)),
        tail,
        icao24: String(aircraft.icao24),
        role,
        stateId,
        kind: "landing",
        description: describeEvent(
          tail,
          aircraft.nickname ? String(aircraft.nickname) : null,
          "landing",
          null,
          role,
        ),
      });
    }
  }
  return entries
    .filter((entry) => Number.isFinite(entry.ts))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, limit);
}
