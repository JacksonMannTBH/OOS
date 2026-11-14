import assert from "node:assert/strict";
import test from "node:test";
import { fetchAdsbLolSnapshot, AdsbLolError } from "./adsblol";
import { FLEET, fleetHex } from "./seed";
import { stateIdForOpsAircraftTail } from "./aircraft-directory";
import { stateCodeForId } from "./app-states";
import type { AircraftCatalogEntry } from "./aircraft-data";

const catalog: AircraftCatalogEntry[] = FLEET.map((aircraft) => ({
  aircraft, homeStateCode: stateCodeForId(stateIdForOpsAircraftTail(aircraft.tail) ?? "washington"),
  nominalEnduranceMin: null, usableFuelGallons: null, lowBurnGph: null, highBurnGph: null, reserveMin: null,
}));
const first = catalog[0]!;

test("cloud provider sends one request for the entire national catalog and preserves unknown ground state", async () => {
  let calls = 0;
  const snapshot = await fetchAdsbLolSnapshot(catalog, async (input) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.hostname, "api.adsb.lol");
    assert.equal(url.pathname.split("/").at(-1)!.split(",").length, catalog.length);
    return Response.json({ now: Date.now(), msg: "No error", ac: [{
      hex: fleetHex(first.aircraft), seen: 1, seen_pos: 120, lat: 47, lon: -122,
    }] });
  });
  assert.equal(calls, 1);
  assert.equal(snapshot.aircraft.length, catalog.length);
  assert.equal(snapshot.source, "adsblol");
  assert.equal(snapshot.aircraft.filter((row) => row.home_state_code === "TX").length, 84);
  assert.equal(snapshot.aircraft.some((row) => row.home_state_code === "NY"), true);
  const row = snapshot.aircraft.find((row) => row.tail === first.aircraft.tail)!;
  assert.equal(row.observed, true);
  assert.equal(row.airborne, false);
  assert.equal(row.observation_status, "unknown");
  assert.equal(row.lat, undefined);
  assert.equal(snapshot.aircraft.filter((row) => row.observed).length, 1);
});

test("cloud provider rejects stale successful responses instead of refreshing old data", async () => {
  await assert.rejects(fetchAdsbLolSnapshot(catalog, async () => Response.json({
    now: Date.now() - 120_000, ac: [], msg: "No error",
  })), /outdated snapshot/);
  await assert.rejects(fetchAdsbLolSnapshot(catalog, async () => Response.json({ error: "unavailable" })), /Invalid ADSB.lol/);
});

test("cloud provider carries rate-limit retry instructions to the scheduler", async () => {
  await assert.rejects(fetchAdsbLolSnapshot(catalog, async () => new Response("", {
    status: 429, headers: { "Retry-After": "180" },
  })), (error: unknown) => error instanceof AdsbLolError && error.retryAfterMs === 180_000);
});
