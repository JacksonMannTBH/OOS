import type { TrackPoint } from "./tracks";

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
