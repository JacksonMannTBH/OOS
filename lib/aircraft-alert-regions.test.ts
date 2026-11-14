import assert from "node:assert/strict";
import test from "node:test";
import { OPS_AIRCRAFT } from "./aircraft-directory";
import { aircraftMatchesCaliforniaRegion } from "./california-regions";
import { notificationTrackingPreferences } from "./aircraft-alerts/preferences";
import { isTakeoffDeliverySelected } from "./aircraft-alerts/eligibility";

test("takeoff delivery matches the selected California region for every aircraft", () => {
  for (const region of ["north", "south"] as const) {
    const subscription = { enabled: true, stateCode: "CA", excludedAircraftByState: notificationTrackingPreferences({}, "CA", region) };
    for (const row of OPS_AIRCRAFT.filter(row => row.stateId === "california")) {
      assert.equal(isTakeoffDeliverySelected(subscription, "CA", row.tail), aircraftMatchesCaliforniaRegion(row.tail, region), `${region}: ${row.tail}`);
    }
  }
});

test("changing regions restores that fleet without changing manually excluded aircraft", () => {
  const saved = { CA: ["N975HP", "N912KC"], WA: ["N102LP"] };
  const original = JSON.stringify(saved);
  const north = notificationTrackingPreferences(saved, "CA", "north");
  const south = notificationTrackingPreferences(saved, "CA", "south");
  assert.ok(north.CA?.includes("N213PF")); // LAPD
  assert.ok(!north.CA?.includes("N983HP")); // Paso Robles
  assert.ok(!south.CA?.includes("N983HP")); // CHP remains selected in both regions
  assert.ok(!south.CA?.includes("N213PF"));
  for (const selected of [north, south]) {
    assert.ok(selected.CA?.includes("N975HP"));
    assert.ok(selected.CA?.includes("N912KC"));
    assert.deepEqual(selected.WA, ["N102LP"]);
  }
  assert.equal(JSON.stringify(saved), original);
  assert.equal(notificationTrackingPreferences(saved, "TX", "north"), saved);
});
