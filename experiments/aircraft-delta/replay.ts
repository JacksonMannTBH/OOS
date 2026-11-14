/** Reconstruct a deterministic timeline from an already-saved capture. No network. */
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { gzipSync } from "node:zlib";
import { buildDatabaseSnapshot } from "../../lib/aircraft-data";
import { SUPPORTED_STATE_CODES, type StateCode } from "../../lib/app-states";
import { encodeLiveState, LiveStateAssembler, type LiveDelta, type LiveState, type LiveTrailPoint } from "../../lib/live-data-protocol";
import { AircraftDeltaAssembler, deltaMessage, encodeMessage, fullMessage, wireCopy, type FullMessage } from "./protocol";

globalThis.fetch = async () => { throw new Error("Network disabled: only saved capture data is allowed"); };
type Row = Record<string, unknown>;
type Capture = { captured_at: string; rows: Row[]; positions: Row[]; runs: { finished_at: string; source: string }[] };
async function main() {
const input = process.argv[2] ?? ".local/incremental-live-20261113/data-savings-snapshot.json";
const output = process.argv[3] ?? ".local/aircraft-delta-test";
const capture: Capture = JSON.parse(await readFile(input, "utf8"));
const end = Date.parse(capture.captured_at), cycles = 120, interval = 20_000, start = end - cycles * interval;
const byteCount = (v: unknown) => Buffer.byteLength(JSON.stringify(v));
const frameBytes = (frames: unknown[]) => frames.reduce<number>((sum, f) => sum + byteCount(f), 0);
const gzipBytes = (frames: unknown[]) => frames.reduce<number>((sum, f) => sum + gzipSync(JSON.stringify(f)).length, 0);
const pointsBySession = new Map<string, Row[]>();
for (const p of capture.positions) {
  const id = String(p.flight_session_id);
  if (!pointsBySession.has(id)) pointsBySession.set(id, []);
  pointsBySession.get(id)!.push(p);
}
const current = new Map<StateCode, FullMessage>();
const receivers = new Map<StateCode, AircraftDeltaAssembler>();
const oldReceivers = new Map<StateCode, LiveStateAssembler>();
const totals = { comparisons: 0, recoveryComparisons: 0, v2Bytes: 0, v3Bytes: 0, v2GzipBytes: 0, v3GzipBytes: 0,
  v2InitialBytes: 0, v3InitialBytes: 0, v2NewFlightRecoveryBytes: 0, encodeMs: 0, decodeMs: 0, maxDecodeMs: 0 };
const states: Record<string, { aircraft: number; v2Bytes: number; v3Bytes: number }> = {};
// Representative full-state pairs are also exercised in Safari on the iPhone simulator.
const browserPairs: { before: FullMessage; after: LiveState }[] = [];
const heapBefore = process.memoryUsage().heapUsed;
for (let step = 0; step <= cycles; step++) {
  const now = start + step * interval;
  const grouped = new Map<string, Row[]>();
  const trails: Record<string, LiveTrailPoint[]> = {};
  for (const captured of capture.rows) {
    const row = { ...captured }, session = row.flight_session_id ? String(row.flight_session_id) : null;
    if (session) {
      // Arrival time controls when a late observation first becomes visible.
      const arrived = (pointsBySession.get(session) ?? []).filter(p => Date.parse(String(p.created_at)) <= now)
        .sort((a, b) => Date.parse(String(a.observed_at)) - Date.parse(String(b.observed_at)));
      const last = arrived.at(-1);
      if (last) {
        Object.assign(row, { observed_at: last.observed_at, last_seen_at: last.observed_at,
          latitude: last.latitude, longitude: last.longitude, altitude_ft: last.altitude_ft,
          ground_speed_kt: last.ground_speed_kt, heading_deg: last.heading_deg });
        const unique = new Map(arrived.map(p => [Date.parse(String(p.observed_at)) / 1000,
          { lat: Number(p.latitude), lon: Number(p.longitude), ts: Math.floor(Date.parse(String(p.observed_at)) / 1000) }]));
        trails[String(row.tail)] = [...unique.values()].sort((a, b) => a.ts - b.ts);
      } else {
        Object.assign(row, { observed_at: null, last_seen_at: null, flight_session_id: null, observation_status: "unknown" });
      }
    } else if (Date.parse(String(row.observed_at)) > now) {
      Object.assign(row, { observed_at: null, last_seen_at: null, observation_status: "unknown" });
    }
    const code = String(row.home_state_code);
    if (!grouped.has(code)) grouped.set(code, []);
    grouped.get(code)!.push(row);
  }
  for (const code of SUPPORTED_STATE_CODES) {
    const snapshot = buildDatabaseSnapshot(grouped.get(code) ?? [], { finished_at: new Date(now).toISOString(), source: "adsbfi" }, now);
    const sessions = Object.fromEntries(snapshot.aircraft.filter(a => (a.airborne || a.last_known_airborne) && a.flight_session_id).map(a => [a.tail, a.flight_session_id!]));
    const full: LiveState = wireCopy({ version: 1, state: code, revision: now, cursor: now, snapshot, sessions,
      trails: Object.fromEntries(Object.keys(sessions).map(t => [t, trails[t] ?? []])) });
    const before = current.get(code);
    if (!before) {
      const baseline = fullMessage(full, `offline-${code}`);
      current.set(code, baseline);
      const receiver = new AircraftDeltaAssembler(code); receiver.acceptFull(baseline); receivers.set(code, receiver);
      const old = new LiveStateAssembler(code); old.acceptState(full); oldReceivers.set(code, old);
      totals.v2InitialBytes += byteCount(full); totals.v3InitialBytes += byteCount(baseline);
      states[code] = { aircraft: full.snapshot.aircraft.length, v2Bytes: 0, v3Bytes: 0 };
      continue;
    }
    const encodeStart = performance.now();
    const delta = deltaMessage(before, full), frames = encodeMessage(delta);
    totals.encodeMs += performance.now() - encodeStart;
    const decodeStart = performance.now();
    let decoded: LiveState | null = null;
    for (const frame of frames) decoded = receivers.get(code)!.acceptFrame(wireCopy(frame)) ?? decoded;
    const decodeMs = performance.now() - decodeStart;
    totals.decodeMs += decodeMs; totals.maxDecodeMs = Math.max(totals.maxDecodeMs, decodeMs);
    assert.deepEqual(decoded, full, `v3 state mismatch: ${code}, cycle ${step}`);
    assert.equal(receivers.get(code)!.needsResync, false);
    totals.comparisons++;
    const additions = Object.fromEntries(Object.keys(sessions).map(tail => {
      const earlier = new Map((before.data.trails[tail] ?? []).map(p => [p.ts, JSON.stringify(p)]));
      return [tail, full.trails[tail]!.filter(p => earlier.get(p.ts) !== JSON.stringify(p))];
    }));
    const v2: LiveDelta = { ...full, version: 2, cursor: now, baseCursor: now - interval, sessions, trails: additions };
    const v2Frames = encodeLiveState(v2), old = oldReceivers.get(code)!;
    let oldDecoded: LiveState | null = null;
    for (const frame of v2Frames) oldDecoded = old.acceptFrame(frame) ?? oldDecoded;
    if (old.needsResync) { oldDecoded = old.acceptState(full); totals.v2NewFlightRecoveryBytes += byteCount(full); }
    assert.deepEqual(oldDecoded, full, `Current v2 reference mismatch: ${code}, cycle ${step}`);
    const v2Bytes = frameBytes(v2Frames), v3Bytes = frameBytes(frames);
    states[code]!.v2Bytes += v2Bytes; states[code]!.v3Bytes += v3Bytes;
    totals.v2Bytes += v2Bytes; totals.v3Bytes += v3Bytes;
    totals.v2GzipBytes += gzipBytes(v2Frames); totals.v3GzipBytes += gzipBytes(frames);
    if (step % 20 === 0) {
      const missed = new AircraftDeltaAssembler(code);
      for (const frame of frames) missed.acceptFrame(frame);
      assert.equal(missed.needsResync, true);
      assert.deepEqual(missed.acceptFull(before), full);
      totals.recoveryComparisons++;
      if (["WA", "CA", "TX", "NY", "FL"].includes(code)) browserPairs.push({ before, after: full });
    }
    current.set(code, fullMessage(full, before.stream, delta.sequence));
  }
}
const heapAfter = process.memoryUsage().heapUsed;
const percent = (before: number, after: number) => Math.round((1 - after / before) * 1000) / 10;
const report = {
  status: "passed", capturedAt: capture.captured_at, aircraft: capture.rows.length, recordedTrailPoints: capture.positions.length,
  states: SUPPORTED_STATE_CODES.length, cycles, simulatedMinutes: cycles * interval / 60000,
  ...totals, frameSavingsPercent: percent(totals.v2Bytes, totals.v3Bytes),
  includingInitialSavingsPercent: percent(totals.v2Bytes + totals.v2InitialBytes, totals.v3Bytes + totals.v3InitialBytes),
  gzipComparisonSavingsPercent: percent(totals.v2GzipBytes, totals.v3GzipBytes),
  averageEncodeMsPerState: totals.encodeMs / totals.comparisons,
  averageDecodeMsPerState: totals.decodeMs / totals.comparisons,
  retainedCurrentStateBytes: [...current.values()].reduce((n, x) => n + byteCount(x.data), 0),
  processHeapBeforeBytes: heapBefore, processHeapAfterBytes: heapAfter,
  byState: states,
  limitations: [
    "Simulated 40-minute timeline uses recorded positions with a fixed catalog and final known statuses. It is not a complete historical production-feed recording.",
    "Counts each state once; not weighted by connected users. Metadata/lifecycle changes are separate adversarial tests.",
    "JSON frame bytes exclude HTTP/WebSocket overhead. Gzip is a comparison, not a claim that Supabase compresses messages this way.",
    "Initial downloads reported separately; headline savings exclude retries and recoveries. Includes-initial figure assumes one initial connection per state.",
    "Timings are local codec work, not production database or worker performance. Process heap includes replay fixtures and compression allocations, not isolated app memory.",
    "No backend, app-default, provider, credentials, database, notification, or deployment changes."
  ],
};
await mkdir(output, { recursive: true });
await writeFile(`${output}/replay-results.json`, JSON.stringify(report, null, 2));
await writeFile(`${output}/browser-pairs.json`, JSON.stringify(browserPairs));
console.log(JSON.stringify({ ...report, byState: Object.fromEntries(["WA", "CA", "TX", "NY", "FL"].map(s => [s, states[s]])) }, null, 2));
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
