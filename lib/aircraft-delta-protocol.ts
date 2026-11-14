/** Versioned aircraft field deltas, shared by the release client and recorded-data tests. */
import type { StateCode } from "./app-states";
import { appendLiveTrail, isLiveState, type LiveState, type LiveTrailPoint } from "./live-data-protocol";
import type { Aircraft, Snapshot } from "./types";

type Header = { version: 3; state: StateCode; stream: string; sequence: number };
export type FullMessage = Header & { kind: "full"; data: LiveState };
type Change = { tail: string; set: Partial<Aircraft>; unset: (keyof Aircraft)[] };
export type DeltaMessage = Header & {
  kind: "delta";
  baseSequence: number;
  revision: number;
  cursor: number;
  snapshot: Omit<Snapshot, "aircraft">;
  aircraft: { add: Aircraft[]; change: Change[]; remove: string[]; order?: string[]; asOf?: Aircraft["as_of"] };
  sessions: Record<string, string>;
  trails: { replace: Record<string, LiveTrailPoint[]>; append: Record<string, LiveTrailPoint[]> };
};
export type Message = FullMessage | DeltaMessage;
export type Frame = Header & { index: number; count: number; data: string };
export const aircraftDeltaTopic = (state: StateCode) => `oos-live-v3:${state}`;
const CHUNK_CHARS = 24_000, MAX_CHUNKS = 256, MAX_QUEUE = 8;
const own = (o: object, k: PropertyKey) => Object.hasOwn(o, k);
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const safeKey = (k: string) => !["__proto__", "prototype", "constructor"].includes(k);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
// Match actual JSON transport: undefined optional fields disappear, null remains explicit.
export const wireCopy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const validTail = (x: unknown): x is string => typeof x === "string" && /^[A-Z0-9-]{1,24}$/.test(x);
const scalar = (x: unknown) => x === null || typeof x === "string" || typeof x === "boolean" ||
  (typeof x === "number" && Number.isFinite(x));
function validAircraft(x: unknown): x is Aircraft {
  if (!record(x)) return false;
  const numeric = ["starting_fuel_estimate_gal", "usable_fuel_gallons", "nominal_endurance_min", "low_burn_gph",
    "high_burn_gph", "reserve_min", "lat", "lon", "altitude_ft", "ground_speed_kt", "heading", "time_aloft_min"];
  return validTail(x.tail) && typeof x.airborne === "boolean" &&
    ["icao24", "operator", "model", "roleDescription", "base", "role", "roleConfidence"].every(k => typeof x[k] === "string") &&
    (x.nickname === null || typeof x.nickname === "string") &&
    Object.entries(x).every(([k, v]) => safeKey(k) && scalar(v)) &&
    numeric.every(k => !own(x, k) || (typeof x[k] === "number" && Number.isFinite(x[k]))) &&
    ["observed", "last_known_airborne"].every(k => !own(x, k) || typeof x[k] === "boolean");
}
const validSessions = (x: unknown): x is Record<string, string> => record(x) &&
  Object.entries(x).every(([k, v]) => validTail(k) && typeof v === "string" && v.length > 0);
const validTrails = (x: unknown): x is Record<string, LiveTrailPoint[]> => record(x) &&
  Object.entries(x).every(([k, v]) => validTail(k) && Array.isArray(v) && v.every(p =>
    record(p) && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Number.isFinite(p.ts)));
const unique = (items: string[]) => new Set(items).size === items.length;
const validMeta = (x: unknown) => record(x) && !own(x, "aircraft") && Number.isFinite(x.fetched_at) &&
  ["adsbfi", "adsblol", "opensky", "mock"].includes(String(x.source)) && Number.isFinite(x.live_seen_count) &&
  (!own(x, "source_ok") || typeof x.source_ok === "boolean") &&
  (!own(x, "source_error") || typeof x.source_error === "string");

function validFull(data: unknown, state: StateCode): data is LiveState {
  if (!isLiveState(data, state) || !Number.isFinite(data.cursor) || !validSessions(data.sessions) ||
    !data.snapshot.aircraft.every(validAircraft) || !unique(data.snapshot.aircraft.map(a => a.tail))) return false;
  const { aircraft, ...meta } = data.snapshot;
  const tails = new Set(aircraft.map(a => a.tail));
  return validMeta(meta) && Object.keys(data.sessions!).every(t => tails.has(t)) &&
    Object.keys(data.sessions!).every(t => own(data.trails, t)) &&
    Object.keys(data.trails).every(t => own(data.sessions!, t)) &&
    Object.values(data.trails).every(points => points.every((p, i) => !i || points[i - 1]!.ts < p.ts));
}

function validMessage(x: unknown, state: StateCode): x is Message {
  if (!record(x) || x.version !== 3 || x.state !== state || typeof x.stream !== "string" ||
    !x.stream.length || x.stream.length > 128 || !Number.isSafeInteger(x.sequence) || Number(x.sequence) < 1) return false;
  if (x.kind === "full") return validFull(x.data, state);
  if (x.kind !== "delta" || !Number.isSafeInteger(x.baseSequence) || Number(x.baseSequence) < 1 ||
    x.sequence !== Number(x.baseSequence) + 1 || !Number.isFinite(x.revision) || !Number.isFinite(x.cursor) ||
    !validMeta(x.snapshot) || !validSessions(x.sessions) || !record(x.aircraft) || !record(x.trails) ||
    !validTrails(x.trails.replace) || !validTrails(x.trails.append)) return false;
  const a = x.aircraft, trails = x.trails;
  if (!Array.isArray(a.add) || !a.add.every(validAircraft) || !Array.isArray(a.remove) || !a.remove.every(validTail) ||
    !Array.isArray(a.change) || !a.change.every(c => record(c) && validTail(c.tail) && record(c.set) &&
      !own(c.set, "tail") && Object.entries(c.set).every(([k, v]) => safeKey(k) && scalar(v)) &&
      Array.isArray(c.unset) && c.unset.every(k => typeof k === "string" && safeKey(k) && k !== "tail" && !own(c.set as object, k)))) return false;
  const touched = [...a.add.map(v => v.tail), ...a.remove, ...a.change.map(v => v.tail)];
  return unique(touched) && (!own(a, "asOf") || a.asOf === null || typeof a.asOf === "string" || Number.isFinite(a.asOf)) &&
    (!own(a, "order") || (Array.isArray(a.order) && a.order.every(validTail) && unique(a.order))) &&
    [...Object.keys(x.trails.replace), ...Object.keys(x.trails.append)].every(t => own(x.sessions as object, t)) &&
    !Object.keys(trails.replace as object).some(t => own(trails.append as object, t));
}

export function isAircraftFullMessage(value: unknown, state: StateCode): value is FullMessage {
  return validMessage(value, state) && value.kind === "full";
}

export function fullMessage(data: LiveState, stream: string, sequence = 1): FullMessage {
  const message: FullMessage = { version: 3, kind: "full", state: data.state, stream, sequence, data: canonicalState(data) };
  if (!validMessage(message, data.state)) throw new Error("Invalid full baseline");
  return message;
}

/** Provider rows can repeat an observation time. Match the existing trail merger's last-point-wins semantics. */
export function canonicalState(data: LiveState): LiveState {
  const result = wireCopy(data);
  for (const tail of Object.keys(result.sessions ?? {})) {
    result.trails[tail] = appendLiveTrail([], result.trails[tail] ?? []);
  }
  return result;
}

/** Diff JSON-visible fields, including catalog edits, nulls and removed optional fields. */
export function deltaMessage(previous: FullMessage, next: LiveState): DeltaMessage {
  const before = previous.data, after = canonicalState(next);
  if (!validMessage(previous, next.state) || !validFull(after, next.state) ||
    after.revision <= before.revision || after.cursor! < before.cursor!) throw new Error("Invalid next state");
  const old = new Map(before.snapshot.aircraft.map(a => [a.tail, a]));
  const now = new Map(after.snapshot.aircraft.map(a => [a.tail, a]));
  const aircraft: DeltaMessage["aircraft"] = { add: [], change: [], remove: [...old.keys()].filter(t => !now.has(t)) };
  const first = after.snapshot.aircraft[0];
  // The snapshot clock currently changes on every aircraft each cycle. Transmit it once.
  if (first && own(first, "as_of") && after.snapshot.aircraft.every(a => own(a, "as_of") && a.as_of === first.as_of)) {
    aircraft.asOf = first.as_of;
  }
  for (const a of after.snapshot.aircraft) {
    const b = old.get(a.tail);
    if (!b) { aircraft.add.push(a); continue; }
    const set: Record<string, unknown> = {}, unset: (keyof Aircraft)[] = [];
    for (const k of Object.keys(a) as (keyof Aircraft)[]) {
      if (k !== "tail" && !(k === "as_of" && own(aircraft, "asOf")) && !same(a[k], b[k])) set[k] = a[k];
    }
    for (const k of Object.keys(b) as (keyof Aircraft)[]) if (!own(a, k)) unset.push(k);
    if (Object.keys(set).length || unset.length) aircraft.change.push({ tail: a.tail, set, unset });
  }
  const defaultOrder = [...old.keys()].filter(t => now.has(t)).concat(aircraft.add.map(a => a.tail));
  if (!same(defaultOrder, [...now.keys()])) aircraft.order = [...now.keys()];
  const trails: DeltaMessage["trails"] = { replace: {}, append: {} };
  for (const tail of Object.keys(after.sessions!)) {
    const points = after.trails[tail] ?? [];
    const older = before.trails[tail] ?? [];
    const byTime = new Map(older.map(p => [p.ts, p]));
    const times = new Set(points.map(p => p.ts));
    if (after.sessions![tail] !== before.sessions![tail] || older.some(p => !times.has(p.ts))) {
      trails.replace[tail] = points;
    } else {
      const additions = points.filter(p => !same(p, byTime.get(p.ts)));
      if (additions.length) trails.append[tail] = additions;
    }
  }
  const { aircraft: _, ...snapshot } = after.snapshot;
  return {
    version: 3, kind: "delta", state: next.state, stream: previous.stream,
    sequence: previous.sequence + 1, baseSequence: previous.sequence,
    revision: after.revision, cursor: after.cursor!, snapshot, aircraft, sessions: after.sessions!, trails,
  };
}

export function encodeMessage(message: Message): Frame[] {
  if (!validMessage(message, message.state)) throw new Error("Invalid v3 message");
  const data = JSON.stringify(message), count = Math.ceil(data.length / CHUNK_CHARS);
  if (count > MAX_CHUNKS) throw new Error("V3 message exceeds broadcast limit");
  return Array.from({ length: count }, (_, index) => ({
    version: 3, state: message.state, stream: message.stream, sequence: message.sequence,
    index, count, data: data.slice(index * CHUNK_CHARS, (index + 1) * CHUNK_CHARS),
  }));
}

/** Exact publisher baseline required: an independently generated /live read is not sufficient. */
export class AircraftDeltaAssembler {
  private current: FullMessage | null = null;
  private recovery = false;
  private queued = new Map<string, DeltaMessage>();
  private pending: { stream: string; sequence: number; count: number; parts: Map<number, string> } | null = null;
  constructor(private readonly state: StateCode) {}
  get needsResync(): boolean { return this.recovery; }
  get queuedCount(): number { return this.queued.size; }
  get value(): LiveState | null { return this.current?.data ?? null; }

  acceptFull(message: FullMessage): LiveState | null {
    if (!validMessage(message, this.state) || message.kind !== "full") return null;
    if (this.current && (message.data.revision < this.current.data.revision ||
      message.data.cursor! < this.current.data.cursor! ||
      (message.stream === this.current.stream && message.sequence < this.current.sequence))) return null;
    this.current = wireCopy(message);
    this.recovery = false;
    this.pending = null;
    const queued = [...this.queued.values()].filter(d => d.stream === message.stream && d.sequence > message.sequence)
      .sort((a, b) => a.sequence - b.sequence);
    this.queued.clear();
    for (const delta of queued) this.acceptDelta(delta);
    return this.current.data;
  }

  private waitForFull(message: DeltaMessage): null {
    this.recovery = true;
    this.queued.set(`${message.stream}:${message.sequence}`, message);
    if (this.queued.size > MAX_QUEUE) this.queued.delete(this.queued.keys().next().value!);
    return null;
  }

  private acceptDelta(message: DeltaMessage): LiveState | null {
    const current = this.current;
    if (current && (message.revision <= current.data.revision || message.cursor < current.data.cursor! ||
      (message.stream === current.stream && message.sequence <= current.sequence))) return null;
    if (!current || message.stream !== current.stream || message.baseSequence !== current.sequence) return this.waitForFull(message);
    // Build a replacement without mutating the last visible state. Any inconsistency recovers.
    const aircraft = new Map(current.data.snapshot.aircraft.map(a => [a.tail, { ...a }]));
    for (const tail of message.aircraft.remove) if (!aircraft.delete(tail)) return this.waitForFull(message);
    for (const a of message.aircraft.add) {
      if (aircraft.has(a.tail)) return this.waitForFull(message);
      aircraft.set(a.tail, { ...a });
    }
    for (const c of message.aircraft.change) {
      const a = aircraft.get(c.tail);
      if (!a) return this.waitForFull(message);
      const row = a as unknown as Record<string, unknown>;
      for (const k of c.unset) delete row[k];
      Object.assign(a, c.set);
      if (!validAircraft(a)) return this.waitForFull(message);
    }
    if (own(message.aircraft, "asOf")) for (const a of aircraft.values()) a.as_of = message.aircraft.asOf;
    const order = message.aircraft.order ?? [...aircraft.keys()];
    if (order.length !== aircraft.size || order.some(t => !aircraft.has(t)) ||
      Object.keys(message.sessions).some(t => !aircraft.has(t))) return this.waitForFull(message);
    const trails: LiveState["trails"] = {};
    for (const [tail, id] of Object.entries(message.sessions)) {
      if (own(message.trails.replace, tail)) trails[tail] = message.trails.replace[tail]!;
      else {
        if (current.data.sessions?.[tail] !== id) return this.waitForFull(message);
        trails[tail] = appendLiveTrail(current.data.trails[tail] ?? [], message.trails.append[tail] ?? []);
      }
    }
    const data: LiveState = {
      version: 1, state: this.state, revision: message.revision, cursor: message.cursor,
      snapshot: { ...message.snapshot, aircraft: order.map(t => aircraft.get(t)!) }, sessions: message.sessions, trails,
    };
    this.current = { version: 3, kind: "full", state: this.state, stream: message.stream, sequence: message.sequence, data };
    this.queued.delete(`${message.stream}:${message.sequence}`);
    this.recovery = this.queued.size > 0;
    return data;
  }

  acceptFrame(value: unknown): LiveState | null {
    if (!record(value) || value.version !== 3 || value.state !== this.state ||
      typeof value.stream !== "string" || !value.stream.length || value.stream.length > 128 ||
      !Number.isSafeInteger(value.sequence) || Number(value.sequence) < 1 || !Number.isInteger(value.count) ||
      Number(value.count) < 1 || Number(value.count) > MAX_CHUNKS || !Number.isInteger(value.index) ||
      Number(value.index) < 0 || Number(value.index) >= Number(value.count) || typeof value.data !== "string" ||
      value.data.length > CHUNK_CHARS) return null;
    const f = value as Frame;
    if (this.current?.stream === f.stream && f.sequence <= this.current.sequence) return null;
    if (this.pending?.stream === f.stream && f.sequence < this.pending.sequence) return null;
    if (!this.pending || f.stream !== this.pending.stream || f.sequence !== this.pending.sequence) {
      this.pending = { stream: f.stream, sequence: f.sequence, count: f.count, parts: new Map() };
    }
    if (this.pending.count !== f.count) return null;
    if (this.pending.parts.has(f.index) && this.pending.parts.get(f.index) !== f.data) {
      this.pending = null; this.recovery = true; return null;
    }
    this.pending.parts.set(f.index, f.data);
    if (this.pending.parts.size !== f.count) return null;
    const data = Array.from({ length: f.count }, (_, i) => this.pending!.parts.get(i)).join("");
    this.pending = null;
    try {
      const message: unknown = JSON.parse(data);
      if (!validMessage(message, this.state) || message.stream !== f.stream || message.sequence !== f.sequence) {
        this.recovery = true; return null;
      }
      return message.kind === "full" ? this.acceptFull(message) : this.acceptDelta(message);
    } catch { this.recovery = true; return null; }
  }
}
