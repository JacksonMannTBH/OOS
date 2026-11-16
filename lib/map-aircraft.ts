import { isVisibleFlight } from "./aircraft-freshness";
import type { Aircraft } from "./types";

export function hasAircraftMapPosition(plane: Aircraft): boolean {
  return typeof plane.lat === "number" && Number.isFinite(plane.lat) && Math.abs(plane.lat) <= 90
    && typeof plane.lon === "number" && Number.isFinite(plane.lon) && Math.abs(plane.lon) <= 180;
}

export function aircraftMapTails(aircraft: Aircraft[]): Set<string> {
  return new Set(aircraft.filter(plane => isVisibleFlight(plane) && hasAircraftMapPosition(plane)).map(plane => plane.tail));
}
