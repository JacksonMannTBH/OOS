import type { Map as MaplibreMap } from "maplibre-gl";

export type MapOpeningCamera = {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
};

let openingCamera: MapOpeningCamera | null = null;
export function getMapOpeningCamera() { return openingCamera; }
export function setMapOpeningCamera(camera: MapOpeningCamera | null) { openingCamera = camera; }

/** Keep the map's current view available without sharing its WebGL lifecycle. */
export function trackMapOpeningCamera(map: MaplibreMap): () => void {
  const container = map.getContainer();
  const publish = () => {
    const camera: MapOpeningCamera = {
      center: map.getCenter().toArray(), zoom: map.getZoom(),
      bearing: map.getBearing(), pitch: map.getPitch(),
    };
    container.dataset.oosMapCamera = JSON.stringify(camera);
  };
  map.on("move", publish);
  publish();
  return () => { map.off("move", publish); delete container.dataset.oosMapCamera; };
}

export function readMapOpeningCamera(screen: "home" | "map" | "ride"): MapOpeningCamera | null {
  const selector = screen === "map" ? ".ss-map-screen" : screen === "ride" ? ".ss-ride-map" : ".ss-home-map-preview";
  const source = document.querySelector<HTMLElement>(
    `${selector} [data-oos-map-camera]`,
  );
  try {
    const camera = JSON.parse(source?.dataset.oosMapCamera ?? "null") as MapOpeningCamera | null;
    if (!camera || !Array.isArray(camera.center) || camera.center.length !== 2 ||
      ![...camera.center, camera.zoom, camera.bearing, camera.pitch].every(value => typeof value === "number" && Number.isFinite(value))) return null;
    return camera;
  } catch { return null; }
}
