import assert from "node:assert/strict";
import test from "node:test";
import { APP_STATES, getSelectedStateCode, isSupportedStateCode, setSelectedStateCode, setAutomaticallyDetectedStateCode, STATE_PREFERENCE_KEY } from "./app-states";
import { stateCodeFromCensusResponse } from "./location-state";

test("state choices and location detection stay inside the WA/CA rollout", () => {
  assert.deepEqual(APP_STATES.map((state) => state.code), ["CA", "WA"]);
  assert.equal(isSupportedStateCode("ca"), true);
  assert.equal(isSupportedStateCode("TX"), false);
  assert.equal(stateCodeFromCensusResponse({ result: { geographies: { States: [{ STUSAB: "TX" }] } } }), null);
});

test("obsolete saved state choices fall back without changing a supported preference", () => {
  const values = new Map<string, string>([[STATE_PREFERENCE_KEY, "TX"]]);
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) },
    dispatchEvent: () => true,
  } });
  try {
    assert.equal(getSelectedStateCode(), "WA");
    setSelectedStateCode("CA");
    assert.equal(getSelectedStateCode(), "CA");
    assert.equal(setAutomaticallyDetectedStateCode("TX"), false);
    assert.equal(getSelectedStateCode(), "CA");
    setSelectedStateCode("TX");
    assert.equal(getSelectedStateCode(), "WA");
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
