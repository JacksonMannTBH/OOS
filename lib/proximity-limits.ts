export const STATUTE_MILES_PER_NM = 1.150779;
export const PROXIMITY_MIN_MI = 1;
export const PROXIMITY_MAX_MI = 150;

function round(value: number, precision: number): number {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

export function statuteMilesToNm(miles: number): number {
  return miles / STATUTE_MILES_PER_NM;
}

export function nmToStatuteMiles(nm: number): number {
  return nm * STATUTE_MILES_PER_NM;
}

export function clampProximityMiles(miles: number): number {
  return round(Math.max(PROXIMITY_MIN_MI, Math.min(PROXIMITY_MAX_MI, miles)), 1);
}

export function clampProximityNm(nm: number): number {
  const miles = clampProximityMiles(nmToStatuteMiles(nm));
  return round(statuteMilesToNm(miles), 3);
}
