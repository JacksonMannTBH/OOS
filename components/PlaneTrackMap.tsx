"use client";

// Renders the most-recent-flight track for a single tail as a polyline
// over the same OpenFreeMap dark base used on /map. Native MapLibre
// interactions are enabled (pinch, drag, double-tap, +/- buttons) so
// the user can dig into the route on the plane detail page.
//
// When the most-recent session is still in progress (the tail is
// currently airborne), the map polls /api/trails every 10 s for the
// freshest 30 min of points and re-fits its viewport. Without that
// the page would show only the SSR-time snapshot of the flight, which
// can be 0–2 points old enough to render as a blank map for a tail
// that just lifted off.

import { useEffect, useRef, useState } from "react";
import maplibregl, {
  Map as MaplibreMap,
  GeoJSONSource,
  LngLatBoundsLike,
  NavigationControl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_STYLE_URL } from "@/lib/map-style";
import { SS_TOKENS } from "@/lib/tokens";
import type { TrackPoint } from "@/lib/tracks";

const PUGET_SOUND: [number, number] = [-122.3, 47.6];
const FALLBACK_ZOOM = 9;
const SHORT_TRACK_ZOOM = 11;
const POLL_MS = 10_000;
const TRAIL_MINUTES = 30;

type Coord = [number, number];

type LiveTrail = { lat: number; lon: number; ts: number };
type TrailsResponse = { trails: Record<string, LiveTrail[]> };

type Props = {
  /** Tail this map is for — required when `inProgress` so the map can
   *  poll /api/trails for the live extension. */
  tail: string;
  /** Polyline samples, oldest → newest. May be 0/1/2+. */
  points: TrackPoint[];
  /** Pulse the end dot if the flight is still in progress. */
  inProgress: boolean;
  height?: number;
};

function pointsToCoords(points: TrackPoint[]): Coord[] {
  return points.map<Coord>((p) => [p.lon, p.lat]);
}

function liveToCoords(trail: LiveTrail[]): Coord[] {
  return trail.map<Coord>((p) => [p.lon, p.lat]);
}

function fitToCoords(map: MaplibreMap, coords: Coord[], padPct = 0.1): void {
  if (coords.length < 2) {
    const center = coords[0];
    if (center) {
      map.easeTo({ center, zoom: SHORT_TRACK_ZOOM, duration: 0 });
    }
    return;
  }
  const bounds = coords.reduce(
    (b, c) => b.extend(c),
    new maplibregl.LngLatBounds(coords[0]!, coords[0]!),
  );
  // Convert percentage to pixel padding using the canvas size — gives
  // ~10 % visual breathing room regardless of viewport.
  const canvas = map.getCanvas();
  const padding = Math.round(
    Math.min(canvas.clientWidth, canvas.clientHeight) * padPct,
  );
  map.fitBounds(bounds as LngLatBoundsLike, {
    padding: Math.max(20, padding),
    duration: 0,
    maxZoom: 14,
  });
}

export default function PlaneTrackMap({
  tail,
  points,
  inProgress,
  height = 280,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const pulseRef = useRef<number | null>(null);
  const styleLoadedRef = useRef(false);

  // Live coords — seeded with the SSR-rendered points and replaced by
  // /api/trails polls when inProgress. State (not ref) so the map-update
  // useEffect can react to it.
  const [coords, setCoords] = useState<Coord[]>(() => pointsToCoords(points));
  const lastFitRef = useRef<{ minLat: number; maxLat: number; minLon: number; maxLon: number } | null>(null);

  // Mount the map once.
  useEffect(() => {
    if (!containerRef.current) return;

    const initialCoords = pointsToCoords(points);
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: initialCoords[0] ?? PUGET_SOUND,
      zoom: initialCoords.length < 2 ? SHORT_TRACK_ZOOM : FALLBACK_ZOOM,
      attributionControl: { compact: true },
      // Native interactions explicitly on — this map is meant to be
      // poked at, unlike the live radar which mostly shows you state.
      dragPan: true,
      scrollZoom: true,
      touchZoomRotate: true,
      doubleClickZoom: true,
    });
    mapRef.current = map;

    map.addControl(new NavigationControl({ showCompass: true }), "top-right");

    map.on("load", () => {
      if (!mapRef.current) return;
      styleLoadedRef.current = true;

      // Polyline.
      map.addSource("track", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "LineString", coordinates: initialCoords },
          properties: {},
        },
      });
      map.addLayer({
        id: "track-line",
        type: "line",
        source: "track",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#f6c431",
          "line-width": 3,
        },
      });

      // Endpoint dots — start green, end amber. Re-rendered on each
      // coords change via the data-update useEffect below.
      map.addSource("endpoints", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "endpoint-dot",
        type: "circle",
        source: "endpoints",
        paint: {
          "circle-radius": 6,
          "circle-color": [
            "match",
            ["get", "kind"],
            "start",
            "#9ee8b5",
            "#ff6b6b",
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      applyCoords(map, initialCoords);
      fitToCoords(map, initialCoords);

      // Pulse the "end" point if the session is in-progress.
      if (inProgress) {
        const start = Date.now();
        const tick = () => {
          if (!mapRef.current) return;
          const phase = ((Date.now() - start) % 1600) / 1600;
          const radius = 6 + 4 * Math.sin(phase * Math.PI * 2);
          try {
            map.setPaintProperty("endpoint-dot", "circle-radius", [
              "match",
              ["get", "kind"],
              "end",
              radius,
              6,
            ]);
          } catch {
            /* layer torn down mid-frame */
          }
          pulseRef.current = requestAnimationFrame(tick);
        };
        pulseRef.current = requestAnimationFrame(tick);
      }
    });

    return () => {
      if (pulseRef.current != null) cancelAnimationFrame(pulseRef.current);
      styleLoadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll /api/trails every 10 s while the tail is airborne. Replaces
  // the SSR-rendered coords with the freshest 30 min of points so the
  // map extends as new positions arrive.
  useEffect(() => {
    if (!inProgress || !tail) return;
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const r = await fetch(
          `/api/trails?tails=${encodeURIComponent(tail)}&minutes=${TRAIL_MINUTES}`,
          { cache: "no-store" },
        );
        if (!r.ok || cancelled) return;
        const d = (await r.json()) as TrailsResponse;
        if (cancelled) return;
        const trail = d.trails?.[tail] ?? [];
        if (trail.length === 0) return;
        setCoords(liveToCoords(trail));
      } catch {
        // transient — next tick will retry
      }
    };
    void fetchOnce();
    const id = window.setInterval(fetchOnce, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [tail, inProgress]);

  // Push fresh coords into the map source whenever they change. Re-fits
  // bounds only when the new track meaningfully extends beyond the
  // previously-fit extent — avoids fighting the rider's manual pan/zoom
  // on every poll while still keeping new segments in view.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    applyCoords(map, coords);
    if (coords.length === 0) return;
    const bbox = bboxOf(coords);
    const prev = lastFitRef.current;
    const grew =
      !prev ||
      bbox.minLat < prev.minLat - 0.001 ||
      bbox.maxLat > prev.maxLat + 0.001 ||
      bbox.minLon < prev.minLon - 0.001 ||
      bbox.maxLon > prev.maxLon + 0.001;
    if (grew) {
      fitToCoords(map, coords);
      lastFitRef.current = bbox;
    }
  }, [coords]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height,
        borderRadius: 12,
        overflow: "hidden",
        background: SS_TOKENS.bg0,
      }}
    />
  );
}

function bboxOf(coords: Coord[]): {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
} {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const [lon, lat] of coords) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }
  return { minLat, maxLat, minLon, maxLon };
}

function applyCoords(map: MaplibreMap, coords: Coord[]): void {
  const trackSrc = map.getSource("track") as GeoJSONSource | undefined;
  if (trackSrc) {
    trackSrc.setData({
      type: "Feature",
      geometry: { type: "LineString", coordinates: coords },
      properties: {},
    });
  }
  const endpointSrc = map.getSource("endpoints") as GeoJSONSource | undefined;
  if (endpointSrc) {
    const features: GeoJSON.Feature<
      GeoJSON.Point,
      { kind: "start" | "end" }
    >[] = [];
    if (coords.length > 0) {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: coords[0]! },
        properties: { kind: "start" },
      });
    }
    if (coords.length > 1) {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: coords[coords.length - 1]! },
        properties: { kind: "end" },
      });
    }
    endpointSrc.setData({ type: "FeatureCollection", features });
  }
}
