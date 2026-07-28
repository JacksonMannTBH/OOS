import {
  DEFAULT_STATE_CODE,
  getAppState,
  isStateCode,
  type StateCode,
} from "./app-states";
import { buildSnapshot } from "./adsb";
import { getDatabaseSnapshot } from "./aircraft-data";
import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase/server";
import type { Snapshot, SnapshotSource } from "./types";

let lastSource: SnapshotSource | null = null;

export function getLastSource(): SnapshotSource | null {
  return lastSource;
}

export async function invalidateSnapshot(_state?: string): Promise<void> {
  // Reads are backed by current database state. Netlify CDN cache headers
  // control public response freshness; there is no mutable application cache.
}

export async function getLastAirborneTs(): Promise<number | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabaseAdmin()
    .from("flight_sessions")
    .select("last_seen_at")
    .eq("status", "airborne")
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.last_seen_at) return null;
  const parsed = Date.parse(String(data.last_seen_at));
  return Number.isFinite(parsed) ? parsed : null;
}

export async function peekSnapshot(
  state: StateCode | string = DEFAULT_STATE_CODE,
): Promise<Snapshot | null> {
  return readSnapshot(state);
}

export async function peekHealthSnapshot(
  state: StateCode | string = DEFAULT_STATE_CODE,
): Promise<Snapshot | null> {
  return readSnapshot(state);
}

export async function getSnapshotForRender(
  state: StateCode | string = DEFAULT_STATE_CODE,
): Promise<Snapshot> {
  return (await readSnapshot(state)) ?? emptySnapshot();
}

export async function getSnapshot(
  state: StateCode | string = DEFAULT_STATE_CODE,
  _options: { dispatchAlerts?: boolean } = {},
): Promise<Snapshot> {
  return (await readSnapshot(state)) ?? emptySnapshot();
}

async function readSnapshot(state: StateCode | string): Promise<Snapshot | null> {
  const code = isStateCode(state)
    ? state.toUpperCase() as StateCode
    : getAppState(state).code;
  const snapshot = isSupabaseConfigured()
    ? await getDatabaseSnapshot(code)
    : await buildSnapshot(code);
  lastSource = snapshot.source;
  return snapshot;
}

function emptySnapshot(): Snapshot {
  return {
    fetched_at: Date.now(),
    source: "mock",
    aircraft: [],
    live_seen_count: 0,
  };
}
