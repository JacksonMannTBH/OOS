import { buildDatabaseSnapshot } from "./aircraft-data";
import { SUPPORTED_STATE_CODES, type StateCode } from "./app-states";
import { encodeLiveState, liveTopic, type LiveState, type LiveDelta, type LiveTrailPoint } from "./live-data-protocol";
import { getSupabaseAdmin, readServerEnv } from "./supabase/server";
import { catalogBatches, readAllCatalogPages } from "./catalog-pagination";
import { mapWithConcurrency } from "./map-with-concurrency";
import type { Snapshot } from "./types";
import { getPreparedAircraftResponse } from "./prepared-aircraft-response";

const LIVE_STATE_CONCURRENCY = 4;

async function readLiveSnapshots(state?: StateCode) {
  const db = getSupabaseAdmin();
  const [rows, runs] = await Promise.all([
    readAllCatalogPages((from, to) => {
      const query = db.from("aircraft_live_public").select("*").order("tail").range(from, to);
      return state ? query.eq("home_state_code", state) : query.in("home_state_code", SUPPORTED_STATE_CODES);
    }, "Live aircraft read failed"),
    db.from("ingestion_runs").select("finished_at,source").in("status", ["succeeded", "partial"])
      .not("finished_at", "is", null).order("finished_at", { ascending: false }).limit(2),
  ]);
  if (runs.error) throw new Error(`Live revision read failed: ${runs.error.message}`);
  const revision = Date.now();
  const latest = runs.data?.[0] ?? null;
  const cursor = latest ? Date.parse(latest.finished_at) : 0;
  const baseCursor = runs.data?.[1] ? Date.parse(runs.data[1].finished_at) : 0;
  if (!Number.isFinite(cursor) || !Number.isFinite(baseCursor)) throw new Error("Invalid live revision");
  const grouped = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const code = String(row.home_state_code);
    if (!grouped.has(code)) grouped.set(code, []);
    grouped.get(code)!.push(row);
  }
  const snapshots = new Map<StateCode, Snapshot>();
  for (const code of state ? [state] : SUPPORTED_STATE_CODES) {
    snapshots.set(code, buildDatabaseSnapshot(grouped.get(code) ?? [], latest, revision));
  }
  return { revision, cursor, baseCursor, snapshots };
}

function liveSessions(snapshot: Snapshot): Record<string, string> {
  return Object.fromEntries(snapshot.aircraft
    .filter(a => (a.airborne || a.last_known_airborne) && a.flight_session_id)
    .map(a => [a.tail, a.flight_session_id!]));
}

/** Batch by flight ID; full histories are read only for connection/recovery requests. */
async function readLiveTrails(sessions: Record<string, string>, through: number, after?: number) {
  const trails: Record<string, LiveTrailPoint[]> = Object.fromEntries(Object.keys(sessions).map(tail => [tail, []]));
  const tailsBySession = new Map(Object.entries(sessions).map(([tail, id]) => [id, tail]));
  for (const batch of catalogBatches([...tailsBySession.keys()])) {
    const points = await readAllCatalogPages((from, to) => {
      const query = getSupabaseAdmin().from("aircraft_positions")
        .select("id,flight_session_id,latitude,longitude,observed_at,created_at")
        .in("flight_session_id", batch).lte("created_at", new Date(through).toISOString())
        .order("created_at").order("id").range(from, to);
      // Use insertion time: provider observations may arrive late or out of order.
      return after === undefined ? query : query.gte("created_at", new Date(after).toISOString());
    }, "Live trail read failed");
    for (const point of points) {
      const tail = tailsBySession.get(String(point.flight_session_id));
      const lat = Number(point.latitude), lon = Number(point.longitude);
      const ts = Math.floor(Date.parse(point.observed_at) / 1_000);
      if (tail && Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(ts)) trails[tail]!.push({ lat, lon, ts });
    }
  }
  for (const tail of Object.keys(trails)) trails[tail]!.sort((a, b) => a.ts - b.ts);
  return trails;
}

/** A complete state for initial connections, reconnects, and detected gaps. */
export async function getLiveState(state: StateCode): Promise<LiveState> {
  return getPreparedAircraftResponse(`oos-prepared-v1:live:${state}`, () => buildLiveState(state));
}

async function buildLiveState(state: StateCode): Promise<LiveState> {
  const { revision, cursor, snapshots } = await readLiveSnapshots(state);
  const snapshot = snapshots.get(state)!;
  const sessions = liveSessions(snapshot);
  const trails = await readLiveTrails(sessions, revision);
  return { version: 1, state, revision, cursor, snapshot, sessions, trails };
}

export async function broadcastLiveStates(sourceUnavailable = false): Promise<void> {
  const url = readServerEnv("SUPABASE_URL");
  const key = readServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Live backend is not configured");
  const { revision, cursor, baseCursor, snapshots } = await readLiveSnapshots();
  const sessionsByState = new Map([...snapshots].map(([state, snapshot]) => [state, liveSessions(snapshot)]));
  const allSessions = Object.assign({}, ...sessionsByState.values()) as Record<string, string>;
  // Ingestion persists the cursor, so cold starts also read only new points.
  const newPoints = await readLiveTrails(allSessions, revision, baseCursor);
  await mapWithConcurrency(SUPPORTED_STATE_CODES, LIVE_STATE_CONCURRENCY, async state => {
    const snapshot = snapshots.get(state)!;
    const sessions = sessionsByState.get(state)!;
    const update: LiveDelta = {
      version: 2, state, revision, cursor, baseCursor, sessions,
      snapshot: sourceUnavailable ? { ...snapshot, source_ok: false, source_error: "Aircraft feed is temporarily unavailable." } : snapshot,
      trails: Object.fromEntries(Object.keys(sessions).map(tail => [tail, newPoints[tail] ?? []])),
    };
    const frames = encodeLiveState(update);
    for (let offset = 0; offset < frames.length; offset += 4) {
      const response = await fetch(`${url}/realtime/v1/api/broadcast`, {
        method: "POST", signal: AbortSignal.timeout(5_000),
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messages: frames.slice(offset, offset + 4).map(payload => ({
          topic: liveTopic(state), event: "state", private: true, payload,
        })) }),
      });
      if (!response.ok) throw new Error(`Live broadcast failed (${response.status})`);
    }
  });
}
