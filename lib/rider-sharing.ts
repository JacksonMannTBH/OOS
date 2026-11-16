import { DINKIE_RIDER_ICONS } from "./elite-rider-icons";

export type RiderPreferences = { username: string; icon: string; visible: boolean; shareSpeed: boolean };
export type RiderProfile = RiderPreferences & { id: string; elite: boolean; eliteUntil: number | null; activeSession: string | null };
export type SharedRider = {
  id: string; username: string; icon: string; lat: number; lon: number;
  speedMps?: number; heading?: number; capturedAt: number; expiresAt: number; version: number;
};
export type RiderEvent = { id: string; version: number; rider?: SharedRider };
export type RiderBounds = { west: number; south: number; east: number; north: number };
export const RIDER_TTL_MS = 45_000;
export const RIDER_PREFERENCES_KEY = "oos_elite_ui_preferences";
export const RIDER_PROFILE_CHANGED = "oos:rider-profile";
export const validRiderIcon = (value: unknown): value is string => typeof value === "string" && DINKIE_RIDER_ICONS.some(icon => icon.id === value);
export const validRiderUsername = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9_]{1,20}$/.test(value);
export const riderTopic = (lat: number, lon: number) => `oos-riders:${Math.min(89, Math.floor((lat + 90) / 2))}:${Math.min(179, Math.floor((lon + 180) / 2))}`;
export function riderTopics(bounds: RiderBounds): string[] {
  const topics: string[] = [];
  for (let y = Math.floor((bounds.south + 90) / 2); y <= Math.min(89, Math.floor((bounds.north + 90) / 2)); y++) {
    for (let x = Math.floor((bounds.west + 180) / 2); x <= Math.min(179, Math.floor((bounds.east + 180) / 2)); x++) topics.push(`oos-riders:${y}:${x}`);
  }
  return topics;
}
export function validRiderBounds(b: RiderBounds): boolean {
  return Object.values(b).every(Number.isFinite) && b.west >= -180 && b.east <= 180 && b.south >= -90 && b.north <= 90 && b.east > b.west && b.north > b.south && b.east - b.west <= 8.001 && b.north - b.south <= 8.001;
}
export function isSharedRider(value: unknown): value is SharedRider {
  if (!value || typeof value !== "object") return false;
  const r = value as SharedRider;
  return typeof r.id === "string" && /^[a-f0-9-]{36}$/.test(r.id) && validRiderUsername(r.username) && validRiderIcon(r.icon) &&
    Number.isFinite(r.lat) && r.lat >= -90 && r.lat <= 90 && Number.isFinite(r.lon) && r.lon >= -180 && r.lon <= 180 &&
    Number.isSafeInteger(r.version) && Number.isFinite(r.capturedAt) && Number.isFinite(r.expiresAt) && r.expiresAt > r.capturedAt && r.expiresAt - r.capturedAt <= RIDER_TTL_MS + 5_000 &&
    (r.speedMps === undefined || Number.isFinite(r.speedMps) && r.speedMps >= 0 && r.speedMps <= 150) &&
    (r.heading === undefined || Number.isFinite(r.heading) && r.heading >= 0 && r.heading < 360);
}

/** Tombstones prevent a delayed heartbeat or snapshot from restoring a hidden rider. */
export class RiderCollection {
  private values = new Map<string, SharedRider>();
  private versions = new Map<string, number>();
  accept(value: unknown): boolean {
    if (!value || typeof value !== "object") return false;
    const event = value as RiderEvent;
    if (typeof event.id !== "string" || !Number.isSafeInteger(event.version) || (this.versions.get(event.id) ?? -1) >= event.version) return false;
    if (event.rider && (!isSharedRider(event.rider) || event.rider.id !== event.id || event.rider.version !== event.version)) return false;
    this.versions.set(event.id, event.version);
    if (event.rider) this.values.set(event.id, event.rider); else this.values.delete(event.id);
    return true;
  }
  list(now = Date.now()): SharedRider[] { return [...this.values.values()].filter(r => r.expiresAt > now); }
  removeMissing(ids: Set<string>, canRemove: (id: string) => boolean) {
    for (const id of this.values.keys()) if (!ids.has(id) && canRemove(id)) this.values.delete(id);
  }
}
