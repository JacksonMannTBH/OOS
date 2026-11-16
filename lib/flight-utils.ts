import type { TrackPoint } from "./tracks";
import type { AircraftLive } from "./types";

export type CurrentFlightTime = {
  seconds: number;
  basis: "takeoff" | "tracking" | "reported";
};

/** Missing takeoff confirmation must not hide the known current-flight duration. */
export function getCurrentFlightTime(
  aircraft: AircraftLive,
  snapshotAt: number,
): CurrentFlightTime | null {
  if (!aircraft.airborne && !aircraft.last_known_airborne) return null;
  const timestamp = (value: unknown): number | null => {
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Date.parse(value) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  };
  // A last-known flight freezes at its observation; an active one uses server time.
  const end = (aircraft.last_known_airborne ? timestamp(aircraft.observed_at) : null)
    ?? timestamp(aircraft.as_of) ?? snapshotAt;
  const confirmedTakeoff = aircraft.takeoff_confidence === "medium" || aircraft.takeoff_confidence === "high";
  const starts = [
    { at: confirmedTakeoff ? timestamp(aircraft.detected_takeoff_at) : null, basis: "takeoff" },
    { at: timestamp(aircraft.tracking_started_at), basis: "tracking" },
  ] as const;
  for (const { at, basis } of starts) {
    if (at != null && Number.isFinite(end) && end >= at) {
      return { seconds: Math.floor((end - at) / 1_000), basis };
    }
  }
  const reported = aircraft.time_aloft_min;
  return typeof reported === "number" && Number.isFinite(reported) && reported >= 0
    ? { seconds: Math.floor(reported * 60), basis: "reported" }
    : null;
}

export function averageGroundSpeedKt(points: TrackPoint[]): number | null {
  const validSpeeds = points
    .map((point) => point.spd)
    .filter(
      (speed): speed is number =>
        typeof speed === "number" && Number.isFinite(speed) && speed >= 0,
    );
  if (validSpeeds.length === 0) return null;

  let weightedSpeedSeconds = 0;
  let totalSeconds = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    if (
      typeof previous.spd !== "number" ||
      typeof current.spd !== "number" ||
      !Number.isFinite(previous.spd) ||
      !Number.isFinite(current.spd)
    ) {
      continue;
    }
    const seconds = current.ts - previous.ts;
    if (seconds <= 0) continue;
    weightedSpeedSeconds += ((previous.spd + current.spd) / 2) * seconds;
    totalSeconds += seconds;
  }
  return totalSeconds > 0
    ? weightedSpeedSeconds / totalSeconds
    : validSpeeds.reduce((sum, speed) => sum + speed, 0) /
        validSpeeds.length;
}

export function flightIdFromTs(tsMs: number): string {
  const date = new Date(tsMs);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}${month}${day}T${hour}${minute}`;
}

export function parseFlightId(
  flightId: string,
): { dateKey: string; tsMs: number } | null {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})$/.exec(flightId);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const tsMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  return Number.isFinite(tsMs)
    ? { dateKey: `${year}${month}${day}`, tsMs }
    : null;
}
