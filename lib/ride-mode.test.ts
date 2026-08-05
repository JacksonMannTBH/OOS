// Run: npx tsx --test lib/ride-mode.test.ts

import { test } from "node:test";
import assert from "node:assert";
import {
  bearingDeg,
  cardinalFromDeg,
  cardinalTrackFromDeg,
  classifyRideStatus,
  getRideContacts,
  isSameCardinalTrack,
  normalizeRideStatusThresholds,
  relativeBearingDeg,
  rideStatusLabel,
} from "./ride-mode";
import type { Aircraft } from "./types";

function assertAbout(actual: number, expected: number, tolerance = 0.5) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

test("bearingDeg returns true-north clockwise bearings", () => {
  assertAbout(bearingDeg(47, -122, 48, -122), 0);
  assertAbout(bearingDeg(47, -122, 47, -121), 90);
  assertAbout(bearingDeg(47, -122, 46, -122), 180);
  assertAbout(bearingDeg(47, -122, 47, -123), 270);
});

test("relativeBearingDeg normalizes aircraft bearing against rider heading", () => {
  assert.equal(relativeBearingDeg(90, 0), 90);
  assert.equal(relativeBearingDeg(90, 90), 0);
  assert.equal(relativeBearingDeg(350, 10), 340);
  assert.equal(relativeBearingDeg(10, 350), 20);
});

test("cardinalFromDeg returns eight-way direction labels", () => {
  assert.equal(cardinalFromDeg(0), "N");
  assert.equal(cardinalFromDeg(45), "NE");
  assert.equal(cardinalFromDeg(90), "E");
  assert.equal(cardinalFromDeg(135), "SE");
  assert.equal(cardinalFromDeg(180), "S");
  assert.equal(cardinalFromDeg(225), "SW");
  assert.equal(cardinalFromDeg(270), "W");
  assert.equal(cardinalFromDeg(315), "NW");
});

test("cardinalTrackFromDeg reduces headings to N/E/S/W travel tracks", () => {
  assert.equal(cardinalTrackFromDeg(0), "N");
  assert.equal(cardinalTrackFromDeg(44), "N");
  assert.equal(cardinalTrackFromDeg(46), "E");
  assert.equal(cardinalTrackFromDeg(134), "E");
  assert.equal(cardinalTrackFromDeg(136), "S");
  assert.equal(cardinalTrackFromDeg(224), "S");
  assert.equal(cardinalTrackFromDeg(226), "W");
  assert.equal(cardinalTrackFromDeg(314), "W");
  assert.equal(cardinalTrackFromDeg(316), "N");
  assert.equal(cardinalTrackFromDeg(null), null);
});

test("isSameCardinalTrack matches aircraft movement with rider direction", () => {
  assert.equal(isSameCardinalTrack(3, 358), true);
  assert.equal(isSameCardinalTrack(87, 112), true);
  assert.equal(isSameCardinalTrack(182, 201), true);
  assert.equal(isSameCardinalTrack(271, 290), true);
  assert.equal(isSameCardinalTrack(30, 95), false);
  assert.equal(isSameCardinalTrack(undefined, 95), false);
  assert.equal(isSameCardinalTrack(95, null), false);
});

test("classifyRideStatus follows ride-mode distance thresholds", () => {
  assert.equal(classifyRideStatus(null), "clear");
  assert.equal(classifyRideStatus(5.1), "clear");
  assert.equal(classifyRideStatus(5), "watch");
  assert.equal(classifyRideStatus(3.1), "watch");
  assert.equal(classifyRideStatus(3), "warning");
  assert.equal(classifyRideStatus(1.1), "warning");
  assert.equal(classifyRideStatus(1), "danger");
  assert.equal(classifyRideStatus(0.5), "danger");
});

test("classifyRideStatus accepts custom ride-mode thresholds", () => {
  const thresholds = { watchNm: 8, warningNm: 4, stopNm: 2 };
  assert.equal(classifyRideStatus(8.1, thresholds), "clear");
  assert.equal(classifyRideStatus(8, thresholds), "watch");
  assert.equal(classifyRideStatus(4, thresholds), "warning");
  assert.equal(classifyRideStatus(2, thresholds), "danger");
});

test("normalizeRideStatusThresholds keeps cutoffs ordered", () => {
  assert.deepEqual(
    normalizeRideStatusThresholds({ watchNm: 1, warningNm: 1, stopNm: 3 }),
    { watchNm: 3.2, warningNm: 3.1, stopNm: 3 },
  );
});

test("rideStatusLabel presents danger as Stop", () => {
  assert.equal(rideStatusLabel("danger"), "Stop");
});

test("getRideContacts includes SAR and transport aircraft", () => {
  const aircraft = [
    {
      tail: "SAR1",
      role: "sar",
      airborne: true,
      lat: 47.01,
      lon: -122,
    },
    {
      tail: "TRN1",
      role: "transport",
      airborne: true,
      lat: 47.02,
      lon: -122,
    },
  ] as Aircraft[];

  const contacts = getRideContacts(aircraft, { lat: 47, lon: -122 }, null, true);
  assert.deepEqual(
    contacts.map((contact) => contact.plane.tail),
    ["SAR1", "TRN1"],
  );
});
