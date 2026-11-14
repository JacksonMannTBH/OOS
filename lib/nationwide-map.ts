import { isStateCode } from "./app-states";
import { isVisibleFlight } from "./aircraft-freshness";
import type { Aircraft, Snapshot } from "./types";

export function parseNationwideMapSnapshot(value: unknown): Snapshot {
  const snapshot = value as Snapshot | null;
  if (!snapshot || !Number.isFinite(snapshot.fetched_at) || !Array.isArray(snapshot.aircraft)
    || !snapshot.aircraft.every(plane => plane && typeof plane.tail === "string"
      && typeof plane.airborne === "boolean" && isStateCode(plane.home_state_code))) {
    throw new Error("Invalid nationwide map data");
  }
  return snapshot;
}

/** Only map markers use the national list. Selected-state screens keep their own snapshot. */
export function mergeMapAircraft(selectedState: Aircraft[], nationwide: Aircraft[]): Aircraft[] {
  const byTail = new Map(nationwide.map(plane => [plane.tail, plane]));
  const reportedAt = (plane: Aircraft) => Date.parse(plane.observed_at ?? "") || 0;
  // Either transport can deliver first. Newer landings must also win.
  for (const plane of selectedState) {
    const previous = byTail.get(plane.tail);
    if (!previous || reportedAt(plane) >= reportedAt(previous)) byTail.set(plane.tail, plane);
  }
  return [...byTail.values()].filter(isVisibleFlight);
}
