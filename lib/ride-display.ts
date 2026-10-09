export const SPEEDOMETER_STORAGE_KEY = "oos_ride_speedometer_visible";
export const SPEEDOMETER_CHANGE_EVENT = "oos-ride-speedometer-change";
let sessionVisible = true;

export function readSpeedometerVisible(): boolean {
  if (typeof window === "undefined") return true;
  try { return window.localStorage.getItem(SPEEDOMETER_STORAGE_KEY) !== "0"; }
  catch { return sessionVisible; }
}

export function writeSpeedometerVisible(visible: boolean): void {
  if (typeof window === "undefined") return;
  sessionVisible = visible;
  try { window.localStorage.setItem(SPEEDOMETER_STORAGE_KEY, visible ? "1" : "0"); }
  catch { /* Keep this session's choice when storage is unavailable. */ }
  window.dispatchEvent(new CustomEvent(SPEEDOMETER_CHANGE_EVENT, { detail: visible }));
}
