// ADS-B feed adapters: adsb.fi (primary) + OpenSky (fallback).
// Polite usage: exact fleet ICAOs once per state refresh, locally cached.

import { fleetHex } from "./seed";
import { getCatalog } from "./aircraft-data";
import { fetchOpenSky } from "./opensky";
import {
  DEFAULT_STATE_CODE,
  type StateCode,
} from "./app-states";
import type {
  Aircraft,
  AircraftLive,
  FleetEntry,
  NormalizedAc,
  Snapshot,
} from "./types";

const FETCH_OPTS: RequestInit = {
  headers: { "User-Agent": "OutOfSight/0.1 (+https://github.com/)" },
  // Avoid Next.js's fetch caching layer — we cache ourselves.
  cache: "no-store",
};

// ─── adsb.fi ───────────────────────────────────────────────────────────────

// Exact-ICAO responses use the ADSBexchange-compatible `ac` field. Keep
// `aircraft` compatibility for older regional responses and fixtures.
type AdsbFiResp = {
  ac?: unknown[];
  aircraft?: unknown[];
  now?: number;
};

const SNAPSHOT_TTL_MS = 15_000;
const MAX_ADSB_OBSERVATION_AGE_SECONDS = 60;
const snapshotCache = new Map<
  StateCode,
  { snapshot: Snapshot; expiresAt: number }
>();
const pendingSnapshots = new Map<StateCode, Promise<Snapshot>>();

async function fetchAdsbFi(hexes: string[]): Promise<NormalizedAc[]> {
  if (hexes.length === 0) return [];
  const url = `https://opendata.adsb.fi/api/v2/icao/${hexes.join(",")}`;
  const r = await fetch(url, FETCH_OPTS);
  if (!r.ok) throw new Error(`adsb.fi ${r.status}`);
  const j = (await r.json()) as AdsbFiResp;
  return normalizeAdsbFiPayload(j);
}

export function normalizeAdsbFiPayload(payload: unknown): NormalizedAc[] {
  if (!isRecord(payload)) return [];
  const rows = Array.isArray(payload.ac)
    ? payload.ac
    : Array.isArray(payload.aircraft)
      ? payload.aircraft
      : [];

  const aircraft: NormalizedAc[] = [];
  for (const value of rows) {
    if (!isRecord(value) || typeof value.hex !== "string") continue;
    const seenSeconds = finiteNumber(value.seen);
    if (
      seenSeconds != null &&
      seenSeconds > MAX_ADSB_OBSERVATION_AGE_SECONDS
    ) {
      continue;
    }

    const seenPositionSeconds = finiteNumber(value.seen_pos);
    const positionIsCurrent =
      seenPositionSeconds == null ||
      seenPositionSeconds <= MAX_ADSB_OBSERVATION_AGE_SECONDS;
    const altitude =
      value.alt_baro === "ground"
        ? "ground"
        : finiteNumber(value.alt_baro);

    aircraft.push({
      hex: value.hex.toLowerCase(),
      r: typeof value.r === "string" ? value.r : undefined,
      lat: positionIsCurrent ? finiteNumber(value.lat) : undefined,
      lon: positionIsCurrent ? finiteNumber(value.lon) : undefined,
      alt_baro: altitude,
      gs: finiteNumber(value.gs),
      track: finiteNumber(value.track),
      squawk:
        typeof value.squawk === "string"
          ? value.squawk
          : value.squawk === null
            ? null
            : undefined,
      seen_seconds: seenSeconds,
      seen_position_seconds: seenPositionSeconds,
    });
  }
  return aircraft;
}

// ─── Normalize + merge ─────────────────────────────────────────────────────

export async function buildSnapshot(
  stateCode: StateCode = DEFAULT_STATE_CODE,
): Promise<Snapshot> {
  const now = Date.now();
  const cached = snapshotCache.get(stateCode);
  if (cached && cached.expiresAt > now) return cached.snapshot;

  const pending = pendingSnapshots.get(stateCode);
  if (pending) return pending;

  const request = buildSnapshotUncached(stateCode)
    .then((snapshot) => {
      snapshotCache.set(stateCode, {
        snapshot,
        expiresAt: Date.now() + SNAPSHOT_TTL_MS,
      });
      return snapshot;
    })
    .finally(() => {
      pendingSnapshots.delete(stateCode);
    });

  pendingSnapshots.set(stateCode, request);
  return request;
}

async function buildSnapshotUncached(
  stateCode: StateCode,
): Promise<Snapshot> {
  const fleet = await getCatalog(stateCode);
  const fleetByIcao = new Map<string, FleetEntry>();
  for (const f of fleet) {
    const hex = fleetHex(f);
    if (hex) fleetByIcao.set(hex, f);
  }
  const fleetHexes = [...fleetByIcao.keys()];

  let raw: NormalizedAc[] = [];
  let source: Snapshot["source"] = "adsbfi";
  let sourceOk = true;
  let sourceError: string | undefined;
  try {
    raw = await fetchAdsbFi(fleetHexes);
  } catch (e) {
    console.warn("[adsb] primary failed, falling back to OpenSky:", e);
    const primaryError = errorMessage(e);
    try {
      raw = await fetchOpenSky(fleetHexes);
      source = "opensky";
      sourceError = `adsb.fi: ${primaryError}`;
    } catch (e2) {
      console.error("[adsb] both feeds failed:", e2);
      raw = [];
      source = "opensky";
      sourceOk = false;
      sourceError = `adsb.fi: ${primaryError}; OpenSky: ${errorMessage(e2)}`;
    }
  }

  const liveByIcao = new Map<string, NormalizedAc>();
  for (const ac of raw) {
    const hex = ac.hex.toLowerCase();
    if (fleetByIcao.has(hex)) liveByIcao.set(hex, ac);
  }

  const aircraft: Aircraft[] = fleet.map((entry) => {
    const hex = fleetHex(entry);
    const ac = liveByIcao.get(hex);
    if (!ac) {
      const live: AircraftLive = {
        tail: entry.tail,
        icao24: hex,
        observed: false,
        airborne: false,
        home_state_code: stateCode,
        observation_status: "unknown",
        last_seen_min: null,
      };
      return { ...entry, ...live };
    }

    const grounded = ac.alt_baro === "ground";
    const live: AircraftLive = {
      tail: entry.tail,
      icao24: hex,
      observed: true,
      airborne: !grounded,
      home_state_code: stateCode,
      observation_status: grounded ? "grounded" : "airborne_candidate",
      lat: ac.lat,
      lon: ac.lon,
      altitude_ft:
        typeof ac.alt_baro === "number" ? ac.alt_baro : undefined,
      ground_speed_kt: ac.gs,
      heading: ac.track,
      squawk: ac.squawk ?? null,
      last_seen_min: 0,
    };
    return { ...entry, ...live };
  });

  return {
    fetched_at: Date.now(),
    source,
    source_ok: sourceOk,
    source_error: sourceError,
    aircraft,
    live_seen_count: raw.length,
  };
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

export function anyAirborne(snap: Snapshot): boolean {
  return snap.aircraft.some((a) => a.airborne);
}
