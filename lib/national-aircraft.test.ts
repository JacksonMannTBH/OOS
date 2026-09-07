import assert from "node:assert/strict";
import test from "node:test";
import sources from "../data/national-aircraft-sources.json";
import { APP_STATES, getAppState, isStateCode, stateCodeForId } from "./app-states";
import { AIRCRAFT_DURATION_MINUTES, OPS_AIRCRAFT, stateIdForOpsAircraftTail } from "./aircraft-directory";
import { aircraftVehicleType } from "./aircraft-type";
import { NATIONAL_AIRCRAFT_ROWS } from "./national-aircraft-data";
import { FLEET, fleetHex } from "./seed";
import { getAircraftFuelProfile } from "./fuel-estimate";
import { getCatalog, getDatabaseSnapshot } from "./aircraft-data";
import { STATE_AIRCRAFT_COVERAGE_NOTES } from "./state-aircraft-coverage";

test("all 50 states have unique IDs, valid centers and state-code lookups", () => {
  const codes = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
  assert.deepEqual(new Set(APP_STATES.map((state) => state.code)), new Set(codes));
  assert.equal(new Set(APP_STATES.map((state) => state.id)).size, 50);
  for (const state of APP_STATES) {
    assert.equal(isStateCode(state.code.toLowerCase()), true);
    assert.equal(getAppState(state.id).code, state.code);
    assert.ok(state.centerLat > 18 && state.centerLat < 72);
    assert.ok(state.centerLon > -180 && state.centerLon < -66);
  }
  assert.equal(getAppState(null).code, "WA");
});

test("national aircraft identities, state assignments and vehicle icons match the registry evidence", () => {
  assert.ok(NATIONAL_AIRCRAFT_ROWS.length >= 500);
  const evidence = new Map(sources.aircraft.map((row) => [row.tail, row]));
  assert.equal(new Set(FLEET.map((row) => row.tail)).size, FLEET.length);
  assert.equal(new Set(FLEET.map(fleetHex)).size, FLEET.length);
  for (const [stateId, tail, hex, model, operator, , kind] of NATIONAL_AIRCRAFT_ROWS) {
    const source = evidence.get(tail);
    assert.ok(source, `${tail} has registry evidence`);
    assert.equal(source.state, stateCodeForId(stateId), tail);
    assert.equal(source.icao24, hex, tail);
    assert.equal(source.operator, operator, tail);
    assert.equal(source.registrationStatus, "V", tail);
    assert.ok(source.seats > 0, tail);
    assert.equal(aircraftVehicleType(model), kind, `${tail}: ${model}`);
    assert.equal(stateIdForOpsAircraftTail(tail), stateId, tail);
    assert.ok(operator !== "WSP", tail);
  }
  assert.equal(FLEET.some((row) => row.tail === "N911SZ"), false);
});

test("unsupported performance stays unknown and every state has aircraft or an explicit coverage gap", () => {
  for (const row of OPS_AIRCRAFT) {
    if (row.durationMin == null) {
      assert.equal(AIRCRAFT_DURATION_MINUTES[row.tail], undefined);
      assert.equal(getAircraftFuelProfile(row.tail), null);
    }
  }
  for (const state of APP_STATES) {
    assert.ok(OPS_AIRCRAFT.some((row) => row.stateId === state.id) || STATE_AIRCRAFT_COVERAGE_NOTES[state.code], state.label);
  }
});

test("seed-backed catalog and snapshots return new states without leaking Washington aircraft", async () => {
  // These unit tests run with no configured remote database, as the existing suite does.
  if (process.env.SUPABASE_URL || process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  for (const code of ["AK", "NY", "UT", "WI", "RI", "VT"] as const) {
    const expected = NATIONAL_AIRCRAFT_ROWS.filter((row) => stateCodeForId(row[0]) === code);
    const catalog = await getCatalog(code);
    const snapshot = await getDatabaseSnapshot(code);
    assert.equal(catalog.length, expected.length, code);
    assert.equal(snapshot.aircraft.length, expected.length, code);
    for (const row of snapshot.aircraft) assert.equal(row.home_state_code, code);
  }
});
