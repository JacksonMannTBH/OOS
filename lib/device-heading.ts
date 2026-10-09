import { normalizeDeg } from "./ride-mode";

export function finiteHeading(value: unknown): number | null {
  // Missing or invalid sensor values must not become north.
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return normalizeDeg(value);
}

export function headingFromOrientationEvent(event: {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
  alpha: number | null;
  absolute: boolean;
}): number | null {
  const compass = finiteHeading(event.webkitCompassHeading);
  if (compass != null && !(typeof event.webkitCompassAccuracy === "number" && event.webkitCompassAccuracy < 0)) return compass;
  const alpha = finiteHeading(event.alpha);
  return alpha != null && event.absolute ? normalizeDeg(360 - alpha) : null;
}
