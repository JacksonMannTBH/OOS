export function rideMapBounds(rider: { lat: number; lon: number }, watchNm: number): [[number, number], [number, number]] {
  const dLat = watchNm / 60;
  const dLon = dLat / Math.max(0.01, Math.cos((rider.lat * Math.PI) / 180));
  return [[rider.lon - dLon, rider.lat - dLat], [rider.lon + dLon, rider.lat + dLat]];
}
