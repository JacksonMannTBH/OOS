import assert from "node:assert";
import { test } from "node:test";
import { normalizeAdsbFiPayload } from "./adsb";
import { buildOpenSkyStatesUrl } from "./opensky";

test("adsb.fi parser reads current v2 ICAO responses", () => {
  const aircraft = normalizeAdsbFiPayload({
    ac: [
      {
        hex: "A3323A",
        lat: 47.5,
        lon: -122.3,
        alt_baro: 2500,
        gs: 110,
        track: 90,
        seen: 2,
        seen_pos: 3,
      },
    ],
  });

  assert.equal(aircraft.length, 1);
  assert.equal(aircraft[0]?.hex, "a3323a");
  assert.equal(aircraft[0]?.lat, 47.5);
  assert.equal(aircraft[0]?.seen_seconds, 2);
});

test("adsb.fi parser rejects stale observations and stale positions", () => {
  const aircraft = normalizeAdsbFiPayload({
    ac: [
      { hex: "a3323a", seen: 61, lat: 47.5, lon: -122.3 },
      {
        hex: "a3335f",
        seen: 2,
        seen_pos: 61,
        lat: 47.6,
        lon: -122.4,
      },
    ],
  });

  assert.equal(aircraft.length, 1);
  assert.equal(aircraft[0]?.hex, "a3335f");
  assert.equal(aircraft[0]?.lat, undefined);
  assert.equal(aircraft[0]?.lon, undefined);
});

test("OpenSky URL repeats the icao24 parameter for every aircraft", () => {
  const url = new URL(buildOpenSkyStatesUrl(["A3323A", "a3335f"]));
  assert.deepEqual(url.searchParams.getAll("icao24"), ["a3323a", "a3335f"]);
});
