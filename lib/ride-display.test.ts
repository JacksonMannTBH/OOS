import assert from "node:assert/strict";
import { test } from "node:test";
import { readSpeedometerVisible, writeSpeedometerVisible, SPEEDOMETER_CHANGE_EVENT, SPEEDOMETER_STORAGE_KEY } from "./ride-display";

test("speedometer defaults on and remembers the rider's choice across reopening", context => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  context.after(() => { if (original) Object.defineProperty(globalThis, "window", original); else Reflect.deleteProperty(globalThis, "window"); });
  const stored = new Map<string, string>();
  const events: Event[] = [];
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    localStorage: { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) },
    dispatchEvent: (event: Event) => { events.push(event); return true; },
  } });
  assert.equal(readSpeedometerVisible(), true);
  writeSpeedometerVisible(false);
  assert.equal(readSpeedometerVisible(), false);
  assert.equal(events[0]!.type, SPEEDOMETER_CHANGE_EVENT);
  assert.equal((events[0] as CustomEvent<boolean>).detail, false);
  writeSpeedometerVisible(true);
  assert.equal(readSpeedometerVisible(), true);
  stored.delete(SPEEDOMETER_STORAGE_KEY);
  assert.equal(readSpeedometerVisible(), true);
});

test("blocked device storage keeps the speedometer usable and still broadcasts the current choice", context => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  context.after(() => { if (original) Object.defineProperty(globalThis, "window", original); else Reflect.deleteProperty(globalThis, "window"); });
  let selected: unknown;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    localStorage: { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } },
    dispatchEvent: (event: CustomEvent<boolean>) => { selected = event.detail; return true; },
  } });
  assert.equal(readSpeedometerVisible(), true);
  assert.doesNotThrow(() => writeSpeedometerVisible(false));
  assert.equal(selected, false);
  assert.equal(readSpeedometerVisible(), false);
});
