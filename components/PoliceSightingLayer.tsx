"use client";
import { useEffect, useRef } from "react";
import maplibregl, { type Map as MaplibreMap } from "maplibre-gl";
import { POLICE_COLOR, POLICE_ICON_PATH, policeReportAge, type PoliceSighting } from "@/lib/police-sightings";

type Entry = { marker: maplibregl.Marker; popup?: maplibregl.Popup; details?: HTMLDivElement; count?: HTMLElement; age?: HTMLElement };
const MAIN_MAP_POLICE_MIN_ZOOM = 10;

function setMarkerVisibility(entry: Entry, visible: boolean) {
  entry.marker.getElement().style.display = visible ? "grid" : "none";
  if (!visible) entry.popup?.remove();
}

export function PoliceSightingLayer({ map, sightings, interactive = false }: { map: MaplibreMap | null; sightings: PoliceSighting[]; interactive?: boolean }) {
  const entries = useRef(new Map<string, Entry>());
  useEffect(() => {
    const markers = entries.current;
    const updateVisibility = () => {
      const visible = !interactive || !!map && map.getZoom() >= MAIN_MAP_POLICE_MIN_ZOOM;
      for (const entry of markers.values()) setMarkerVisibility(entry, visible);
    };
    map?.on("zoom", updateVisibility);
    updateVisibility();
    return () => {
      map?.off("zoom", updateVisibility);
      for (const entry of markers.values()) { entry.popup?.remove(); entry.marker.remove(); }
      markers.clear();
    };
  }, [map, interactive]);
  useEffect(() => {
    if (!map) return;
    const keep = new Set(sightings.map(s => s.id));
    for (const [id, entry] of entries.current) if (!keep.has(id)) { entry.popup?.remove(); entry.marker.remove(); entries.current.delete(id); }
    for (const sighting of sightings) {
      let entry = entries.current.get(sighting.id);
      if (!entry) {
        const element = document.createElement(interactive ? "button" : "div");
        element.className = "oos-police-marker";
        element.setAttribute("aria-label", "Police sighting");
        if (interactive) element.setAttribute("type", "button");
        else element.setAttribute("aria-hidden", "true");
        // The main-map badge is compact, with an unchanged 44px touch target.
        const size = interactive ? 28 : 22;
        Object.assign(element.style, { width: interactive ? "44px" : "22px", height: interactive ? "44px" : "22px", display: "grid", placeItems: "center", border: "none", borderRadius: "50%", background: "transparent", color: POLICE_COLOR, cursor: interactive ? "pointer" : "default", pointerEvents: interactive ? "auto" : "none", padding: "0", boxSizing: "border-box" });
        element.innerHTML = `<span class="oos-police-marker__badge" style="display:grid;place-items:center;width:${size}px;height:${size}px;box-sizing:border-box;border:1px solid currentColor;border-radius:50%;background:#090909;padding:4px"><svg width="100%" height="100%" viewBox="0 0 24 26" aria-hidden="true"><path d="${POLICE_ICON_PATH}" fill="currentColor"/></svg></span>`;
        entry = { marker: new maplibregl.Marker({ element }).setLngLat([sighting.lon, sighting.lat]).addTo(map) };
        if (interactive) {
          entry.details = document.createElement("div");
          entry.details.className = "oos-police-popup__details";
          entry.details.setAttribute("role", "group");
          entry.count = document.createElement("strong");
          entry.age = document.createElement("span");
          entry.details.append(entry.count, entry.age);
          entry.popup = new maplibregl.Popup({ offset: 16, closeButton: true, maxWidth: "180px", className: "oos-police-popup" }).setDOMContent(entry.details);
          const popup = entry.popup;
          const marker = entry.marker;
          element.addEventListener("click", event => {
            event.stopPropagation();
            if (popup.isOpen()) { popup.remove(); return; }
            for (const other of entries.current.values()) other.popup?.remove();
            popup.setLngLat(marker.getLngLat()).addTo(map);
          });
        }
        entries.current.set(sighting.id, entry);
      }
      entry.marker.setLngLat([sighting.lon, sighting.lat]);
      setMarkerVisibility(entry, !interactive || map.getZoom() >= MAIN_MAP_POLICE_MIN_ZOOM);
      entry.popup?.setLngLat([sighting.lon, sighting.lat]);
      if (entry.details && entry.count && entry.age) {
        const count = `${sighting.reportCount} rider${sighting.reportCount === 1 ? "" : "s"}`;
        const age = policeReportAge(sighting.lastReportedAt);
        entry.count.textContent = count;
        entry.age.textContent = age;
        entry.details.setAttribute("aria-label", `Reported by ${count}. Last reported: ${age}.`);
      }
    }
  }, [map, sightings, interactive]);
  return null;
}
