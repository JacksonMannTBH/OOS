import assert from "node:assert/strict";
import test from "node:test";
import { AdsbLolTrial, trialCatalog } from "./adsblol-trial";

const epoch = 1_800_000_000_000;
const first = trialCatalog[0]!;
const response = (now: number, ac: unknown[] = []) => Response.json({ now, ac, msg: "No error" });

test("queries the complete WA/CA catalog in one request and never polls early", async () => {
  let now = epoch;
  const urls: string[] = [];
  const trial = new AdsbLolTrial(async (url) => {
    urls.push(String(url));
    return response(now);
  }, () => now);
  await trial.poll();
  const requested = urls[0]!.split("/").at(-1)!.split(",");
  assert.deepEqual(new Set(requested), new Set(trialCatalog.map((row) => row.hex)));
  assert.equal(trial.snapshot("WA").counts.catalog, 29);
  assert.equal(trial.snapshot("CA").counts.catalog, 230);
  assert.equal(trial.snapshot().counts.catalog, 259);
  now += 29_999;
  assert.equal(await trial.poll(), false);
  now += 1;
  assert.equal(await trial.poll(), true);
  assert.equal(urls.length, 2);
  assert.equal(trial.snapshot().aircraft[0]!.status, "unknown");
});

test("freshness expires on reads and stale coordinates are withheld", async () => {
  let now = epoch;
  const trial = new AdsbLolTrial(async () => response(epoch, [{
    hex: first.hex.toUpperCase(), seen: 1, seen_pos: 2,
    lat: 47, lon: -122, alt_baro: 1200, gs: 90, track: 45,
  }]), () => now);
  await trial.poll();
  assert.equal(trial.snapshot().counts.positioned, 1);
  now += 59_000;
  assert.equal(trial.snapshot().counts.observed, 1);
  assert.equal(trial.snapshot().counts.positioned, 0);
  now += 2_000;
  const row = trial.snapshot().aircraft.find((entry) => entry.hex === first.hex)!;
  assert.equal(row.status, "unknown");
  assert.equal(row.ground, null);
  assert.equal(row.altitudeFeet, null);
  assert.equal(trial.snapshot().healthy, false);
});

test("rate limits honor Retry-After and successful recovery restores normal polling", async () => {
  let now = epoch;
  let calls = 0;
  const trial = new AdsbLolTrial(async () => ++calls === 1
    ? new Response("", { status: 429, headers: { "Retry-After": "120" } })
    : response(now), () => now);
  await trial.poll();
  assert.equal(trial.snapshot().healthy, false);
  assert.equal(Date.parse(trial.snapshot().nextRequestAt), epoch + 120_000);
  now += 119_999;
  assert.equal(await trial.poll(), false);
  now += 1;
  await trial.poll();
  assert.equal(trial.snapshot().healthy, true);
  assert.equal(Date.parse(trial.snapshot().nextRequestAt), now + 30_000);
});

test("does not overlap pending requests or treat malformed payloads as success", async () => {
  let release!: (value: Response) => void;
  const trial = new AdsbLolTrial(() => new Promise((resolve) => { release = resolve; }), () => epoch);
  const pending = trial.poll();
  assert.equal(await trial.poll(), false);
  release(Response.json({ message: "upstream unavailable" }));
  await pending;
  assert.equal(trial.snapshot().successes, 0);
  assert.match(trial.snapshot().error!, /Invalid ADSB.lol/);
});
