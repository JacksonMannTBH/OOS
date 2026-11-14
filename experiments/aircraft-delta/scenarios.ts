import { AircraftDeltaAssembler, canonicalState, deltaMessage, encodeMessage, fullMessage, wireCopy, type Message, type FullMessage } from "./protocol";
import { encodeLiveState, LiveStateAssembler, type LiveState } from "../../lib/live-data-protocol";
import type { Aircraft } from "../../lib/types";

export const canonical = (value: unknown): string => JSON.stringify(value, (_k, v) =>
  v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
export function check(value: unknown, message = "Check failed"): asserts value { if (!value) throw new Error(message); }
export const equal = (a: unknown, b: unknown, message = "States differ") => check(canonical(a) === canonical(b), message);
export const point = (ts: number) => ({ lat: 47 + ts / 10000, lon: -122, ts });
export const aircraft = (tail: string): Aircraft => ({
  tail, icao24: "A00123", operator: "Example agency", model: "Cessna 182", nickname: null,
  roleDescription: "Patrol", base: "Example airport", role: "patrol", roleConfidence: "confirmed",
  airborne: true, observed: true, as_of: 100, lat: 47, lon: -122, heading: 20,
  home_state_code: "WA", current_state_code: "WA", flight_session_id: "flight-1",
});
export const state = (revision = 100): LiveState => ({
  version: 1, state: "WA", revision, cursor: revision,
  snapshot: { fetched_at: revision, source: "adsbfi", source_ok: true, live_seen_count: 2,
    aircraft: [aircraft("N123"), { ...aircraft("N456"), airborne: false, flight_session_id: null }] },
  sessions: { N123: "flight-1" }, trails: { N123: [point(1), point(2)] },
});
export function nextState(previous: LiveState, edit: (s: LiveState) => void = () => {}): LiveState {
  const next = wireCopy(previous);
  next.revision += 20_000; next.cursor = next.revision; next.snapshot.fetched_at = next.revision;
  for (const a of next.snapshot.aircraft) a.as_of = next.revision;
  edit(next);
  return next;
}
export function receive(assembler: AircraftDeltaAssembler, message: Message): LiveState | null {
  let result: LiveState | null = null;
  for (const f of encodeMessage(message)) result = assembler.acceptFrame(wireCopy(f)) ?? result;
  return result;
}
function setup() {
  const baseline = fullMessage(state(), "test-worker");
  const assembler = new AircraftDeltaAssembler("WA");
  equal(receive(assembler, baseline), baseline.data);
  return { baseline, assembler };
}
function transition(baseline: FullMessage, assembler: AircraftDeltaAssembler, edit: (s: LiveState) => void) {
  const next = nextState(baseline.data, edit), delta = deltaMessage(baseline, next);
  equal(receive(assembler, delta), next);
  check(!assembler.needsResync);
  return fullMessage(next, baseline.stream, delta.sequence);
}

export const scenarios: { name: string; run: () => void }[] = [
  { name: "duplicate provider observations normalize consistently at bootstrap and update", run() {
    const initial = state(); initial.trails.N123 = [point(2), point(1), { ...point(2), lat: 49 }];
    const baseline = fullMessage(initial, "duplicate-points"), assembler = new AircraftDeltaAssembler("WA");
    equal(receive(assembler, baseline)!.trails.N123, [point(1), { ...point(2), lat: 49 }]);
    const next = nextState(baseline.data); next.trails.N123 = [point(3), point(1), point(2), { ...point(3), lat: 48 }];
    equal(receive(assembler, deltaMessage(baseline, next)), canonicalState(next));
  } },
  { name: "independent aircraft clocks and removal of the clock retain exact field presence", run() {
    const { baseline, assembler } = setup();
    const b = transition(baseline, assembler, s => { s.snapshot.aircraft[0]!.as_of = "2026-11-13T22:00:00Z"; });
    transition(b, assembler, s => { delete s.snapshot.aircraft[0]!.as_of; s.snapshot.aircraft[1]!.as_of = null; });
  } },
  { name: "a malformed coordinate patch requests recovery instead of poisoning the map", run() {
    const { baseline, assembler } = setup();
    const bad = deltaMessage(baseline, nextState(baseline.data));
    bad.aircraft.change = [{ tail: "N123", set: { lat: "invalid" as unknown as number }, unset: [] }];
    check(receive(assembler, bad) === null); check(assembler.needsResync); equal(assembler.value, baseline.data);
  } },
  { name: "position-only changes preserve catalog and transmit the common clock once", run() {
    const { baseline, assembler } = setup();
    const next = nextState(baseline.data, s => { s.snapshot.aircraft[0]!.lat = 48; s.trails.N123!.push(point(3)); });
    const delta = deltaMessage(baseline, next);
    equal(delta.aircraft.change, [{ tail: "N123", set: { lat: 48 }, unset: [] }]);
    check(delta.aircraft.asOf === next.revision);
    check(!JSON.stringify(delta).includes("Cessna"));
    equal(receive(assembler, delta), next);
    equal(baseline.data, state(), "Previously visible state was mutated");
  } },
  { name: "catalog edits, null, false, zero, and deleting optional fields survive", run() {
    const { baseline, assembler } = setup();
    let b = transition(baseline, assembler, s => Object.assign(s.snapshot.aircraft[0]!, {
      nickname: "New name", model: "Updated model", roleDescription: "Changed mission", heading: 0, observed: false, roleNote: "Temporary",
    }));
    b = transition(b, assembler, s => { const a = s.snapshot.aircraft[0]!; a.nickname = null; delete a.heading; delete a.roleNote; });
    check(!Object.hasOwn(b.data.snapshot.aircraft[0]!, "heading"));
  } },
  { name: "adding, removing and reordering aircraft preserves exact catalog order", run() {
    const { baseline, assembler } = setup();
    const b = transition(baseline, assembler, s => { s.snapshot.aircraft.unshift({ ...aircraft("N789"), airborne: false, flight_session_id: null }); s.snapshot.aircraft.reverse(); });
    transition(b, assembler, s => { s.snapshot.aircraft = s.snapshot.aircraft.filter(a => a.tail !== "N123"); delete s.sessions!.N123; delete s.trails.N123; });
  } },
  { name: "landing clears trails and a new flight replaces the old session", run() {
    const { baseline, assembler } = setup();
    const landed = transition(baseline, assembler, s => {
      Object.assign(s.snapshot.aircraft[0]!, { airborne: false, flight_session_id: null }); s.sessions = {}; s.trails = {};
    });
    transition(landed, assembler, s => {
      Object.assign(s.snapshot.aircraft[0]!, { airborne: true, flight_session_id: "flight-2" });
      s.sessions = { N123: "flight-2" }; s.trails = { N123: [point(40)] };
    });
  } },
  { name: "late and corrected points merge; history trimming replaces the trail", run() {
    const { baseline, assembler } = setup();
    const b = transition(baseline, assembler, s => { s.trails.N123 = [point(0), { ...point(1), lat: 49 }, point(2), point(3)]; });
    transition(b, assembler, s => { s.trails.N123 = [point(2), point(3)]; });
  } },
  { name: "provider failure and recovery update health while retaining aircraft", run() {
    const { baseline, assembler } = setup();
    const b = transition(baseline, assembler, s => { s.cursor = baseline.data.cursor; s.snapshot.source_ok = false; s.snapshot.source_error = "Unavailable"; });
    transition(b, assembler, s => { s.snapshot.source_ok = true; delete s.snapshot.source_error; });
  } },
  { name: "missed message requires an exact baseline; queued later updates replay", run() {
    const { baseline, assembler } = setup();
    const second = fullMessage(nextState(baseline.data, s => { s.snapshot.aircraft[0]!.nickname = "Changed while offline"; }), baseline.stream, 2);
    const third = nextState(second.data, s => { s.snapshot.aircraft[0]!.lat = 49; });
    check(receive(assembler, deltaMessage(second, third)) === null);
    check(assembler.needsResync); equal(assembler.value, baseline.data);
    equal(assembler.acceptFull(second), third); check(!assembler.needsResync);
  } },
  { name: "duplicate and reordered complete updates never roll back the visible state", run() {
    const { baseline, assembler } = setup();
    const second = nextState(baseline.data), d2 = deltaMessage(baseline, second);
    const third = nextState(second), b2 = fullMessage(second, baseline.stream, 2), d3 = deltaMessage(b2, third);
    check(receive(assembler, d3) === null); check(receive(assembler, d3) === null);
    equal(assembler.acceptFull(b2), third);
    check(receive(assembler, d2) === null); check(receive(assembler, d3) === null);
    check(assembler.acceptFull(baseline) === null); equal(assembler.value, third);
  } },
  { name: "new worker epoch recovers safely and rejects delayed old-worker data", run() {
    const { baseline, assembler } = setup();
    const second = fullMessage(nextState(baseline.data), "new-worker");
    const third = nextState(second.data);
    check(receive(assembler, deltaMessage(second, third)) === null); check(assembler.needsResync);
    equal(assembler.acceptFull(second), third);
    check(assembler.acceptFull(baseline) === null); equal(assembler.value, third);
  } },
  { name: "reversed and duplicated chunks commit atomically; incomplete messages recover", run() {
    const { baseline, assembler } = setup();
    const next = nextState(baseline.data, s => { s.snapshot.aircraft[0]!.roleDescription = "😀".repeat(40_000); });
    const delta = deltaMessage(baseline, next), frames = encodeMessage(delta).reverse();
    check(frames.length > 1);
    for (const f of frames.slice(0, -1)) { check(assembler.acceptFrame(f) === null); check(assembler.acceptFrame(f) === null); equal(assembler.value, baseline.data); }
    equal(assembler.acceptFrame(frames.at(-1)), next);
    const missing = new AircraftDeltaAssembler("WA"); missing.acceptFull(baseline); missing.acceptFrame(frames[0]);
    const later = nextState(next); check(receive(missing, deltaMessage(fullMessage(next, baseline.stream, 2), later)) === null);
    check(missing.needsResync); equal(missing.acceptFull(fullMessage(later, baseline.stream, 3)), later);
  } },
  { name: "unknown aircraft patch fails atomically and asks for recovery", run() {
    const { baseline, assembler } = setup();
    const delta = deltaMessage(baseline, nextState(baseline.data));
    delta.aircraft.change = [{ tail: "N999", set: { lat: 49 }, unset: [] }];
    check(receive(assembler, delta) === null); check(assembler.needsResync); equal(assembler.value, baseline.data);
  } },
  { name: "malformed frames and prototype keys cannot alter cached data", run() {
    const { baseline, assembler } = setup();
    const f = encodeMessage(deltaMessage(baseline, nextState(baseline.data)))[0]!;
    for (const invalid of [null, {}, { ...f, count: 9999 }, { ...f, index: -1 }, { ...f, sequence: NaN }, { ...f, state: "TX" }, { ...f, data: "not json" }]) {
      check(assembler.acceptFrame(invalid) === null); equal(assembler.value, baseline.data);
    }
    const bad = deltaMessage(baseline, nextState(baseline.data));
    bad.aircraft.change = [{ tail: "N123", set: JSON.parse('{"__proto__":{"polluted":true}}'), unset: [] }];
    check(assembler.acceptFrame({ ...f, data: JSON.stringify(bad) }) === null);
    check(!Object.hasOwn({}, "polluted")); equal(assembler.value, baseline.data);
  } },
  { name: "wrong-state traffic is isolated and an empty state still updates health", run() {
    const { baseline, assembler } = setup();
    const texas = wireCopy(baseline.data); texas.state = "TX"; texas.revision++;
    check(receive(assembler, fullMessage(texas, "tx")) === null); equal(assembler.value, baseline.data);
    const empty = transition(baseline, assembler, s => { s.snapshot.aircraft = []; s.sessions = {}; s.trails = {}; });
    transition(empty, assembler, s => { s.snapshot.source_ok = false; });
  } },
  { name: "long disconnection bounds queued updates and reconnect restores the latest state", run() {
    const { baseline, assembler } = setup();
    let latest = baseline;
    for (let i = 0; i < 100; i++) {
      const next = nextState(latest.data, s => { s.snapshot.aircraft[0]!.lat = 47 + i / 100; });
      const delta = deltaMessage(latest, next);
      if (i > 0) receive(assembler, delta); // first update is lost while backgrounded
      latest = fullMessage(next, latest.stream, delta.sequence);
      check(assembler.queuedCount <= 8);
    }
    check(assembler.needsResync); equal(assembler.acceptFull(latest), latest.data);
    check(!assembler.needsResync); check(assembler.queuedCount === 0);
    transition(latest, assembler, s => { s.snapshot.aircraft[0]!.lat = 48; });
  } },
  { name: "existing v1/v2 client ignores v3 and continues using its unchanged feed", run() {
    const old = new LiveStateAssembler("WA"), initial = state(); old.acceptState(initial);
    const next = nextState(initial), delta = deltaMessage(fullMessage(initial, "new"), next);
    for (const f of encodeMessage(delta)) check(old.acceptFrame(f) === null);
    let received = null;
    for (const f of encodeLiveState({ ...next, version: 2, cursor: next.cursor!, baseCursor: initial.cursor!, sessions: next.sessions!, trails: {} })) received = old.acceptFrame(f) ?? received;
    equal(received, next);
  } },
  { name: "1,000 deterministic mixed updates reconstruct exactly without accumulating catalog rows", run() {
    const { baseline, assembler } = setup(); let b = baseline, seed = 731;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
    for (let i = 0; i < 1000; i++) {
      b = transition(b, assembler, s => {
        const a = s.snapshot.aircraft[0]!;
        a.lat = 47 + random(); a.heading = Math.floor(random() * 360);
        if (i % 7 === 0) a.nickname = i % 14 === 0 ? null : `Name ${i}`;
        if (i % 11 === 0) a.roleNote = `Note ${i}`;
        if (i % 13 === 0) delete a.roleNote;
        s.snapshot.source_ok = i % 23 !== 0;
        s.trails.N123!.push(point(i + 3));
        if (s.trails.N123!.length > 40) s.trails.N123!.shift();
      });
      check(b.data.snapshot.aircraft.length === 2);
    }
  } },
];
