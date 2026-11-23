import { getDevicePreference, updateDevicePreferences } from "./device-preferences";
import { isColorMode, isTintedColorMode, tintedUIVariables, TINTED_UI_PROPERTIES, type ColorMode } from "./color-mode-palette";

export type { ColorMode } from "./color-mode-palette";
export const COLOR_MODE_KEY = "oos_color_mode";
export const COLOR_MODE_EVENT = "oos-color-mode-change";
export const DEFAULT_COLOR_MODE: ColorMode = "color";

export function readColorMode(): ColorMode {
  if (typeof window === "undefined") return DEFAULT_COLOR_MODE;
  const saved = getDevicePreference(COLOR_MODE_KEY);
  return isColorMode(saved) ? saved : DEFAULT_COLOR_MODE;
}

export function applyColorMode(mode: ColorMode): void {
  const variables = isTintedColorMode(mode) ? tintedUIVariables(mode) : {};
  for (const element of [document.documentElement, document.body]) {
    for (const property of TINTED_UI_PROPERTIES) {
      const value = variables[property];
      if (value) element.style.setProperty(property, value);
      else element.style.removeProperty(property);
    }
    element.dataset.colorMode = mode;
  }
}

export async function writeColorMode(mode: ColorMode): Promise<void> {
  await updateDevicePreferences({ [COLOR_MODE_KEY]: mode });
  applyColorMode(mode);
  window.dispatchEvent(new Event(COLOR_MODE_EVENT));
}
