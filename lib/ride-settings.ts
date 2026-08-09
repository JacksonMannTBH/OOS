"use client";

import {
  DEFAULT_RIDE_STATUS_THRESHOLDS,
  normalizeRideStatusThresholds,
  type RideStatusThresholds,
} from "./ride-mode";

export const RIDE_STATUS_THRESHOLDS_KEY = "ss_ride_status_thresholds";
export const RIDE_STATUS_THRESHOLDS_EVENT = "ss_ride_status_thresholds_change";

export function getRideStatusThresholds(): RideStatusThresholds {
  if (typeof window === "undefined") return DEFAULT_RIDE_STATUS_THRESHOLDS;
  try {
    const raw = window.localStorage.getItem(RIDE_STATUS_THRESHOLDS_KEY);
    if (!raw) return DEFAULT_RIDE_STATUS_THRESHOLDS;
    const parsed = JSON.parse(raw) as Partial<RideStatusThresholds>;
    return normalizeRideStatusThresholds(parsed);
  } catch {
    return DEFAULT_RIDE_STATUS_THRESHOLDS;
  }
}

export function setRideStatusThresholds(
  thresholds: Partial<RideStatusThresholds>,
): RideStatusThresholds {
  const normalized = normalizeRideStatusThresholds(thresholds);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      RIDE_STATUS_THRESHOLDS_KEY,
      JSON.stringify(normalized),
    );
    window.dispatchEvent(
      new CustomEvent<RideStatusThresholds>(RIDE_STATUS_THRESHOLDS_EVENT, {
        detail: normalized,
      }),
    );
  }
  return normalized;
}
