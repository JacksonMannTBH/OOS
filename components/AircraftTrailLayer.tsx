"use client";

// Receives live trails for the currently-airborne tail set and renders a
// polyline + endpoint dots behind each plane on /map.
//
// Aircraft-colored lines keep a consistent opacity along the full
// recorded path. A subtle dark outline separates them from map roads.

import { useCallback, useEffect, useRef } from "react";
import { subscribeLiveState } from "@/lib/live-data-client";
import type { LiveState } from "@/lib/live-data-protocol";
import { useSelectedStateId } from "@/lib/hooks/useSelectedStateId";
import { isStateCode, stateCodeForId, type StateCode } from "@/lib/app-states";
import type { Map as MaplibreMap, GeoJSONSource } from "maplibre-gl";
import { aircraftColorForTail } from "@/lib/aircraft-colors";
import { smoothFlightPath } from "@/lib/flight-path-smoothing";
import type { Aircraft } from "@/lib/types";
import { aircraftMapTails } from "@/lib/map-aircraft";

const SOURCE_ID = "aircraft-trails";
const ENDPOINTS_SOURCE_ID = "aircraft-trail-endpoints";
const HALO_LAYER_ID = "aircraft-trail-halo";
const LAYER_ID = "aircraft-trail";
const START_DOT_LAYER_ID = "aircraft-trail-start-dot";
const END_DOT_LAYER_ID = "aircraft-trail-end-dot";
const AIRCRAFT_LAYER_ID = "aircraft";
const AIRCRAFT_ROTOR_LAYER_ID = "aircraft-heli-rotor";
const TRAIL_OPACITY = 0.9;
const HALO_OPACITY = 0.28;
const TRAIL_LAYER_IDS = [
  HALO_LAYER_ID,
  LAYER_ID,
  START_DOT_LAYER_ID,
  END_DOT_LAYER_ID,
] as const;

type TrailPoint = { lat: number; lon: number; ts: number };
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
  const tailsKey = [...aircraftMapTails(airborne)].sort().join(",");
  const currentTails = useRef(new Set<string>());
  currentTails.current = new Set(tailsKey.split(",").filter(Boolean));
  const received = useRef(new Map<StateCode, LiveState>());
  const currentSessions = useRef(new Map<string, string | null | undefined>());
  currentSessions.current = new Map(airborne.map(plane => [plane.tail, plane.flight_session_id]));
  const sessionsKey = airborne.map(plane => `${plane.tail}:${plane.flight_session_id ?? ""}`).sort().join(",");
  const visible = enabled || selectedTail !== null;
  const enabledRef = useRef(visible);
  enabledRef.current = visible;
  const selectedTailRef = useRef(selectedTail);
  selectedTailRef.current = selectedTail;

  const stateCode = stateCodeForId(useSelectedStateId());
  const trailStateKeys = [...new Set(airborne
    .filter(plane => !selectedTail || plane.tail === selectedTail)
    .map(plane => isStateCode(plane.home_state_code) ? plane.home_state_code : stateCode))].sort().join(",");
  const requestedStates = useRef(new Set<string>());
  requestedStates.current = new Set(trailStateKeys.split(",").filter(Boolean));

  const renderTrails = useCallback(() => {
    const filtered: Record<string, TrailPoint[]> = {};
    for (const [state, update] of received.current) {
      if (!requestedStates.current.has(state)) { received.current.delete(state); continue; }
      const sessions = update.sessions ?? Object.fromEntries(update.snapshot.aircraft.map(plane => [plane.tail, plane.flight_session_id]));
      for (const [tail, points] of Object.entries(update.trails)) {
        if (!currentTails.current.has(tail)) continue;
        const currentSession = currentSessions.current.get(tail);
        if (currentSession && sessions[tail] && currentSession !== sessions[tail]) continue;
        const previous = filtered[tail];
        if (!previous || (points.at(-1)?.ts ?? 0) >= (previous.at(-1)?.ts ?? 0)) filtered[tail] = points;
      }
    }
    if (!map || !map.getStyle()) return;
    (map.getSource(SOURCE_ID) as GeoJSONSource | undefined)?.setData(buildFeatureCollection(filtered));
    (map.getSource(ENDPOINTS_SOURCE_ID) as GeoJSONSource | undefined)?.setData(buildEndpointCollection(filtered));
  }, [map]);

  const applyTrailSelection = useCallback(() => {
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
  }, [map]);

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
      // A steady endpoint avoids repainting the entire map for a pulse.
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
      renderTrails();
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

    return () => {
      map.off("load", attach);
      map.off("styledata", attach);
      map.off("data", attach);
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
  }, [map, applyTrailSelection, renderTrails]);

  useEffect(() => {
    applyTrailSelection();
  }, [map, visible, selectedTail, applyTrailSelection]);

  // Refilter existing data when the roster changes without blanking other
  // flights or reconnecting their shared stream. New flight sessions are pruned.
  useEffect(() => {
    renderTrails();
  }, [tailsKey, sessionsKey, trailStateKeys, visible, renderTrails]);

  // Normally one shared state channel. Nationwide markers can select a flight
  // from another state without changing the user's notification state.
  useEffect(() => {
    if (!map || !visible || !trailStateKeys) return;
    let cancelled = false;
    const unsubscribe: Array<() => void> = [];
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const [index, state] of trailStateKeys.split(",").filter(Boolean).entries()) {
      const connect = () => unsubscribe.push(subscribeLiveState(state as StateCode, update => {
        if (cancelled) return;
        // A received snapshot replaces this state's paths, including an empty
        // result. Only UI subscription changes preserve the previous data.
        received.current.set(state as StateCode, update);
        renderTrails();
        reorderTrailLayers(map);
      }));
      // Spread joins when all flight paths are enabled across several states.
      if (index === 0) connect();
      else timers.push(setTimeout(connect, index * 150));
    }
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      unsubscribe.forEach(close => close());
    };
  }, [map, visible, trailStateKeys, renderTrails]);

  return null;
}
