import type { FleetRole } from "@/lib/types";

// Keep the slot count/order stable so only aircraft assigned the removed
// amber/yellow colors change. Roads retain those hues; aircraft use other ones.
export const AIRCRAFT_PATH_COLORS = [
  "#ff8a3d",
  "#4da3ff",
  "#2dd4a3",
  "#e879f9",
  "#e2e8f0",
  "#22d3ee",
  "#fb7185",
  "#a78bfa",
  "#a3e635",
  "#f87171",
  "#2dd4bf",
  "#818cf8",
  "#f472b6",
  "#c084fc",
  "#38bdf8",
  "#34d399",
] as const;

export const PLANE_COLOR_INDEX = 1;
export const HELICOPTER_COLOR_INDEX = 7;

export function aircraftColorIndexForRole(
  role: FleetRole | "unknown" | null | undefined,
): number {
  return role === "patrol" || role === "sar"
    ? HELICOPTER_COLOR_INDEX
    : PLANE_COLOR_INDEX;
}

export function aircraftColorForRole(
  role: FleetRole | "unknown" | null | undefined,
): string {
  return AIRCRAFT_PATH_COLORS[aircraftColorIndexForRole(role)]!;
}

export function aircraftColorIndex(tail: string | null | undefined): number {
  const text = (tail ?? "").toUpperCase();
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash % AIRCRAFT_PATH_COLORS.length;
}

export function aircraftColorForTail(tail: string | null | undefined): string {
  return AIRCRAFT_PATH_COLORS[aircraftColorIndex(tail)]!;
}
