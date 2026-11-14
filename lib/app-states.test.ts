import assert from "node:assert/strict";
import test from "node:test";
import { APP_STATES, getSelectedStateCode, isSupportedStateCode, setSelectedStateCode, setAutomaticallyDetectedStateCode, STATE_PREFERENCE_KEY } from "./app-states";
import { stateCodeFromCensusResponse } from "./location-state";

test("all 50 states are selectable and available for location detection", () => {
  assert.equal(APP_STATES.length, 50);
  assert.equal(new Set(APP_STATES.map((state) => state.code)).size, 50);
  for (const state of APP_STATES) {
    assert.equal(isSupportedStateCode(state.code), true);
    assert.equal(stateCodeFromCensusResponse({ result: { geographies: { States: [{ STUSAB: state.code }] } } }), state.code);
  }
  assert.equal(isSupportedStateCode("ca"), true);
  assert.equal(isSupportedStateCode("TX"), true);
  assert.equal(isSupportedStateCode("NY"), true);
  assert.equal(isSupportedStateCode("XX"), false);
  assert.equal(stateCodeFromCensusResponse({ result: { geographies: { States: [{ STUSAB: "TX" }] } } }), "TX");
});

test("saved state choices survive nationwide restoration and manual selection wins", async () => {
  const values = new Map<string, string>([[STATE_PREFERENCE_KEY, "NY"]]);
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) },
    dispatchEvent: () => true,
  } });
  try {
    assert.equal(getSelectedStateCode(), "NY");
    await setSelectedStateCode("CA");
    assert.equal(getSelectedStateCode(), "CA");
    assert.equal(await setAutomaticallyDetectedStateCode("TX"), false);
    assert.equal(getSelectedStateCode(), "CA");
    await setSelectedStateCode("TX");
    assert.equal(getSelectedStateCode(), "TX");
    await setSelectedStateCode("NY");
    assert.equal(getSelectedStateCode(), "NY");
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
