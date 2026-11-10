import counties from "../data/california-counties.json";
import type { CaliforniaRegion } from "./california-regions";

// Census TIGERweb Counties, January 1, 2026 vintage. Coordinates are WGS84,
// generalized to 0.001 degrees. See data/california-counties-source.json.
type Ring = number[][];
type Polygon = Ring[];
type County = {
  properties: { GEOID: string; NAME: string };
  geometry: { type: string; coordinates: Polygon | Polygon[] };
};
const SOUTHERN_COUNTIES = new Set([
  "06025", "06029", "06037", "06059", "06065", "06071", "06073", "06083", "06111",
]);

function insideRing(lat: number, lon: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x, y] = ring[i]! as [number, number];
    const [previousX, previousY] = ring[j]! as [number, number];
    // A point exactly on the county edge belongs to that county.
    const cross = (lon - x) * (previousY - y) - (lat - y) * (previousX - x);
    if (Math.abs(cross) < 1e-12 && lon >= Math.min(x, previousX) && lon <= Math.max(x, previousX)
      && lat >= Math.min(y, previousY) && lat <= Math.max(y, previousY)) return true;
    if ((y > lat) !== (previousY > lat) && lon < (previousX - x) * (lat - y) / (previousY - y) + x) inside = !inside;
  }
  return inside;
}

function insidePolygon(lat: number, lon: number, polygon: Polygon): boolean {
  return Boolean(polygon[0] && insideRing(lat, lon, polygon[0]))
    && !polygon.slice(1).some((hole) => insideRing(lat, lon, hole));
}

export function californiaRegionForCoordinates(lat: number, lon: number): CaliforniaRegion | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 32 || lat > 42.1 || lon < -125 || lon > -114) return null;
  for (const county of counties.features as County[]) {
    const polygons = county.geometry.type === "Polygon"
      ? [county.geometry.coordinates as Polygon]
      : county.geometry.coordinates as Polygon[];
    if (polygons.some((polygon) => insidePolygon(lat, lon, polygon))) {
      return SOUTHERN_COUNTIES.has(county.properties.GEOID) ? "south" : "north";
    }
  }
  return null;
}
