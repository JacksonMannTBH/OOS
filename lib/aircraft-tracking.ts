import { isStateCode, type StateCode } from "./app-states";

// Store exclusions so existing and newly added aircraft are tracked by default.
export type AircraftTrackingPreferences = Partial<Record<StateCode, string[]>>;
export const AIRCRAFT_TRACKING_STORAGE_KEY = "oos_aircraft_tracking";
export const AIRCRAFT_TRACKING_CHANGE_EVENT = "oos-aircraft-tracking-change";

export function parseAircraftTrackingPreferences(value: unknown): AircraftTrackingPreferences | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const preferences: AircraftTrackingPreferences = {};
  for (const [code, tails] of Object.entries(value)) {
    if (!isStateCode(code) || !Array.isArray(tails) || tails.length > 2000) return null;
    if (!tails.every((tail) => typeof tail === "string" && /^[A-Z0-9-]{2,16}$/i.test(tail.trim()))) return null;
    const normalized = [...new Set(tails.map((tail: string) => tail.trim().toUpperCase()))].sort();
    const state = code.toUpperCase() as StateCode;
    if (normalized.length) preferences[state] = [...new Set([...(preferences[state] ?? []), ...normalized])].sort();
  }
  return preferences;
}

export function isAircraftTracked(preferences: AircraftTrackingPreferences, state: StateCode, tail: string): boolean {
  return !(preferences[state] ?? []).includes(tail.trim().toUpperCase());
}

export function withAircraftTracked(preferences: AircraftTrackingPreferences, state: StateCode, tail: string, tracked: boolean): AircraftTrackingPreferences {
  const excluded = new Set(preferences[state] ?? []);
  const normalized = tail.trim().toUpperCase();
  if (tracked) excluded.delete(normalized);
  else excluded.add(normalized);
  return withStateAircraftExclusions(preferences, state, [...excluded]);
}

export function withStateAircraftExclusions(preferences: AircraftTrackingPreferences, state: StateCode, excluded: string[]): AircraftTrackingPreferences {
  const next = { ...preferences };
  if (excluded.length) next[state] = [...excluded].sort();
  else delete next[state];
  return next;
}

export function filterTrackedAircraft<T extends { tail: string }>(aircraft: T[], preferences: AircraftTrackingPreferences, state: StateCode): T[] {
  return aircraft.filter((plane) => isAircraftTracked(preferences, state, plane.tail));
}

export function readAircraftTrackingPreferences(): AircraftTrackingPreferences {
  if (typeof window === "undefined") return {};
  try {
    return parseAircraftTrackingPreferences(JSON.parse(window.localStorage.getItem(AIRCRAFT_TRACKING_STORAGE_KEY) ?? "{}")) ?? {};
  } catch {
    return {};
  }
}

export function saveAircraftTrackingPreferences(preferences: AircraftTrackingPreferences): void {
  window.localStorage.setItem(AIRCRAFT_TRACKING_STORAGE_KEY, JSON.stringify(preferences));
  window.dispatchEvent(new Event(AIRCRAFT_TRACKING_CHANGE_EVENT));
}
