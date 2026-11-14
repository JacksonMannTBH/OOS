"use client";

import { useEffect, useId, useRef } from "react";
import { Marker, type Map } from "maplibre-gl";
import { useDeviceHeading } from "@/lib/hooks/useDeviceHeading";

type Point = { lat: number; lon: number; heading?: number | null };

export function MapHeadingCone({ map, rider }: { map: Map | null; rider: Point | null }) {
  const heading = useDeviceHeading(rider?.heading);
  const marker = useRef<Marker | null>(null);
  const gradientId = `heading-cone-${useId().replace(/:/g, "")}`;
  useEffect(() => {
    if (!map) return;
    const element = document.createElement("div");
    element.className = "ss-map-heading-cone";
    element.style.cssText = "width:80px;height:80px;pointer-events:none";
    element.setAttribute("aria-hidden", "true");
    element.innerHTML = `<svg width="80" height="80" viewBox="0 0 80 80">
      <defs><radialGradient id="${gradientId}">
        <stop stop-color="#8bd2ff" stop-opacity=".65"/>
        <stop offset="1" stop-color="#8bd2ff" stop-opacity="0"/>
      </radialGradient></defs>
      <path d="M40 40 14 6 Q40 -6 66 6Z" fill="url(#${gradientId})"/>
      <circle cx="40" cy="40" r="6" fill="#8bd2ff" stroke="white" stroke-width="2"/>
    </svg>`;
    const current = new Marker({ element, rotationAlignment: "map", pitchAlignment: "map" });
    marker.current = current;
    return () => { current.remove(); marker.current = null; };
  }, [map, gradientId]);
  useEffect(() => {
    const current = marker.current;
    if (!current || !map) return;
    if (!rider || heading.headingDeg == null) { current.remove(); return; }
    current.setLngLat([rider.lon, rider.lat]).setRotation(heading.headingDeg).addTo(map);
  }, [map, rider, heading.headingDeg]);
  return null;
}
