import { FLEET, fleetHex } from "./seed";
import { stateIdForOpsAircraftTail } from "./aircraft-directory";

export const TRIAL_INTERVAL_MS = 30_000;
const MAX_AGE_MS = 60_000;
export type TrialState = "WA" | "CA";
type Observation = {
  observedAt: number;
  positionAt: number | null;
  lat: number | null;
  lon: number | null;
  altitudeFeet: number | null;
  speedKnots: number | null;
  headingDegrees: number | null;
  ground: boolean | null;
  squawk: string | null;
};

export const trialCatalog = FLEET.flatMap((aircraft) => {
  const state = stateIdForOpsAircraftTail(aircraft.tail) ?? "washington";
  if (state !== "washington" && state !== "california") return [];
  return [{
    tail: aircraft.tail, hex: fleetHex(aircraft),
    state: (state === "washington" ? "WA" : "CA") as TrialState,
    operator: aircraft.operator, model: aircraft.model,
  }];
});

const finite = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export function parseTrialPayload(payload: unknown, receivedAt: number): Map<string, Observation> {
  if (!record(payload) || !Array.isArray(payload.ac) || finite(payload.now) === null) {
    throw new Error("Invalid ADSB.lol response: expected ac array and timestamp");
  }
  if (payload.msg != null && payload.msg !== "No error") {
    throw new Error(`ADSB.lol: ${String(payload.msg)}`);
  }
  const rawNow = payload.now as number;
  const sourceNow = rawNow < 1e12 ? rawNow * 1000 : rawNow;
  if (sourceNow > receivedAt + MAX_AGE_MS) throw new Error("ADSB.lol timestamp is in the future");
  const observations = new Map<string, Observation>();
  for (const row of payload.ac) {
    if (!record(row) || typeof row.hex !== "string") continue;
    const seen = finite(row.seen);
    if (seen === null || seen < 0) continue;
    const positionAge = finite(row.seen_pos);
    const lat = finite(row.lat);
    const lon = finite(row.lon);
    const validPosition = lat !== null && lon !== null && Math.abs(lat) <= 90 &&
      Math.abs(lon) <= 180 && positionAge !== null && positionAge >= 0;
    observations.set(row.hex.toLowerCase(), {
      observedAt: sourceNow - seen * 1000,
      positionAt: validPosition ? sourceNow - positionAge! * 1000 : null,
      lat: validPosition ? lat : null, lon: validPosition ? lon : null,
      altitudeFeet: finite(row.alt_baro), speedKnots: finite(row.gs),
      headingDegrees: finite(row.track),
      ground: row.alt_baro === "ground" ? true : finite(row.alt_baro) !== null ? false : null,
      squawk: typeof row.squawk === "string" ? row.squawk : null,
    });
  }
  return observations;
}

export class AdsbLolTrial {
  private observations = new Map<string, Observation>();
  private busy = false;
  private failures = 0;
  private attempts = 0;
  private successes = 0;
  private nextRequestAt = 0;
  private lastSuccessAt: number | null = null;
  private lastRequestAt: number | null = null;
  private lastDurationMs: number | null = null;
  private error: string | null = null;
  private readonly hexes = [...new Set(trialCatalog.map((entry) => entry.hex))];

  constructor(private readonly fetcher: typeof fetch = fetch, private readonly now = Date.now) {
    if (!this.hexes.length || this.hexes.some((hex) => !/^[a-f0-9]{6}$/.test(hex))) {
      throw new Error("Trial catalog contains missing or invalid aircraft identifiers");
    }
  }

  async poll(): Promise<boolean> {
    const startedAt = this.now();
    if (this.busy || startedAt < this.nextRequestAt) return false;
    this.busy = true;
    this.lastRequestAt = startedAt;
    this.nextRequestAt = startedAt + TRIAL_INTERVAL_MS;
    this.attempts += 1;
    let retryAfterMs = 0;
    try {
      const response = await this.fetcher(`https://api.adsb.lol/v2/icao/${this.hexes.join(",")}`, {
        headers: { "User-Agent": "OutOfSight-ADSBTrial/0.1", Accept: "application/json" },
        signal: AbortSignal.timeout(10_000), cache: "no-store",
      });
      if (!response.ok) {
        const retry = response.headers.get("retry-after");
        if (retry !== null) {
          retryAfterMs = /^\d+(\.\d+)?$/.test(retry) ? Number(retry) * 1000 :
            Math.max(0, Date.parse(retry) - this.now()) || 0;
        }
        throw new Error(`ADSB.lol HTTP ${response.status}`);
      }
      this.observations = parseTrialPayload(await response.json(), this.now());
      this.lastSuccessAt = this.now();
      this.successes += 1;
      this.failures = 0;
      this.error = null;
    } catch (error) {
      this.failures += 1;
      this.error = error instanceof Error ? error.message : String(error);
      this.nextRequestAt = this.now() + Math.max(retryAfterMs,
        Math.min(300_000, TRIAL_INTERVAL_MS * 2 ** Math.min(this.failures, 4)));
    } finally {
      this.lastDurationMs = this.now() - startedAt;
      this.busy = false;
    }
    return true;
  }

  snapshot(state?: TrialState) {
    const now = this.now();
    const aircraft = trialCatalog.filter((entry) => !state || entry.state === state).map((entry) => {
      const observation = this.observations.get(entry.hex);
      const fresh = !!observation && now - observation.observedAt <= MAX_AGE_MS;
      const positionFresh = fresh && observation.positionAt !== null && now - observation.positionAt <= MAX_AGE_MS;
      return {
        ...entry, status: fresh ? "observed" : "unknown",
        observedAt: observation ? new Date(observation.observedAt).toISOString() : null,
        observationAgeSeconds: observation ? Math.max(0, (now - observation.observedAt) / 1000) : null,
        position: positionFresh ? { lat: observation.lat, lon: observation.lon,
          observedAt: new Date(observation.positionAt!).toISOString() } : null,
        altitudeFeet: fresh ? observation.altitudeFeet : null,
        speedKnots: fresh ? observation.speedKnots : null,
        headingDegrees: fresh ? observation.headingDegrees : null,
        ground: fresh ? observation.ground : null,
      };
    });
    return {
      source: "ADSB.lol", attribution: "https://www.adsb.lol", license: "ODbL-1.0",
      scope: "OOS bundled public-safety aircraft catalog, by home state",
      intervalSeconds: TRIAL_INTERVAL_MS / 1000,
      generatedAt: new Date(now).toISOString(),
      healthy: this.error === null && this.lastSuccessAt !== null && now - this.lastSuccessAt <= MAX_AGE_MS,
      lastRequestAt: this.lastRequestAt === null ? null : new Date(this.lastRequestAt).toISOString(),
      lastSuccessAt: this.lastSuccessAt === null ? null : new Date(this.lastSuccessAt).toISOString(),
      nextRequestAt: new Date(this.nextRequestAt).toISOString(),
      lastDurationMs: this.lastDurationMs, error: this.error,
      attempts: this.attempts, successes: this.successes,
      counts: {
        catalog: aircraft.length, observed: aircraft.filter((row) => row.status === "observed").length,
        positioned: aircraft.filter((row) => row.position !== null).length,
        WA: aircraft.filter((row) => row.state === "WA").length,
        CA: aircraft.filter((row) => row.state === "CA").length,
      },
      aircraft,
    };
  }
}
