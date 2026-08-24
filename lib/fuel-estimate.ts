import { AIRCRAFT_DURATION_MINUTES } from "./aircraft-directory";

export type FuelProfile = {
  /**
   * Mean maximum flight duration for this aircraft, in minutes.
   * When public references give a range, this is the midpoint of that range.
   */
  meanMaxDurationMin: number;
};

export type FuelEstimateAircraft = {
  tail?: string | null;
  airborne?: boolean | null;
  altitude_ft?: number | null;
  ground_speed_kt?: number | null;
  heading?: number | null;
  /** Exact detected takeoff instant, expressed as ISO-8601 or epoch ms. */
  detected_takeoff_at?: string | number | null;
  /** Confidence assigned by the flight-lifecycle detector. */
  takeoff_confidence?: "low" | "medium" | "high" | null;
  /** Exact instant through which this estimate is current, ISO-8601 or epoch ms. */
  as_of?: string | number | null;
  /**
   * Legacy, minute-precision duration. Retained in the input shape so older
   * callers remain structurally compatible, but it is not precise enough to
   * produce a confidence-aware endurance estimate.
   */
  time_aloft_min?: number | null;
  starting_fuel_estimate_gal?: number | null;
  usable_fuel_gallons?: number | null;
  nominal_endurance_min?: number | null;
  reserve_min?: number | null;
};

export type FuelEstimateBasis = "catalog_upper_bound";

export type FuelEstimateResult = {
  /** Catalog endurance minus exact elapsed time; this is an upper bound. */
  minutesRemaining: number;
  remainingSeconds: number;
  elapsedMinutes: number;
  elapsedSeconds: number;
  catalogUpperBoundMinutes: number;
  basis: FuelEstimateBasis;
  /** @deprecated Use catalogUpperBoundMinutes. */
  maxDurationMinutes: number;
  label: string;
  profile: FuelProfile;
};

export const FUEL_PROFILES: Record<string, FuelProfile> = {
  N102LP: { meanMaxDurationMin: 360 },
  N207HB: { meanMaxDurationMin: 372 }, // mean of 5.4-7.0 hours
  N2446X: { meanMaxDurationMin: 420 }, // mean of 6-8 hour mission profile
  N305DK: { meanMaxDurationMin: 420 }, // mean of 6-8 hour mission profile
  N305RC: { meanMaxDurationMin: 360 },
  N3532K: { meanMaxDurationMin: 360 },
  N407KS: { meanMaxDurationMin: 240 },
  N411KS: { meanMaxDurationMin: 189 }, // mean of 3.0-3.3 hours
  N67817: { meanMaxDurationMin: 189 }, // mean of 3.0-3.3 hours
  N67880: { meanMaxDurationMin: 189 }, // mean of 3.0-3.3 hours
  N78906: { meanMaxDurationMin: 189 }, // mean of 3.0-3.3 hours
  N790RJ: { meanMaxDurationMin: 150 },
  N815SC: { meanMaxDurationMin: 150 },
  N9446P: { meanMaxDurationMin: 282 }, // mean of 4.4-5.0 hours
  N422CT: { meanMaxDurationMin: 240 },
  ...Object.fromEntries(
    Object.entries(AIRCRAFT_DURATION_MINUTES).map(([tail, minutes]) => [
      tail,
      { meanMaxDurationMin: minutes },
    ]),
  ),
};

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeTailNumber(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "");
  return normalized.length > 0 ? normalized : null;
}

export function getAircraftFuelProfile(
  tailNumber: unknown,
): FuelProfile | null {
  const normalized = normalizeTailNumber(tailNumber);
  if (!normalized) return null;
  return FUEL_PROFILES[normalized] ?? null;
}

export function formatFuelRemaining(totalMinutes: number): string {
  return formatFuelRemainingSeconds((safeNumber(totalMinutes) ?? 0) * 60);
}

function formatFuelRemainingSeconds(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(safeNumber(totalSeconds) ?? 0));
  const safeMinutes = Math.floor(safeSeconds / 60);
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `Est. ${hours}h ${minutes}min`;
}

export function estimateFuelRemaining(
  aircraft: FuelEstimateAircraft,
): FuelEstimateResult | null {
  const databaseDuration = safeNumber(aircraft.nominal_endurance_min);
  const profile =
    databaseDuration && databaseDuration > 0
      ? { meanMaxDurationMin: databaseDuration }
      : getAircraftFuelProfile(aircraft.tail);
  if (!profile) return null;
  if (!isAircraftAirborne(aircraft)) return null;

  if (
    aircraft.takeoff_confidence !== "medium" &&
    aircraft.takeoff_confidence !== "high"
  ) {
    return null;
  }

  const takeoffAtMs = timestampMs(aircraft.detected_takeoff_at);
  const asOfMs = timestampMs(aircraft.as_of);
  if (takeoffAtMs == null || asOfMs == null || asOfMs < takeoffAtMs) {
    return null;
  }

  const elapsedSeconds = (asOfMs - takeoffAtMs) / 1_000;
  const catalogUpperBoundSeconds = profile.meanMaxDurationMin * 60;
  const remainingSeconds = clamp(
    catalogUpperBoundSeconds - elapsedSeconds,
    0,
    catalogUpperBoundSeconds,
  );
  const elapsedMinutes = elapsedSeconds / 60;
  const minutesRemaining = remainingSeconds / 60;

  return {
    minutesRemaining,
    remainingSeconds,
    elapsedMinutes,
    elapsedSeconds,
    catalogUpperBoundMinutes: profile.meanMaxDurationMin,
    basis: "catalog_upper_bound",
    maxDurationMinutes: profile.meanMaxDurationMin,
    label: formatFuelRemainingSeconds(remainingSeconds),
    profile,
  };
}

function safeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function timestampMs(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isAircraftAirborne(aircraft: FuelEstimateAircraft): boolean {
  if (aircraft.airborne === true) return true;
  if (aircraft.airborne === false) return false;
  const altitudeFt = safeNumber(aircraft.altitude_ft);
  const speedKts = safeNumber(aircraft.ground_speed_kt);
  return (altitudeFt != null && altitudeFt > 0) || (speedKts != null && speedKts > 30);
}
