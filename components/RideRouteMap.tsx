"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_STYLE_URL } from "@/lib/map-style";
import { darkMapStyle } from "@/lib/dark-map-style";
import type { RideRoutePoint } from "@/lib/ride-recording";

export function RideRouteMap({ route }: { route?: RideRoutePoint[] }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current || !route?.length) return;
    const points = route.filter(point => Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 &&
      Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180);
    if (!points.length) return;
    // Unwrap longitude so rides across the date line stay in one local viewport.
    let longitude = points[0]!.longitude;
    const coordinates = points.map(point => {
      longitude = point.longitude + 360 * Math.round((longitude - point.longitude) / 360);
      const coordinate = [longitude, point.latitude];
      return coordinate;
    });
    const bounds = coordinates.reduce((box, coordinate) => box.extend(coordinate as [number, number]),
      new maplibregl.LngLatBounds());
    const element = container.current;
    const map = new maplibregl.Map({
      container: container.current, interactive: false, attributionControl: false,
      center: coordinates[0] as [number, number], zoom: 15,
      bounds, fitBoundsOptions: { padding: 36, maxZoom: 16 }, renderWorldCopies: false,
    });
    // A summary needs neighborhood streets and buildings, including short rides.
    // Ride Mode intentionally hides those details and can look empty at this scale.
    map.setStyle(MAP_STYLE_URL, { transformStyle: (_, style) => darkMapStyle(style) });
    map.on("load", () => {
      map.addSource("ride-route", { type: "geojson", data: {
        type: "Feature", properties: {}, geometry: {
          // Join the saved fixes across GPS gaps for the summary preview.
          type: "LineString", coordinates: coordinates.length > 1 ? coordinates : [],
        },
      } });
      map.addLayer({ id: "ride-route-outline", type: "line", source: "ride-route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#10110f", "line-width": 7 } });
      map.addLayer({ id: "ride-route-trace", type: "line", source: "ride-route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#ffffff", "line-width": 4 } });
      map.once("idle", () => {
        element.dataset.ready = "true";
      });
    });
    for (const [index, end] of [[0, false], [coordinates.length - 1, true]] as const) {
      const marker = document.createElement("div");
      marker.className = `ss-ride-route-marker ss-ride-route-marker-${end ? "end" : "start"}`;
      if (!end) marker.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
      marker.setAttribute("role", "img");
      marker.setAttribute("aria-label", end ? "Ride finish" : "Ride start");
      new maplibregl.Marker({ element: marker }).setLngLat(coordinates[index] as [number, number]).addTo(map);
    }
    const observer = new ResizeObserver(() => {
      map.resize();
      map.fitBounds(bounds, { padding: 36, maxZoom: 16, duration: 0 });
    });
    observer.observe(container.current);
    return () => { observer.disconnect(); map.remove(); };
  }, [route]);
  // Older rides have no saved GPS trace; never substitute a fictional route.
  if (!route?.length) return null;
  return <div ref={container} className="ss-ride-route-map" role="img" aria-label="Recorded route with start and finish" />;
}
