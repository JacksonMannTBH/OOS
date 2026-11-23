"use client";

import { setMapDisplayStyle } from "@/lib/map-display-style";
import { COLOR_MODE_EVENT, COLOR_MODE_KEY, readColorMode } from "@/lib/color-mode";
import { colorModeMapPaint } from "@/lib/map-color-palette";

import { useEffect, useRef } from "react";
import maplibregl, { Map as MaplibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { SS_TOKENS } from "@/lib/tokens";
import type { TrackPoint } from "@/lib/tracks";

export default function TracksMap({ samples }: { samples: TrackPoint[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (samples.length < 2) return;

    const coords: [number, number][] = samples.map((s) => [s.lon, s.lat]);

    const map = new maplibregl.Map({
      container: containerRef.current,
      center: coords[0]!,
      zoom: 11,
      attributionControl: { compact: true },
    });
    const stopColorMode = setMapDisplayStyle(map, null);
    mapRef.current = map;
    const trackColor = () => colorModeMapPaint("#f6c431", readColorMode()) as string;
    const endpointColors = (): maplibregl.ExpressionSpecification => ["match", ["get", "kind"], "start", "#9ee8b5", "end", "#ff6b6b", trackColor()];
    const updateTrackColors = () => {
      if (map.getLayer("track")) map.setPaintProperty("track", "line-color", trackColor());
      if (map.getLayer("endpoints")) map.setPaintProperty("endpoints", "circle-color", endpointColors());
    };
    const storage = (event: StorageEvent) => { if (!event.key || event.key === COLOR_MODE_KEY) updateTrackColors(); };
    window.addEventListener(COLOR_MODE_EVENT, updateTrackColors);
    window.addEventListener("storage", storage);

    map.on("load", () => {
      // Polyline of the flight.
      map.addSource("track", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "LineString", coordinates: coords },
          properties: {},
        },
      });
      map.addLayer({
        id: "track",
        type: "line",
        source: "track",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": trackColor(),
          "line-width": 3,
        },
      });

      // Endpoint dots.
      map.addSource("endpoints", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: coords[0]! },
              properties: { kind: "start" },
            },
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: coords[coords.length - 1]! },
              properties: { kind: "end" },
            },
          ],
        },
      });
      map.addLayer({
        id: "endpoints",
        type: "circle",
        source: "endpoints",
        paint: {
          "circle-radius": 6,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
          "circle-color": endpointColors(),
        },
      });

      // Auto-fit bounds.
      let minLon = coords[0]![0];
      let maxLon = coords[0]![0];
      let minLat = coords[0]![1];
      let maxLat = coords[0]![1];
      for (const [lon, lat] of coords) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
      map.fitBounds(
        [
          [minLon, minLat],
          [maxLon, maxLat],
        ],
        { padding: 60, duration: 0, maxZoom: 13 },
      );
    });

    return () => {
      window.removeEventListener(COLOR_MODE_EVENT, updateTrackColors);
      window.removeEventListener("storage", storage);
      stopColorMode(); map.remove();
      mapRef.current = null;
    };
  }, [samples]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        background: SS_TOKENS.bg0,
      }}
    />
  );
}
