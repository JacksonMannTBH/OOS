import type { StyleSpecification } from "maplibre-gl";

// Transform the provider style before MapLibre commits it, so its light
// background and tiles never reach a visible frame. Preserve sources, filters,
// sprites, attribution, and zoom-dependent geometry from the provider.
export function darkMapStyle(style: StyleSpecification, mode: "radar" | "ride" = "radar"): StyleSpecification {
  const ride = mode === "ride";
  return {
    ...style,
    layers: style.layers.map(layer => {
      const descriptor = `${layer.id} ${"source-layer" in layer ? layer["source-layer"] : ""}`.toLowerCase();
      const water = /water|ocean|lake|river|bay|marine/.test(descriptor);
      const road = /road|street|highway|motorway|transport/.test(descriptor);
      const boundary = /boundary|admin|state|county/.test(descriptor);
      const green = /park|forest|wood|grass|landcover|landuse/.test(descriptor);
      let paint: Record<string, unknown> = {};
      switch (layer.type) {
        case "background": paint = { "background-color": ride ? "#202526" : "#262b2c" }; break;
        case "fill": paint = {
          "fill-color": water ? (ride ? "#081013" : "#000000") : green ? (ride ? "#273128" : "#3d493e") : (ride ? "#2f3435" : "#3b4041"),
          "fill-opacity": 1,
        }; break;
        case "line": paint = {
          "line-color": water ? (ride ? "#101a1d" : "#000000") : road ? (ride ? "#8b7330" : "#f6c431") : boundary ? (ride ? "#555851" : "#4b4c46") : (ride ? "#3b4142" : "#323637"),
          ...(ride ? { "line-opacity": road ? 0.58 : 0.66 } : road ? { "line-opacity": 0.52 } : boundary ? { "line-opacity": 0.7 } : {}),
        }; break;
        case "symbol":
          if (layer.layout?.["text-field"]) paint = { "text-color": ride ? "#d8d2c0" : "#e8e0c8", "text-halo-color": ride ? "#121515" : "#050505", "text-halo-width": 1.6 };
          break;
        case "fill-extrusion": paint = { "fill-extrusion-color": "#3b4041" }; break;
      }
      const hide = ride && (
        /building|structure|address|housenumber|poi|shop|amenity|transit|rail|airport|aeroway/.test(descriptor) ||
        (road && /minor|service|residential|unclassified|living_street|track|path|footway|cycleway|pedestrian|steps|driveway|alley/.test(descriptor)) ||
        (layer.type === "symbol" && road && Boolean(layer.layout?.["text-field"]))
      );
      return { ...layer, paint: { ...layer.paint, ...paint }, ...(hide ? { layout: { ...layer.layout, visibility: "none" } } : {}) } as typeof layer;
    }),
  };
}
