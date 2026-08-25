"use client";

import { useEffect, useRef } from "react";
import maplibregl, {
  GeoJSONSource,
  Map as MaplibreMap,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { aircraftSvg, glyphRoleFor } from "@/lib/brand/aircraft-glyphs";
import { MAP_STYLE_URL } from "@/lib/map-style";
import type {
  RideContact,
  RideStatus,
  RideStatusThresholds,
} from "@/lib/ride-mode";

type RiderPoint = { lat: number; lon: number };

type Props = {
  status: RideStatus;
  rider: RiderPoint | null;
  contacts: RideContact[];
  distanceBands: RideStatusThresholds;
};

type RideMapState = Props & { rider: RiderPoint };

type StyleLayerLike = {
  id: string;
  type?: string;
  layout?: Record<string, unknown>;
  "source-layer"?: string;
};

const STATUS_COLORS: Record<RideStatus, string> = {
  clear: "#39d98a",
  watch: "#60a5fa",
  warning: "#f6c431",
  danger: "#ff4d4f",
};

const MAP_ICON_SIZE = 52;
const RIDE_PLANE_ICON_KEY = "ride-aircraft-plane-cessna";
const PLANE_ASSET_VERSION = "cessna-v1";
const RING_SEGMENTS = 96;
const CAMERA_PADDING_PX = 5;
const MAP_LAYER_PREFIX = "ride-";

export default function RideMap(props: Props) {
  const visibleContactCount = props.contacts.filter(
    (contact) => contact.distanceNm <= props.distanceBands.watchNm,
  ).length;
  const closestContact = props.contacts[0] ?? null;
  const nearestVisible =
    closestContact && closestContact.distanceNm <= props.distanceBands.watchNm
      ? closestContact
      : null;
  const nearestOffMap =
    props.rider &&
    closestContact &&
    closestContact.distanceNm > props.distanceBands.watchNm
      ? closestContact
      : null;
  const offMapBearingDeg = nearestOffMap
    ? normalizeDegrees(nearestOffMap.bearingDeg)
    : null;
  const watchText = formatNm(props.distanceBands.watchNm);
  const ariaLabel = props.rider
    ? `Ride map. The outer edge is the ${watchText} nautical mile Watch area. ${visibleContactCount} tracked aircraft ${visibleContactCount === 1 ? "is" : "are"} inside it.${
        nearestVisible
          ? ` The nearest is ${nearestVisible.distanceNm.toFixed(1)} nautical miles away.`
          : nearestOffMap
            ? ` The nearest tracked aircraft is ${nearestOffMap.distanceNm.toFixed(1)} nautical miles away, outside the map; an arrow points toward it.`
          : ""
      } North is up.`
    : "Ride map waiting for your location.";

  return (
    <section
      aria-label={ariaLabel}
      style={{
        width: "min(70vw, 320px, 42dvh)",
        aspectRatio: "1",
        position: "relative",
        flex: "0 0 auto",
        overflow: "visible",
      }}
    >
      <div
        className="ss-ride-map"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          overflow: "hidden",
          border: `3px solid color-mix(in srgb, ${STATUS_COLORS[props.status]} 78%, #f5f2e8)`,
          background:
            "radial-gradient(circle at 50% 50%, #222820 0%, #0a0b0a 68%, #020202 100%)",
          boxShadow: "0 18px 48px rgba(0,0,0,0.48)",
        }}
      >
        {props.rider ? (
          <RideMapCanvas {...props} rider={props.rider} />
        ) : (
          <LocationPlaceholder />
        )}
      </div>

      {offMapBearingDeg != null && (
        <OffMapAircraftArrow bearingDeg={offMapBearingDeg} />
      )}
    </section>
  );
}

function OffMapAircraftArrow({ bearingDeg }: { bearingDeg: number }) {
  const radians = ((bearingDeg - 90) * Math.PI) / 180;
  const radiusPercent = 55;
  const left = 50 + Math.cos(radians) * radiusPercent;
  const top = 50 + Math.sin(radians) * radiusPercent;

  return (
    <div
      className="ss-ride-off-map-arrow"
      aria-hidden
      style={{
        position: "absolute",
        zIndex: 5,
        left: `${left}%`,
        top: `${top}%`,
        width: 38,
        height: 38,
        borderRadius: "50%",
        border: "2px solid #f6c431",
        background: "#050505",
        boxShadow:
          "0 0 0 5px rgba(246,196,49,0.18), 0 0 24px rgba(246,196,49,0.68)",
        display: "grid",
        placeItems: "center",
        pointerEvents: "none",
        transform: `translate(-50%, -50%) rotate(${bearingDeg}deg)`,
        transformOrigin: "center",
      }}
    >
      <span
        style={{
          width: 0,
          height: 0,
          borderLeft: "7px solid transparent",
          borderRight: "7px solid transparent",
          borderBottom: "18px solid #f6c431",
          transform: "translateY(-1px)",
        }}
      />
    </div>
  );
}

function RideMapCanvas(props: RideMapState) {
  const { contacts, distanceBands, rider, status } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const readyRef = useRef(false);
  const latestRef = useRef<RideMapState>(props);
  latestRef.current = { contacts, distanceBands, rider, status };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const initial = latestRef.current;

    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE_URL,
      center: [initial.rider.lon, initial.rider.lat],
      zoom: 10,
      bearing: 0,
      pitch: 0,
      interactive: false,
      attributionControl: false,
      renderWorldCopies: false,
      maxPitch: 0,
    });
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    collapseMapAttribution(container);
    mapRef.current = map;
    let disposed = false;

    const onLoad = async () => {
      applyRideMapTheme(map);
      const icons = await loadAircraftIcons();
      if (disposed || mapRef.current !== map) {
        icons.forEach((icon) => icon.image.close?.());
        return;
      }
      icons.forEach(({ key, image }) => map.addImage(key, image));
      addRideLayers(map);
      readyRef.current = true;
      updateRideMap(map, latestRef.current, false);
      collapseMapAttribution(container);
    };

    map.on("load", onLoad);
    return () => {
      disposed = true;
      readyRef.current = false;
      map.off("load", onLoad);
      map.remove();
      mapRef.current = null;
    };
    // The map owns its lifecycle; prop changes flow through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    updateRideMap(
      map,
      { contacts, distanceBands, rider, status },
      true,
    );
  }, [
    contacts,
    distanceBands,
    rider,
    status,
  ]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        background: "#111514",
      }}
    />
  );
}

function LocationPlaceholder() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(circle, rgba(96,165,250,0.13), transparent 62%)",
        color: "#a9a28a",
        fontSize: 12,
        fontWeight: 900,
        letterSpacing: "0.08em",
      }}
    >
      LOCATING
    </div>
  );
}

function updateRideMap(
  map: MaplibreMap,
  state: RideMapState,
  animate: boolean,
) {
  setRingData(map, state);
  setRiderData(map, state.rider);
  setContactData(map, state);
  setCamera(map, state, animate);
}

function addRideLayers(map: MaplibreMap) {
  map.addSource("ride-rings", {
    type: "geojson",
    data: emptyFeatureCollection(),
  });
  map.addLayer({
    id: "ride-rings",
    type: "line",
    source: "ride-rings",
    filter: ["==", ["geometry-type"], "LineString"],
    paint: {
      "line-color": "#ffffff",
      "line-opacity": ["case", ["boolean", ["get", "active"], false], 1, 0.76],
      "line-width": ["case", ["boolean", ["get", "active"], false], 3.25, 1.75],
      "line-dasharray": [2, 1.6],
    },
  });

  map.addSource("ride-rider", {
    type: "geojson",
    data: emptyFeatureCollection(),
  });
  map.addLayer({
    id: "ride-rider-halo",
    type: "circle",
    source: "ride-rider",
    paint: {
      "circle-radius": 14,
      "circle-color": "#8bd2ff",
      "circle-opacity": 0.2,
      "circle-blur": 0.35,
    },
  });
  map.addLayer({
    id: "ride-rider",
    type: "circle",
    source: "ride-rider",
    paint: {
      "circle-radius": 6.5,
      "circle-color": "#8bd2ff",
      "circle-stroke-color": "#f8fbff",
      "circle-stroke-width": 2,
    },
  });

  map.addSource("ride-contacts", {
    type: "geojson",
    data: emptyFeatureCollection(),
  });
  map.addLayer({
    id: "ride-contact-halos",
    type: "circle",
    source: "ride-contacts",
    paint: {
      "circle-radius": ["case", ["boolean", ["get", "nearest"], false], 18, 13],
      "circle-color": ["get", "color"],
      "circle-opacity": ["case", ["boolean", ["get", "nearest"], false], 0.42, 0.22],
      "circle-blur": 0.4,
    },
  });
  map.addLayer({
    id: "ride-contacts",
    type: "symbol",
    source: "ride-contacts",
    layout: {
      "icon-image": ["get", "icon"],
      "icon-size": ["case", ["boolean", ["get", "nearest"], false], 0.95, 0.76],
      "icon-rotate": ["get", "track"],
      "icon-rotation-alignment": "map",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
    paint: {
      "icon-opacity": 1,
    },
  });
}

function setRingData(map: MaplibreMap, state: RideMapState) {
  const source = map.getSource("ride-rings") as GeoJSONSource | undefined;
  if (!source) return;

  const ringSpecs = [
    {
      band: "warning",
      nm: state.distanceBands.warningNm,
      active: state.status === "warning",
    },
    {
      band: "stop",
      nm: state.distanceBands.stopNm,
      active: state.status === "danger",
    },
  ] as const;
  const features: GeoJSON.Feature[] = [];

  for (const ring of ringSpecs) {
    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: circleRingCoords(
          state.rider.lat,
          state.rider.lon,
          ring.nm,
        ),
      },
      properties: { band: ring.band, active: ring.active },
    });
  }

  source.setData({ type: "FeatureCollection", features });
}

function setRiderData(map: MaplibreMap, rider: RiderPoint) {
  const source = map.getSource("ride-rider") as GeoJSONSource | undefined;
  if (!source) return;
  source.setData({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [rider.lon, rider.lat] },
        properties: {},
      },
    ],
  });
}

function setContactData(map: MaplibreMap, state: RideMapState) {
  const source = map.getSource("ride-contacts") as GeoJSONSource | undefined;
  if (!source) return;
  const statusColor = STATUS_COLORS[state.status];
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];

  state.contacts.forEach((contact, index) => {
    if (contact.distanceNm > state.distanceBands.watchNm) return;
    if (contact.plane.lat == null || contact.plane.lon == null) return;
    const role = glyphRoleFor(contact.plane.role);
    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [contact.plane.lon, contact.plane.lat],
      },
      properties: {
        icon: iconKey(role),
        track: contact.plane.heading ?? 0,
        nearest: index === 0,
        color: index === 0 ? statusColor : "#f6c431",
      },
    });
  });

  source.setData({ type: "FeatureCollection", features });
}

function setCamera(map: MaplibreMap, state: RideMapState, animate: boolean) {
  const watchNm = state.distanceBands.watchNm;
  const dLat = watchNm / 60;
  const dLon = dLat / Math.max(0.01, Math.cos((state.rider.lat * Math.PI) / 180));
  const camera = map.cameraForBounds(
    [
      [state.rider.lon - dLon, state.rider.lat - dLat],
      [state.rider.lon + dLon, state.rider.lat + dLat],
    ],
    { padding: CAMERA_PADDING_PX, maxZoom: 16 },
  );
  if (!camera) return;

  const bearing = 0;
  const currentCenter = map.getCenter();
  const bearingDelta = Math.abs(shortestHeadingDelta(map.getBearing(), bearing));
  const centerDelta = Math.hypot(
    currentCenter.lng - state.rider.lon,
    currentCenter.lat - state.rider.lat,
  );
  const zoom = camera.zoom ?? map.getZoom();
  const zoomDelta = Math.abs(map.getZoom() - zoom);
  if (bearingDelta < 1.5 && centerDelta < 0.000002 && zoomDelta < 0.002) return;

  const nextCamera = {
    center: [state.rider.lon, state.rider.lat] as [number, number],
    zoom,
    bearing,
    pitch: 0,
  };
  if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    map.jumpTo(nextCamera);
  } else {
    map.easeTo({ ...nextCamera, duration: 260 });
  }
}

function applyRideMapTheme(map: MaplibreMap) {
  const layers = (map.getStyle().layers ?? []) as StyleLayerLike[];
  for (const layer of layers) {
    if (layer.id.startsWith(MAP_LAYER_PREFIX)) continue;
    const descriptor = `${layer.id} ${layer["source-layer"] ?? ""}`.toLowerCase();
    const isWater = /water|ocean|lake|river|bay|marine/.test(descriptor);
    const isRoad = /road|street|highway|motorway|transport/.test(descriptor);
    const isBoundary = /boundary|admin|state|county/.test(descriptor);
    const isGreen = /park|forest|wood|grass|landcover|landuse/.test(descriptor);
    const isMinorRoad =
      isRoad &&
      /minor|service|residential|unclassified|living_street|track|path|footway|cycleway|pedestrian|steps|driveway|alley/.test(
        descriptor,
      );
    const isDistractingDetail =
      /building|structure|address|housenumber|poi|shop|amenity|transit|rail|airport|aeroway/.test(
        descriptor,
      );
    const isRoadLabel =
      layer.type === "symbol" && isRoad && Boolean(layer.layout?.["text-field"]);

    try {
      if (isDistractingDetail || isMinorRoad || isRoadLabel) {
        map.setLayoutProperty(layer.id, "visibility", "none");
        continue;
      }
      if (layer.type === "background") {
        map.setPaintProperty(layer.id, "background-color", "#202526");
      } else if (layer.type === "fill") {
        map.setPaintProperty(
          layer.id,
          "fill-color",
          isWater ? "#081013" : isGreen ? "#273128" : "#2f3435",
        );
        map.setPaintProperty(layer.id, "fill-opacity", 1);
      } else if (layer.type === "line") {
        map.setPaintProperty(
          layer.id,
          "line-color",
          isWater
            ? "#101a1d"
            : isRoad
              ? "#8b7330"
              : isBoundary
                ? "#555851"
                : "#3b4142",
        );
        map.setPaintProperty(layer.id, "line-opacity", isRoad ? 0.58 : 0.66);
      }
      if (layer.type === "symbol" && layer.layout?.["text-field"]) {
        map.setPaintProperty(layer.id, "text-color", "#d8d2c0");
        map.setPaintProperty(layer.id, "text-halo-color", "#121515");
        map.setPaintProperty(layer.id, "text-halo-width", 1.6);
      }
    } catch {
      // Provider styles can contain layers that do not expose every property.
    }
  }
}

function collapseMapAttribution(container: HTMLDivElement) {
  const attribution = container.querySelector<HTMLDetailsElement>(
    ".maplibregl-ctrl-attrib.maplibregl-compact",
  );
  if (!attribution) return;
  attribution.classList.remove("maplibregl-compact-show");
  attribution.setAttribute("open", "");
}

async function loadAircraftIcons() {
  const helicopterRoles = ["patrol", "sar"] as const;
  return await Promise.all([
    loadImageBitmap(
      `/icons/plane/cessna-body.png?v=${PLANE_ASSET_VERSION}`,
      MAP_ICON_SIZE,
    ).then((image) => ({ key: RIDE_PLANE_ICON_KEY, image })),
    ...helicopterRoles.map(async (role) => ({
      key: iconKey(role),
      image: await loadSvgBitmap(
        aircraftSvg(role, {
          size: MAP_ICON_SIZE,
          tone: "radar",
          color: "#f6c431",
          strokeColor: "#050908",
          blipColor: "#050908",
        }),
        MAP_ICON_SIZE,
      ),
    })),
  ]);
}

async function loadImageBitmap(src: string, size: number): Promise<ImageBitmap> {
  const image = new Image(size, size);
  image.src = src;
  await image.decode();
  return await createImageBitmap(image, {
    resizeWidth: size,
    resizeHeight: size,
  });
}

async function loadSvgBitmap(svg: string, size: number): Promise<ImageBitmap> {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image(size, size);
    image.src = url;
    await image.decode();
    return await createImageBitmap(image, {
      resizeWidth: size,
      resizeHeight: size,
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function iconKey(role: string): string {
  if (role === "fixed_wing" || role === "transport") {
    return RIDE_PLANE_ICON_KEY;
  }
  return `ride-aircraft-${role}`;
}

function circleRingCoords(
  centerLat: number,
  centerLon: number,
  radiusNm: number,
): Array<[number, number]> {
  const coordinates: Array<[number, number]> = [];
  for (let step = 0; step <= RING_SEGMENTS; step++) {
    coordinates.push(
      pointAtBearing(
        centerLat,
        centerLon,
        radiusNm,
        (step / RING_SEGMENTS) * 360,
      ),
    );
  }
  return coordinates;
}

function pointAtBearing(
  centerLat: number,
  centerLon: number,
  radiusNm: number,
  bearingDeg: number,
): [number, number] {
  const radians = (bearingDeg * Math.PI) / 180;
  const dLat = (radiusNm / 60) * Math.cos(radians);
  const lonScale = Math.max(0.01, Math.cos((centerLat * Math.PI) / 180));
  const dLon = ((radiusNm / 60) * Math.sin(radians)) / lonScale;
  return [centerLon + dLon, centerLat + dLat];
}

function shortestHeadingDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function emptyFeatureCollection(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function formatNm(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
