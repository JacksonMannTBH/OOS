// "Next likely sweep" predictor — replaces the hardcoded probability
// card on the home page with one derived from accumulated activity:feed
// events. Algorithm is a simple (hour, day-of-week) histogram of takeoff
// events for tracked aircraft, normalized per day of week.
//
// Storage:
//   predictor:current → JSON of { windows, total_events, generated_at }, 1h TTL
//
// Refreshed by /api/cron/refresh-predictor (hourly on Pro, daily on Hobby).
// Reads served from cache; falls back to live recompute on cache miss.

import { cacheGet, cacheSet } from "./cache";
import { getRecentActivity, type ActivityEntry } from "./activity";

const CACHE_KEY = "predictor:current";
const CACHE_TTL_SECONDS = 60 * 60;

const WINDOW_HOURS = 1;
const HORIZON_HOURS = 6;
const TOP_N = 3;
const MAX_FEED_READ = 500;

// Local-time bucketing: tied to America/Los_Angeles since rider behavior is
// what matters and Pacific time is the operational frame for our fleet.
const TIME_ZONE = "America/Los_Angeles";

export type ConfidenceLevel = "low" | "medium" | "high";

export type PredictionWindow = {
  /** ISO timestamp of window start (Pacific time, expressed as UTC ms). */
  window_start: string;
  /** ISO timestamp of window end. */
  window_end: string;
  /** P(takeoff in this hour | this dow), 0-1. */
  probability: number;
  /** Total takeoff events that contributed to this bucket. */
  sample_count: number;
  /** Top tails by frequency in this bucket (max 3, by count desc). */
  common_tails: Array<{ tail: string; nickname: string | null; count: number }>;
  confidence_level: ConfidenceLevel;
};

export type PredictorOutput = {
  windows: PredictionWindow[];
  total_events: number;
  generated_at: number;
};

function confidenceFor(n: number): ConfidenceLevel {
  if (n < 5) return "low";
  if (n < 20) return "medium";
  return "high";
}

/**
 * Get the Pacific-time hour-of-day [0, 23] and day-of-week [0, 6] for
 * a given UTC ms timestamp. Sun=0 .. Sat=6.
 */
function pacificHourDow(tsMs: number): { hour: number; dow: number } {
  // Intl gives us locale-correct bucketing without DST math errors.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(new Date(tsMs));
  let hourStr: string | null = null;
  let weekday: string | null = null;
  for (const p of parts) {
    if (p.type === "hour") hourStr = p.value;
    if (p.type === "weekday") weekday = p.value;
  }
  const hour = Number(hourStr ?? 0) % 24;
  const dowMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dow = weekday != null ? (dowMap[weekday] ?? 0) : 0;
  return { hour, dow };
}

/**
 * Returns the UTC ms for the start of the next occurrence of (dow, hour)
 * in Pacific time, AT OR AFTER the given anchor time. If anchor falls
 * within the bucket, returns the bucket's start (= the most recent
 * Pacific-local hour boundary that matches).
 */
function nextOccurrenceMs(anchorMs: number, dow: number, hour: number): number {
  const a = pacificHourDow(anchorMs);
  let dowDelta = (dow - a.dow + 7) % 7;
  let hourDelta = hour - a.hour;
  if (dowDelta === 0 && hourDelta < 0) dowDelta = 7;
  // Pacific clock seconds since anchor's Pacific-day start, approximated.
  // We can't easily round-trip across DST without a library, so we
  // synthesize the wall-clock target then convert via Intl.
  // Simpler: walk the anchor forward in 1h steps until (dow, hour) hits.
  // Worst case 7*24=168 iterations — trivial.
  let t = anchorMs;
  for (let i = 0; i < 24 * 8; i++) {
    const p = pacificHourDow(t);
    if (p.dow === dow && p.hour === hour) {
      // Snap to the start of the Pacific hour. Floor to the hour in UTC
      // is approximately right (off by minutes during DST flips, which
      // is acceptable for "next likely window" copy).
      return Math.floor(t / 3_600_000) * 3_600_000;
    }
    t += 3_600_000;
  }
  return anchorMs; // unreachable
}

async function readActivityEvents(): Promise<ActivityEntry[]> {
  return getRecentActivity(MAX_FEED_READ);
}

/**
 * Build the full prediction. Returns the top-N upcoming hour buckets in
 * the next HORIZON_HOURS window, ranked by P(takeoff | hour, dow).
 */
export async function getNextLikelyWindows(): Promise<PredictorOutput> {
  const events = await readActivityEvents();
  const takeoffs = events.filter((e) => e.kind === "takeoff");
  const total = takeoffs.length;
  const now = Date.now();

  if (total === 0) {
    return { windows: [], total_events: 0, generated_at: now };
  }

  // Histogram: bucket → count + tail-frequency map.
  type BucketInfo = {
    count: number;
    tailFreq: Map<string, { nickname: string | null; n: number }>;
  };
  const dowCounts = new Array<number>(7).fill(0);
  const buckets = new Map<string, BucketInfo>();
  for (const e of takeoffs) {
    const { hour, dow } = pacificHourDow(e.ts);
    dowCounts[dow] = (dowCounts[dow] ?? 0) + 1;
    const key = `${dow}:${hour}`;
    let b = buckets.get(key);
    if (!b) {
      b = { count: 0, tailFreq: new Map() };
      buckets.set(key, b);
    }
    b.count += 1;
    const prev = b.tailFreq.get(e.tail);
    if (prev) prev.n += 1;
    else
      b.tailFreq.set(e.tail, {
        nickname: extractNickname(e),
        n: 1,
      });
  }

  // Walk forward from now in 1h steps, collect upcoming buckets up to horizon.
  const candidates: PredictionWindow[] = [];
  for (let h = 0; h < HORIZON_HOURS; h++) {
    const anchor = now + h * 3_600_000;
    const { hour, dow } = pacificHourDow(anchor);
    const key = `${dow}:${hour}`;
    const b = buckets.get(key);
    if (!b) continue;
    const dowTotal = dowCounts[dow] ?? 0;
    if (dowTotal === 0) continue;

    const startMs = nextOccurrenceMs(anchor, dow, hour);
    const endMs = startMs + WINDOW_HOURS * 3_600_000;
    const top = [...b.tailFreq.entries()]
      .sort((a, b) => b[1].n - a[1].n)
      .slice(0, 3)
      .map(([tail, v]) => ({ tail, nickname: v.nickname, count: v.n }));

    candidates.push({
      window_start: new Date(startMs).toISOString(),
      window_end: new Date(endMs).toISOString(),
      probability: b.count / dowTotal,
      sample_count: b.count,
      common_tails: top,
      confidence_level: confidenceFor(b.count),
    });
  }

  candidates.sort((a, b) => b.probability - a.probability);
  return {
    windows: candidates.slice(0, TOP_N),
    total_events: total,
    generated_at: now,
  };
}

/** Cached read for /api/predict and the home card. */
export async function getCachedPrediction(): Promise<PredictorOutput | null> {
  return await cacheGet<PredictorOutput>(CACHE_KEY);
}

/** Recompute and cache. Called by the hourly cron. */
export async function refreshPrediction(): Promise<PredictorOutput> {
  const out = await getNextLikelyWindows();
  await cacheSet(CACHE_KEY, out, CACHE_TTL_SECONDS);
  return out;
}

/**
 * 7×24 grid of P(takeoff | hour, dow) for the /forecast heatmap. dow
 * is index [0..6] (Sun..Sat); each row is 24 cells (hour 0..23) of
 * { probability, sample_count, common_tails }.
 */
export type ForecastCell = {
  hour: number;
  dow: number;
  probability: number;
  sample_count: number;
  common_tails: Array<{ tail: string; nickname: string | null; count: number }>;
};

export type ForecastGrid = {
  cells: ForecastCell[];
  total_events: number;
  generated_at: number;
};

export async function getForecastGrid(): Promise<ForecastGrid> {
  const events = await readActivityEvents();
  const takeoffs = events.filter((e) => e.kind === "takeoff");
  const total = takeoffs.length;
  const now = Date.now();
  const dowCounts = new Array<number>(7).fill(0);
  type BucketInfo = {
    count: number;
    tailFreq: Map<string, { nickname: string | null; n: number }>;
  };
  const buckets = new Map<string, BucketInfo>();
  for (const e of takeoffs) {
    const { hour, dow } = pacificHourDow(e.ts);
    dowCounts[dow] = (dowCounts[dow] ?? 0) + 1;
    const key = `${dow}:${hour}`;
    let b = buckets.get(key);
    if (!b) {
      b = { count: 0, tailFreq: new Map() };
      buckets.set(key, b);
    }
    b.count += 1;
    const prev = b.tailFreq.get(e.tail);
    if (prev) prev.n += 1;
    else
      b.tailFreq.set(e.tail, {
        nickname: extractNickname(e),
        n: 1,
      });
  }
  const cells: ForecastCell[] = [];
  for (let dow = 0; dow < 7; dow++) {
    const dowTotal = dowCounts[dow] ?? 0;
    for (let hour = 0; hour < 24; hour++) {
      const b = buckets.get(`${dow}:${hour}`);
      const top = b
        ? [...b.tailFreq.entries()]
            .sort((a, b) => b[1].n - a[1].n)
            .slice(0, 3)
            .map(([tail, v]) => ({ tail, nickname: v.nickname, count: v.n }))
        : [];
      cells.push({
        hour,
        dow,
        probability: b && dowTotal > 0 ? b.count / dowTotal : 0,
        sample_count: b?.count ?? 0,
        common_tails: top,
      });
    }
  }
  return { cells, total_events: total, generated_at: now };
}

function extractNickname(e: ActivityEntry): string | null {
  // The activity entry's description embeds the nickname for known tails;
  // for unknown ones the description is "{tail} airborne". We don't store
  // the raw nickname on the entry, so we can only recover it when the
  // description doesn't start with the tail itself.
  const desc = e.description ?? "";
  const m = /^([A-Za-z][A-Za-z0-9 ]+) (airborne|landed|up|off|lifting)/.exec(
    desc,
  );
  if (m && m[1] && m[1] !== e.tail) return m[1];
  return null;
}
