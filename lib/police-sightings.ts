import { haversineNm } from "./geo";
import type { StateCode } from "./app-states";

// 0.3 statute miles, shared with the server's prepare and vote checks.
export const POLICE_NEARBY_METERS = 482.8032;
export const POLICE_GROUP_METERS = POLICE_NEARBY_METERS;
export const POLICE_REPORT_LIFETIME_MS = 30 * 60_000;
export const POLICE_REPORT_COOLDOWN_MS = 30_000;
export const POLICE_COLOR = "#4da3ff";
export type PoliceSighting = {
  id: string;
  stateCode: StateCode;
  lat: number;
  lon: number;
  reportCount: number;
  lastReportedAt: number;
  expiresAt: number;
};

export function activePoliceSightings(sightings: PoliceSighting[], state: StateCode, now: number) {
  return sightings.filter(s => s.stateCode === state && s.expiresAt > now && s.reportCount > 0);
}

export function hasNearbyPolice(sightings: PoliceSighting[], rider: { lat: number; lon: number } | null): boolean {
  return !!rider && sightings.some(s => haversineNm(rider.lat, rider.lon, s.lat, s.lon) * 1852 <= POLICE_NEARBY_METERS);
}

export function policeReportAge(timestamp: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  return minutes === 0 ? "Just now" : `${minutes} min ago`;
}

// A filled police-officer silhouette, shared by the button and map markers.
export const POLICE_ICON_PATH = "M3 6 12 2l9 4-2 4H5L3 6Zm3 5h12v2a6 6 0 0 1-12 0v-2Zm6 9c-4.8 0-8 2-8 4h16c0-4-3.2-4-8-4Z";
