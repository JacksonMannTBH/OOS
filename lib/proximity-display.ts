"use client";

import {
  DEFAULT_RIDE_STATUS_THRESHOLDS,
  RIDE_STATUS_COLORS,
  normalizeRideStatusThresholds,
  type RideStatusThresholds,
} from "./ride-mode";

export type ProximityBand = "stop" | "slow" | "watch";

export type ProximityBandInfo = {
  band: ProximityBand;
  label: string;
  color: string;
  severity: number;
};

export function proximityBandForDistance(
  distanceNm: number,
  thresholds: RideStatusThresholds = DEFAULT_RIDE_STATUS_THRESHOLDS,
): ProximityBandInfo {
  const normalized = normalizeRideStatusThresholds(thresholds);
  if (distanceNm <= normalized.stopNm) {
    return { band: "stop", label: "STOP", color: RIDE_STATUS_COLORS.danger, severity: 3 };
  }
  if (distanceNm <= normalized.warningNm) {
    return { band: "slow", label: "SLOW", color: RIDE_STATUS_COLORS.warning, severity: 2 };
  }
  return { band: "watch", label: "Watch", color: RIDE_STATUS_COLORS.watch, severity: 1 };
}
