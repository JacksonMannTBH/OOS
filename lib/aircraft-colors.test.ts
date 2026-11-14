import assert from "node:assert/strict";
import test from "node:test";
import {
  AIRCRAFT_PATH_COLORS,
  aircraftColorForTail,
} from "./aircraft-colors";
import { AIRCRAFT_COLORS, aircraftSvg } from "./brand/aircraft-glyphs";

test("aircraft path palette provides a broad set of distinct colors", () => {
  assert.equal(AIRCRAFT_PATH_COLORS.length, 16);
  assert.equal(new Set(AIRCRAFT_PATH_COLORS).size, AIRCRAFT_PATH_COLORS.length);
  // Amber/yellow roads must not share aircraft colors or default glyph accents.
  const roadHues = ["#fbbf24", "#f59e0b", "#f4c430", "#f6c431"];
  for (const color of [...AIRCRAFT_PATH_COLORS, ...Object.values(AIRCRAFT_COLORS)]) {
    assert.ok(!roadHues.includes(color.toLowerCase()));
  }
  for (const role of ["patrol", "fixed_wing"] as const) {
    for (const tone of ["default", "radar"] as const) {
      const svg = aircraftSvg(role, { tone }).toLowerCase();
      assert.ok(roadHues.every(color => !svg.includes(color)));
    }
  }
});

test("tail colors are stable across formatting and repeated calls", () => {
  const color = aircraftColorForTail("N305DK");
  assert.equal(aircraftColorForTail("n305dk"), color);
  assert.equal(aircraftColorForTail("N305DK"), color);
  assert.ok((AIRCRAFT_PATH_COLORS as readonly string[]).includes(color));
});
