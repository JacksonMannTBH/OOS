import assert from "node:assert/strict";
import { test } from "node:test";
import { encodeLiveState, LiveStateAssembler, type LiveDelta, type LiveState } from "./live-data-protocol";
import { LiveStateStream } from "./live-data-client";

const point = (ts: number) => ({ lat: 47 + ts / 1000, lon: -122, ts });
const full = (revision = 100, cursor = 100, session = "flight-1"): LiveState => ({
  version: 1, state: "WA", revision, cursor, sessions: { N123: session },
  snapshot: { fetched_at: revision, source: "adsbfi", source_ok: true, aircraft: [], live_seen_count: 0 },
  trails: { N123: [point(1), point(2)] },
});
const delta = (revision = 200, baseCursor = 100, cursor = 200): LiveDelta => ({
  ...full(revision, cursor), version: 2, baseCursor, cursor, sessions: { N123: "flight-1" },
  trails: { N123: [point(3)] },
});
const receive = (assembler: LiveStateAssembler, update: LiveState | LiveDelta) => {
  let result: LiveState | null = null;
  for (const frame of encodeLiveState(update)) result = assembler.acceptFrame(frame) ?? result;
  return result;
};
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

test("deltas append and deduplicate points, including late observations; health updates retain trails", () => {
  const assembler = new LiveStateAssembler("WA");
  assembler.acceptState(full());
  const update = delta();
  update.trails.N123 = [point(2), point(4), point(3)];
  assert.deepEqual(receive(assembler, update)!.trails.N123, [point(1), point(2), point(3), point(4)]);
  assert.equal(receive(assembler, update), null);
  const health = delta(210, 100, 200);
  health.trails.N123 = [];
  health.snapshot.source_ok = false;
  const result = receive(assembler, health)!;
  assert.equal(result.snapshot.source_ok, false);
  assert.equal(result.trails.N123!.length, 4);
  assert.equal(assembler.needsResync, false);
});

test("missed delta requests recovery and queued messages replay after a full snapshot", () => {
  const assembler = new LiveStateAssembler("WA");
  assembler.acceptState(full());
  assert.equal(receive(assembler, delta(300, 200, 300)), null);
  assert.equal(assembler.needsResync, true);
  const recovered = full(250, 200);
  recovered.trails.N123 = [point(1), point(2)];
  const result = assembler.acceptState(recovered)!;
  assert.equal(result.revision, 300);
  assert.deepEqual(result.trails.N123, [point(1), point(2), point(3)]);
  assert.equal(assembler.needsResync, false);
});

test("new flights recover complete history; landings and removed aircraft discard old trails", () => {
  const assembler = new LiveStateAssembler("WA");
  assembler.acceptState(full());
  const newFlight = delta();
  newFlight.sessions.N123 = "flight-2";
  assert.equal(receive(assembler, newFlight), null);
  assert.equal(assembler.needsResync, true);
  assembler.acceptState(full(210, 200, "flight-2"));
  const landed = delta(300, 200, 300);
  landed.sessions = {}; landed.trails = {};
  assert.deepEqual(receive(assembler, landed)!.trails, {});
  assert.equal(assembler.needsResync, false);
});

test("partial, malformed and out-of-order deltas cannot change the visible trail", () => {
  const assembler = new LiveStateAssembler("WA");
  assembler.acceptState(full());
  const large = delta();
  large.snapshot.source_error = "😀".repeat(25_000);
  const frames = encodeLiveState(large).reverse();
  for (const frame of frames.slice(0, -1)) assert.equal(assembler.acceptFrame(frame), null);
  assert.equal(assembler.needsResync, false);
  assert.equal(assembler.acceptFrame(frames.at(-1))!.trails.N123!.length, 3);
  assert.equal(receive(assembler, delta(190, 100, 200)), null);
  const malformed = delta(250);
  malformed.trails.N123 = [{ lat: NaN, lon: 0, ts: 0 }];
  assert.equal(receive(assembler, malformed), null);
  const noBaseline = new LiveStateAssembler("WA");
  assert.equal(receive(noBaseline, delta()), null);
  assert.equal(noBaseline.needsResync, true);
});

test("a missed partial message is detected by the next complete delta", () => {
  const assembler = new LiveStateAssembler("WA");
  assembler.acceptState(full());
  const partial = delta();
  partial.snapshot.source_error = "x".repeat(50_000);
  assembler.acceptFrame(encodeLiveState(partial)[0]);
  assert.equal(receive(assembler, delta(300, 200, 300)), null);
  assert.equal(assembler.needsResync, true);
});

test("healthy 25-second deltas need one bootstrap; gap recovery coalesces pending requests", async () => {
  let now = 100_000, reads = 0;
  let callback: (frame: unknown) => void = () => {};
  let joined = () => {};
  const pending: ((state: LiveState) => void)[] = [];
  const stream = new LiveStateStream("WA", (receive, subscribed) => {
    callback = receive; joined = subscribed; return () => {};
  }, async () => {
    reads++;
    if (reads === 1) return full(now, now);
    return new Promise(resolve => pending.push(resolve));
  }, () => now);
  const updates: LiveState[] = [];
  const stop = stream.subscribe(update => updates.push(update));
  stream.resume(); joined(); await flush();
  for (let i = 0; i < 4; i++) {
    const before = now;
    now += 25_000;
    stream.checkHealth();
    for (const frame of encodeLiveState(delta(now, before, now))) callback(frame);
  }
  assert.equal(reads, 1);
  const beforeGap = now;
  now += 50_000;
  for (const frame of encodeLiveState(delta(now, beforeGap + 25_000, now))) callback(frame);
  await flush();
  assert.equal(reads, 2);
  now += 25_000;
  for (const frame of encodeLiveState(delta(now, now - 25_000, now))) callback(frame);
  assert.equal(reads, 2, "another delta must not abort and restart the same recovery");
  pending[0]!(full(now + 1, now)); await flush();
  const before = now;
  now += 25_000;
  for (const frame of encodeLiveState(delta(now, before, now))) callback(frame);
  assert.equal(reads, 2);
  assert.equal(updates.at(-1)!.trails.N123!.length, 3);
  stop();
});
