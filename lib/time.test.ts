// Run: npx tsx --test lib/time.test.ts
//
// Pins the contract for fmtAgoTs against the regression that shipped on
// A forked formatter treated millisecond timestamps as seconds and
// collapsed every Recent activity row into "just now". The activity feed
// (lib/activity.ts) emits ms-since-epoch, so callers must read ms here too.

import { test } from "node:test";
import assert from "node:assert";
import { fmtAgoTs, formatTs } from "./time";
import { parseTimeFormat } from "./time-format";

test("time defaults to 12-hour while preserving an explicit 24-hour preference", () => {
  assert.equal(parseTimeFormat(null), "12");
  assert.equal(parseTimeFormat("invalid"), "12");
  assert.equal(parseTimeFormat("24"), "24");
  const instant = Date.parse("2026-11-15T23:42:00Z");
  assert.match(formatTs(instant, "time"), /3:42.*PM.*PT/);
  assert.equal(formatTs(instant, "time", { hour12: false }), "15:42 PT");
});

test("fmtAgoTs: 5h-old ms timestamp renders as '5h ago' (regression — must not be 'just now')", () => {
  const fiveHoursAgoMs = Date.now() - 5 * 60 * 60 * 1000;
  assert.equal(fmtAgoTs(fiveHoursAgoMs), "5h ago");
});

test("fmtAgoTs: 30s-old ms timestamp renders as 'just now'", () => {
  const thirtySecAgoMs = Date.now() - 30 * 1000;
  assert.equal(fmtAgoTs(thirtySecAgoMs), "just now");
});
