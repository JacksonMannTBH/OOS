import type { Snapshot } from "./types";

const keyFor = (path: string) => `oos-aircraft-snapshot-v1:${path}`;
const displayKeyFor = (path: string) => `oos-aircraft-display-v1:${path}`;

// Cache the unfiltered feed per state. Preferences are applied when rendering.
export function readAircraftCache(path: string): Snapshot | null {
  if (typeof window === "undefined" || path.includes("&mock=")) return null;
  try {
    const saved = JSON.parse(window.localStorage.getItem(keyFor(path)) ?? "null") as Snapshot | null;
    if (!saved || !Number.isFinite(saved.fetched_at) || saved.fetched_at <= 0 ||
      !Array.isArray(saved.aircraft) || !saved.aircraft.every(plane => plane &&
        typeof plane.tail === "string" && typeof plane.airborne === "boolean")) return null;
    return { ...saved, source_ok: false };
  } catch {
    return null;
  }
}

export function saveAircraftCache(path: string, snapshot: Snapshot): void {
  if (typeof window === "undefined" || path.includes("&mock=") || snapshot.fetched_at <= 0) return;
  try {
    window.localStorage.setItem(keyFor(path), JSON.stringify(snapshot));
  } catch {
    // In-memory retention still works when persistent storage is unavailable.
  }
}

// Store the actual last display separately from the unmodified feed. This
// preserves both visible aircraft and aircraft already timed out before pause.
export function readAircraftDisplayCache(path: string): Snapshot | null {
  if (typeof window === "undefined" || path.includes("&mock=")) return null;
  try {
    const saved = JSON.parse(window.localStorage.getItem(displayKeyFor(path)) ?? "null") as Snapshot | null;
    return saved && Number.isFinite(saved.fetched_at) && saved.fetched_at > 0 &&
      Array.isArray(saved.aircraft) && saved.aircraft.every(plane => plane &&
        typeof plane.tail === "string" && typeof plane.airborne === "boolean") ? saved : null;
  } catch { return null; }
}

export function saveAircraftDisplayCache(path: string, snapshot: Snapshot): void {
  if (typeof window === "undefined" || path.includes("&mock=") || snapshot.fetched_at <= 0) return;
  try { window.localStorage.setItem(displayKeyFor(path), JSON.stringify(snapshot)); }
  catch { /* The in-memory display is still available when storage is full. */ }
}
