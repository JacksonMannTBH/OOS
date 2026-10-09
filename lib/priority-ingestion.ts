import { ADSB_FI_BATCH_SIZE, ADSB_FI_REQUEST_SPACING_MS } from "./adsb-limits";

export type IngestionBatch = {
  tails: string[];
  kind: "priority" | "discovery";
  intervalMs: number;
  scheduledAt: number;
};

/** One shared request budget for both queues; publication completes per batch. */
export async function runPriorityIngestion(options: {
  tails: string[];
  priorityTails: string[];
  lastAttemptByTail: Map<string, number>;
  priorityIntervalMs: number;
  windowMs?: number;
  now?: () => number;
  wait?: (ms: number) => Promise<void>;
  sample: (batch: IngestionBatch) => Promise<string[] | undefined>;
}): Promise<void> {
  const now = options.now ?? Date.now;
  const wait = options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const startedAt = now();
  const deadline = startedAt + (options.windowMs ?? 55_000);
  const tails = [...new Set(options.tails)];
  const priority = new Set(options.priorityTails);
  const attempts = new Map(options.lastAttemptByTail);
  const discoveryIntervalMs = Math.max(30_000, options.priorityIntervalMs);
  // Leave a full request-spacing gap on worker handoff, too.
  let nextRequestAt = startedAt + ADSB_FI_REQUEST_SPACING_MS;
  let previousKind: IngestionBatch["kind"] | undefined;

  while (now() < deadline && tails.length > 0) {
    const dueAt = (tail: string) => {
      const previous = attempts.get(tail);
      // Never-queried aircraft must outrank overdue but previously queried
      // aircraft, including after a worker restart during a long fleet scan.
      return previous == null ? 0 : previous + (
        priority.has(tail) ? options.priorityIntervalMs : discoveryIntervalMs
      );
    };
    const due = tails.filter((tail) => dueAt(tail) <= now())
      .sort((a, b) => dueAt(a) - dueAt(b) || a.localeCompare(b));
    const fast = due.filter((tail) => priority.has(tail));
    const slow = due.filter((tail) => !priority.has(tail));
    // Under load, reserve every other batch for discovery so takeoffs cannot
    // starve behind a large airborne fleet. Oldest due aircraft always go first.
    const kind = fast.length && !(previousKind === "priority" && slow.length)
      ? "priority" : "discovery";
    const selected = (kind === "priority" ? fast : slow).slice(0, ADSB_FI_BATCH_SIZE);
    if (!selected.length) {
      const nextDue = Math.min(...tails.map(dueAt));
      if (nextDue >= deadline) break;
      await wait(Math.max(1, nextDue - now()));
      continue;
    }
    if (nextRequestAt >= deadline) break;
    if (nextRequestAt > now()) await wait(nextRequestAt - now());
    if (now() >= deadline) break;
    const requestedAt = now();
    const updatedPriority = await options.sample({
      tails: selected,
      kind,
      intervalMs: kind === "priority" ? options.priorityIntervalMs : discoveryIntervalMs,
      scheduledAt: attempts.has(selected[0]!) ? dueAt(selected[0]!) : startedAt,
    });
    for (const tail of selected) attempts.set(tail, requestedAt);
    // Failed source requests return undefined: retain priority through outages.
    if (updatedPriority) {
      for (const tail of selected) priority.delete(tail);
      for (const tail of updatedPriority) priority.add(tail);
    }
    // Include persistence and fallback time: variable DB latency before a
    // request must never compress two actual provider calls below the limit.
    nextRequestAt = now() + ADSB_FI_REQUEST_SPACING_MS;
    previousKind = kind;
  }
}
