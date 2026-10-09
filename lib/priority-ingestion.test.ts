import assert from "node:assert/strict";
import { test } from "node:test";
import { runPriorityIngestion, type IngestionBatch } from "./priority-ingestion";

test("airborne batches interrupt nationwide discovery without starving it", async () => {
  let now = 1_000_000;
  const tails = Array.from({ length: 1100 }, (_, i) => `N${String(i).padStart(4, "0")}`);
  const published: Array<IngestionBatch & { at: number }> = [];
  await runPriorityIngestion({
    tails, priorityTails: [tails[0]!], lastAttemptByTail: new Map(),
    priorityIntervalMs: 10_000, now: () => now,
    wait: async (ms) => { now += ms; },
    sample: async (batch) => {
      published.push({ ...batch, at: now });
      now += 500; // fetch and publish before the next batch
      return batch.tails.includes(tails[0]!) ? [tails[0]!] : [];
    },
  });
  assert.equal(published[0]?.kind, "priority");
  const airborne = published.filter((batch) => batch.kind === "priority");
  assert.ok(airborne.length >= 4);
  for (let i = 1; i < airborne.length; i++) {
    assert.ok(airborne[i]!.at - airborne[i - 1]!.at <= 12_000);
  }
  assert.equal(new Set(published.flatMap((batch) => batch.tails)).size, 1100);
  assert.ok(published.every((batch) => batch.tails.length <= 75));
  for (let i = 1; i < published.length; i++) {
    assert.ok(published[i]!.at - published[i - 1]!.at >= 1_100);
  }
});

test("new takeoff candidates get a fast followup and confirmed landings return to discovery", async () => {
  let now = 0;
  const samples: Array<IngestionBatch & { at: number }> = [];
  await runPriorityIngestion({
    tails: ["N1"], priorityTails: [], lastAttemptByTail: new Map(),
    priorityIntervalMs: 10_000, now: () => now,
    wait: async (ms) => { now += ms; },
    sample: async (batch) => {
      samples.push({ ...batch, at: now });
      return samples.length === 1 ? ["N1"] : [];
    },
  });
  assert.deepEqual(samples.map((s) => s.kind), ["discovery", "priority", "discovery"]);
  assert.equal(samples[1]!.at - samples[0]!.at, 10_000);
  assert.equal(samples[2]!.at - samples[1]!.at, 30_000);
});

test("outages preserve priority and attempts from previous workers preserve discovery progress", async () => {
  let now = 100_000;
  const samples: Array<IngestionBatch & { at: number }> = [];
  await runPriorityIngestion({
    tails: ["N1", "N2", "N3"], priorityTails: ["N1"],
    lastAttemptByTail: new Map([["N1", 99_000], ["N2", 99_000]]),
    priorityIntervalMs: 10_000, windowMs: 25_000, now: () => now,
    wait: async (ms) => { now += ms; },
    sample: async (batch) => { samples.push({ ...batch, at: now }); return undefined; },
  });
  assert.deepEqual(samples[0]?.tails, ["N3"]);
  assert.deepEqual(samples.slice(1).map((s) => s.kind), ["priority", "priority"]);
  assert.ok(samples.every((s) => !s.tails.includes("N2")));
});

test("discovery retains capacity when the airborne fleet exceeds the fast budget", async () => {
  let now = 0;
  const priorityTails = Array.from({ length: 900 }, (_, i) => `P${i}`);
  const samples: IngestionBatch[] = [];
  await runPriorityIngestion({
    tails: [...priorityTails, "N-grounded"], priorityTails,
    lastAttemptByTail: new Map(), priorityIntervalMs: 5_000,
    windowMs: 20_000, now: () => now,
    wait: async (ms) => { now += ms; },
    sample: async (batch) => {
      samples.push(batch);
      now += 2_000;
      return batch.tails.filter((tail) => tail.startsWith("P"));
    },
  });
  assert.deepEqual(samples[1]?.tails, ["N-grounded"]);
  assert.equal(samples[1]?.kind, "discovery");
  const fastTails = samples.filter((s) => s.kind === "priority").flatMap((s) => s.tails);
  assert.equal(new Set(fastTails).size, fastTails.length, "oldest airborne aircraft get served first");
});

test("a slow batch crossing the worker deadline prevents further requests", async () => {
  let now = 0;
  let calls = 0;
  await runPriorityIngestion({
    tails: Array.from({ length: 100 }, (_, i) => `N${i}`),
    priorityTails: [], lastAttemptByTail: new Map(), priorityIntervalMs: 10_000,
    windowMs: 5_000, now: () => now,
    wait: async (ms) => { now += ms; },
    sample: async () => { calls++; now += 10_000; return []; },
  });
  assert.equal(calls, 1);
});

test("after restart, never-queried discovery aircraft precede overdue previously queried aircraft", async () => {
  let now = 60_000;
  const samples: IngestionBatch[] = [];
  const tails = Array.from({ length: 100 }, (_, i) => `N${String(i).padStart(3, "0")}`);
  await runPriorityIngestion({
    tails, priorityTails: [],
    lastAttemptByTail: new Map(tails.slice(0, 75).map((tail) => [tail, 1_100])),
    priorityIntervalMs: 10_000, windowMs: 2_000, now: () => now,
    wait: async (ms) => { now += ms; },
    sample: async (batch) => { samples.push(batch); return []; },
  });
  assert.deepEqual(samples[0]?.tails.slice(0, 25), tails.slice(75));
});
