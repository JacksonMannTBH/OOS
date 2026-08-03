export const DEFAULT_AIRCRAFT_SAMPLE_INTERVAL_MS = 10_000;
export const MIN_AIRCRAFT_SAMPLE_INTERVAL_MS = 5_000;
export const MAX_AIRCRAFT_SAMPLE_INTERVAL_MS = 60_000;
export const AIRCRAFT_SAMPLE_WINDOW_MS = 60_000;

export function normalizeAircraftSampleInterval(
  value: string | number | null | undefined,
): number {
  const configured = Number(value);
  if (
    Number.isInteger(configured) &&
    configured >= MIN_AIRCRAFT_SAMPLE_INTERVAL_MS &&
    configured <= MAX_AIRCRAFT_SAMPLE_INTERVAL_MS
  ) {
    return configured;
  }
  return DEFAULT_AIRCRAFT_SAMPLE_INTERVAL_MS;
}

export function buildSampleOffsets(
  intervalMs: number,
  windowMs = AIRCRAFT_SAMPLE_WINDOW_MS,
): number[] {
  if (!Number.isInteger(intervalMs) || intervalMs < 1) {
    throw new Error("Sample interval must be a positive integer");
  }
  const offsets: number[] = [];
  for (let offset = 0; offset < windowMs; offset += intervalMs) {
    offsets.push(offset);
  }
  return offsets;
}
