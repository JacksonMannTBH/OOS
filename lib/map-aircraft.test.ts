import assert from "node:assert/strict";
import test from "node:test";
import { aircraftMapTails } from "./map-aircraft";
import type { Aircraft } from "./types";

test("paths are limited to observed flying aircraft with a drawable map position", () => {
  const plane = { tail: "N1", airborne: true, observed: true, lat: 47.5, lon: -122.26 } as Aircraft;
  const variants = [
    {}, { lat: null }, { lon: null }, { lat: NaN }, { lon: Infinity },
    { lat: 91 }, { lon: -181 }, { observed: false }, { airborne: false },
    { lat: 0, lon: 0 },
  ].map((changes, index) => ({ ...plane, tail: `N${index}`, ...changes })) as unknown as Aircraft[];
  assert.deepEqual([...aircraftMapTails(variants)], ["N0", "N9"]);
  assert.equal(aircraftMapTails([]).size, 0);
});
