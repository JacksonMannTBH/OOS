import { isStateCode, type StateCode } from "../app-states";
import { isAircraftTracked, parseAircraftTrackingPreferences } from "../aircraft-tracking";

export function isTakeoffDeliverySelected(subscription: {
  enabled: boolean;
  stateCode: string;
  excludedAircraftByState: unknown;
}, eventState: unknown, tail: string): boolean {
  if (!subscription.enabled || !isStateCode(eventState) || subscription.stateCode !== eventState) return false;
  const preferences = parseAircraftTrackingPreferences(subscription.excludedAircraftByState);
  // Invalid persisted preferences must not accidentally allow excluded aircraft.
  return preferences !== null && isAircraftTracked(preferences, eventState.toUpperCase() as StateCode, tail);
}
