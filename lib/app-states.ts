export const APP_STATES = [
  { id: "alabama", code: "AL", label: "Alabama", centerLat: 32.8, centerLon: -86.8 },
  { id: "alaska", code: "AK", label: "Alaska", centerLat: 64.2, centerLon: -152.0 },
  { id: "arizona", code: "AZ", label: "Arizona", centerLat: 34.3, centerLon: -111.7 },
  { id: "arkansas", code: "AR", label: "Arkansas", centerLat: 34.9, centerLon: -92.4 },
  { id: "california", code: "CA", label: "California", centerLat: 37.2, centerLon: -119.7 },
  { id: "colorado", code: "CO", label: "Colorado", centerLat: 39.0, centerLon: -105.5 },
  { id: "connecticut", code: "CT", label: "Connecticut", centerLat: 41.6, centerLon: -72.7 },
  { id: "delaware", code: "DE", label: "Delaware", centerLat: 39.0, centerLon: -75.5 },
  { id: "florida", code: "FL", label: "Florida", centerLat: 28.1, centerLon: -82.1 },
  { id: "georgia", code: "GA", label: "Georgia", centerLat: 32.6, centerLon: -83.4 },
  { id: "hawaii", code: "HI", label: "Hawaii", centerLat: 20.8, centerLon: -156.3 },
  { id: "idaho", code: "ID", label: "Idaho", centerLat: 44.2, centerLon: -114.5 },
  { id: "illinois", code: "IL", label: "Illinois", centerLat: 40.0, centerLon: -89.2 },
  { id: "indiana", code: "IN", label: "Indiana", centerLat: 39.9, centerLon: -86.3 },
  { id: "iowa", code: "IA", label: "Iowa", centerLat: 42.0, centerLon: -93.5 },
  { id: "kansas", code: "KS", label: "Kansas", centerLat: 38.5, centerLon: -98.3 },
  { id: "kentucky", code: "KY", label: "Kentucky", centerLat: 37.5, centerLon: -85.3 },
  { id: "louisiana", code: "LA", label: "Louisiana", centerLat: 31.0, centerLon: -92.0 },
  { id: "maine", code: "ME", label: "Maine", centerLat: 45.3, centerLon: -69.0 },
  { id: "maryland", code: "MD", label: "Maryland", centerLat: 39.0, centerLon: -76.7 },
  { id: "massachusetts", code: "MA", label: "Massachusetts", centerLat: 42.2, centerLon: -71.8 },
  { id: "michigan", code: "MI", label: "Michigan", centerLat: 44.3, centerLon: -85.6 },
  { id: "minnesota", code: "MN", label: "Minnesota", centerLat: 46.0, centerLon: -94.5 },
  { id: "mississippi", code: "MS", label: "Mississippi", centerLat: 32.7, centerLon: -89.7 },
  { id: "missouri", code: "MO", label: "Missouri", centerLat: 38.5, centerLon: -92.5 },
  { id: "montana", code: "MT", label: "Montana", centerLat: 47.0, centerLon: -109.6 },
  { id: "nebraska", code: "NE", label: "Nebraska", centerLat: 41.5, centerLon: -99.8 },
  { id: "nevada", code: "NV", label: "Nevada", centerLat: 39.3, centerLon: -116.6 },
  { id: "new-hampshire", code: "NH", label: "New Hampshire", centerLat: 43.8, centerLon: -71.6 },
  { id: "new-jersey", code: "NJ", label: "New Jersey", centerLat: 40.1, centerLon: -74.7 },
  { id: "new-mexico", code: "NM", label: "New Mexico", centerLat: 34.5, centerLon: -106.0 },
  { id: "new-york", code: "NY", label: "New York", centerLat: 42.9, centerLon: -75.5 },
  { id: "north-carolina", code: "NC", label: "North Carolina", centerLat: 35.6, centerLon: -79.8 },
  { id: "north-dakota", code: "ND", label: "North Dakota", centerLat: 47.5, centerLon: -100.5 },
  { id: "ohio", code: "OH", label: "Ohio", centerLat: 40.2, centerLon: -82.8 },
  { id: "oklahoma", code: "OK", label: "Oklahoma", centerLat: 35.6, centerLon: -97.5 },
  { id: "oregon", code: "OR", label: "Oregon", centerLat: 44.0, centerLon: -120.6 },
  { id: "pennsylvania", code: "PA", label: "Pennsylvania", centerLat: 40.9, centerLon: -77.8 },
  { id: "rhode-island", code: "RI", label: "Rhode Island", centerLat: 41.7, centerLon: -71.5 },
  { id: "south-carolina", code: "SC", label: "South Carolina", centerLat: 33.8, centerLon: -80.9 },
  { id: "south-dakota", code: "SD", label: "South Dakota", centerLat: 44.4, centerLon: -100.2 },
  { id: "tennessee", code: "TN", label: "Tennessee", centerLat: 35.8, centerLon: -86.4 },
  { id: "texas", code: "TX", label: "Texas", centerLat: 31.0, centerLon: -99.0 },
  { id: "utah", code: "UT", label: "Utah", centerLat: 39.3, centerLon: -111.7 },
  { id: "vermont", code: "VT", label: "Vermont", centerLat: 44.0, centerLon: -72.7 },
  { id: "virginia", code: "VA", label: "Virginia", centerLat: 37.5, centerLon: -79.0 },
  { id: "washington", code: "WA", label: "Washington", centerLat: 47.4, centerLon: -120.8 },
  { id: "west-virginia", code: "WV", label: "West Virginia", centerLat: 38.6, centerLon: -80.6 },
  { id: "wisconsin", code: "WI", label: "Wisconsin", centerLat: 44.6, centerLon: -89.8 },
  { id: "wyoming", code: "WY", label: "Wyoming", centerLat: 43.0, centerLon: -107.6 },
] as const;

export type AppState = (typeof APP_STATES)[number];
export type AppStateId = AppState["id"];
export type StateCode = AppState["code"];

export const DEFAULT_APP_STATE_ID: AppStateId = "washington";
export const DEFAULT_STATE_CODE: StateCode = "WA";
export const STATE_PREFERENCE_KEY = "oos_state_code";
export const STATE_SELECTION_SOURCE_KEY = "oos_state_selection_source";
export const STATE_CHANGE_EVENT = "oos-state-change";
export type StateSelectionSource = "automatic" | "manual";

export function isStateCode(value: unknown): value is StateCode {
  return (
    typeof value === "string" &&
    APP_STATES.some((state) => state.code === value.toUpperCase())
  );
}

export function isAppStateId(value: unknown): value is AppStateId {
  return (
    typeof value === "string" &&
    APP_STATES.some((state) => state.id === value)
  );
}

export function getAppState(value: string | null | undefined): AppState {
  const normalized = value?.trim();
  return (
    APP_STATES.find(
      (state) =>
        state.id === normalized || state.code === normalized?.toUpperCase(),
    ) ??
    APP_STATES.find((state) => state.code === DEFAULT_STATE_CODE)!
  );
}

export function stateCodeForId(id: AppStateId): StateCode {
  return getAppState(id).code;
}

export function stateIdForCode(code: StateCode): AppStateId {
  return getAppState(code).id;
}

export function getSelectedStateCode(): StateCode {
  if (typeof window === "undefined") return DEFAULT_STATE_CODE;
  const stored = window.localStorage.getItem(STATE_PREFERENCE_KEY);
  return isStateCode(stored) ? stored.toUpperCase() as StateCode : DEFAULT_STATE_CODE;
}

export function shouldAutoDetectStateSelection(
  storedCode: string | null,
  storedSource: string | null,
): boolean {
  return storedCode === null && storedSource === null;
}

export function shouldAutomaticallyDetectState(): boolean {
  if (typeof window === "undefined") return false;
  // A pre-existing preference predates source tracking and must be treated as
  // an intentional/manual choice so an upgrade never overwrites it.
  return shouldAutoDetectStateSelection(
    window.localStorage.getItem(STATE_PREFERENCE_KEY),
    window.localStorage.getItem(STATE_SELECTION_SOURCE_KEY),
  );
}

export function setSelectedStateCode(
  code: StateCode,
  source: StateSelectionSource = "manual",
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STATE_PREFERENCE_KEY, code);
  window.localStorage.setItem(STATE_SELECTION_SOURCE_KEY, source);
  window.dispatchEvent(
    new CustomEvent(STATE_CHANGE_EVENT, { detail: { code } }),
  );
}

export function setAutomaticallyDetectedStateCode(code: StateCode): boolean {
  if (!shouldAutomaticallyDetectState()) return false;
  setSelectedStateCode(code, "automatic");
  return true;
}
