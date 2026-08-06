import assert from "node:assert/strict";
import test from "node:test";

import {
  AIRCRAFT_DURATION_MINUTES,
  OPS_AIRCRAFT,
} from "./aircraft-directory";
import { FLEET } from "./seed";
import { isTrackedTail, TRACKED_TAILS } from "./tracked-tails";

test("operational aircraft are tracked and available to flight paths", () => {
  const fleetTails = new Set(FLEET.map((entry) => entry.tail));

  for (const tail of TRACKED_TAILS) {
    assert.equal(
      fleetTails.has(tail),
      true,
      `${tail} should be in FLEET for flight-path enumeration`,
    );
  }

  for (const aircraft of OPS_AIRCRAFT) {
    assert.equal(
      isTrackedTail(aircraft.tail),
      true,
      `${aircraft.tail} should be in TRACKED_TAILS for ADS-B polling`,
    );
    assert.ok(
      (AIRCRAFT_DURATION_MINUTES[aircraft.tail] ?? 0) > 0,
      `${aircraft.tail} should have source duration data`,
    );
  }
});

test("customs-specific aircraft are not in active source catalogs", () => {
  const blockedTerms = [
    /\bcbp\b/i,
    /customs/i,
    /border protection/i,
    /air and marine/i,
  ];
  const blockedTails = new Set([
    "N1977G",
    "N2108J",
    "N741C",
    "N128J",
    "N144CS",
    "N146CS",
    "N149CS",
    "N403SK",
    "N480SK",
    "N741SK",
    "N142CS",
    "N143CS",
    "N147CS",
    "N148CS",
    "N423SK",
    "N431SK",
    "N769SK",
  ]);

  for (const entry of FLEET) {
    assert.equal(
      blockedTails.has(entry.tail),
      false,
      `${entry.tail} should not be in FLEET`,
    );
    const searchable = [
      entry.operator,
      entry.model,
      entry.nickname,
      entry.base,
      entry.roleDescription,
      entry.roleNote,
    ].join(" ");
    assert.equal(
      blockedTerms.some((term) => term.test(searchable)),
      false,
      `${entry.tail} should not reference Customs/CBP scope`,
    );
  }

  for (const aircraft of OPS_AIRCRAFT) {
    assert.equal(
      blockedTails.has(aircraft.tail),
      false,
      `${aircraft.tail} should not be in OPS_AIRCRAFT`,
    );
    const searchable = [
      aircraft.unit,
      aircraft.model,
      aircraft.fuelText,
      aircraft.speedText,
      aircraft.enduranceText,
    ].join(" ");
    assert.equal(
      blockedTerms.some((term) => term.test(searchable)),
      false,
      `${aircraft.tail} should not reference Customs/CBP scope`,
    );
  }

  for (const tail of TRACKED_TAILS) {
    assert.equal(
      blockedTails.has(tail),
      false,
      `${tail} should not be tracked`,
    );
  }
});
