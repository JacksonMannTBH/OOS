import test from "node:test";
import assert from "node:assert/strict";
import { aircraftAlertAvailabilityMessage, aircraftAlertErrorMessage, canArmAircraftAlerts, shouldPromoteAircraftAlerts } from "./aircraft-alerts/presentation";
import type { AircraftAlertStatus } from "./aircraft-alerts/types";

const ready: AircraftAlertStatus = { supported: true, configured: true, enabled: false, permission: "default" };

test("alert offers wait for readiness and never promote enabled or denied notifications", () => {
  assert.equal(canArmAircraftAlerts(null), false);
  assert.equal(canArmAircraftAlerts({ ...ready, configured: false }), false);
  assert.equal(canArmAircraftAlerts({ ...ready, supported: false }), false);
  assert.equal(canArmAircraftAlerts(ready), true);
  assert.equal(shouldPromoteAircraftAlerts(ready), true);
  assert.equal(shouldPromoteAircraftAlerts({ ...ready, enabled: true }), false);
  assert.equal(shouldPromoteAircraftAlerts({ ...ready, permission: "denied" }), false);
});

test("unconfigured iPhone builds explain availability without browser instructions", () => {
  const missing = aircraftAlertAvailabilityMessage({ ...ready, configured: false, message: "native_not_configured" }, "ios");
  assert.match(missing, /this app build/);
  assert.doesNotMatch(missing, /browser|Home Screen|keys|Firebase/);
  assert.match(aircraftAlertAvailabilityMessage({ ...ready, configured: false, message: "native_update_required" }, "ios"), /Update OOS/);
  assert.match(aircraftAlertErrorMessage(new Error("permission_denied"), "ios"), /iPhone Settings/);
  assert.doesNotMatch(aircraftAlertErrorMessage(new Error("unsupported"), "ios"), /browser/);
});
