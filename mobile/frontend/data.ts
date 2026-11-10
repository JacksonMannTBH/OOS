import type { AircraftCatalogEntry } from "../../lib/aircraft-data";
import type { RecentFlightForTail } from "../../lib/flights";
import type { FleetEntry, Snapshot } from "../../lib/types";
import { DEFAULT_STATE_CODE, type StateCode } from "../../lib/app-states";
export type { AircraftCatalogEntry, RecentFlightForTail };

const pending = new Map<string, Promise<unknown>>();
async function read<T>(path: string): Promise<T> {
  let request = pending.get(path);
  if (!request) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error("Live data is unavailable. Check your connection and try again.")); }, 15_000);
    });
    request = Promise.race([fetch(path, { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Live data is unavailable. Check your connection and try again.");
      return response.json();
    }), timeout]).finally(() => clearTimeout(timer));
    pending.set(path, request);
    void request.finally(() => { if (pending.get(path) === request) pending.delete(path); }).catch(() => {});
  }
  return request as Promise<T>;
}
export const getAircraftCatalogEntries = () => read<AircraftCatalogEntry[]>("/api/mobile?kind=catalog");
export async function getRegistry(): Promise<FleetEntry[]> { return (await getAircraftCatalogEntries()).map(item => item.aircraft); }
export const getSnapshotForRender = (state: StateCode = DEFAULT_STATE_CODE) => read<Snapshot>(`/api/aircraft?state=${encodeURIComponent(state)}`);
export const getMostRecentFlightForTail = (tail: string, nickname?: string | null) => read<RecentFlightForTail | null>(`/api/mobile?kind=recent-flight&tail=${encodeURIComponent(tail)}`);
export const getFlightById = (tail: string, nickname: string | null, flightId: string) => read<RecentFlightForTail | null>(`/api/mobile?kind=flight&tail=${encodeURIComponent(tail)}&flightId=${encodeURIComponent(flightId)}`);
export const getSpeedWarningEnabled = async () => (await read<{ speedWarningEnabled: boolean }>("/api/mobile?kind=settings")).speedWarningEnabled;
export { averageGroundSpeedKt, flightIdFromTs, parseFlightId } from "../../lib/flight-utils";

export const STARTING_SNAPSHOT: Snapshot = { fetched_at: 0, source: "adsbfi", source_ok: false, aircraft: [], live_seen_count: 0 };
