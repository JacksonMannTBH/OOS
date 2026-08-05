import { haversineNm } from "./geo";
import type { Aircraft } from "./types";

export type RideStatus = "clear" | "watch" | "warning" | "danger";

export type RideStatusThresholds = {
  watchNm: number;
  warningNm: number;
  stopNm: number;
};

export type RideContact = {
  plane: Aircraft;
  distanceNm: number;
  bearingDeg: number;
  relativeBearingDeg: number | null;
  cardinal: string;
};

export const DEFAULT_RIDE_STATUS_THRESHOLDS: RideStatusThresholds = {
  watchNm: 5,
  warningNm: 3,
  stopNm: 1,
};

export const RIDE_STATUS_LABELS: Record<RideStatus, string> = {
  clear: "Clear",
  watch: "Watch",
  warning: "Warning",
  danger: "Stop",
};

const MIN_RIDE_NM = 0.1;
const MAX_RIDE_NM = 50;
const MIN_RIDE_GAP_NM = 0.1;

export function normalizeDeg(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

export function bearingDeg(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
): number {
  const fromPhi = (fromLat * Math.PI) / 180;
  const toPhi = (toLat * Math.PI) / 180;
  const deltaLambda = ((toLon - fromLon) * Math.PI) / 180;
  const y = Math.sin(deltaLambda) * Math.cos(toPhi);
  const x =
    Math.cos(fromPhi) * Math.sin(toPhi) -
    Math.sin(fromPhi) * Math.cos(toPhi) * Math.cos(deltaLambda);
  return normalizeDeg((Math.atan2(y, x) * 180) / Math.PI);
}

export function relativeBearingDeg(
  aircraftBearingDeg: number,
  riderHeadingDeg: number,
): number {
  return normalizeDeg(aircraftBearingDeg - riderHeadingDeg);
}

export function cardinalFromDeg(degrees: number): string {
  const labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(normalizeDeg(degrees) / 45) % labels.length;
  return labels[index]!;
}

export function cardinalTrackFromDeg(degrees: number | null | undefined): "N" | "E" | "S" | "W" | null {
  if (typeof degrees !== "number" || !Number.isFinite(degrees)) return null;
  const labels = ["N", "E", "S", "W"] as const;
  const index = Math.round(normalizeDeg(degrees) / 90) % labels.length;
  return labels[index]!;
}

export function isSameCardinalTrack(
  aircraftHeadingDeg: number | null | undefined,
  riderHeadingDeg: number | null | undefined,
): boolean {
  const aircraftTrack = cardinalTrackFromDeg(aircraftHeadingDeg);
  const riderTrack = cardinalTrackFromDeg(riderHeadingDeg);
  return aircraftTrack != null && aircraftTrack === riderTrack;
}

export function normalizeRideStatusThresholds(
  thresholds?: Partial<RideStatusThresholds> | null,
): RideStatusThresholds {
  const stopNm = clampNm(
    thresholds?.stopNm,
    DEFAULT_RIDE_STATUS_THRESHOLDS.stopNm,
    MIN_RIDE_NM,
    MAX_RIDE_NM - MIN_RIDE_GAP_NM * 2,
  );
  const warningNm = clampNm(
    thresholds?.warningNm,
    DEFAULT_RIDE_STATUS_THRESHOLDS.warningNm,
    stopNm + MIN_RIDE_GAP_NM,
    MAX_RIDE_NM - MIN_RIDE_GAP_NM,
  );
  const watchNm = clampNm(
    thresholds?.watchNm,
    DEFAULT_RIDE_STATUS_THRESHOLDS.watchNm,
    warningNm + MIN_RIDE_GAP_NM,
    MAX_RIDE_NM,
  );

  return { watchNm, warningNm, stopNm };
}

export function classifyRideStatus(
  distanceNm: number | null,
  thresholds: RideStatusThresholds = DEFAULT_RIDE_STATUS_THRESHOLDS,
): RideStatus {
  const t = normalizeRideStatusThresholds(thresholds);
  if (distanceNm == null || distanceNm > t.watchNm) return "clear";
  if (distanceNm <= t.stopNm) return "danger";
  if (distanceNm <= t.warningNm) return "warning";
  return "watch";
}

export function rideStatusLabel(status: RideStatus): string {
  return RIDE_STATUS_LABELS[status];
}

export function rideStatusSeverity(status: RideStatus): number {
  switch (status) {
    case "danger":
      return 3;
    case "warning":
      return 2;
    case "watch":
      return 1;
    case "clear":
      return 0;
  }
}

function clampNm(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = typeof value === "number" ? value : Number(value);
  const n = Number.isFinite(raw) ? raw : fallback;
  const clamped = Math.max(min, Math.min(max, n));
  return Math.round(clamped * 10) / 10;
}

export function isRideRelevantAircraft(
  aircraft: Aircraft,
  _alertOnly = true,
): boolean {
  return aircraft.airborne;
}

export function getRideContacts(
  aircraft: Aircraft[],
  rider: { lat: number; lon: number },
  riderHeadingDeg: number | null = null,
  alertOnly = true,
): RideContact[] {
  const contacts: RideContact[] = [];
  for (const plane of aircraft) {
    if (plane.lat == null || plane.lon == null) continue;
    if (plane.airborne === false) continue;
    if (!isRideRelevantAircraft(plane, alertOnly)) continue;
    const bearing = bearingDeg(rider.lat, rider.lon, plane.lat, plane.lon);
    contacts.push({
      plane,
      distanceNm: haversineNm(rider.lat, rider.lon, plane.lat, plane.lon),
      bearingDeg: bearing,
      relativeBearingDeg:
        riderHeadingDeg == null ? null : relativeBearingDeg(bearing, riderHeadingDeg),
      cardinal: cardinalFromDeg(bearing),
    });
  }
  contacts.sort((a, b) => a.distanceNm - b.distanceNm);
  return contacts;
}
