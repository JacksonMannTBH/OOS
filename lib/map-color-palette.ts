import type { Map, StyleSpecification } from "maplibre-gl";
import { MODE_ACCENTS, type ColorMode } from "./color-mode-palette";

const BASEMAP_COLORS = "oos:basemap-colors";

const brightness = (red: number, green: number, blue: number) => red * 0.2126 + green * 0.7152 + blue * 0.0722;
const ROAD_BRIGHTNESS = brightness(246, 196, 49);

function modeColor(mode: Exclude<ColorMode, "color">, red: number, green: number, blue: number, alpha = 1): string | null {
  const level = brightness(red, green, blue);
  if (mode === "monochrome") {
    const gray = Math.round(level);
    return `rgba(${gray},${gray},${gray},${alpha})`;
  }
  // Subdue the green land-cover fills in colored modes. Retain separate gray
  // levels for the main map and Ride so terrain detail stays in the background.
  const terrainGray = red === 61 && green === 73 && blue === 62 ? 56
    : red === 39 && green === 49 && blue === 40 ? 40 : null;
  if (terrainGray !== null) return `rgba(${terrainGray},${terrainGray},${terrainGray},${alpha})`;
  // Replace saffron accents and Ride's muted gold roads. Labels, water, and
  // other provider colors keep their original appearance.
  const saffron = [[246, 196, 49], [244, 196, 48], [139, 115, 48]].some(rgb =>
    rgb[0] === Math.round(red) && rgb[1] === Math.round(green) && rgb[2] === Math.round(blue));
  if (!saffron) return null;
  const scale = Math.min(1, level / ROAD_BRIGHTNESS);
  const rgb = MODE_ACCENTS[mode].map(channel => Math.round(channel * scale));
  return `rgba(${rgb.join(",")},${alpha})`;
}

// Preserve opacity, zoom expressions, and legacy color stops in every mode.
export function colorModeMapPaint(value: unknown, mode: ColorMode): unknown {
  if (mode === "color") return value;
  if (Array.isArray(value)) return value.map(item => colorModeMapPaint(item, mode));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, colorModeMapPaint(item, mode)]));
  }
  if (typeof value !== "string") return value;
  if (/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) {
    const hex = value.length <= 5 ? [...value.slice(1)].map(char => char + char).join("") : value.slice(1);
    return modeColor(mode, ...[0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16)) as [number, number, number],
      hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1) ?? value;
  }
  const rgb = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (rgb) return modeColor(mode, Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] === undefined ? 1 : Number(rgb[4])) ?? value;
  const hsl = value.match(/^hsla?\(\s*([\d.-]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (hsl) {
    const hue = ((Number(hsl[1]) % 360) + 360) % 360;
    const saturation = Number(hsl[2]) / 100;
    const lightness = Number(hsl[3]) / 100;
    const amplitude = saturation * Math.min(lightness, 1 - lightness);
    const channel = (offset: number) => {
      const k = (offset + hue / 30) % 12;
      return 255 * (lightness - amplitude * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
    };
    return modeColor(mode, channel(0), channel(8), channel(4), hsl[4] === undefined ? 1 : Number(hsl[4])) ?? value;
  }
  return value;
}

export function monochromeMapPaint(value: unknown): unknown {
  return colorModeMapPaint(value, "monochrome");
}

// Tag provider layers before aircraft, trails, and other live overlays are added.
export function prepareBasemapColors(style: StyleSpecification, mode: ColorMode): StyleSpecification {
  return { ...style, layers: style.layers.map(layer => {
    const colors = Object.fromEntries(Object.entries(layer.paint ?? {}).filter(([property]) => property.endsWith("-color")));
    const paint = mode === "color" ? layer.paint : { ...layer.paint, ...colorModeMapPaint(colors, mode) as object };
    return { ...layer, paint, metadata: { ...layer.metadata as object, [BASEMAP_COLORS]: colors } } as typeof layer;
  }) };
}

export function applyBasemapColors(map: Pick<Map, "getStyle" | "getPaintProperty" | "setPaintProperty">, mode: ColorMode): void {
  for (const layer of map.getStyle().layers ?? []) {
    const colors = (layer.metadata as Record<string, unknown> | undefined)?.[BASEMAP_COLORS];
    if (!colors || typeof colors !== "object") continue;
    for (const [property, original] of Object.entries(colors)) {
      const value = colorModeMapPaint(original, mode);
      if (JSON.stringify(map.getPaintProperty(layer.id, property)) !== JSON.stringify(value)) {
        map.setPaintProperty(layer.id, property, value);
      }
    }
  }
}
