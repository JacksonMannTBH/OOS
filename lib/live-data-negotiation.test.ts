import assert from "node:assert/strict";
import { test } from "node:test";
import { LiveStateStream } from "./live-data-client";
import { encodeLiveState, type LiveState } from "./live-data-protocol";
import { aircraftDeltaTopic, deltaMessage, encodeMessage, fullMessage, type FullMessage, type Message } from "./aircraft-delta-protocol";
import { nextState, state } from "../experiments/aircraft-delta/scenarios";

const flush = () => new Promise<void>(resolve => setImmediate(resolve));
type Connection = { version: 2 | 3; receive: (frame: unknown) => void; joined: () => void; closed: boolean };
function harness(load?: (signal: AbortSignal) => Promise<unknown>) {
  let clock = 100_000, reads = 0;
  let baseline: unknown = state(clock);
  const connections: Connection[] = [], seen: LiveState[] = [];
  const stream = new LiveStateStream("WA", (receive, joined, version) => {
    const connection = { receive, joined, version, closed: false };
    connections.push(connection);
    return () => { connection.closed = true; };
  }, async signal => { reads++; return load ? load(signal) : baseline; }, () => clock);
  const stop = stream.subscribe(value => seen.push(value));
  return { stream, connections, seen, stop, get reads() { return reads; },
    set baseline(value: unknown) { baseline = value; },
    tick(ms: number) { clock += ms; },
    sendLegacy(value: LiveState) { for (const f of encodeLiveState(value)) connections.at(-1)!.receive(f); },
    sendV3(value: Message) { for (const f of encodeMessage(value)) connections.at(-1)!.receive(f); },
    async join() { stream.resume(); connections.at(-1)!.joined(); await flush(); },
  };
}

test("release uses today's backend without an extra poll or v3 subscription", async () => {
  const h = harness(); await h.join();
  assert.equal(h.connections[0]!.version, 2);
  for (let i = 0; i < 20; i++) { h.tick(20_000); h.sendLegacy(state(120_000 + i * 20_000)); h.stream.checkHealth(); }
  assert.equal(h.reads, 1);
  assert.equal(h.connections.length, 1);
  assert.equal(h.seen.length, 21);
  h.stop();
});

test("v3 activates only after a validated full baseline and rejoins before a fresh read", async () => {
  const h = harness();
  const first = fullMessage(state(), "publisher"); h.baseline = first;
  await h.join();
  assert.deepEqual(h.connections.map(c => c.version), [2, 3]);
  assert.equal(h.connections[0]!.closed, true);
  assert.equal(h.reads, 1);
  const second = fullMessage(nextState(first.data), first.stream, 2); h.baseline = second;
  await h.join();
  assert.equal(h.reads, 2);
  const third = nextState(second.data, s => { s.snapshot.aircraft[0]!.lat = 48; });
  h.sendV3(deltaMessage(second, third));
  assert.deepEqual(h.seen.at(-1), third);
  assert.equal(aircraftDeltaTopic("WA"), "oos-live-v3:WA");
  h.stop();
});

test("returning from background picks up a later backend upgrade", async () => {
  const h = harness(); await h.join();
  h.stream.suspend(); h.baseline = fullMessage(state(200_000), "enabled-later");
  await h.join(); await h.join();
  assert.deepEqual(h.connections.map(c => c.version), [2, 2, 3]);
  assert.equal(h.seen.at(-1)!.revision, 200_000);
  h.stop();
});

test("invalid and wrong-state v3 baselines leave the healthy legacy feed intact", async () => {
  for (const bad of [{ ...fullMessage(state(), "bad"), sequence: 0 },
    { ...fullMessage(state(), "bad"), state: "TX" }, { version: 3, kind: "full" }]) {
    const h = harness(); h.baseline = bad; await h.join();
    assert.equal(h.connections.length, 1);
    assert.equal(h.connections[0]!.version, 2);
    h.sendLegacy(state(300_000));
    assert.equal(h.seen.at(-1)!.revision, 300_000);
    h.stop();
  }
});

test("failed discovery does not prevent receiving current backend broadcasts", async () => {
  const h = harness(async () => { throw new Error("temporary HTTP failure"); }); await h.join();
  h.sendLegacy(state(400_000));
  assert.equal(h.seen.at(-1)!.revision, 400_000);
  h.stop();
});

test("a missed v3 update triggers one shared recovery and merges updates arriving during the read", async () => {
  let latest = fullMessage(state(), "publisher"), reads = 0;
  let resolve: (value: FullMessage) => void = () => {};
  const h = harness(async () => ++reads <= 2 ? latest : new Promise<FullMessage>(r => { resolve = r; }));
  await h.join(); await h.join();
  const second = fullMessage(nextState(latest.data), latest.stream, 2);
  const third = fullMessage(nextState(second.data), latest.stream, 3);
  h.sendV3(deltaMessage(second, third.data)); await flush();
  const fourth = nextState(third.data, s => { s.snapshot.aircraft[0]!.heading = 0; });
  h.sendV3(deltaMessage(third, fourth));
  assert.equal(h.reads, 3);
  resolve(third); await flush();
  assert.deepEqual(h.seen.at(-1), fourth);
  h.stop();
});

test("backend rollback returns the release app to v2 and rejects late v3 callbacks", async () => {
  const h = harness(); h.baseline = fullMessage(state(), "publisher");
  await h.join(); await h.join();
  const oldV3 = h.connections.at(-1)!;
  h.stream.suspend(); h.baseline = state(500_000); await h.join(); await h.join();
  assert.equal(h.connections.at(-1)!.version, 2);
  const reads = h.reads;
  oldV3.joined();
  for (const frame of encodeMessage(fullMessage(state(900_000), "old-socket"))) oldV3.receive(frame);
  await flush();
  assert.equal(h.reads, reads);
  assert.equal(h.seen.at(-1)!.revision, 500_000);
  h.sendLegacy(state(600_000)); assert.equal(h.seen.at(-1)!.revision, 600_000);
  h.stop();
});

test("a baseline completing after suspension cannot change the selected protocol", async () => {
  let resolve: (value: unknown) => void = () => {};
  const h = harness(() => new Promise(r => { resolve = r; }));
  await h.join(); h.stream.suspend(); resolve(fullMessage(state(), "late")); await flush();
  assert.equal(h.connections.length, 1);
  assert.equal(h.seen.length, 0);
  h.stop();
});

test("switching to a lagging v3 baseline cannot move the visible state backwards", async () => {
  let resolve: (value: unknown) => void = () => {};
  const h = harness(() => new Promise(r => { resolve = r; }));
  await h.join(); h.sendLegacy(state(100_000));
  const baseline = fullMessage(state(90_000), "publisher"); resolve(baseline); await flush();
  assert.equal(h.connections.at(-1)!.version, 3);
  assert.equal(h.seen.at(-1)!.revision, 100_000);
  h.sendV3(deltaMessage(baseline, nextState(baseline.data)));
  assert.equal(h.seen.at(-1)!.revision, 110_000);
  h.stop();
});

test("healthy v3 updates share their receiver across screens without polling", async () => {
  const h = harness(); let latest = fullMessage(state(), "publisher"); h.baseline = latest;
  await h.join(); await h.join();
  const other: LiveState[] = [], flags: boolean[] = [];
  const stop2 = h.stream.subscribe((value, delivery) => { other.push(value); flags.push(delivery.fromCache); });
  for (let i = 0; i < 60; i++) {
    h.tick(20_000);
    const next = nextState(latest.data), delta = deltaMessage(latest, next);
    h.sendV3(delta); latest = fullMessage(next, latest.stream, delta.sequence); h.stream.checkHealth();
  }
  assert.equal(h.reads, 2);
  assert.equal(h.connections.length, 2);
  assert.deepEqual(other.at(-1), latest.data);
  assert.equal(flags[0], true); assert.ok(flags.slice(1).every(value => !value));
  h.stop(); assert.equal(h.connections.at(-1)!.closed, false);
  stop2(); assert.equal(h.connections.at(-1)!.closed, true);
});
