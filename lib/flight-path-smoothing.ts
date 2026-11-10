type Position = { lat: number; lon: number };
type Coordinate = [number, number];

const METERS_PER_DEGREE = 111_195;
const CORNER_FRACTION = 0.18;
const MAX_CORNER_RADIUS_METERS = 200;
const CURVE_STEPS = 6;

// Round only the immediate neighborhood of a bend. Quadratic curves stay
// inside the adjoining segments' triangle, so they cannot overshoot a turn.
// This geometry is for display; recorded positions remain unchanged.
export function smoothFlightPath(points: readonly Position[]): Coordinate[] {
  if (points.length < 3) return points.map(({ lon, lat }) => [lon, lat]);

  const first = points[0]!;
  const result: Coordinate[] = [[first.lon, first.lat]];
  for (let index = 1; index < points.length - 1; index++) {
    const previous = points[index - 1]!;
    const corner = points[index]!;
    const next = points[index + 1]!;
    const longitudeScale = METERS_PER_DEGREE * Math.cos(corner.lat * Math.PI / 180);
    const incoming = [(corner.lon - previous.lon) * longitudeScale, (corner.lat - previous.lat) * METERS_PER_DEGREE];
    const outgoing = [(next.lon - corner.lon) * longitudeScale, (next.lat - corner.lat) * METERS_PER_DEGREE];
    const incomingLength = Math.hypot(incoming[0]!, incoming[1]!);
    const outgoingLength = Math.hypot(outgoing[0]!, outgoing[1]!);

    // Keep straight runs and repeated observations free of extra vertices.
    const alignment = (incoming[0]! * outgoing[0]! + incoming[1]! * outgoing[1]!) / (incomingLength * outgoingLength);
    if (incomingLength < 0.5 || outgoingLength < 0.5 || alignment > 0.995) {
      result.push([corner.lon, corner.lat]);
      continue;
    }

    const radius = Math.min(incomingLength * CORNER_FRACTION, outgoingLength * CORNER_FRACTION, MAX_CORNER_RADIUS_METERS);
    const before = radius / incomingLength;
    const after = radius / outgoingLength;
    const entry: Coordinate = [corner.lon + (previous.lon - corner.lon) * before, corner.lat + (previous.lat - corner.lat) * before];
    const exit: Coordinate = [corner.lon + (next.lon - corner.lon) * after, corner.lat + (next.lat - corner.lat) * after];
    result.push(entry);
    for (let step = 1; step <= CURVE_STEPS; step++) {
      const t = step / CURVE_STEPS;
      const remaining = 1 - t;
      result.push([
        remaining * remaining * entry[0] + 2 * remaining * t * corner.lon + t * t * exit[0],
        remaining * remaining * entry[1] + 2 * remaining * t * corner.lat + t * t * exit[1],
      ]);
    }
  }
  const last = points[points.length - 1]!;
  result.push([last.lon, last.lat]);
  return result;
}
