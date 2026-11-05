import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { checkSource } from '../../scripts/check-aircraft-provider.mjs';

const ingestion = readFileSync(new URL('./oos-ingest/index.js', import.meta.url), 'utf8');
function adapter() {
  let now = 1_800_000_000_000;
  const context = vm.createContext({
    FLEET: [], fleetHex: aircraft => aircraft.hex,
    isSupportedStateCode: state => ['WA', 'CA', 'TX'].includes(state),
    Date: class extends Date { static now() { return now; } },
    setTimeout: (callback, delay) => { now += delay; callback(); },
    AbortSignal, fetch,
  });
  vm.runInContext(ingestion.slice(ingestion.indexOf('// adsb.fi observation parser'), ingestion.indexOf('// lib/tracks.ts')), context);
  return { fetchSnapshot: context.fetchAdsbFiSnapshot, now: () => now };
}

test('release guard rejects an unapproved provider endpoint', () => {
  assert.throws(() => checkSource('oos-ingest', ingestion.replace('https://opendata.adsb.fi/api/', 'https://other-provider.invalid/')), /approved provider/);
});

for (const name of ['oos-ingest', 'oos-app']) {
  const source = readFileSync(new URL(`./${name}/index.js`, import.meta.url), 'utf8');
  test(`${name} retains stored aircraft observations through feed gaps`, async () => {
    const timestamp = new Date(Date.now() - 600_000).toISOString();
    const row = { tail: 'N123', icao24: '000001', observed_at: timestamp, last_seen_at: timestamp,
      observation_status: 'airborne', latitude: 47.5, longitude: -122.3,
      home_state_code: 'WA', flight_session_id: 'active-flight' };
    const db = { from(table) {
      const result = { data: table === 'aircraft_live_public' ? [row] : { source: 'adsbfi', finished_at: timestamp } };
      const chain = new Proxy({}, { get(_, property) {
        if (property === 'then') return (resolve) => resolve(result);
        return () => chain;
      } });
      return chain;
    } };
    const context = vm.createContext({
      Date, DEFAULT_STATE_CODE: 'WA', CURRENT_OBSERVATION_MAX_AGE_MS: 90_000,
      isSupabaseConfigured: () => true, getSupabaseAdmin: () => db,
      parseTime: value => value ? Date.parse(value) : null,
      finiteNumber: value => typeof value === 'number' ? value : undefined,
      inferSnapshotSource: () => 'adsbfi',
    });
    const start = source.indexOf('async function getDatabaseSnapshot(');
    const end = source.indexOf('\nasync function ', start + 1);
    vm.runInContext(source.slice(start, end), context);
    const snapshot = await context.getDatabaseSnapshot('WA');
    assert.equal(snapshot.aircraft[0].observed, true);
    assert.equal(snapshot.aircraft[0].airborne, true);
    assert.equal(snapshot.aircraft[0].lat, 47.5);
    assert.equal(snapshot.aircraft[0].flight_session_id, 'active-flight');
    assert.equal(snapshot.source_ok, false);
  });

  test(`${name} retains an active flight trail through a feed gap`, async () => {
    const now = Date.now();
    const points = [{ lat: 47.5, lon: -122.3, ts: (now - 600_000) / 1000 }];
    const start = source.indexOf('function getCurrentFlightTrackFromPoints(');
    const end = source.indexOf('async function readCurrentFlightPoints(', start);
    const context = vm.createContext({ Date, CURRENT_FLIGHT_GAP_SECONDS: 300, readCurrentFlightPoints: async () => points });
    vm.runInContext(source.slice(start, end), context);
    const track = await context.getCurrentFlightTrack('N123', now);
    assert.equal(track.points.length, 1);
    assert.equal(track.points[0].ts, points[0].ts);
  });
}
const catalog = count => Array.from({ length: count }, (_, index) => ({
  aircraft: { hex: index.toString(16).padStart(6, '0'), tail: `N${index}` }, homeStateCode: 'WA',
}));

test('live adapter uses bounded adsb.fi requests, spacing, and provider timestamps', async () => {
  const api = adapter();
  const calls = [];
  const snapshot = await api.fetchSnapshot(catalog(151), async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://opendata.adsb.fi');
    assert.equal(options.cache, 'no-store');
    const hexes = parsed.pathname.replace('/api/v2/icao/', '').split(',');
    calls.push({ at: api.now(), count: hexes.length });
    return Response.json({ msg: 'No error', now: api.now(), ac: hexes.map(hex => ({
      hex, seen: 1, seen_pos: 2, lat: 47.5, lon: -122.3, alt_baro: 1200,
    })) });
  });
  assert.deepEqual(calls.map(call => call.count), [75, 75, 1]);
  assert.ok(calls[1].at - calls[0].at >= 1100);
  assert.ok(calls[2].at - calls[1].at >= 1100);
  assert.equal(snapshot.source, 'adsbfi');
  assert.equal(snapshot.live_seen_count, 151);
  assert.equal(snapshot.aircraft[0].position_observed_at, new Date(calls[0].at - 2000).toISOString());
});

test('live adapter fails the full snapshot on an upstream error', async () => {
  const api = adapter();
  let calls = 0;
  await assert.rejects(api.fetchSnapshot(catalog(76), async () => {
    calls++;
    return calls === 1 ? Response.json({ now: api.now(), ac: [] }) : new Response('', { status: 429, headers: { 'Retry-After': '30' } });
  }), error => error.message === 'adsb.fi HTTP 429' && error.retryAfterMs === 30000);
  assert.equal(calls, 2);
});

test('live adapter rejects stale and malformed provider snapshots', async () => {
  for (const payload of [{ now: 1_700_000_000_000, ac: [] }, { now: 1_800_000_000_000 }]) {
    await assert.rejects(adapter().fetchSnapshot(catalog(1), async () => Response.json(payload)), /adsb.fi/);
  }
});

test('live adapter does not turn stale positions into current locations', async () => {
  const api = adapter();
  const snapshot = await api.fetchSnapshot(catalog(1), async () => Response.json({ now: api.now(), ac: [{
    hex: '000000', seen: 1, seen_pos: 120, lat: 47.5, lon: -122.3, alt_baro: 'ground',
  }] }));
  assert.equal(snapshot.aircraft[0].observed, true);
  assert.equal(snapshot.aircraft[0].lat, undefined);
  assert.equal(snapshot.aircraft[0].position_observed_at, null);
});

for (const name of ['oos-api', 'oos-app']) {
  test(`${name} attributes current and historical feeds accurately`, () => {
    const source = readFileSync(new URL(`./${name}/index.js`, import.meta.url), 'utf8');
    const context = vm.createContext({});
    vm.runInContext(source.slice(source.indexOf('function feedAttribution(')), context);
    assert.equal(context.feedAttribution('adsbfi').attribution, 'adsb.fi');
    assert.equal(context.feedAttribution('adsbfi').attribution_url, 'https://adsb.fi/');
    assert.equal(context.feedAttribution('adsbfi').license, undefined);
    assert.equal(context.feedAttribution('opensky').attribution, 'OpenSky Network');
  });
}
