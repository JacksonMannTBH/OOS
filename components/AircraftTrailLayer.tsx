"use client";

// Receives live trails for the currently-airborne tail set and renders a
// polyline + endpoint dots behind each plane on /map.
//
// Aircraft-colored lines keep a consistent opacity along the full
// recorded path. A subtle dark outline separates them from map roads.

import { useEffect, useRef } from "react";
import { subscribeLiveState } from "@/lib/live-data-client";
import { useSelectedStateId } from "@/lib/hooks/useSelectedStateId";
import { isStateCode, stateCodeForId, type StateCode } from "@/lib/app-states";
import type { Map as MaplibreMap, GeoJSONSource } from "maplibre-gl";
import { aircraftColorForTail } from "@/lib/aircraft-colors";
import { smoothFlightPath } from "@/lib/flight-path-smoothing";
import type { Aircraft } from "@/lib/types";

const SOURCE_ID = "aircraft-trails";
const ENDPOINTS_SOURCE_ID = "aircraft-trail-endpoints";
const HALO_LAYER_ID = "aircraft-trail-halo";
const LAYER_ID = "aircraft-trail";
const START_DOT_LAYER_ID = "aircraft-trail-start-dot";
const END_DOT_LAYER_ID = "aircraft-trail-end-dot";
const AIRCRAFT_LAYER_ID = "aircraft";
const AIRCRAFT_ROTOR_LAYER_ID = "aircraft-heli-rotor";
const PULSE_PERIOD_MS = 1600;
const TRAIL_OPACITY = 0.9;
const HALO_OPACITY = 0.28;
const TRAIL_LAYER_IDS = [
  HALO_LAYER_ID,
  LAYER_ID,
  START_DOT_LAYER_ID,
  END_DOT_LAYER_ID,
] as const;

type TrailPoint = { lat: number; lon: number; ts: number };
type TrailsResponse = { trails: Record<string, TrailPoint[]> };
type TrailProps = {
  tail: string;
  color: string;
};

type EndpointKind = "start" | "end";
type EndpointProps = { tail: string; kind: EndpointKind; color: string };

function buildFeatureCollection(
  trails: Record<string, TrailPoint[]>,
): GeoJSON.FeatureCollection<GeoJSON.LineString, TrailProps> {
  const features: GeoJSON.Feature<GeoJSON.LineString, TrailProps>[] = [];
  for (const [tail, pts] of Object.entries(trails)) {
    if (pts.length < 2) continue;
    const color = aircraftColorForTail(tail);
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: smoothFlightPath(pts) },
      properties: { tail, color },
    });
  }
  return { type: "FeatureCollection", features };
}

function buildEndpointCollection(
  trails: Record<string, TrailPoint[]>,
): GeoJSON.FeatureCollection<GeoJSON.Point, EndpointProps> {
  const features: GeoJSON.Feature<GeoJSON.Point, EndpointProps>[] = [];
  for (const [tail, pts] of Object.entries(trails)) {
    if (pts.length < 2) continue;
    const color = aircraftColorForTail(tail);
    const start = pts[0]!;
    const end = pts[pts.length - 1]!;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [start.lon, start.lat] },
      properties: { tail, kind: "start", color },
    });
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [end.lon, end.lat] },
      properties: { tail, kind: "end", color },
    });
  }
  return { type: "FeatureCollection", features };
}

/**
 * Move all four trail layers to sit below the live aircraft marker stack.
 * Layers were added with no beforeId (default-stack-top) so the
 * polyline is visible immediately even if the chevron mounts later;
 * this call slides them into proper position once the chevron exists.
 *
 * Idempotent + cheap. Called on attach and on every fetch poll so a
 * sibling layer mounting late can never bury the trail.
 */
function reorderTrailLayers(map: MaplibreMap): void {
  const markerBaseLayerId = map.getLayer(AIRCRAFT_LAYER_ID)
    ? AIRCRAFT_LAYER_ID
    : map.getLayer(AIRCRAFT_ROTOR_LAYER_ID)
      ? AIRCRAFT_ROTOR_LAYER_ID
      : null;
  if (!markerBaseLayerId) {
    // Aircraft marker not attached yet — leave the trail at the top
    // of the stack for now. Next poll will move it down once the
    // marker exists.
    return;
  }
  for (const id of TRAIL_LAYER_IDS) {
    try {
      if (map.getLayer(id)) map.moveLayer(id, markerBaseLayerId);
    } catch {
      /* layer torn down mid-call */
    }
  }
  console.debug("[trail] reorder complete", {
    layers: map.getStyle()?.layers?.map((l) => l.id) ?? [],
  });
}

export function AircraftTrailLayer({
  map,
  airborne,
  enabled,
  selectedTail = null,
}: {
  map: MaplibreMap | null;
  airborne: Aircraft[];
  enabled: boolean;
  selectedTail?: string | null;
}) {
  const tailsKey = airborne
    .map((a) => a.tail)
    .filter(Boolean)
    .sort()
    .join(",");
  const tailsKeyRef = useRef(tailsKey);
  tailsKeyRef.current = tailsKey;
  const pulseRef = useRef<number | null>(null);
  const visible = enabled || selectedTail !== null;
  const enabledRef = useRef(visible);
  enabledRef.current = visible;
  const selectedTailRef = useRef(selectedTail);
  selectedTailRef.current = selectedTail;

  function applyTrailSelection() {
    if (!map) return;
    const tail = selectedTailRef.current;
    for (const id of TRAIL_LAYER_IDS) {
      if (!map.getLayer(id)) continue;
      const selection: import("maplibre-gl").ExpressionSpecification = tail
        ? ["==", ["get", "tail"], tail]
        : ["all"];
      const kind = id === START_DOT_LAYER_ID ? "start" : id === END_DOT_LAYER_ID ? "end" : null;
      map.setFilter(id, kind ? ["all", selection, ["==", ["get", "kind"], kind]] : selection);
      map.setLayoutProperty(id, "visibility", enabledRef.current ? "visible" : "none");
    }
  }

  // Layer attachment — once per map instance.
  useEffect(() => {
    if (!map) return;
    const attach = () => {
      if (map.getSource(SOURCE_ID)) {
        if (map.getLayer(LAYER_ID)) return;
        try {
          if (map.getSource(ENDPOINTS_SOURCE_ID)) {
            map.removeSource(ENDPOINTS_SOURCE_ID);
          }
          map.removeSource(SOURCE_ID);
        } catch {
          return;
        }
      }
      console.debug("[trail] attach: adding sources + layers");
      try {
        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addSource(ENDPOINTS_SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      } catch {
        return;
      }
      // Draw the subtle dark outline beneath the colored trail.
      map.addLayer({
        id: HALO_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        layout: {
          visibility: enabledRef.current ? "visible" : "none",
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#050505",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            8,
            5,
            11,
            6,
            14,
            7.5,
            18,
            9.5,
          ],
          "line-opacity": HALO_OPACITY,
        },
      });
      // Keep the trail equally visible from start to finish.
      map.addLayer({
        id: LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        layout: {
          visibility: enabledRef.current ? "visible" : "none",
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": ["coalesce", ["get", "color"], "#8bd2ff"],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            8,
            3,
            11,
            4,
            14,
            5.5,
            18,
            7.5,
          ],
          "line-opacity": TRAIL_OPACITY,
        },
      });
      map.addLayer({
        id: START_DOT_LAYER_ID,
        type: "circle",
        source: ENDPOINTS_SOURCE_ID,
        layout: { visibility: enabledRef.current ? "visible" : "none" },
        filter: ["==", ["get", "kind"], "start"],
        paint: {
          "circle-radius": 5,
          "circle-color": ["coalesce", ["get", "color"], "#9ee8b5"],
          "circle-stroke-color": "#FFFFFF",
          "circle-stroke-width": 1.5,
        },
      });
      map.addLayer({
        id: END_DOT_LAYER_ID,
        type: "circle",
        source: ENDPOINTS_SOURCE_ID,
        layout: { visibility: enabledRef.current ? "visible" : "none" },
        filter: ["==", ["get", "kind"], "end"],
        paint: {
          "circle-radius": 7,
          "circle-color": ["coalesce", ["get", "color"], "#ff6b6b"],
          "circle-stroke-color": "#FFFFFF",
          "circle-stroke-width": 1.5,
        },
      });
      // Move the cluster below the chevron once the aircraft layer
      // exists. If it doesn't yet, the cluster sits at the top of
      // the stack (visible immediately) and the next fetch poll
      // re-runs the reorder once the chevron mounts.
      applyTrailSelection();
      reorderTrailLayers(map);
      console.debug("[trail] attach: complete", {
        layers: map.getStyle()?.layers?.map((l) => l.id) ?? [],
        hasAircraft: !!map.getLayer(AIRCRAFT_LAYER_ID),
      });
    };
    attach();
    map.on("load", attach);
    map.on("styledata", attach);
    map.on("data", attach);

    // Pulse the end dot every animation frame. setPaintProperty is
    // cheap; the radius expression covers every airborne tail in a
    // single layer (filter handles which features show).
    const startedAt = Date.now();
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      try {
        if (!map.getLayer(END_DOT_LAYER_ID)) {
          pulseRef.current = requestAnimationFrame(tick);
          return;
        }
      } catch {
        return;
      }
      const phase =
        ((Date.now() - startedAt) % PULSE_PERIOD_MS) / PULSE_PERIOD_MS;
      const radius = 6 + 2 * Math.sin(phase * Math.PI * 2);
      try {
        map.setPaintProperty(END_DOT_LAYER_ID, "circle-radius", radius);
      } catch {
        if (!cancelled) {
          pulseRef.current = requestAnimationFrame(tick);
        }
        return;
      }
      pulseRef.current = requestAnimationFrame(tick);
    };
    pulseRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      map.off("load", attach);
      map.off("styledata", attach);
      map.off("data", attach);
      if (pulseRef.current != null) cancelAnimationFrame(pulseRef.current);
      pulseRef.current = null;
      try {
        if (map.getLayer(END_DOT_LAYER_ID)) map.removeLayer(END_DOT_LAYER_ID);
        if (map.getLayer(START_DOT_LAYER_ID)) map.removeLayer(START_DOT_LAYER_ID);
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getLayer(HALO_LAYER_ID)) map.removeLayer(HALO_LAYER_ID);
        if (map.getSource(ENDPOINTS_SOURCE_ID)) {
          map.removeSource(ENDPOINTS_SOURCE_ID);
        }
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        // map torn down already
      }
    };
  }, [map]);

  useEffect(() => {
    applyTrailSelection();
  }, [map, visible, selectedTail]);

  const stateCode = stateCodeForId(useSelectedStateId());
  const trailStateKeys = [...new Set(airborne
    .filter(plane => !selectedTail || plane.tail === selectedTail)
    .map(plane => isStateCode(plane.home_state_code) ? plane.home_state_code : stateCode))].sort().join(",");
  // Normally one shared state channel. Nationwide markers can select a flight
  // from another state without changing the user's notification state.
  useEffect(() => {
    if (!map || !visible) return;
    const render = (trails: Record<string, TrailPoint[]>) => {
      const line = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      const endpoints = map.getSource(ENDPOINTS_SOURCE_ID) as GeoJSONSource | undefined;
      line?.setData(buildFeatureCollection(trails));
      endpoints?.setData(buildEndpointCollection(trails));
      reorderTrailLayers(map);
    };
    if (!tailsKey) { render({}); return; }
    const tails = new Set(tailsKey.split(","));
    const byState = new Map<string, Record<string, TrailPoint[]>>();
    const unsubscribe: Array<() => void> = [];
    const timers: ReturnType<typeof setTimeout>[] = [];
    render({});
    for (const [index, state] of trailStateKeys.split(",").filter(Boolean).entries()) {
      const connect = () => unsubscribe.push(subscribeLiveState(state as StateCode, update => {
        byState.set(state, Object.fromEntries(Object.entries(update.trails).filter(([tail]) => tails.has(tail))));
        render(Object.assign({}, ...byState.values()));
      }));
      // Spread joins when all flight paths are enabled across several states.
      if (index === 0) connect();
      else timers.push(setTimeout(connect, index * 150));
    }
    return () => { timers.forEach(clearTimeout); unsubscribe.forEach(close => close()); };
  }, [map, tailsKey, visible, trailStateKeys]);

  return null;
}
