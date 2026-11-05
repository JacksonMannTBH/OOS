import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const backendRoot = fileURLToPath(new URL('../', import.meta.url));
export const functions = { 'oos-ingest': false, 'oos-app': false, 'oos-api': true, 'mobile-api': false };

export function checkSource(name, source) {
  if (!Object.hasOwn(functions, name)) throw new Error(`Unknown aircraft function: ${name}`);
  const upstreamUrls = [...source.matchAll(/https?:\/\/[^\s"'`]*\/v[23]\/(?:icao|hex)\//g)].map(match => match[0]);
  if (upstreamUrls.some(url => !url.startsWith('https://opendata.adsb.fi/api/'))) {
    throw new Error(`${name}: aircraft request host is not the approved provider`);
  }
  if (name === 'oos-ingest') {
    if (!source.includes('https://opendata.adsb.fi/api/v2/icao/')) throw new Error('Missing adsb.fi endpoint');
    if (!source.includes('const snapshot = await fetchAdsbFiSnapshot(catalog)')) throw new Error('Ingestion must call the adsb.fi adapter');
    if (!source.includes('source: "adsbfi"')) throw new Error('Ingestion must record adsbfi');
  }
}

export function checkBackend(root = backendRoot) {
  for (const name of Object.keys(functions)) {
    checkSource(name, readFileSync(path.join(root, 'supabase/functions', name, name === 'mobile-api' ? 'bundle.js' : 'index.js'), 'utf8'));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkBackend();
  console.log('Aircraft deployment sources use adsb.fi.');
}
