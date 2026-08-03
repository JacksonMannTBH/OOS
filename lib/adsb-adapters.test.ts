import assert from "node:assert";
import { test } from "node:test";
import { chunkIcaoHexes, normalizeAdsbFiPayload } from "./adsb";
import { buildOpenSkyStatesUrl, normalizeOpenSkyStates } from "./opensky";

test("adsb.fi parser reads current v2 ICAO responses", () => {
  const aircraft = normalizeAdsbFiPayload({
    now: 1_800_000_000_000,
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
  assert.equal(aircraft[0]?.observed_at_ms, 1_799_999_998_000);
  assert.equal(aircraft[0]?.position_observed_at_ms, 1_799_999_997_000);
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

test("OpenSky parser keeps provider timestamps and rejects stale data", () => {
  const current = Array(15).fill(null);
  current[0] = "a3323a";
  current[3] = 1_799_999_995;
  current[4] = 1_799_999_998;
  current[5] = -122.3;
  current[6] = 47.5;

  const stale = [...current];
  stale[0] = "a3335f";
  stale[4] = 1_799_999_900;

  const aircraft = normalizeOpenSkyStates(
    [current, stale],
    1_800_000_000,
  );

  assert.equal(aircraft.length, 1);
  assert.equal(aircraft[0]?.observed_at_ms, 1_799_999_998_000);
  assert.equal(aircraft[0]?.position_observed_at_ms, 1_799_999_995_000);
});

test("fleet ICAOs are normalized, deduplicated, and split into bounded batches", () => {
  const hexes = ["A3323A", "a3335f", "A3323A", "bad"];

  assert.deepEqual(chunkIcaoHexes(hexes, 2), [
    ["a3323a", "a3335f"],
  ]);
  assert.throws(() => chunkIcaoHexes(hexes, 0), /positive integer/);
});
