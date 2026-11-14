import assert from "node:assert/strict";
import { test } from "node:test";
import { LiveStateStream } from "./live-data-client";
import { encodeLiveState, LiveStateAssembler, type LiveState } from "./live-data-protocol";

const state = (revision: number): LiveState => ({
  version: 1, state: "WA", revision,
  snapshot: { fetched_at: revision, source: "adsblol", aircraft: [], live_seen_count: 0 },
  trails: { N123: [{ lat: 47, lon: -122, ts: revision }] },
});
const flush = () => new Promise(resolve => setImmediate(resolve));

test("large Unicode payloads reassemble out of order, atomically, with bounded frames", () => {
  const update = state(10);
  update.snapshot.source_error = "😀 aircraft ".repeat(20_000);
  const frames = encodeLiveState(update);
  assert.ok(frames.length > 1);
  assert.ok(frames.every(f => Buffer.byteLength(JSON.stringify(f)) < 256_000));
  const assembler = new LiveStateAssembler("WA");
  const reversed = frames.toReversed();
  for (const frame of reversed.slice(0, -1)) assert.equal(assembler.acceptFrame(frame), null);
  assert.deepEqual(assembler.acceptFrame(reversed.at(-1)), update);
  for (const frame of frames) assert.equal(assembler.acceptFrame(frame), null);
});

test("older bootstrap, stale state, mixed revisions, malformed and wrong-state frames cannot replace live data", () => {
  const assembler = new LiveStateAssembler("WA");
  assert.deepEqual(assembler.acceptFrame(encodeLiveState(state(20))[0]), state(20));
  assert.equal(assembler.acceptState(state(19)), null);
  const invalid = [null, {}, { ...encodeLiveState(state(30))[0], state: "TX" },
    { ...encodeLiveState(state(30))[0], count: 9999 },
    { ...encodeLiveState(state(30))[0], data: "not JSON" },
    { ...encodeLiveState(state(30))[0], revision: Infinity }];
  for (const frame of invalid) assert.equal(assembler.acceptFrame(frame), null);
  const large = state(40); large.snapshot.source_error = "x".repeat(50_000);
  assert.equal(assembler.acceptFrame(encodeLiveState(large)[0]), null);
  assert.deepEqual(assembler.acceptFrame(encodeLiveState(state(41))[0]), state(41));
  for (const frame of encodeLiveState(large)) assert.equal(assembler.acceptFrame(frame), null);
});

test("multiple consumers share a connection, healthy updates never poll, reconnect bootstraps once", async () => {
  let now = 100_000;
  let opens = 0, closes = 0, reads = 0;
  let receive: (frame: unknown) => void = () => {};
  let joined = () => {};
  const stream = new LiveStateStream("WA", (message, subscribed) => {
    opens++; receive = message; joined = subscribed; return () => { closes++; };
  }, async () => { reads++; return state(now); }, () => now);
  const seen1: number[] = [], seen2: number[] = [];
  const stop1 = stream.subscribe(update => seen1.push(update.revision));
  const stop2 = stream.subscribe(update => seen2.push(update.revision));
  stream.resume(); stream.resume(); joined(); await flush();
  assert.equal(opens, 1); assert.equal(reads, 1);
  for (let i = 0; i < 20; i++) {
    now += 15_000;
    for (const frame of encodeLiveState(state(now))) receive(frame);
    stream.checkHealth();
  }
  assert.equal(reads, 1, "steady-state updates must never fetch the API");
  assert.deepEqual(seen1, seen2);
  stream.suspend(); stream.resume(); joined(); await flush();
  assert.equal(opens, 2); assert.equal(reads, 2);
  stop1(); assert.equal(closes, 1);
  stop2(); assert.equal(closes, 2);
});

test("silent connections recover after 60 seconds and ignore aborted bootstrap responses", async () => {
  let now = 100_000, opens = 0, closes = 0, reads = 0;
  const pending: ((update: LiveState) => void)[] = [];
  let joined = () => {};
  const seen: number[] = [];
  const stream = new LiveStateStream("WA", (_, subscribed) => {
    opens++; joined = subscribed; return () => { closes++; };
  }, async () => { reads++; return new Promise(resolve => pending.push(resolve)); }, () => now);
  const stop = stream.subscribe(update => seen.push(update.revision));
  stream.resume(); joined();
  now += 59_999; stream.checkHealth();
  assert.equal(opens, 1); assert.equal(closes, 0); assert.equal(reads, 1);
  now += 1; stream.checkHealth();
  assert.equal(opens, 2); assert.equal(closes, 1); assert.equal(reads, 2);
  for (let i = 0; i < 5; i++) stream.checkHealth();
  assert.equal(reads, 2);
  pending[0]!(state(now - 1)); await flush(); assert.deepEqual(seen, []);
  pending[1]!(state(now)); await flush(); assert.deepEqual(seen, [now]);
  stop();
});

test("stream distinguishes a cached replay from the first completed reconnect update", async () => {
  let receive: (frame: unknown) => void = () => {};
  let joined = () => {};
  let now = 100_000;
  const deliveries: boolean[] = [];
  const stream = new LiveStateStream("WA", (onFrame, subscribed) => {
    receive = onFrame; joined = subscribed; return () => {};
  }, async () => state(now), () => now);
  const stop1 = stream.subscribe(() => {});
  stream.resume(); joined(); await flush();
  stop1();
  const stop2 = stream.subscribe((_, delivery) => deliveries.push(delivery.fromCache));
  assert.deepEqual(deliveries, [true]);
  stream.resume(); now += 1_000; joined(); await flush();
  assert.deepEqual(deliveries, [true, false]);
  now += 1_000;
  for (const frame of encodeLiveState(state(now))) receive(frame);
  assert.deepEqual(deliveries, [true, false, false]);
  stop2();
});

test("late callbacks from the old connection cannot refresh or replace a resumed stream", async () => {
  const connections: { receive: (frame: unknown) => void; joined: () => void }[] = [];
  let reads = 0, now = 100_000;
  const seen: number[] = [];
  const stream = new LiveStateStream("WA", (receive, joined) => {
    connections.push({ receive, joined }); return () => {};
  }, async () => { reads++; return state(now); }, () => now);
  const stop = stream.subscribe(update => seen.push(update.revision));
  stream.resume(); connections[0]!.joined(); await flush();
  stream.suspend(); stream.resume(); now++;
  connections[0]!.joined();
  for (const frame of encodeLiveState(state(now + 100))) connections[0]!.receive(frame);
  await flush();
  assert.equal(reads, 1);
  assert.deepEqual(seen, [100_000]);
  connections[1]!.joined(); await flush();
  assert.equal(reads, 2);
  assert.deepEqual(seen, [100_000, now]);
  stop();
});
