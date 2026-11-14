import assert from "node:assert/strict";
import test from "node:test";
import { OPS_AIRCRAFT } from "./aircraft-directory";
import { aircraftMatchesCaliforniaRegion, californiaRegionForAgency, filterAircraftByCaliforniaRegion, getRegionalMapState, getSelectedCaliforniaRegion, setSelectedCaliforniaRegion, CALIFORNIA_REGION_KEY } from "./california-regions";
import { DevicePreferenceStore } from "./device-preference-store";

test("CHP aircraft are statewide and other California aircraft retain one home region", () => {
  const fleet = OPS_AIRCRAFT.filter((row) => row.stateId === "california");
  assert.ok(fleet.length > 100);
  for (const row of fleet) {
    assert.ok(californiaRegionForAgency(row.unit), `${row.tail}: ${row.unit}`);
    if (row.unit.startsWith("CHP ") || row.unit.startsWith("California Highway Patrol")) {
      assert.equal(californiaRegionForAgency(row.unit), "both", row.tail);
      assert.equal(aircraftMatchesCaliforniaRegion(row.tail, "north"), true, row.tail);
      assert.equal(aircraftMatchesCaliforniaRegion(row.tail, "south"), true, row.tail);
    } else {
      assert.notEqual(aircraftMatchesCaliforniaRegion(row.tail, "north"), aircraftMatchesCaliforniaRegion(row.tail, "south"), row.tail);
    }
  }
});

test("regional filtering uses home agency even when an aircraft crosses the boundary", () => {
  const aircraft = [
    { tail: "N975HP", lat: 33.0 }, // Fresno, currently south
    { tail: "N983HP", lat: 35.6 }, // Paso Robles
    { tail: "N189JC", lat: 36.3 }, // Tulare
    { tail: "N912KC", lat: 39.0 }, // Kern, currently north
    { tail: "N206SB", lat: 34.4 }, // Santa Barbara
    { tail: "N984HP", lat: 34.5 }, // CHP Inland
  ];
  assert.deepEqual(filterAircraftByCaliforniaRegion(aircraft, "CA", "north").map((a) => a.tail), ["N975HP", "N983HP", "N189JC", "N984HP"]);
  assert.deepEqual(filterAircraftByCaliforniaRegion(aircraft, "california", "south").map((a) => a.tail), ["N975HP", "N983HP", "N912KC", "N206SB", "N984HP"]);
  assert.equal(filterAircraftByCaliforniaRegion(aircraft, "WA", "south"), aircraft);
  assert.equal(aircraftMatchesCaliforniaRegion(" n912kc ", "south"), true);
  for (const region of ["north", "south"] as const) {
    for (const tail of [" n975hp ", "N984HP", "N263HP", "N911CA", "N918CA"]) assert.equal(aircraftMatchesCaliforniaRegion(tail, region), true, tail);
    assert.equal(aircraftMatchesCaliforniaRegion("UNKNOWN", region), false);
    assert.equal(aircraftMatchesCaliforniaRegion("N25HP", region), false, "Other states' highway patrols are not California fleets");
  }
});

test("California map centers change by region while other states stay unchanged", () => {
  assert.ok(getRegionalMapState("CA", "north").centerLat > getRegionalMapState("CA", "south").centerLat);
  assert.deepEqual(getRegionalMapState("TX", "north"), getRegionalMapState("TX", "south"));
});

test("the region defaults to North and saves without changing the selected state", async () => {
  const values = new Map<string, string>([["oos_state_code", "CA"]]);
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  const events: string[] = [];
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) },
    dispatchEvent: (event: Event) => { events.push(event.type); return true; },
  } });
  try {
    assert.equal(getSelectedCaliforniaRegion(), "north");
    await setSelectedCaliforniaRegion("south");
    assert.equal(getSelectedCaliforniaRegion(), "south");
    assert.equal(values.get("oos_state_code"), "CA");
    assert.deepEqual(events, ["oos-california-region-change"]);
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("native storage retains the region through a restart and resets it with preferences", async () => {
  const web = new Map<string, string>();
  let nativeValue: string | null = null;
  const browser = () => ({ getItem: (key: string) => web.get(key) ?? null, setItem: (key: string, value: string) => { web.set(key, value); }, removeItem: (key: string) => { web.delete(key); } });
  const native = { get: async () => ({ value: nativeValue }), set: async ({ value }: { value: string }) => { nativeValue = value; } };
  const first = new DevicePreferenceStore(browser, native);
  await first.initialize();
  await first.update({ [CALIFORNIA_REGION_KEY]: "south" });
  web.clear();
  const restarted = new DevicePreferenceStore(browser, native);
  await restarted.initialize();
  assert.equal(restarted.get(CALIFORNIA_REGION_KEY), "south");
  await restarted.update({ [CALIFORNIA_REGION_KEY]: null });
  assert.equal(restarted.get(CALIFORNIA_REGION_KEY), null);
});

test("location initializes the region once and preserves manual choices and other states", async () => {
  const { setAutomaticallyDetectedCaliforniaRegion } = await import("./california-regions");
  const values = new Map<string, string>([["oos_state_code", "CA"]]);
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) },
    dispatchEvent: () => true,
  } });
  try {
    assert.equal(await setAutomaticallyDetectedCaliforniaRegion(34.0522, -118.2437), true);
    assert.equal(getSelectedCaliforniaRegion(), "south");
    assert.equal(await setAutomaticallyDetectedCaliforniaRegion(38.5816, -121.4944), false);
    assert.equal(getSelectedCaliforniaRegion(), "south");
    values.delete(CALIFORNIA_REGION_KEY);
    assert.equal(await setAutomaticallyDetectedCaliforniaRegion(38.5816, -121.4944), true);
    assert.equal(getSelectedCaliforniaRegion(), "north");
    assert.equal(await setAutomaticallyDetectedCaliforniaRegion(34.0522, -118.2437), false);
    const save = setSelectedCaliforniaRegion("south");
    assert.equal(await setAutomaticallyDetectedCaliforniaRegion(38.5816, -121.4944), false);
    await save;
    assert.equal(getSelectedCaliforniaRegion(), "south");
    values.delete(CALIFORNIA_REGION_KEY);
    values.set("oos_state_code", "WA");
    assert.equal(await setAutomaticallyDetectedCaliforniaRegion(34.0522, -118.2437), false);
    assert.equal(values.has(CALIFORNIA_REGION_KEY), false);
    values.set("oos_state_code", "CA");
    assert.equal(await setAutomaticallyDetectedCaliforniaRegion(36.1699, -115.1398), false);
    assert.equal(values.has(CALIFORNIA_REGION_KEY), false);
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
