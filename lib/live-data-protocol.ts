import type { StateCode } from "./app-states";
import type { Snapshot } from "./types";

export type LiveTrailPoint = { lat: number; lon: number; ts: number };
/** Full state, also used internally by every UI consumer after merging deltas. */
export type LiveState = {
  version: 1;
  state: StateCode;
  revision: number;
  cursor?: number;
  sessions?: Record<string, string>;
  snapshot: Snapshot;
  trails: Record<string, LiveTrailPoint[]>;
};
export type LiveDelta = {
  version: 2;
  state: StateCode;
  revision: number;
  cursor: number;
  baseCursor: number;
  sessions: Record<string, string>;
  snapshot: Snapshot;
  trails: Record<string, LiveTrailPoint[]>;
};
export type LiveFrame = {
  version: 1 | 2; state: StateCode; revision: number;
  index: number; count: number; data: string;
};
export const liveTopic = (state: StateCode) => `oos-live:${state}`;
// Even JSON escaping and four-byte Unicode stay below the broadcast limit.
const CHUNK_CHARS = 24_000;
const MAX_CHUNKS = 256;

export function encodeLiveState(update: LiveState | LiveDelta): LiveFrame[] {
  const data = JSON.stringify(update);
  const count = Math.ceil(data.length / CHUNK_CHARS);
  if (count > MAX_CHUNKS) throw new Error("Live state exceeds broadcast limit");
  return Array.from({ length: count }, (_, index) => ({
    version: update.version, state: update.state, revision: update.revision, index, count,
    data: data.slice(index * CHUNK_CHARS, (index + 1) * CHUNK_CHARS),
  }));
}

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const validSessions = (value: unknown): value is Record<string, string> =>
  record(value) && Object.values(value).every(id => typeof id === "string" && id.length > 0);
const validTrails = (value: unknown): value is Record<string, LiveTrailPoint[]> =>
  record(value) && Object.values(value).every(points => Array.isArray(points) && points.every(p =>
    record(p) && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Number.isFinite(p.ts)));

function validUpdate(value: unknown, state: StateCode): value is LiveState | LiveDelta {
  if (!record(value) || value.state !== state || !Number.isFinite(value.revision) ||
    !record(value.snapshot) || !Number.isFinite(value.snapshot.fetched_at) ||
    !Array.isArray(value.snapshot.aircraft) || !validTrails(value.trails)) return false;
  if (value.version === 1) return (value.cursor === undefined || Number.isFinite(value.cursor)) &&
    (value.sessions === undefined || validSessions(value.sessions));
  return value.version === 2 && Number.isFinite(value.cursor) && Number.isFinite(value.baseCursor) &&
    Number(value.baseCursor) <= Number(value.cursor) && validSessions(value.sessions) &&
    Object.keys(value.trails).every(tail => Object.hasOwn(value.sessions as object, tail));
}

export function isLiveState(value: unknown, state: StateCode): value is LiveState {
  return validUpdate(value, state) && value.version === 1;
}

export function appendLiveTrail(points: LiveTrailPoint[], additions: LiveTrailPoint[]): LiveTrailPoint[] {
  if (!additions.length) return points;
  const byTime = new Map(points.map(p => [p.ts, p]));
  for (const point of additions) byTime.set(point.ts, point);
  return [...byTime.values()].sort((a, b) => a.ts - b.ts);
}

/** Apply complete messages atomically; missing deltas require a full recovery. */
export class LiveStateAssembler {
  private pending: { version: 1 | 2; revision: number; count: number; parts: Map<number, string> } | null = null;
  private current: LiveState | null = null;
  private recovery = false;
  private queued = new Map<number, LiveDelta>();
  constructor(private state: StateCode) {}

  get needsResync(): boolean { return this.recovery; }

  acceptState(update: LiveState): LiveState | null {
    if (!isLiveState(update, this.state) || update.revision <= (this.current?.revision ?? 0)) return null;
    this.current = update;
    this.recovery = false;
    if (this.pending && this.pending.revision <= update.revision) this.pending = null;
    const queued = [...this.queued.values()].sort((a, b) => a.revision - b.revision);
    this.queued.clear();
    for (const delta of queued) {
      if (delta.revision > this.current.revision) this.acceptDelta(delta);
    }
    return this.current;
  }

  private acceptDelta(update: LiveDelta): LiveState | null {
    const current = this.current;
    if (update.revision <= (current?.revision ?? 0) ||
      (current?.cursor !== undefined && update.cursor < current.cursor)) return null;
    const newSession = Object.entries(update.sessions).some(([tail, id]) => current?.sessions?.[tail] !== id);
    if (this.recovery || current?.cursor === undefined || !current.sessions ||
      current.cursor < update.baseCursor || newSession) {
      this.recovery = true;
      this.queued.set(update.revision, update);
      // A slow/offline recovery must not accumulate unlimited flight updates.
      if (this.queued.size > 8) this.queued.delete(Math.min(...this.queued.keys()));
      return null;
    }
    const trails = Object.fromEntries(Object.keys(update.sessions).map(tail =>
      [tail, appendLiveTrail(current.trails[tail] ?? [], update.trails[tail] ?? [])]));
    this.current = {
      version: 1, state: update.state, revision: update.revision, cursor: update.cursor,
      sessions: update.sessions, snapshot: update.snapshot, trails,
    };
    return this.current;
  }

  acceptFrame(value: unknown): LiveState | null {
    if (!record(value)) return null;
    const f = value as LiveFrame;
    if ((f.version !== 1 && f.version !== 2) || f.state !== this.state || !Number.isFinite(f.revision) ||
      f.revision <= (this.current?.revision ?? 0) ||
      !Number.isInteger(f.count) || f.count < 1 || f.count > MAX_CHUNKS ||
      !Number.isInteger(f.index) || f.index < 0 || f.index >= f.count ||
      typeof f.data !== "string" || f.data.length > CHUNK_CHARS) return null;
    if (this.pending && f.revision < this.pending.revision) return null;
    if (!this.pending || f.revision > this.pending.revision) {
      this.pending = { version: f.version, revision: f.revision, count: f.count, parts: new Map() };
    }
    if (this.pending.count !== f.count || this.pending.version !== f.version) return null;
    this.pending.parts.set(f.index, f.data);
    if (this.pending.parts.size !== f.count) return null;
    const data = Array.from({ length: f.count }, (_, index) => this.pending!.parts.get(index)).join("");
    this.pending = null;
    try {
      const update: unknown = JSON.parse(data);
      if (!validUpdate(update, this.state) || update.revision !== f.revision || update.version !== f.version) return null;
      return update.version === 1 ? this.acceptState(update) : this.acceptDelta(update);
    } catch { return null; }
  }
}
