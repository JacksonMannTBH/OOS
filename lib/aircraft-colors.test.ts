import assert from "node:assert/strict";
import test from "node:test";
import {
  AIRCRAFT_PATH_COLORS,
  aircraftColorForTail,
} from "./aircraft-colors";

test("aircraft path palette provides a broad set of distinct colors", () => {
  assert.equal(AIRCRAFT_PATH_COLORS.length, 16);
  assert.equal(new Set(AIRCRAFT_PATH_COLORS).size, AIRCRAFT_PATH_COLORS.length);
});

test("tail colors are stable across formatting and repeated calls", () => {
  const color = aircraftColorForTail("N305DK");
  assert.equal(aircraftColorForTail("n305dk"), color);
  assert.equal(aircraftColorForTail("N305DK"), color);
  assert.ok((AIRCRAFT_PATH_COLORS as readonly string[]).includes(color));
});
