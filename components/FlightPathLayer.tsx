"use client";

// Flight-path polyline overlay. Threads each tail-day's track samples
// as a thin amber line so corridors and patrol orbits read as actual
// paths. Visibility tracks its own
// `ss_flight_paths_visible` localStorage key so riders can dim the
// paths. The layer also listens for the LAYER_VISIBILITY_CHANGE_EVENT
// broadcast so controls stay in sync.
//
// Source: /api/flight-paths returns one GeoJSON LineString per tail-day
// with >= 5 points, filtered by the selected state.
// Edge-cached for 5 min so flipping filters is cheap.

import { useEffect, useRef, useState } from "react";
import type { Map as MaplibreMap, GeoJSONSource } from "maplibre-gl";
import { aircraftColorForTail } from "@/lib/aircraft-colors";
import {
  STATE_CHANGE_EVENT,
  getSelectedStateCode,
  type StateCode,
} from "@/lib/app-states";
import {
  FLIGHT_PATHS_VISIBLE_KEY,
  LAYER_VISIBILITY_CHANGE_EVENT,
} from "@/lib/radar-layer-events";

const VISIBLE_KEY = FLIGHT_PATHS_VISIBLE_KEY;
const SOURCE_ID = "flight-paths";
const LAYER_ID = "flight-paths-line";
const AIRCRAFT_LAYER_ID = "aircraft";

function buildQueryString(stateCode: StateCode, tails: string[]): string {
  const p = new URLSearchParams();
  p.set("state", stateCode);
  if (tails.length > 0) p.set("tails", tails.join(","));
  return p.toString();
}

type Props = {
  map: MaplibreMap | null;
  airborneTails: string[];
};

function colorizeFeatures(features: GeoJSON.Feature[]): GeoJSON.Feature[] {
  return features.map((feature) => {
    const props = feature.properties ?? {};
    const tail = typeof props.tail === "string" ? props.tail : "";
    return {
      ...feature,
      properties: {
        ...props,
        color: aircraftColorForTail(tail),
      },
    };
  });
}

export function FlightPathLayer({ map, airborneTails }: Props) {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [stateCode, setStateCode] = useState<StateCode>(
    () => getSelectedStateCode(),
  );
  const [features, setFeatures] = useState<GeoJSON.Feature[] | null>(null);
  const airborneTailKey = airborneTails
    .map((tail) => tail.trim().toUpperCase())
    .filter(Boolean)
    .sort()
    .join(",");
  const filteredAirborneTails = airborneTailKey ? airborneTailKey.split(",") : [];
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // Keep state / visibility changes in sync with map controls.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = window.localStorage.getItem(VISIBLE_KEY);
    if (v === "0") setEnabled(false);
    else if (v === "1") setEnabled(true);
    setStateCode(getSelectedStateCode());
    const onStateChange = (e: Event) => {
      const detail = (e as CustomEvent<{ code?: StateCode }>).detail;
      setStateCode(detail?.code ?? getSelectedStateCode());
    };
    // Same-tab broadcast from the flight-path toggle — sync
    // visibility instantly when the rider taps the bottom-left pill or
    // the in-panel Layers row.
    const onLayerVisChange = (e: Event) => {
      const detail = (
        e as CustomEvent<{ key: string; enabled: boolean }>
      ).detail;
      if (detail?.key === VISIBLE_KEY) setEnabled(detail.enabled);
    };
    // Cross-tab visibility sync (rider has /map open in two tabs).
    const onStorage = (e: StorageEvent) => {
      if (e.key === VISIBLE_KEY) {
        setEnabled(e.newValue === "1");
      }
    };
    window.addEventListener(STATE_CHANGE_EVENT, onStateChange);
    window.addEventListener(LAYER_VISIBILITY_CHANGE_EVENT, onLayerVisChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(STATE_CHANGE_EVENT, onStateChange);
      window.removeEventListener(
        LAYER_VISIBILITY_CHANGE_EVENT,
        onLayerVisChange,
      );
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Fetch the polyline FeatureCollection on filter / state change.
  useEffect(() => {
    let cancelled = false;
    if (filteredAirborneTails.length === 0) {
      setFeatures([]);
      return;
    }
    const qs = buildQueryString(stateCode, filteredAirborneTails);
    (async () => {
      try {
        const r = await fetch(`/api/flight-paths?${qs}`, {
          cache: "no-store",
        });
        if (!r.ok) return;
        const d = (await r.json()) as { features?: GeoJSON.Feature[] };
        if (cancelled) return;
        setFeatures(Array.isArray(d.features) ? colorizeFeatures(d.features) : []);
      } catch {
        // best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stateCode, airborneTailKey]);

  // Add the source + layer once the map is ready. Same retry-on-data
  // pattern used by sibling layers because MapLibre's isStyleLoaded() is
  // unreliable post-mount under Next.js dynamic-import.
  useEffect(() => {
    if (!map) return;

    const addLayerOnce = () => {
      if (map.getSource(SOURCE_ID)) return;
      try {
        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        // Z-order: insert before aircraft so the polyline stays beneath
        // the chevrons.
        const beforeId = map.getLayer(AIRCRAFT_LAYER_ID)
          ? AIRCRAFT_LAYER_ID
          : undefined;
        map.addLayer(
          {
            id: LAYER_ID,
            type: "line",
            source: SOURCE_ID,
            layout: {
              visibility: enabledRef.current ? "visible" : "none",
              "line-cap": "round",
              "line-join": "round",
            },
            paint: {
              "line-color": ["coalesce", ["get", "color"], "#f6c431"],
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                8,
                0.35,
                12,
                0.8,
                15,
                1.15,
                18,
                1.65,
              ],
              "line-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                8,
                0.5,
                12,
                0.62,
                15,
                0.7,
                18,
                0.78,
              ],
            },
          },
          beforeId,
        );
      } catch {
        // style not ready; the data event will retry
      }
    };

    let cancelled = false;
    const ensure = () => {
      if (cancelled || !map) return;
      if (map.getSource(SOURCE_ID)) return;
      addLayerOnce();
    };
    ensure();
    map.on("data", ensure);

    return () => {
      cancelled = true;
      try {
        map.off("data", ensure);
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        /* map already torn down */
      }
    };
  }, [map]);

  // Push features into the source whenever they change.
  useEffect(() => {
    if (!map || !features) return;
    const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (!src) {
      const onSourceReady = () => {
        const s = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
        if (s && features) {
          s.setData({ type: "FeatureCollection", features });
          map.off("sourcedata", onSourceReady);
        }
      };
      map.on("sourcedata", onSourceReady);
      return () => {
        map.off("sourcedata", onSourceReady);
      };
    }
    src.setData({ type: "FeatureCollection", features });
  }, [map, features]);

  // Mirror enabled to the layer's visibility.
  useEffect(() => {
    if (!map) return;
    try {
      if (!map.getLayer(LAYER_ID)) return;
      map.setLayoutProperty(
        LAYER_ID,
        "visibility",
        enabled ? "visible" : "none",
      );
    } catch {
      /* layer not yet attached */
    }
  }, [map, enabled]);

  return null;
}
