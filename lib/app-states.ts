export const APP_STATES = [
  { id: "washington", code: "WA", label: "Washington", centerLat: 47.4, centerLon: -120.8 },
  { id: "california", code: "CA", label: "California", centerLat: 37.2, centerLon: -119.7 },
  { id: "texas", code: "TX", label: "Texas", centerLat: 31.0, centerLon: -99.0 },
  { id: "florida", code: "FL", label: "Florida", centerLat: 28.1, centerLon: -82.1 },
  { id: "ohio", code: "OH", label: "Ohio", centerLat: 40.2, centerLon: -82.8 },
  { id: "colorado", code: "CO", label: "Colorado", centerLat: 39.0, centerLon: -105.5 },
] as const;

export type AppState = (typeof APP_STATES)[number];
export type AppStateId = AppState["id"];
export type StateCode = AppState["code"];

export const DEFAULT_APP_STATE_ID: AppStateId = "washington";
export const DEFAULT_STATE_CODE: StateCode = "WA";
export const STATE_PREFERENCE_KEY = "oos_state_code";
export const STATE_CHANGE_EVENT = "oos-state-change";

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

export function setSelectedStateCode(code: StateCode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STATE_PREFERENCE_KEY, code);
  window.dispatchEvent(
    new CustomEvent(STATE_CHANGE_EVENT, { detail: { code } }),
  );
}
