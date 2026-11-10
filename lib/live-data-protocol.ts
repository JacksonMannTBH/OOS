import type { StateCode } from "./app-states";
import type { Snapshot } from "./types";

export type LiveTrailPoint = { lat: number; lon: number; ts: number };
export type LiveState = {
  version: 1;
  state: StateCode;
  revision: number;
  snapshot: Snapshot;
  trails: Record<string, LiveTrailPoint[]>;
};
export type LiveFrame = {
  version: 1; state: StateCode; revision: number;
  index: number; count: number; data: string;
};
export const liveTopic = (state: StateCode) => `oos-live:${state}`;
// Even JSON escaping and four-byte Unicode stay below the broadcast limit.
const CHUNK_CHARS = 24_000;
const MAX_CHUNKS = 256;

export function encodeLiveState(update: LiveState): LiveFrame[] {
  const data = JSON.stringify(update);
  const count = Math.ceil(data.length / CHUNK_CHARS);
  if (count > MAX_CHUNKS) throw new Error("Live state exceeds broadcast limit");
  return Array.from({ length: count }, (_, index) => ({
    version: 1, state: update.state, revision: update.revision, index, count,
    data: data.slice(index * CHUNK_CHARS, (index + 1) * CHUNK_CHARS),
  }));
}

export function isLiveState(value: unknown, state: StateCode): value is LiveState {
  if (!value || typeof value !== "object") return false;
  const v = value as LiveState;
  return v.version === 1 && v.state === state && Number.isFinite(v.revision) &&
    !!v.snapshot && Number.isFinite(v.snapshot.fetched_at) && Array.isArray(v.snapshot.aircraft) &&
    !!v.trails && typeof v.trails === "object" && !Array.isArray(v.trails);
}

/** A partial, duplicate, or older update must never replace a complete state. */
export class LiveStateAssembler {
  private pending: { revision: number; count: number; parts: Map<number, string> } | null = null;
  private applied = 0;
  constructor(private state: StateCode) {}

  acceptState(update: LiveState): LiveState | null {
    if (!isLiveState(update, this.state) || update.revision <= this.applied) return null;
    this.applied = update.revision;
    if (this.pending && this.pending.revision <= update.revision) this.pending = null;
    return update;
  }

  acceptFrame(value: unknown): LiveState | null {
    if (!value || typeof value !== "object") return null;
    const f = value as LiveFrame;
    if (f.version !== 1 || f.state !== this.state || !Number.isFinite(f.revision) || f.revision <= this.applied ||
      !Number.isInteger(f.count) || f.count < 1 || f.count > MAX_CHUNKS ||
      !Number.isInteger(f.index) || f.index < 0 || f.index >= f.count ||
      typeof f.data !== "string" || f.data.length > CHUNK_CHARS) return null;
    if (this.pending && f.revision < this.pending.revision) return null;
    if (!this.pending || f.revision > this.pending.revision) {
      this.pending = { revision: f.revision, count: f.count, parts: new Map() };
    }
    if (this.pending.count !== f.count) return null;
    this.pending.parts.set(f.index, f.data);
    if (this.pending.parts.size !== f.count) return null;
    const data = Array.from({ length: f.count }, (_, index) => this.pending!.parts.get(index)).join("");
    this.pending = null;
    try {
      const update: unknown = JSON.parse(data);
      return isLiveState(update, this.state) && update.revision === f.revision ? this.acceptState(update) : null;
    } catch { return null; }
  }
}
