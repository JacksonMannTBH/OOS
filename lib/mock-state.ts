// Mock state machine for ?mock=<state> on rider-facing pages and API
// routes. Deterministic — same query param yields the same response
// shape, no randomness, no time-of-day drift.
//
// Snapshot-level states: up, down, eyes-up, mixed, multiple, stale.
// Data-layer states: learning (forecast empty + Day 0 of 30),
// full-data (predictor confident + learning panel hidden).

import type { Snapshot, FleetRole } from "./types";
import type { LearningState } from "./learning";
import type { ForecastGrid, ForecastCell } from "./predictor";

export const MOCK_STATES = [
  "up",
  "down",
  "eyes-up",
  "mixed",
  "multiple",
  "stale",
  "learning",
  "full-data",
] as const;
export type MockState = (typeof MOCK_STATES)[number];

const TAIL_OVERRIDES: Record<
  string,
  Partial<{
    lat: number;
    lon: number;
    altitude_ft: number;
    ground_speed_kt: number;
    heading: number;
    time_aloft_min: number;
    squawk: string | null;
  }>
> = {
  N305DK: {
    lat: 47.5301,
    lon: -122.2612,
    altitude_ft: 2800,
    ground_speed_kt: 118,
    heading: 184,
    time_aloft_min: 47,
    squawk: "1234",
  },
  N422CT: {
    lat: 47.671,
    lon: -122.3345,
    altitude_ft: 1400,
    ground_speed_kt: 88,
    heading: 270,
    time_aloft_min: 12,
    squawk: "1200",
  },
};

function liftAirborne(
  snap: Snapshot,
  predicate: (role: FleetRole) => boolean,
  cap?: number,
): Snapshot {
  let lifted = 0;
  return {
    ...snap,
    source: "mock",
    aircraft: snap.aircraft.map((a) => {
      if (!predicate(a.role)) return a;
      if (cap != null && lifted >= cap) return a;
      lifted++;
      const o = TAIL_OVERRIDES[a.tail] ?? {};
      return {
        ...a,
        ...o,
        airborne: true,
        last_seen_min: 0,
      };
    }),
  };
}

export function parseMockState(value: string | null | undefined): MockState | null {
  if (!value) return null;
  if (value === "fixed_wing") return "up";
  return (MOCK_STATES as readonly string[]).includes(value) ? (value as MockState) : null;
}

export function getMockStateFromRequest(req: Request): MockState | null {
  return parseMockState(new URL(req.url).searchParams.get("mock"));
}

export function applyMockState(snap: Snapshot, state: MockState | null): Snapshot {
  if (!state) return snap;
  switch (state) {
    case "down":
      // All clear — every aircraft grounded, even if upstream had something
      // up. Useful for previewing the calm-sky home screen at any time.
      return {
        ...snap,
        source: "mock",
        aircraft: snap.aircraft.map((a) => ({ ...a, airborne: false })),
      };
    case "up":
      // At least one fixed-wing aircraft up. The original mock=up behavior.
      return liftAirborne(snap, (r) => r === "fixed_wing");
    case "eyes-up": {
      // Patrol or unknown airborne, no fixed_wing. State name kept for
      // back-compat with existing QA flows.
      //
      // First ground every fixed_wing-class so a live fixed_wing doesn't bleed
      // through and contaminate the assertion that this state should
      // produce only patrol/unknown airborne.
      const grounded: Snapshot = {
        ...snap,
        source: "mock",
        aircraft: snap.aircraft.map((a) =>
          a.role === "fixed_wing" ? { ...a, airborne: false } : a,
        ),
      };
      return liftAirborne(
        grounded,
        (r) => r === "patrol" || r === "unknown",
      );
    }
    case "mixed": {
      // Exactly one fixed-wing + one helicopter for compact UI mockups.
      const grounded: Snapshot = {
        ...snap,
        source: "mock",
        aircraft: snap.aircraft.map((a) => ({ ...a, airborne: false })),
      };
      return liftAirborne(
        liftAirborne(grounded, (r) => r === "fixed_wing", 1),
        (r) => r === "patrol" || r === "sar",
        1,
      );
    }
    case "multiple":
      // 3 fixed-wing + 1 patrol. Drives the "X up" pill sub and the
      // others-also-up list.
      return liftAirborne(
        liftAirborne(snap, (r) => r === "fixed_wing", 3),
        (r) => r === "patrol",
        1,
      );
    case "stale":
      // Last sample > 15 min ago. Flips the FreshnessLabel amber and
      // surfaces the "Live cron may be down" tooltip.
      return {
        ...snap,
        source: "mock",
        fetched_at: Date.now() - 16 * 60 * 1000,
      };
    case "learning":
    case "full-data":
      // These two states are data-layer (forecast/learning), not
      // snapshot-level. Fall through to the dedicated transformers
      // (applyMockLearning, applyMockForecastGrid). Snapshot itself
      // unchanged.
      return snap;
  }
}

/** LearningState override for ?mock=learning / ?mock=full-data. */
export function applyMockLearning(
  real: LearningState,
  state: MockState | null,
): LearningState {
  if (state === "learning") {
    return {
      firstSampleIso: new Date().toISOString(),
      daysElapsed: 0,
      daysRemaining: 30,
      progress: 0,
      stillLearning: true,
    };
  }
  if (state === "full-data") {
    return {
      firstSampleIso: new Date(Date.now() - 31 * 86_400_000).toISOString(),
      daysElapsed: 31,
      daysRemaining: 0,
      progress: 1,
      stillLearning: false,
    };
  }
  return real;
}

/**
 * ForecastGrid override. Learning state returns empty cells; full-data
 * synthesizes a deterministic 7×24 grid with realistic-looking commute-
 * shaped probabilities (peaks Mon–Fri 7–9 / 16–18 PT, lower weekends).
 */
export function applyMockForecastGrid(
  real: ForecastGrid,
  state: MockState | null,
): ForecastGrid {
  if (state === "learning") {
    return { cells: [], total_events: 0, generated_at: Date.now() };
  }
  if (state === "full-data") {
    const cells: ForecastCell[] = [];
    let total = 0;
    for (let dow = 0; dow < 7; dow++) {
      const weekday = dow >= 1 && dow <= 5;
      for (let hour = 0; hour < 24; hour++) {
        const commute =
          weekday &&
          ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18));
        const base = commute ? 0.55 : weekday ? 0.18 : 0.12;
        // Smooth daily curve so the heatmap looks plausible; deterministic.
        const wave = 0.08 * Math.sin(((hour - 6) * Math.PI) / 12);
        const probability = Math.max(0, Math.min(1, base + wave));
        const sample_count = Math.round(probability * 22);
        total += sample_count;
        cells.push({
          dow,
          hour,
          probability,
          sample_count,
          common_tails: [
            { tail: "N305DK", nickname: "Bird 4", count: sample_count },
          ],
        });
      }
    }
    return { cells, total_events: total, generated_at: Date.now() };
  }
  return real;
}
