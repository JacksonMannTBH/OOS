import test from "node:test";
import assert from "node:assert/strict";
import { createScreenWakeSession, type ScreenWakeLease } from "./screen-wake-session";

function makeLease() {
  let releases = 0;
  const lease: ScreenWakeLease = {
    released: false,
    async release() { releases++; this.released = true; },
  };
  return { lease, releases: () => releases };
}

test("late wake acquisition is released after leaving Ride Mode", async () => {
  const { lease, releases } = makeLease();
  let finish!: (lease: ScreenWakeLease) => void;
  let requests = 0;
  const session = createScreenWakeSession(() => { requests++; return new Promise(resolve => { finish = resolve; }); }, () => true);
  const pending = session.sync();
  await session.sync();
  assert.equal(requests, 1);
  session.stop();
  finish(lease);
  await pending;
  assert.equal(releases(), 1);
  await session.sync();
  assert.equal(requests, 1);
});

test("backgrounding releases the lock; returning gets a new lock", async () => {
  let visible = false;
  const leases: ReturnType<typeof makeLease>[] = [];
  const session = createScreenWakeSession(async () => {
    const item = makeLease(); leases.push(item); return item.lease;
  }, () => visible);
  await session.sync();
  assert.equal(leases.length, 0);
  visible = true;
  await session.sync();
  await session.sync();
  assert.equal(leases.length, 1);
  visible = false;
  await session.sync();
  assert.equal(leases[0]!.releases(), 1);
  visible = true;
  await session.sync();
  assert.equal(leases.length, 2);
  session.stop(); session.stop();
  assert.equal(leases[1]!.releases(), 1);
});

test("OS release and denied requests can recover on the next visibility change", async () => {
  let calls = 0;
  const item = makeLease();
  const session = createScreenWakeSession(async () => {
    if (++calls === 1) throw new Error("Low power");
    return item.lease;
  }, () => true);
  await session.sync();
  await session.sync();
  assert.equal(calls, 2);
  item.lease.released = true;
  await session.sync();
  assert.equal(calls, 3);
  session.stop();
});

test("a request finishing in the background immediately releases", async () => {
  let visible = true;
  let finish!: (lease: ScreenWakeLease) => void;
  const item = makeLease();
  const session = createScreenWakeSession(() => new Promise(resolve => { finish = resolve; }), () => visible);
  const pending = session.sync();
  visible = false;
  await session.sync();
  finish(item.lease);
  await pending;
  assert.equal(item.releases(), 1);
  session.stop();
});
