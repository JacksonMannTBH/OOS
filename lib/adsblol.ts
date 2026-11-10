import { isSupportedStateCode } from "./app-states";
import { parseTrialPayload } from "./adsblol-trial";
import { fleetHex } from "./seed";
import type { AircraftCatalogEntry } from "./aircraft-data";
import type { Aircraft, Snapshot } from "./types";

export class AdsbLolError extends Error {
  constructor(message: string, public readonly retryAfterMs = 0) { super(message); }
}

export async function fetchAdsbLolSnapshot(
  catalog: AircraftCatalogEntry[], fetcher: typeof fetch = fetch,
): Promise<Snapshot> {
  const entries = catalog.filter((entry) => isSupportedStateCode(entry.homeStateCode));
  const hexes = [...new Set(entries.map((entry) => fleetHex(entry.aircraft)))];
  if (!hexes.length || hexes.some((hex) => !/^[a-f0-9]{6}$/.test(hex))) {
    throw new Error("Supported-state catalog contains missing or invalid aircraft identifiers");
  }
  const response = await fetcher(`https://api.adsb.lol/v2/icao/${hexes.join(",")}`, {
    headers: { Accept: "application/json", "User-Agent": "OutOfSight/ADSB.lol-backend" },
    cache: "no-store", signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const header = response.headers.get("retry-after");
    const delay = header === null ? 0 : /^\d+(\.\d+)?$/.test(header)
      ? Number(header) * 1000 : Math.max(0, Date.parse(header) - Date.now()) || 0;
    throw new AdsbLolError(`ADSB.lol HTTP ${response.status}`, delay);
  }
  const payload = await response.json();
  const now = Date.now();
  const observations = parseTrialPayload(payload, now);
  // A successful HTTP response with an old provider timestamp is still a failed sample.
  const sourceNow = payload.now < 1e12 ? payload.now * 1000 : payload.now;
  if (now - sourceNow > 60_000) throw new AdsbLolError("ADSB.lol returned an outdated snapshot");
  const aircraft: Aircraft[] = entries.map(({ aircraft, homeStateCode }) => {
    const hex = fleetHex(aircraft);
    const observation = observations.get(hex);
    const base = { ...aircraft, icao24: hex, home_state_code: homeStateCode };
    if (!observation || now - observation.observedAt > 60_000) {
      return { ...base, observed: false, airborne: false, observation_status: "unknown", last_seen_min: null };
    }
    const positionFresh = observation.positionAt !== null && now - observation.positionAt <= 60_000;
    return {
      ...base, observed: true, observed_at: new Date(observation.observedAt).toISOString(),
      airborne: observation.ground === false,
      observation_status: observation.ground === true ? "grounded" : observation.ground === false ? "airborne_candidate" : "unknown",
      position_observed_at: positionFresh ? new Date(observation.positionAt!).toISOString() : null,
      lat: positionFresh ? observation.lat ?? undefined : undefined,
      lon: positionFresh ? observation.lon ?? undefined : undefined,
      altitude_ft: observation.altitudeFeet ?? undefined,
      ground_speed_kt: observation.speedKnots ?? undefined,
      heading: observation.headingDegrees ?? undefined,
      squawk: observation.squawk,
      last_seen_min: Math.max(0, (now - observation.observedAt) / 60_000),
    };
  });
  return { source: "adsblol", source_ok: true, fetched_at: now, aircraft,
    live_seen_count: aircraft.filter((row) => row.observed).length };
}
