"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import maplibregl, { type Map, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getMapOpeningCamera, trackMapOpeningCamera } from "@/lib/map-opening-camera";
import { MAP_STYLE_URL } from "@/lib/map-style";
import { darkMapStyle } from "@/lib/dark-map-style";
import { getAppState, getSelectedStateCode } from "@/lib/app-states";
import type { Aircraft } from "@/lib/types";
import { aircraftColorForTail } from "@/lib/aircraft-colors";
import { HelicopterIcon } from "./HelicopterIcon";
import { PlaneIcon } from "./PlaneIcon";
import { MapHeadingCone } from "./MapHeadingCone";

type Point = { lat: number; lon: number; heading?: number | null };

function PreviewAircraft({ map, aircraft, bearing, onSelect }: {
  map: Map; aircraft: Aircraft; bearing: number; onSelect: (aircraft: Aircraft) => void;
}) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  useEffect(() => {
    const target = document.createElement("div");
    target.className = "ss-home-map-aircraft";
    const current = new maplibregl.Marker({ element: target });
    marker.current = current;
    setElement(target);
    return () => { current.remove(); marker.current = null; };
  }, [map]);
  useEffect(() => {
    marker.current?.setLngLat([aircraft.lon!, aircraft.lat!]).addTo(map);
  }, [map, aircraft.lon, aircraft.lat]);
  const heading = (aircraft.heading ?? 0) - bearing;
  const color = aircraftColorForTail(aircraft.tail);
  return element && createPortal(<button type="button" className="ss-home-map-aircraft-button"
    aria-label={`View ${aircraft.tail} aircraft details`} onClick={event => {
      event.stopPropagation();
      onSelect(aircraft);
    }}>
    <span className="ss-home-map-aircraft-label" style={{ background: color }}>{aircraft.tail}</span>
    <span aria-hidden="true">{aircraft.role === "patrol" || aircraft.role === "sar"
      ? <HelicopterIcon size={42} heading={heading} />
      : <PlaneIcon size={40} role={aircraft.role} heading={heading} />}</span>
  </button>, element);
}

export default function HomeMapPreview({ rider, aircraft }: { rider: Point | null; aircraft: Aircraft[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<Map | null>(null);
  const [bearing, setBearing] = useState(0);
  const popup = useRef<maplibregl.Popup | null>(null);
  const centeredOnRider = useRef(false);
  const userInteracted = useRef(false);
  const resetPreview = useRef<(() => void) | null>(null);
  const latestRider = useRef(rider);
  latestRider.current = rider;
  useEffect(() => {
    if (!container.current) return;
    const state = getAppState(getSelectedStateCode());
    const initial = latestRider.current;
    const openingCamera = getMapOpeningCamera();
    const current = new maplibregl.Map({ container: container.current,
      center: openingCamera?.center ?? (initial ? [initial.lon, initial.lat] : [state.centerLon, state.centerLat]),
      zoom: openingCamera?.zoom ?? (initial ? 9 : 5), bearing: openingCamera?.bearing ?? 0, pitch: openingCamera?.pitch ?? 0,
      interactive: true, canvasContextAttributes: { preserveDrawingBuffer: true }, attributionControl: false });
    const stopTrackingCamera = trackMapOpeningCamera(current);
    void import("./RadarMap");
    void import("./RideMap");
    centeredOnRider.current = Boolean(initial || openingCamera);
    userInteracted.current = false;
    setBearing(current.getBearing());
    current.getCanvas().setAttribute("aria-label", "Interactive home map");
    let resetTimer: number | undefined;
    let paused = document.visibilityState !== "visible";
    const pointers = new Set<number>();
    const clearReset = () => { window.clearTimeout(resetTimer); resetTimer = undefined; };
    const recenter = () => {
      clearReset();
      userInteracted.current = false;
      const position = latestRider.current;
      centeredOnRider.current = Boolean(position);
      popup.current?.remove();
      if (position) current.easeTo({ center: [position.lon, position.lat], zoom: 9, bearing: 0, pitch: 0,
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 300 });
    };
    resetPreview.current = recenter;
    const scheduleReset = () => {
      clearReset();
      if (!paused && document.visibilityState === "visible" && pointers.size === 0) {
        resetTimer = window.setTimeout(recenter, 15_000);
      }
    };
    const onGesture = (event: { originalEvent?: Event }) => {
      if (event.originalEvent) { userInteracted.current = true; scheduleReset(); }
    };
    const onMoveEnd = () => { if (userInteracted.current) scheduleReset(); };
    const onPointerDown = (event: PointerEvent) => {
      pointers.add(event.pointerId);
      userInteracted.current = true;
      clearReset();
    };
    const onPointerEnd = (event: PointerEvent) => { if (pointers.delete(event.pointerId)) scheduleReset(); };
    const onInteraction = () => { userInteracted.current = true; scheduleReset(); };
    const pause = () => { paused = true; pointers.clear(); clearReset(); };
    const resume = () => { paused = false; scheduleReset(); };
    const visibility = () => { if (document.visibilityState === "visible") resume(); else pause(); };
    const element = container.current;
    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("wheel", onInteraction, { passive: true });
    element.addEventListener("keydown", onInteraction);
    element.addEventListener("keyup", onInteraction);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    document.addEventListener("pause", pause);
    document.addEventListener("resume", resume);
    document.addEventListener("visibilitychange", visibility);
    current.on("movestart", onGesture);
    current.on("zoomstart", onGesture);
    current.on("moveend", onMoveEnd);
    current.on("rotate", () => setBearing(current.getBearing()));
    current.setStyle(MAP_STYLE_URL, { transformStyle: (_, style) => darkMapStyle(style, "radar") });
    current.on("load", () => {
      current.addSource("preview-points", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      current.addLayer({ id: "preview-points", type: "circle", source: "preview-points", paint: {
        "circle-radius": 5,
        "circle-color": "#8bd2ff",
        "circle-stroke-width": 1.5, "circle-stroke-color": "#fff" } });
      setMap(current);
      scheduleReset();
    });
    const resize = new ResizeObserver(() => current.resize());
    resize.observe(container.current);
    return () => {
      clearReset(); resetPreview.current = null;
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("wheel", onInteraction);
      element.removeEventListener("keydown", onInteraction);
      element.removeEventListener("keyup", onInteraction);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      document.removeEventListener("pause", pause);
      document.removeEventListener("resume", resume);
      document.removeEventListener("visibilitychange", visibility);
      resize.disconnect(); stopTrackingCamera(); popup.current?.remove(); current.remove();
    };
  }, []);
  useEffect(() => {
    if (!map) return;
    const points: GeoJSON.Feature[] = [];
    if (rider) {
      points.push({ type: "Feature", properties: { rider: true }, geometry: { type: "Point", coordinates: [rider.lon, rider.lat] } });
      if (!centeredOnRider.current && !userInteracted.current) {
        centeredOnRider.current = true;
        map.jumpTo({ center: [rider.lon, rider.lat], zoom: 9 });
      }
    }
    (map.getSource("preview-points") as GeoJSONSource)?.setData({ type: "FeatureCollection", features: points });
  }, [map, rider]);
  useEffect(() => {
    if (!map) return;
    const ready = () => {
      if (map.isMoving()) return;
      map.off("render", ready);
      window.dispatchEvent(new Event("oos:home-map-ready"));
    };
    map.on("render", ready);
    map.triggerRepaint();
    return () => { map.off("render", ready); };
  }, [map]);
  const selectAircraft = (plane: Aircraft) => {
    if (!map || plane.lat == null || plane.lon == null) return;
    const details = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = plane.tail;
    const model = document.createElement("div");
    model.textContent = plane.model ?? "Aircraft";
    const link = document.createElement("a");
    link.href = `/map?tail=${encodeURIComponent(plane.tail)}`;
    link.textContent = "View on full map";
    details.append(name, model, link);
    popup.current?.remove();
    popup.current = new maplibregl.Popup({ className: "ss-home-map-popup", offset: 24 })
      .setLngLat([plane.lon, plane.lat]).setDOMContent(details).addTo(map);
  };
  return <><div ref={container} style={{ position: "absolute", inset: 0, background: "#121515" }} /><MapHeadingCone map={map} rider={rider} />
    {map && aircraft.filter(plane => Number.isFinite(plane.lat) && Number.isFinite(plane.lon)).map(plane =>
      <PreviewAircraft key={plane.tail} map={map} aircraft={plane} bearing={bearing} onSelect={selectAircraft} />)}
    {map && rider && <button type="button" aria-label="Center preview on your location" onClick={() => resetPreview.current?.()}
      style={{ position: "absolute", right: 10, bottom: 10, zIndex: 2, width: 44, height: 44, display: "grid", placeItems: "center", border: 0, borderRadius: 12, background: "rgba(5,5,5,.82)", color: "#f5f1e6", cursor: "pointer" }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="6" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" /><circle cx="12" cy="12" r="1" /></svg>
    </button>}
  </>;
}
