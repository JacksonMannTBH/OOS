// Single source of truth for how long Out Of Sight has been listening to
// the sky?" Hot zones, takeoff forecasts, and the home prediction card all
// read from getLearningState() so the "Learning your sky" panel says the
// same thing wherever it appears.
//
// The contract:
//   - meta:first_sample_ts is written ONCE on the first successful track
//     ingest after this code ships (logTracks calls
//     recordFirstSampleIfMissing). After that the timer ticks on its own.
//   - For repos with weeks of history already, run
//     scripts/backfill-first-sample.ts once to seed the key from the
//     oldest existing tracks:* entry. Without that, the production timer
//     starts at deploy day and riders see "Learning your sky" even though
//     we've been collecting data for weeks.

import { cacheGet, cacheSet, cacheSetIfAbsent } from "./cache";

export const LEARNING_THRESHOLD_DAYS = 30;

const META_KEY = "meta:first_sample_ts";
const READ_CACHE_KEY = "ss:learning-state:v1";
const READ_CACHE_TTL_SECONDS = 5 * 60;

export type LearningState = {
  /** ISO timestamp of the first sample ever ingested. null = nothing seen yet. */
  firstSampleIso: string | null;
  /** Whole days elapsed since firstSampleIso, capped at LEARNING_THRESHOLD_DAYS. */
  daysElapsed: number;
  /** Whole days remaining to reach LEARNING_THRESHOLD_DAYS. 0 once we cross the line. */
  daysRemaining: number;
  /** 0..1 fraction of the learning window completed. */
  progress: number;
  /** True until daysElapsed >= LEARNING_THRESHOLD_DAYS. */
  stillLearning: boolean;
};

const MS_PER_DAY = 86_400_000;

/** Pure derivation, exported for tests + tooling. */
export function deriveLearningState(
  firstSampleIso: string | null,
  now: Date = new Date(),
): LearningState {
  if (!firstSampleIso) {
    return {
      firstSampleIso: null,
      daysElapsed: 0,
      daysRemaining: LEARNING_THRESHOLD_DAYS,
      progress: 0,
      stillLearning: true,
    };
  }
  const start = Date.parse(firstSampleIso);
  if (!Number.isFinite(start)) {
    return {
      firstSampleIso,
      daysElapsed: 0,
      daysRemaining: LEARNING_THRESHOLD_DAYS,
      progress: 0,
      stillLearning: true,
    };
  }
  const rawDays = Math.max(0, Math.floor((now.getTime() - start) / MS_PER_DAY));
  const daysElapsed = Math.min(rawDays, LEARNING_THRESHOLD_DAYS);
  const daysRemaining = Math.max(0, LEARNING_THRESHOLD_DAYS - daysElapsed);
  const progress = daysElapsed / LEARNING_THRESHOLD_DAYS;
  return {
    firstSampleIso,
    daysElapsed,
    daysRemaining,
    progress,
    stillLearning: daysElapsed < LEARNING_THRESHOLD_DAYS,
  };
}

export async function getLearningState(): Promise<LearningState> {
  const cached = await cacheGet<LearningState>(READ_CACHE_KEY);
  if (cached) return cached;

  const raw = await cacheGet<string>(META_KEY);
  const firstSampleIso =
    typeof raw === "string" && raw.length > 0 ? raw : null;
  const state = deriveLearningState(firstSampleIso);
  await cacheSet(READ_CACHE_KEY, state, READ_CACHE_TTL_SECONDS);
  return state;
}

/**
 * Idempotent — sets meta:first_sample_ts iff missing. Called from logTracks
 * on every snapshot regen so the very first successful track-write seeds
 * the timer. After that this is a cheap NX no-op (one round-trip, no
 * payload).
 */
export async function recordFirstSampleIfMissing(now: Date = new Date()): Promise<void> {
  try {
    await cacheSetIfAbsent(META_KEY, now.toISOString());
  } catch {
    /* best-effort — non-fatal */
  }
}

/** Test/operator helper: force a value (e.g. from the backfill script). */
export async function setFirstSampleTs(iso: string): Promise<void> {
  await cacheSet(META_KEY, iso, 10 * 365 * 24 * 60 * 60);
  await cacheSet(READ_CACHE_KEY, deriveLearningState(iso), READ_CACHE_TTL_SECONDS);
}
