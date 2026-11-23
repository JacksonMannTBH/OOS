export type TintedColorMode = "red" | "blue" | "green";
export type ColorMode = "color" | "monochrome" | TintedColorMode;
type RGB = readonly [number, number, number];

export const MODE_ACCENTS = {
  red: [229, 57, 53],
  blue: [47, 128, 237],
  green: [30, 215, 96],
} as const satisfies Record<TintedColorMode, RGB>;

export const COLOR_MODE_OPTIONS = [
  { value: "color", label: "Color", swatch: "#f6c431" },
  { value: "monochrome", label: "Black & white", swatch: "#f5f5f5" },
  ...(["red", "blue", "green"] as const).map(value => ({
    value,
    label: value.charAt(0).toUpperCase() + value.slice(1),
    swatch: `rgb(${MODE_ACCENTS[value].join(",")})`,
  })),
] as const;

export function isColorMode(value: unknown): value is ColorMode {
  return COLOR_MODE_OPTIONS.some(option => option.value === value);
}

export function isTintedColorMode(mode: ColorMode): mode is TintedColorMode {
  return mode === "red" || mode === "blue" || mode === "green";
}

// These are existing gold-tinted surfaces and highlights, not neutral text or
// unrelated status colors. Keep their original light/dark range in each mode.
const SAFFRON_SHADES = {
  "--ss-ui-14130d": [20, 19, 13],
  "--ss-ui-15150f": [21, 21, 15],
  "--ss-ui-17150d": [23, 21, 13],
  "--ss-ui-1b1608": [27, 22, 8],
  "--ss-ui-1c1a10": [28, 26, 16],
  "--ss-ui-24200f": [36, 32, 15],
  "--ss-ui-242011": [36, 32, 17],
  "--ss-ui-292313": [41, 35, 19],
  "--ss-ui-fff4c6": [255, 244, 198],
} as const satisfies Record<string, RGB>;
const ACCENT_PROPERTIES = ["--ss-ui-f4c430", "--ss-ui-f6c431"] as const;
export const TINTED_UI_PROPERTIES = [...ACCENT_PROPERTIES, ...Object.keys(SAFFRON_SHADES)];

export function tintedUIVariables(mode: TintedColorMode): Record<string, string> {
  const accent = MODE_ACCENTS[mode].join(", ");
  const variables = Object.fromEntries(ACCENT_PROPERTIES.map(property => [property, accent]));
  for (const [property, original] of Object.entries(SAFFRON_SHADES)) {
    const low = Math.min(...original);
    const scale = (Math.max(...original) - low) / (246 - 49);
    variables[property] = MODE_ACCENTS[mode].map(channel =>
      Math.round(Math.max(0, Math.min(255, low + (channel - 49) * scale)))).join(", ");
  }
  return variables;
}
