import type { RecordedRide } from "./ride-recording";

export function rideDistance(ride: RecordedRide): string {
  return ride.sampleCount > 0 ? `${(ride.distanceMeters / 1609.344).toFixed(1)} mi` : "— mi";
}
export function rideSpeed(ride: RecordedRide): string {
  return ride.topSpeedMps == null ? "— mph" : `${Math.round(ride.topSpeedMps * 2.236936)} mph`;
}
export function rideDuration(seconds: number): string {
  if (seconds < 60) return "<1 min";
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}
export function rideDateRange(ride: RecordedRide): string {
  const format = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  const start = new Date(ride.startedAt);
  return ride.endedAt == null ? format.format(start) : format.formatRange(start, new Date(ride.endedAt));
}
export function rideTimeRange(ride: RecordedRide): string {
  const format = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  const start = format.format(new Date(ride.startedAt));
  return ride.endedAt == null ? start : `${start}–${format.format(new Date(ride.endedAt))}`;
}
export function rideDateTime(ride: RecordedRide): string {
  const start = new Date(ride.startedAt);
  const date = (value: Date) => value.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = (value: Date) => value.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const started = `${date(start)} · ${time(start)}`;
  if (ride.endedAt == null) return started;
  const end = new Date(ride.endedAt);
  const sameDay = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth() && start.getDate() === end.getDate();
  return `${started} – ${sameDay ? time(end) : `${date(end)} · ${time(end)}`}`;
}
