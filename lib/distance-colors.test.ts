import assert from "node:assert/strict";
import { test } from "node:test";
import { DISTANCE_PALETTES, DISTANCE_STATES } from "./distance-color-palette";

test("distance colors default safely, save independently of the app accent, and update every distance state", async () => {
  const values = new Map<string, string>([["oos_color_mode", "green"], ["oos_distance_palette", "unknown"]]);
  let failSave = false;
  const events: string[] = [];
  const element = () => ({ dataset: {} as Record<string, string> });
  const html = element(), body = element();
  const properties = [new Map<string, string>(), new Map<string, string>()];
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { if (failSave) throw new Error("Unavailable"); values.set(key, value); },
    },
    dispatchEvent: (event: Event) => { events.push(event.type); },
  } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    documentElement: { dataset: html.dataset, style: { setProperty: properties[0]!.set.bind(properties[0]) } },
    body: { dataset: body.dataset, style: { setProperty: properties[1]!.set.bind(properties[1]) } },
  } });
  const { readDistancePalette, writeDistancePalette, applyDistancePalette, DISTANCE_PALETTE_EVENT } = await import("./distance-colors");
  assert.equal(readDistancePalette(), "classic");
  for (const palette of DISTANCE_PALETTES) {
    await writeDistancePalette(palette.id);
    assert.equal(readDistancePalette(), palette.id);
    assert.equal(values.get("oos_color_mode"), "green");
    assert.equal(html.dataset.distancePalette, palette.id);
    assert.equal(body.dataset.distancePalette, palette.id);
    for (const state of DISTANCE_STATES) for (const style of properties) {
      assert.equal(style.get(`--ss-distance-${state}`), palette.colors[state]);
    }
  }
  assert.deepEqual(events, DISTANCE_PALETTES.map(() => DISTANCE_PALETTE_EVENT));
  failSave = true;
  await assert.rejects(writeDistancePalette("ocean"));
  const lastSaved = DISTANCE_PALETTES.at(-1)!.id;
  assert.equal(readDistancePalette(), lastSaved);
  assert.equal(html.dataset.distancePalette, lastSaved);
  assert.equal(events.length, DISTANCE_PALETTES.length, "Failed saves cannot publish colors");
  applyDistancePalette("classic");
  assert.equal(html.dataset.distancePalette, "classic");
});
