"use client";

import type { Map } from "maplibre-gl";
import { COLOR_MODE_EVENT, COLOR_MODE_KEY, readColorMode } from "./color-mode";
import { darkMapStyle } from "./dark-map-style";
import { applyBasemapColors, prepareBasemapColors } from "./map-color-palette";
import { MAP_STYLE_URL } from "./map-style";

export function setMapDisplayStyle(map: Map, detail: "radar" | "ride" | null = "radar"): () => void {
  let disposed = false;
  let scheduled = false;
  const schedule = () => {
    if (disposed || scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (!disposed && map.isStyleLoaded()) applyBasemapColors(map, readColorMode());
    });
  };
  const storage = (event: StorageEvent) => { if (!event.key || event.key === COLOR_MODE_KEY) schedule(); };
  // Reapply after a map's theme or source finishes loading. Only tagged provider
  // paints change; aircraft sprites, label colors, trails, and markers stay vivid.
  map.on("styledata", schedule);
  map.on("load", schedule);
  window.addEventListener(COLOR_MODE_EVENT, schedule);
  window.addEventListener("storage", storage);
  map.setStyle(MAP_STYLE_URL, { transformStyle: (_, style) => prepareBasemapColors(
    detail === null ? style : darkMapStyle(style, detail), readColorMode(),
  ) });
  return () => {
    disposed = true;
    map.off("styledata", schedule);
    map.off("load", schedule);
    window.removeEventListener(COLOR_MODE_EVENT, schedule);
    window.removeEventListener("storage", storage);
  };
}
