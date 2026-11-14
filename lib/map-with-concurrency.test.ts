import assert from "node:assert/strict";
import { test } from "node:test";
import { mapWithConcurrency } from "./map-with-concurrency";

const flush = () => new Promise<void>(resolve => setImmediate(resolve));

test("caps in-flight work and preserves order when later items finish first", async () => {
  let active = 0;
  let peak = 0;
  const pending = new Map<number, () => void>();
  const work = mapWithConcurrency([0, 1, 2, 3, 4], 2, async value => {
    peak = Math.max(peak, ++active);
    await new Promise<void>(resolve => pending.set(value, resolve));
    active--;
    return value * 10;
  });
  assert.deepEqual([...pending.keys()], [0, 1]);
  for (const value of [1, 2, 0, 4, 3]) {
    pending.get(value)!();
    await flush();
  }
  assert.deepEqual(await work, [0, 10, 20, 30, 40]);
  assert.equal(peak, 2);
  assert.equal(active, 0);
});

test("attempts and settles every item before reporting a failure", async () => {
  const failure = new Error("one state failed");
  const attempted: number[] = [];
  const settled: number[] = [];
  const work = mapWithConcurrency([0, 1, 2, 3, 4], 2, async value => {
    attempted.push(value);
    if (value === 0) throw failure;
    await flush();
    settled.push(value);
    return value;
  });
  await assert.rejects(work, error => error === failure);
  assert.deepEqual(attempted, [0, 1, 2, 3, 4]);
  assert.deepEqual(settled.sort(), [1, 2, 3, 4]);
});

test("empty work finishes and invalid concurrency is rejected", async () => {
  assert.deepEqual(await mapWithConcurrency([], 4, async value => value), []);
  for (const concurrency of [0, -1, 1.5, Infinity, NaN]) {
    await assert.rejects(mapWithConcurrency([1], concurrency, async value => value), RangeError);
  }
});
