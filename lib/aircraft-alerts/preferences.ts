import { OPS_AIRCRAFT } from "../aircraft-directory";
import { readAircraftTrackingPreferences, withStateAircraftExclusions, type AircraftTrackingPreferences } from "../aircraft-tracking";
import { aircraftMatchesCaliforniaRegion, getSelectedCaliforniaRegion, type CaliforniaRegion } from "../california-regions";
import type { StateCode } from "../app-states";

export function notificationTrackingPreferences(
  preferences: AircraftTrackingPreferences,
  state: StateCode,
  region: CaliforniaRegion,
): AircraftTrackingPreferences {
  if (state !== "CA") return preferences;
  // Reuse the server's existing exclusion checks, including its final recheck
  // of queued alerts. Never persist regional exclusions as manual selections.
  const excluded = new Set(preferences.CA ?? []);
  for (const aircraft of OPS_AIRCRAFT) {
    if (aircraft.stateId === "california" && !aircraftMatchesCaliforniaRegion(aircraft.tail, region)) excluded.add(aircraft.tail);
  }
  return withStateAircraftExclusions(preferences, "CA", [...excluded]);
}

export function readNotificationTrackingPreferences(state: StateCode): AircraftTrackingPreferences {
  return notificationTrackingPreferences(readAircraftTrackingPreferences(), state, getSelectedCaliforniaRegion());
}
