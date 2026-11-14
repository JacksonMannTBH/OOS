import { OPS_AIRCRAFT } from "./aircraft-directory";
import { getAppState, getSelectedStateCode } from "./app-states";
import { getDevicePreference, updateDevicePreferences } from "./device-preferences";
import { californiaRegionForCoordinates } from "./california-location";

export type CaliforniaRegion = "north" | "south";
export const CALIFORNIA_REGION_KEY = "oos_california_region";
export const CALIFORNIA_REGION_EVENT = "oos-california-region-change";

// CHP is statewide; other fleets follow the home agency, never a flight's current position.
// Kern and Santa Barbara are south; Tulare and San Luis Obispo are north.
const SOUTHERN_AGENCIES = /inland division|southern division|border division|apple valley|thermal|fullerton|kern|bakersfield|santa barbara|ventura|camarillo|los angeles|lapd|fontana|anaheim|long beach|san bernard|san bernad|san diego|orange county|riverside|palm springs|chino|glendale|burbank|ontario|pasadena|corona|calimesa|hemet|altadena|commerce|huntington beach|pomona/i;
const NORTHERN_AGENCIES = /northern division|redding|mcclellan|auburn|golden gate|napa|fresno|paso robles|san jose|oakland|contra costa|sacramento|tulare|santa cruz|alameda|livermore|butte|oroville|merced|mather|san luis obispo|santa clara|east bay|el dorado|placerville|kings county|hanford|madera|marin|san rafael|modesto|monterey|salinas|placer|san joaquin|french camp|san mateo|redwood city|stanislaus|tehama|red bluff|trinity|weaverville|visalia|yolo|woodland|sonoma/i;

export function californiaRegionForAgency(unit: string): CaliforniaRegion | "both" | null {
  if (/\bCHP\b|\bCalifornia Highway Patrol\b/i.test(unit)) return "both";
  if (SOUTHERN_AGENCIES.test(unit)) return "south";
  if (NORTHERN_AGENCIES.test(unit)) return "north";
  return null;
}

const regionsByTail = new Map(OPS_AIRCRAFT
  .filter((row) => row.stateId === "california")
  .map((row) => [row.tail, californiaRegionForAgency(row.unit)]));

export function aircraftMatchesCaliforniaRegion(tail: string, region: CaliforniaRegion): boolean {
  const assigned = regionsByTail.get(tail.trim().toUpperCase());
  return assigned === "both" || assigned === region;
}

export function filterAircraftByCaliforniaRegion<T extends { tail: string }>(
  aircraft: T[], state: string, region: CaliforniaRegion,
): T[] {
  return state === "CA" || state === "california"
    ? aircraft.filter((row) => aircraftMatchesCaliforniaRegion(row.tail, region))
    : aircraft;
}

export function getSelectedCaliforniaRegion(): CaliforniaRegion {
  return getDevicePreference(CALIFORNIA_REGION_KEY) === "south" ? "south" : "north";
}

let pendingRegionSelections = 0;

export async function setSelectedCaliforniaRegion(region: CaliforniaRegion): Promise<void> {
  pendingRegionSelections++;
  try {
    await updateDevicePreferences({ [CALIFORNIA_REGION_KEY]: region });
  } finally {
    pendingRegionSelections--;
  }
  window.dispatchEvent(new Event(CALIFORNIA_REGION_EVENT));
}

export async function setAutomaticallyDetectedCaliforniaRegion(lat: number, lon: number): Promise<boolean> {
  // Match state detection: initialize once, preserve all saved/manual choices.
  // The pending guard also protects a manual selection still being saved.
  if (typeof window === "undefined" || pendingRegionSelections > 0
    || getSelectedStateCode() !== "CA" || getDevicePreference(CALIFORNIA_REGION_KEY) !== null) return false;
  const region = californiaRegionForCoordinates(lat, lon);
  if (!region) return false;
  await setSelectedCaliforniaRegion(region);
  return true;
}

export function getRegionalMapState(state: string, region: CaliforniaRegion) {
  const base = getAppState(state);
  if (base.code !== "CA") return base;
  return { ...base, ...(region === "south"
    ? { centerLat: 34.0, centerLon: -117.8 }
    : { centerLat: 38.0, centerLon: -121.0 }) };
}
