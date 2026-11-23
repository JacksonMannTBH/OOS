export const DISTANCE_STATES = ["clear", "watch", "warning", "danger"] as const;
export type DistanceColorState = typeof DISTANCE_STATES[number];

export const DISTANCE_PALETTES = [
  { id: "classic", label: "Classic", colors: { clear: "#39d98a", watch: "#60a5fa", warning: "#f6c431", danger: "#ff4d4f" } },
  { id: "ocean", label: "Ocean", colors: { clear: "#62d0ff", watch: "#9a9cff", warning: "#ffb454", danger: "#ff6080" } },
  { id: "sunset", label: "Sunset", colors: { clear: "#78d6ba", watch: "#f2cf66", warning: "#ff9654", danger: "#f76fa0" } },
  { id: "electric", label: "Electric", colors: { clear: "#b6f35d", watch: "#3bd9ec", warning: "#ffd24a", danger: "#ff5353" } },
  { id: "frost", label: "Frost", colors: { clear: "#a5d3d8", watch: "#96a8d6", warning: "#dfbd86", danger: "#e37a72" } },
] as const;

export type DistancePalette = typeof DISTANCE_PALETTES[number]["id"];
export const DEFAULT_DISTANCE_PALETTE: DistancePalette = "classic";

export function isDistancePalette(value: unknown): value is DistancePalette {
  return DISTANCE_PALETTES.some(palette => palette.id === value);
}

export function distancePalette(value: DistancePalette) {
  return DISTANCE_PALETTES.find(palette => palette.id === value)!;
}

// Keep distance alerts independent of the app's accent and unrelated statuses.
export const DISTANCE_STATUS_COLORS: Record<DistanceColorState, string> = Object.fromEntries(
  DISTANCE_STATES.map(state => [state, `var(--ss-distance-${state}, ${DISTANCE_PALETTES[0].colors[state]})`]),
) as Record<DistanceColorState, string>;
