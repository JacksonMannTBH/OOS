import assert from "node:assert/strict";
import { test } from "node:test";
import type { StyleSpecification } from "maplibre-gl";
import { darkMapStyle, STATE_BOUNDARY_LAYER_ID } from "./dark-map-style";

const provider: StyleSpecification = {
  version: 8,
  sprite: "https://tiles.example.com/sprites",
  glyphs: "https://tiles.example.com/fonts/{fontstack}/{range}.pbf",
  sources: { base: { type: "vector", tiles: ["https://tiles.example.com/{z}/{x}/{y}.pbf"], attribution: "Provider attribution" } },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#ffffff" } },
    { id: "water", type: "fill", source: "base", "source-layer": "water", paint: { "fill-color": "#ffffff" } },
    { id: "landcover", type: "fill", source: "base", "source-layer": "landcover", filter: ["==", "class", "wood"], paint: { "fill-color": "#ffffff" } },
    { id: "road-primary", type: "line", source: "base", "source-layer": "transportation", paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1, 15, 4] } },
    { id: "road-minor", type: "line", source: "base", "source-layer": "transportation" },
    { id: "place-label", type: "symbol", source: "base", "source-layer": "place", layout: { "text-field": "{name}" }, paint: { "text-color": "#000000", "text-halo-color": "#ffffff" } },
  ],
};

test("provider backgrounds and fills are dark before style commitment, without changing data or geometry", () => {
  const original = structuredClone(provider);
  for (const mode of ["radar", "ride"] as const) {
    const result = darkMapStyle(provider, mode);
    assert.deepEqual(result.sources, provider.sources);
    assert.equal(result.glyphs, provider.glyphs);
    assert.equal(result.sprite, provider.sprite);
    assert.deepEqual(result.layers.map(layer => layer.id), provider.layers.map(layer => layer.id));
    for (const layer of result.layers) {
      if (layer.type === "background") assert.notEqual(layer.paint?.["background-color"], "#ffffff");
      if (layer.type === "fill") assert.notEqual(layer.paint?.["fill-color"], "#ffffff");
      if (layer.type === "symbol") assert.notEqual(layer.paint?.["text-halo-color"], "#ffffff");
    }
    const green = result.layers[2]!; const originalGreen = provider.layers[2]!;
    const road = result.layers[3]!; const originalRoad = provider.layers[3]!;
    assert.equal(green.type, "fill"); assert.equal(road.type, "line");
    if (green.type === "fill" && originalGreen.type === "fill") assert.deepEqual(green.filter, originalGreen.filter);
    if (road.type === "line" && originalRoad.type === "line") assert.deepEqual(road.paint?.["line-width"], originalRoad.paint?.["line-width"]);
  }
  assert.deepEqual(provider, original);
});

test("Ride's simplified map is prepared before the first frame while radar retains minor roads", () => {
  assert.equal(darkMapStyle(provider, "ride").layers[4]!.layout?.visibility, "none");
  assert.notEqual(darkMapStyle(provider, "radar").layers[4]!.layout?.visibility, "none");
});

test("state borders appear below overview zoom and survive both map themes without adding county borders", () => {
  const original: StyleSpecification = { ...provider, layers: [
    ...provider.layers,
    { id: "boundary_3", type: "line", source: "base", "source-layer": "boundary", minzoom: 8,
      filter: ["all", [">=", ["get", "admin_level"], 3], ["<=", ["get", "admin_level"], 6]] },
  ] };
  for (const mode of ["radar", "ride"] as const) {
    const style = darkMapStyle(original, mode);
    const borders = style.layers.find(layer => layer.id === STATE_BOUNDARY_LAYER_ID)!;
    assert.equal(borders.type, "line");
    if (borders.type !== "line") throw new Error("State borders must be lines");
    assert.equal(borders.source, "base");
    assert.equal(borders["source-layer"], "boundary");
    assert.equal(borders.minzoom, 2);
    assert.deepEqual(borders.filter, ["all", ["==", ["get", "admin_level"], 4], ["!=", ["get", "maritime"], 1]]);
    assert.equal(borders.layout?.visibility, "visible");
    assert.equal(borders.paint?.["line-opacity"], 0.8);
    assert(style.layers.indexOf(borders) < style.layers.findIndex(layer => layer.type === "symbol"));
    assert.equal(darkMapStyle(style, mode).layers.filter(layer => layer.id === STATE_BOUNDARY_LAYER_ID).length, 1);
  }
  assert.equal(original.layers.some(layer => layer.id === STATE_BOUNDARY_LAYER_ID), false);
});
