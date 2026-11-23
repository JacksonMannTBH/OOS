import assert from "node:assert/strict";
import { test } from "node:test";
import type { Map as MaplibreMap, StyleSpecification } from "maplibre-gl";
import { applyBasemapColors, colorModeMapPaint, monochromeMapPaint, prepareBasemapColors } from "./map-color-palette";
import { MODE_ACCENTS, type ColorMode } from "./color-mode-palette";

test("monochrome basemaps preserve aircraft and trail colors, then restore original map colors", () => {
  const provider: StyleSpecification = { version: 8, sources: {}, layers: [
    { id: "land", type: "background", paint: { "background-color": "#3d493e" } },
  ] };
  const style = prepareBasemapColors(provider, "color");
  style.layers.push({ id: "aircraft", type: "circle", source: "live", paint: { "circle-color": "#4da3ff" } });
  style.layers.push({ id: "aircraft-trails", type: "line", source: "live", paint: { "line-color": "#e879f9" } });
  const paints = new Map(style.layers.map(layer => [layer.id, layer.paint as Record<string, unknown>]));
  const map = {
    getStyle: () => style,
    getPaintProperty: (id: string, property: string) => paints.get(id)?.[property],
    setPaintProperty: (id: string, property: string, value: unknown) => { paints.get(id)![property] = value; },
  } as unknown as Pick<MaplibreMap, "getStyle" | "getPaintProperty" | "setPaintProperty">;
  applyBasemapColors(map, "monochrome");
  assert.equal(map.getPaintProperty("land", "background-color"), "rgba(70,70,70,1)");
  assert.equal(map.getPaintProperty("aircraft", "circle-color"), "#4da3ff");
  assert.equal(map.getPaintProperty("aircraft-trails", "line-color"), "#e879f9");
  applyBasemapColors(map, "color");
  assert.equal(map.getPaintProperty("land", "background-color"), "#3d493e");
});

test("all three tints apply before the map loads and survive repeated mode changes without altering live overlays", () => {
  const provider: StyleSpecification = { version: 8, sources: {}, layers: [
    { id: "land", type: "background", paint: { "background-color": "#262b2c" } },
    { id: "road", type: "line", source: "roads", paint: { "line-color": "#f6c431", "line-opacity": 0.52 } },
    { id: "forest", type: "fill", source: "terrain", paint: { "fill-color": "#3d493e", "fill-opacity": 0.8 } },
  ] };
  const original = structuredClone(provider);
  for (const initial of ["red", "blue", "green"] as const) {
    const style = prepareBasemapColors(provider, initial);
    const road = style.layers[1]!;
    assert.equal((road.paint as Record<string, unknown>)["line-color"], `rgba(${MODE_ACCENTS[initial].join(",")},1)`);
    style.layers.push({ id: "aircraft-trail", type: "line", source: "live", paint: { "line-color": "#e879f9" } });
    const paints = new Map(style.layers.map(layer => [layer.id, layer.paint as Record<string, unknown>]));
    let writes = 0;
    const map = {
      getStyle: () => style,
      getPaintProperty: (id: string, property: string) => paints.get(id)?.[property],
      setPaintProperty: (id: string, property: string, value: unknown) => { writes++; paints.get(id)![property] = value; },
    } as unknown as Pick<MaplibreMap, "getStyle" | "getPaintProperty" | "setPaintProperty">;
    for (const mode of ["green", "red", "blue", "monochrome", "color", initial] as ColorMode[]) {
      applyBasemapColors(map, mode);
      assert.equal(map.getPaintProperty("road", "line-color"), colorModeMapPaint("#f6c431", mode));
      assert.equal(map.getPaintProperty("road", "line-opacity"), 0.52);
      assert.equal(map.getPaintProperty("forest", "fill-color"), mode === "color" ? "#3d493e"
        : mode === "monochrome" ? "rgba(70,70,70,1)" : "rgba(56,56,56,1)");
      assert.equal(map.getPaintProperty("forest", "fill-opacity"), 0.8);
      assert.equal(map.getPaintProperty("aircraft-trail", "line-color"), "#e879f9");
      const before = writes;
      applyBasemapColors(map, mode);
      assert.equal(writes, before, "Style-data events do not trigger a paint loop");
    }
  }
  assert.deepEqual(provider, original);
});

test("tinted map expressions retain opacity and zoom stops, including legacy colors", () => {
  const paint = { stops: [[5, "#f6c43180"], [15, "rgba(246,196,49,0.4)"]], base: 1.2 };
  for (const mode of ["red", "blue", "green"] as const) {
    const rgb = MODE_ACCENTS[mode].join(",");
    assert.deepEqual(colorModeMapPaint(paint, mode), { stops: [[5, `rgba(${rgb},${128 / 255})`], [15, `rgba(${rgb},0.4)`]], base: 1.2 });
    assert.deepEqual(colorModeMapPaint(["interpolate", ["linear"], ["zoom"], 5, "#f6c431", 15, "#000"], mode),
      ["interpolate", ["linear"], ["zoom"], 5, `rgba(${rgb},1)`, 15, "#000"]);
  }
});

test("colored modes preserve white labels and map colors outside saffron and green terrain", () => {
  for (const mode of ["red", "blue", "green"] as const) {
    const colors = ["#fff", "#000", "#262b2c", "#e8e0c8", "#d8d2c0", "#4da3ff", "rgba(255,0,0,0.4)", "hsl(120,100%,50%)"];
    assert.deepEqual(colorModeMapPaint(colors, mode), colors);
    assert.notEqual(colorModeMapPaint("#8b7330", mode), "#8b7330", "Ride's dim saffron roads follow the selected accent");
  }
});

test("red, blue, and green terrain is dull gray without changing opacity or original Color mode", () => {
  const paint = ["interpolate", ["linear"], ["zoom"], 5, "#3d493e80", 15, "rgba(39,49,40,0.4)"];
  const original = structuredClone(paint);
  for (const mode of ["red", "blue", "green"] as const) {
    assert.deepEqual(colorModeMapPaint(paint, mode), ["interpolate", ["linear"], ["zoom"], 5,
      `rgba(56,56,56,${128 / 255})`, 15, "rgba(40,40,40,0.4)"]);
  }
  assert.deepEqual(colorModeMapPaint(paint, "color"), original);
  assert.deepEqual(paint, original);
});

test("monochrome paint preserves alpha, zoom-dependent geometry, and provider input", () => {
  const color = ["interpolate", ["linear"], ["zoom"], 5, "rgba(255,0,0,0.4)", 15, "#00f8"];
  const original = structuredClone(color);
  assert.deepEqual(monochromeMapPaint(color), ["interpolate", ["linear"], ["zoom"], 5,
    "rgba(54,54,54,0.4)", 15, `rgba(18,18,18,${136 / 255})`]);
  assert.equal(monochromeMapPaint("hsl(120,100%,50%)"), "rgba(182,182,182,1)");
  assert.deepEqual(color, original);
});
