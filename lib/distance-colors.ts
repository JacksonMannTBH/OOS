import { getDevicePreference, updateDevicePreferences } from "./device-preferences";
import { DEFAULT_DISTANCE_PALETTE, DISTANCE_STATES, distancePalette, isDistancePalette, type DistancePalette } from "./distance-color-palette";

export const DISTANCE_PALETTE_KEY = "oos_distance_palette";
export const DISTANCE_PALETTE_EVENT = "oos-distance-palette-change";

export function readDistancePalette(): DistancePalette {
  if (typeof window === "undefined") return DEFAULT_DISTANCE_PALETTE;
  const saved = getDevicePreference(DISTANCE_PALETTE_KEY);
  return isDistancePalette(saved) ? saved : DEFAULT_DISTANCE_PALETTE;
}

export function applyDistancePalette(value: DistancePalette): void {
  const palette = distancePalette(value);
  for (const element of [document.documentElement, document.body]) {
    element.dataset.distancePalette = value;
    for (const state of DISTANCE_STATES) element.style.setProperty(`--ss-distance-${state}`, palette.colors[state]);
  }
}

export async function writeDistancePalette(value: DistancePalette): Promise<void> {
  await updateDevicePreferences({ [DISTANCE_PALETTE_KEY]: value });
  applyDistancePalette(value);
  window.dispatchEvent(new Event(DISTANCE_PALETTE_EVENT));
}
