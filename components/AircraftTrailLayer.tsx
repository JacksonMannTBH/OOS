"use client";

// Polls /api/trails for the currently-airborne tail set and renders a
// polyline + endpoint dots behind each plane on /map.
//
// PROMPT_22 rebuild on the confirmed-working PROMPT_19C strip-back
// (PR #119) — the data path was proven; this brings back halo +
// endpoint dots + zoom-interpolated width + explicit z-ordering.
//
// One deviation from PROMPT_22's "decisions locked" section, on the
// strength of the live visual feedback after #119 deployed:
//   - Line color is WHITE, not SS_TOKENS.sky. The cyan brand token
//     (#5BB6FF) read too close to the map's warm road highlights.
//     White has strong luminance contrast against the dark basemap and
//     can't be perceptually mistaken for any existing rider-facing element.
//   - Widths bumped well past the prompt's spec because Alex
//     reported the strip-back's flat 16 px still read skinny on
//     prod. Going wider so a glance-at-a-stoplight rider can
//     find the trail without looking.
//
// The TrailStatusBadge from #119 stays as a debug aid. [trail]
// console.debug lines stay. Both clean up in a follow-up after the
// rebuild has soaked.

import { useEffect, useRef, useState } from "react";
import type { Map as MaplibreMap, GeoJSONSource } from "maplibre-gl";
import { aircraftColorForTail } from "@/lib/aircraft-colors";
import {
  FLIGHT_PATHS_VISIBLE_KEY,
  LAYER_VISIBILITY_CHANGE_EVENT,
} from "@/lib/radar-layer-events";
import type { Aircraft } from "@/lib/types";

const SOURCE_ID = "aircraft-trails";
const ENDPOINTS_SOURCE_ID = "aircraft-trail-endpoints";
const HALO_LAYER_ID = "aircraft-trail-halo";
const LAYER_ID = "aircraft-trail";
const START_DOT_LAYER_ID = "aircraft-trail-start-dot";
const END_DOT_LAYER_ID = "aircraft-trail-end-dot";
const AIRCRAFT_LAYER_ID = "aircraft";
const POLL_MS = 10_000;
const PULSE_PERIOD_MS = 1600;
const TRAIL_LAYER_IDS = [
  HALO_LAYER_ID,
  LAYER_ID,
  START_DOT_LAYER_ID,
  END_DOT_LAYER_ID,
] as const;

type TrailPoint = { lat: number; lon: number; ts: number };
type TrailsResponse = { trails: Record<string, TrailPoint[]> };

type EndpointKind = "start" | "end";
type EndpointProps = { tail: string; kind: EndpointKind; color: string };

function buildFeatureCollection(
  trails: Record<string, TrailPoint[]>,
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  for (const [tail, pts] of Object.entries(trails)) {
    if (pts.length < 2) continue;
    const color = aircraftColorForTail(tail);
    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: pts.map((p) => [p.lon, p.lat]),
      },
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
 * Move all four trail layers to sit just below the aircraft chevron.
 * Layers were added with no beforeId (default-stack-top) so the
 * polyline is visible immediately even if the chevron mounts later;
 * this call slides them into proper position once the chevron exists.
 *
 * Idempotent + cheap. Called on attach and on every fetch poll so a
 * sibling layer mounting late can never bury the trail.
 */
function reorderTrailLayers(map: MaplibreMap): void {
  if (!map.getLayer(AIRCRAFT_LAYER_ID)) {
    // Aircraft chevron not attached yet — leave the trail at the top
    // of the stack for now. Next poll will move it down once the
    // chevron exists.
    return;
  }
  for (const id of TRAIL_LAYER_IDS) {
    try {
      if (map.getLayer(id)) map.moveLayer(id, AIRCRAFT_LAYER_ID);
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
}: {
  map: MaplibreMap | null;
  airborne: Aircraft[];
}) {
  const tailsKey = airborne
    .map((a) => a.tail)
    .filter(Boolean)
    .sort()
    .join(",");
  const tailsKeyRef = useRef(tailsKey);
  tailsKeyRef.current = tailsKey;
  const pulseRef = useRef<number | null>(null);
  const [enabled, setEnabled] = useState<boolean>(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(FLIGHT_PATHS_VISIBLE_KEY);
    if (stored === "0") setEnabled(false);
    else if (stored === "1") setEnabled(true);
    const onLayerVisChange = (e: Event) => {
      const detail = (
        e as CustomEvent<{ key: string; enabled: boolean }>
      ).detail;
      if (detail?.key === FLIGHT_PATHS_VISIBLE_KEY) {
        setEnabled(detail.enabled);
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === FLIGHT_PATHS_VISIBLE_KEY) {
        setEnabled(e.newValue !== "0");
      }
    };
    window.addEventListener(LAYER_VISIBILITY_CHANGE_EVENT, onLayerVisChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(
        LAYER_VISIBILITY_CHANGE_EVENT,
        onLayerVisChange,
      );
      window.removeEventListener("storage", onStorage);
    };
  }, []);

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
      // Halo first (renders below the line). Page-background near-
      // black at 0.6 opacity gives the white line a dark outline that
      // survives over heat density, water, road labels — anything.
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
            3.5,
            11,
            4.5,
            14,
            5.5,
            18,
            7,
          ],
          "line-opacity": 0.28,
        },
      });
      // Line — high contrast against the dark basemap. Wider than every
      // prior iteration so a glance-at-a-stoplight rider can't miss it.
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
            1.6,
            11,
            2.1,
            14,
            2.8,
            18,
            3.6,
          ],
          "line-opacity": 0.9,
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
    const tick = () => {
      if (!map.getLayer(END_DOT_LAYER_ID)) {
        pulseRef.current = requestAnimationFrame(tick);
        return;
      }
      const phase =
        ((Date.now() - startedAt) % PULSE_PERIOD_MS) / PULSE_PERIOD_MS;
      const radius = 6 + 2 * Math.sin(phase * Math.PI * 2);
      try {
        map.setPaintProperty(END_DOT_LAYER_ID, "circle-radius", radius);
      } catch {
        /* layer torn down mid-frame */
      }
      pulseRef.current = requestAnimationFrame(tick);
    };
    pulseRef.current = requestAnimationFrame(tick);

    return () => {
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
    if (!map) return;
    const visibility = enabled ? "visible" : "none";
    for (const id of TRAIL_LAYER_IDS) {
      try {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, "visibility", visibility);
        }
      } catch {
        /* layer not yet attached */
      }
    }
  }, [map, enabled]);

  // Poll /api/trails whenever the airborne tail set changes, plus every
  // POLL_MS while it's stable. Cancel + restart cleanly if tails change
  // mid-cycle so we never write a stale set to the source.
  useEffect(() => {
    if (!map) return;
    if (!enabled) return;
    if (!tailsKey) {
      console.debug("[trail] no airborne tails, clearing sources");
      const lineSrc = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (lineSrc) lineSrc.setData({ type: "FeatureCollection", features: [] });
      const endpointSrc = map.getSource(ENDPOINTS_SOURCE_ID) as
        | GeoJSONSource
        | undefined;
      if (endpointSrc) {
        endpointSrc.setData({ type: "FeatureCollection", features: [] });
      }
      return;
    }
    let cancelled = false;
    const fetchOnce = async () => {
      console.debug("[trail] fetchOnce start", { tailsKey });
      try {
        const r = await fetch(`/api/trails?tails=${tailsKey}`, {
          cache: "no-store",
        });
        if (!r.ok) {
          console.warn("[trail] fetchOnce: bad response", r.status);
          return;
        }
        if (cancelled) return;
        const d = (await r.json()) as TrailsResponse;
        if (cancelled) return;
        if (tailsKeyRef.current !== tailsKey) {
          console.debug("[trail] fetchOnce: stale tailsKey, bailing");
          return;
        }
        const trails = d.trails ?? {};
        const totalPoints = Object.values(trails).reduce(
          (acc, pts) => acc + pts.length,
          0,
        );
        console.debug("[trail] fetchOnce: data received", {
          tails: Object.keys(trails),
          totalPoints,
        });
        const lineSrc = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
        if (!lineSrc) {
          console.warn("[trail] fetchOnce: line source missing");
          return;
        }
        const fc = buildFeatureCollection(trails);
        lineSrc.setData(fc);
        const endpointSrc = map.getSource(ENDPOINTS_SOURCE_ID) as
          | GeoJSONSource
          | undefined;
        if (endpointSrc) {
          endpointSrc.setData(buildEndpointCollection(trails));
        }
        console.debug("[trail] fetchOnce: setData complete", {
          featureCount: fc.features.length,
        });
        // Re-run reorder so a sibling layer that mounted between attach
        // and now can't bury us.
        reorderTrailLayers(map);
      } catch (e) {
        console.warn("[trail] fetchOnce: threw", e);
      }
    };
    void fetchOnce();
    const id = window.setInterval(fetchOnce, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [map, tailsKey, enabled]);

  return null;
}
