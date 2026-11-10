import type { Aircraft, Snapshot } from "./types";

export const AIRCRAFT_FRESHNESS_MS = 5 * 60_000;
export const AIRCRAFT_REPORT_TIMEOUT_MS = 4 * 60_000;

/** Screens and status indicators only show currently observed flights. */
export function isVisibleFlight(aircraft: Aircraft): boolean {
  return aircraft.airborne && aircraft.observed !== false;
}

/** A saved result is displayable regardless of the feed's current health. */
export function isAircraftStateResolved(snapshot: Snapshot): boolean {
  return snapshot.fetched_at > 0;
}

export function lastKnownLabel(aircraft: Aircraft): string {
  const minutes = aircraft.last_seen_min;
  return minutes == null ? "Last known position" : `Last seen ${minutes < 1 ? "just now" : `${minutes}m ago`}`;
}

/** Owner rule: four minutes without an individual report displays as landed.
 * Keep the original report time so a healthy fleet update cannot reset it. */
export function ageAircraftSnapshot(snapshot: Snapshot, now: number): Snapshot {
  return {
    ...snapshot,
    aircraft: snapshot.aircraft.map(plane => {
      const reportedAt = plane.observed_at ? Date.parse(plane.observed_at) : snapshot.fetched_at;
      if (!Number.isFinite(reportedAt) || reportedAt <= 0 || now - reportedAt < AIRCRAFT_REPORT_TIMEOUT_MS) return plane;
      return {
        ...plane,
        airborne: false,
        last_known_airborne: false,
        observed: false,
        observation_status: "grounded" as const,
        time_aloft_min: undefined,
        last_seen_min: Math.max(0, Math.floor((now - reportedAt) / 60_000)),
      };
    }),
  };
}

/** An unsuccessful response must not erase the last displayable state. */
export function retainAircraftSnapshot(previous: Snapshot | null, incoming: Snapshot): Snapshot {
  if (previous && previous.fetched_at > 0 && (
    incoming.fetched_at < previous.fetched_at ||
    (incoming.source_ok === false && incoming.aircraft.length === 0 && previous.aircraft.length > 0)
  )) return { ...previous, source_ok: incoming.source_ok };
  return incoming;
}
