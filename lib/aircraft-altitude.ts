export function formatAircraftAltitude(altitudeFeet: number | null | undefined): string {
  return typeof altitudeFeet === "number" && Number.isFinite(altitudeFeet)
    ? `${Math.round(altitudeFeet).toLocaleString("en-US")} ft`
    : "— ft";
}
