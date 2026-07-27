// ADS-B feed adapters: adsb.fi (primary) + OpenSky (fallback).
// Polite usage: bbox query once per refresh, KV-cached upstream.

import { fleetHex } from "./seed";
import { getCatalog } from "./aircraft-data";
import { fetchOpenSky } from "./opensky";
import {
  DEFAULT_STATE_CODE,
  getAppState,
  type StateCode,
} from "./app-states";
import type {
  Aircraft,
  AircraftLive,
  FleetEntry,
  NormalizedAc,
  Snapshot,
} from "./types";

// State-centroid query covers all four corners of Washington within
// ~190 nm. adsb.fi v2 caps the radius at 250 nm (501+ returns HTTP 400),
// so this is the largest single-circle query the API allows. Registry-tail
// filtering downstream drops any non-fleet leakage from BC / OR / ID.
const FETCH_OPTS: RequestInit = {
  headers: { "User-Agent": "OutOfSight/0.1 (+https://github.com/)" },
  // Avoid Next.js's fetch caching layer — we cache ourselves.
  cache: "no-store",
};

// ─── adsb.fi ───────────────────────────────────────────────────────────────

// Top-level field is `aircraft`, NOT `ac` (adsbexchange uses `ac` —
// don't conflate them). Misreading this field caused every tail to
// classify as airborne:false from launch through 2026-04-30.
type AdsbFiResp = { aircraft?: NormalizedAc[]; now?: number };

async function fetchAdsbFi(stateCode: StateCode): Promise<NormalizedAc[]> {
  const state = getAppState(stateCode);
  const url = `https://opendata.adsb.fi/api/v2/lat/${state.centerLat}/lon/${state.centerLon}/dist/250`;
  const r = await fetch(url, FETCH_OPTS);
  if (!r.ok) throw new Error(`adsb.fi ${r.status}`);
  const j = (await r.json()) as AdsbFiResp;
  return j.aircraft ?? [];
}

// ─── Normalize + merge ─────────────────────────────────────────────────────

export async function buildSnapshot(
  stateCode: StateCode = DEFAULT_STATE_CODE,
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
    raw = await fetchAdsbFi(stateCode);
  } catch (e) {
    console.warn("[adsb] primary failed, falling back to OpenSky:", e);
    const primaryError = errorMessage(e);
    try {
      raw = await fetchOpenSky(fleetHexes);
      source = "opensky";
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

export function anyAirborne(snap: Snapshot): boolean {
  return snap.aircraft.some((a) => a.airborne);
}
