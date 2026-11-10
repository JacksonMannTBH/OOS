import assert from "node:assert/strict";
import test from "node:test";
import { APP_STATES, getSelectedStateCode, isSupportedStateCode, setSelectedStateCode, setAutomaticallyDetectedStateCode, STATE_PREFERENCE_KEY } from "./app-states";
import { stateCodeFromCensusResponse } from "./location-state";

test("state choices and location detection stay inside the WA/CA/TX rollout", () => {
  assert.deepEqual(APP_STATES.map((state) => state.code), ["CA", "TX", "WA"]);
  assert.equal(isSupportedStateCode("ca"), true);
  assert.equal(isSupportedStateCode("TX"), true);
  assert.equal(isSupportedStateCode("NY"), false);
  assert.equal(stateCodeFromCensusResponse({ result: { geographies: { States: [{ STUSAB: "TX" }] } } }), "TX");
});

test("obsolete saved state choices fall back without changing a supported preference", async () => {
  const values = new Map<string, string>([[STATE_PREFERENCE_KEY, "NY"]]);
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) },
    dispatchEvent: () => true,
  } });
  try {
    assert.equal(getSelectedStateCode(), "WA");
    await setSelectedStateCode("CA");
    assert.equal(getSelectedStateCode(), "CA");
    assert.equal(await setAutomaticallyDetectedStateCode("TX"), false);
    assert.equal(getSelectedStateCode(), "CA");
    await setSelectedStateCode("TX");
    assert.equal(getSelectedStateCode(), "TX");
    await setSelectedStateCode("NY");
    assert.equal(getSelectedStateCode(), "WA");
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
