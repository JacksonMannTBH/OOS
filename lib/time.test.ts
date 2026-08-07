// Run: npx tsx --test lib/time.test.ts
//
// Pins the contract for fmtAgoTs against the regression that shipped on
// A forked formatter treated millisecond timestamps as seconds and
// collapsed every Recent activity row into "just now". The activity feed
// (lib/activity.ts) emits ms-since-epoch, so callers must read ms here too.

import { test } from "node:test";
import assert from "node:assert";
import { fmtAgoTs } from "./time";

test("fmtAgoTs: 5h-old ms timestamp renders as '5h ago' (regression — must not be 'just now')", () => {
  const fiveHoursAgoMs = Date.now() - 5 * 60 * 60 * 1000;
  assert.equal(fmtAgoTs(fiveHoursAgoMs), "5h ago");
});

test("fmtAgoTs: 30s-old ms timestamp renders as 'just now'", () => {
  const thirtySecAgoMs = Date.now() - 30 * 1000;
  assert.equal(fmtAgoTs(thirtySecAgoMs), "just now");
});
