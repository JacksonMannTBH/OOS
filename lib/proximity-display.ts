"use client";

import { SS_TOKENS } from "./tokens";
import {
  DEFAULT_RIDE_STATUS_THRESHOLDS,
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
    return { band: "stop", label: "STOP", color: SS_TOKENS.danger, severity: 3 };
  }
  if (distanceNm <= normalized.warningNm) {
    return { band: "slow", label: "SLOW", color: SS_TOKENS.warn, severity: 2 };
  }
  return { band: "watch", label: "Watch", color: SS_TOKENS.sky, severity: 1 };
}
