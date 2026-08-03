// ADS-B feed adapters: adsb.fi (primary) + OpenSky (fallback).
// Public rendering uses a short local cache; ingestion uses rate-limited fleet
// batches so every scheduled sample reaches the upstream source.

import { fleetHex } from "./seed";
import { getAircraftCatalogEntries, getCatalog } from "./aircraft-data";
import { fetchOpenSky } from "./opensky";
import {
  APP_STATES,
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
const ADSB_FI_BATCH_SIZE = 75;
const ADSB_FI_REQUEST_SPACING_MS = 1_100;
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

export function chunkIcaoHexes(
  hexes: string[],
  batchSize = ADSB_FI_BATCH_SIZE,
): string[][] {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("ICAO batch size must be a positive integer");
  }

  const unique = [...new Set(
    hexes
      .map((hex) => hex.trim().toLowerCase())
      .filter((hex) => /^[0-9a-f]{6}$/.test(hex)),
  )];
  const batches: string[][] = [];
  for (let index = 0; index < unique.length; index += batchSize) {
    batches.push(unique.slice(index, index + batchSize));
  }
  return batches;
}

async function fetchAdsbFiBatches(hexes: string[]): Promise<NormalizedAc[]> {
  const batches = chunkIcaoHexes(hexes);
  const aircraft: NormalizedAc[] = [];
  let previousRequestStartedAt = 0;

  for (const batch of batches) {
    if (previousRequestStartedAt > 0) {
      const elapsed = Date.now() - previousRequestStartedAt;
      if (elapsed < ADSB_FI_REQUEST_SPACING_MS) {
        await wait(ADSB_FI_REQUEST_SPACING_MS - elapsed);
      }
    }
    previousRequestStartedAt = Date.now();
    aircraft.push(...await fetchAdsbFi(batch));
  }

  return aircraft;
}

export function normalizeAdsbFiPayload(payload: unknown): NormalizedAc[] {
  if (!isRecord(payload)) return [];
  const sourceNowMs = normalizeEpochMilliseconds(payload.now) ?? Date.now();
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
      observed_at_ms: sourceNowMs - Math.max(0, seenSeconds ?? 0) * 1_000,
      position_observed_at_ms:
        positionIsCurrent && finiteNumber(value.lat) != null && finiteNumber(value.lon) != null
          ? sourceNowMs - Math.max(0, seenPositionSeconds ?? seenSeconds ?? 0) * 1_000
          : undefined,
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

/**
 * Fetch the complete active catalog in a small number of rate-limited ICAO
 * batches. The ingestion worker uses this uncached path so each scheduled
 * sample represents a genuinely new upstream observation.
 */
export async function buildFleetSnapshot(
  stateCodes: readonly StateCode[] = APP_STATES.map((state) => state.code),
): Promise<Snapshot> {
  const allowedStates = new Set(stateCodes);
  const catalog = (await getAircraftCatalogEntries())
    .filter((item) => allowedStates.has(item.homeStateCode));
  const fleet = catalog.map((item) => item.aircraft);
  const homeStateByTail = new Map(
    catalog.map((item) => [item.aircraft.tail.toUpperCase(), item.homeStateCode]),
  );
  const fleetHexes = fleet
    .map((entry) => fleetHex(entry))
    .filter((hex) => /^[0-9a-f]{6}$/i.test(hex));
  const live = await fetchLiveAircraft(fleetHexes, true);

  return joinFleetWithLiveData(fleet, homeStateByTail, live);
}

async function buildSnapshotUncached(
  stateCode: StateCode,
): Promise<Snapshot> {
  const fleet = await getCatalog(stateCode);
  const homeStateByTail = new Map(
    fleet.map((entry) => [entry.tail.toUpperCase(), stateCode]),
  );
  const fleetHexes = fleet.map((entry) => fleetHex(entry)).filter(Boolean);
  const live = await fetchLiveAircraft(fleetHexes, false);

  return joinFleetWithLiveData(fleet, homeStateByTail, live);
}

type LiveAircraftResult = {
  raw: NormalizedAc[];
  source: Snapshot["source"];
  sourceOk: boolean;
  sourceError?: string;
};

async function fetchLiveAircraft(
  fleetHexes: string[],
  batched: boolean,
): Promise<LiveAircraftResult> {
  let raw: NormalizedAc[] = [];
  let source: Snapshot["source"] = "adsbfi";
  let sourceOk = true;
  let sourceError: string | undefined;
  try {
    raw = batched
      ? await fetchAdsbFiBatches(fleetHexes)
      : await fetchAdsbFi(fleetHexes);
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

  return { raw, source, sourceOk, sourceError };
}

function joinFleetWithLiveData(
  fleet: FleetEntry[],
  homeStateByTail: ReadonlyMap<string, StateCode>,
  live: LiveAircraftResult,
): Snapshot {
  const { raw, source, sourceOk, sourceError } = live;
  const fetchedAt = Date.now();
  const fleetByIcao = new Map<string, FleetEntry>();
  for (const entry of fleet) {
    const hex = fleetHex(entry).toLowerCase();
    if (hex) fleetByIcao.set(hex, entry);
  }

  const liveByIcao = new Map<string, NormalizedAc>();
  for (const ac of raw) {
    const hex = ac.hex.toLowerCase();
    if (fleetByIcao.has(hex)) liveByIcao.set(hex, ac);
  }

  const aircraft: Aircraft[] = fleet.map((entry) => {
    const hex = fleetHex(entry).toLowerCase();
    const homeStateCode =
      homeStateByTail.get(entry.tail.toUpperCase()) ?? DEFAULT_STATE_CODE;
    const ac = liveByIcao.get(hex);
    if (!ac) {
      const live: AircraftLive = {
        tail: entry.tail,
        icao24: hex,
        observed: false,
        airborne: false,
        home_state_code: homeStateCode,
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
      observed_at: boundedIsoTimestamp(ac.observed_at_ms, fetchedAt),
      position_observed_at:
        ac.lat != null && ac.lon != null
          ? boundedIsoTimestamp(
              ac.position_observed_at_ms ?? ac.observed_at_ms,
              fetchedAt,
            )
          : null,
      airborne: !grounded,
      home_state_code: homeStateCode,
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
    fetched_at: fetchedAt,
    source,
    source_ok: sourceOk,
    source_error: sourceError,
    aircraft,
    live_seen_count: raw.length,
  };
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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

function normalizeEpochMilliseconds(value: unknown): number | undefined {
  const timestamp = finiteNumber(value);
  if (timestamp == null || timestamp <= 0) return undefined;
  return timestamp >= 1_000_000_000_000 ? timestamp : timestamp * 1_000;
}

function boundedIsoTimestamp(
  timestampMs: number | undefined,
  fetchedAt: number,
): string {
  const safeTimestamp =
    timestampMs != null && Number.isFinite(timestampMs) && timestampMs > 0
      ? Math.min(timestampMs, fetchedAt)
      : fetchedAt;
  return new Date(safeTimestamp).toISOString();
}

export function anyAirborne(snap: Snapshot): boolean {
  return snap.aircraft.some((a) => a.airborne);
}
