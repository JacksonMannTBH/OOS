// Run: npx tsx --test lib/status.test.ts

import { test } from "node:test";
import assert from "node:assert";
import { computeStatus } from "./status";
import type { Aircraft, FleetEntry, Snapshot } from "./types";

function aircraft(role: FleetEntry["role"], tail: string): Aircraft {
  return {
    tail,
    icao24: tail.toLowerCase(),
    hex: tail.toLowerCase(),
    operator: "Test",
    model: "Test aircraft",
    nickname: null,
    roleDescription: "Test role",
    base: "Test base",
    role,
    roleConfidence: "confirmed",
    airborne: true,
  };
}

test("computeStatus alerts for SAR and transport aircraft", () => {
  const sar = aircraft("sar", "SAR1");
  const transport = aircraft("transport", "TRN1");
  const snapshot: Snapshot = {
    fetched_at: Date.now(),
    source: "mock",
    aircraft: [sar, transport],
    live_seen_count: 2,
  };
  const fleet = new Map<string, FleetEntry>([
    [sar.tail, sar],
    [transport.tail, transport],
  ]);

  const status = computeStatus(snapshot, fleet);
  assert.equal(status.kind, "alert");
  assert.equal(status.pill, "BIRD UP");
  assert.equal(status.alertCount, 2);
  assert.equal(status.pillSub, "2 up");
});
