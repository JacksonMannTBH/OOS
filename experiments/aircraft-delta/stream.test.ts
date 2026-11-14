import assert from "node:assert/strict";
import { test } from "node:test";
import { AircraftDeltaStream } from "./stream";
import { deltaMessage, encodeMessage, fullMessage, type FullMessage, type Message } from "./protocol";
import { state, nextState } from "./scenarios";
import type { LiveState } from "../../lib/live-data-protocol";

globalThis.fetch = async () => { throw new Error("Network disabled in local stream tests"); };
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
type Connection = { receive: (frame: unknown) => void; joined: () => void; closed: boolean };
function harness(load?: (signal: AbortSignal) => Promise<FullMessage>) {
  let clock = 100_000, reads = 0;
  let latest = fullMessage(state(clock), "local");
  const connections: Connection[] = [], seen: LiveState[] = [];
  const stream = new AircraftDeltaStream("WA", (receive, joined) => {
    const connection = { receive, joined, closed: false }; connections.push(connection);
    return () => { connection.closed = true; };
  }, async signal => { reads++; return load ? load(signal) : latest; }, () => clock);
  const stop = stream.subscribe(s => seen.push(s));
  const send = (message: Message) => { for (const f of encodeMessage(message)) connections.at(-1)!.receive(f); };
  return { stream, connections, seen, stop, send, get reads() { return reads; },
    advance() {
      clock += 20_000;
      const next = nextState(latest.data), delta = deltaMessage(latest, next);
      latest = fullMessage(next, latest.stream, delta.sequence); return delta;
    }, get latest() { return latest; }, tick(ms: number) { clock += ms; },
    async join() { stream.resume(); connections.at(-1)!.joined(); await flush(); },
  };
}

test("healthy transport shares one bootstrap and never polls the full catalog", async () => {
  const h = harness(); await h.join();
  const second: LiveState[] = [], stop2 = h.stream.subscribe(s => second.push(s));
  for (let i = 0; i < 60; i++) { h.send(h.advance()); h.stream.checkHealth(); }
  assert.equal(h.reads, 1); assert.equal(h.connections.length, 1);
  assert.deepEqual(h.seen.at(-1), h.latest.data); assert.deepEqual(second.at(-1), h.latest.data);
  h.stop(); assert.equal(h.connections[0]!.closed, false); stop2(); assert.equal(h.connections[0]!.closed, true);
});

test("a dropped message automatically fetches one baseline and coalesces concurrent recovery", async () => {
  let resolve: (x: FullMessage) => void = () => {};
  let loads = 0;
  const h = harness(async () => ++loads === 1 ? fullMessage(state(100_000), "local") : new Promise(r => { resolve = r; }));
  await h.join(); h.advance(); h.send(h.advance()); await flush();
  assert.equal(h.reads, 2);
  const recovery = h.latest;
  h.send(h.advance()); h.send(h.advance()); assert.equal(h.reads, 2);
  resolve(recovery); await flush();
  assert.deepEqual(h.seen.at(-1), h.latest.data); h.stop();
});

test("background and foreground reconnects reject old callbacks and aborted recovery", async () => {
  const pending: { resolve: (value: FullMessage) => void; signal: AbortSignal }[] = [];
  const h = harness(signal => new Promise(resolve => pending.push({ resolve, signal })));
  await h.join(); h.stream.suspend(); assert.equal(pending[0]!.signal.aborted, true);
  h.advance(); await h.join();
  pending[0]!.resolve(fullMessage(state(100_000), "local"));
  h.connections[0]!.joined();
  for (const f of encodeMessage(fullMessage(state(999_999), "stale-socket"))) h.connections[0]!.receive(f);
  await flush(); assert.equal(h.seen.length, 0); assert.equal(h.reads, 2);
  pending[1]!.resolve(h.latest); await flush(); assert.deepEqual(h.seen.at(-1), h.latest.data); h.stop();
});

test("silent connection retries after 60 seconds and recovers from a failed initial read", async () => {
  let attempts = 0;
  const h = harness(async () => { if (++attempts === 1) throw new Error("offline"); return fullMessage(state(100_000), "local"); });
  await h.join(); assert.equal(h.seen.length, 0);
  h.tick(59_999); h.stream.checkHealth(); assert.equal(h.reads, 1);
  h.tick(1); h.stream.checkHealth(); await flush(); assert.equal(h.reads, 2); assert.equal(h.connections.length, 2);
  assert.equal(h.seen.length, 1); h.stop();
});

test("state switching cannot deliver an old state's pending baseline to the new subscriber", async () => {
  const h = harness(); await h.join(); h.stop();
  const tx = { ...state(200_000), state: "TX" as const };
  let receive: (frame: unknown) => void = () => {}, joined = () => {};
  const seen: LiveState[] = [];
  const stream = new AircraftDeltaStream("TX", (r, j) => { receive = r; joined = j; return () => {}; }, async () => fullMessage(tx, "tx"));
  const stop = stream.subscribe(s => seen.push(s)); stream.resume(); joined(); await flush();
  for (const f of encodeMessage(fullMessage(state(300_000), "wa"))) receive(f);
  assert.equal(seen.length, 1); assert.equal(seen[0]!.state, "TX"); stop();
});
