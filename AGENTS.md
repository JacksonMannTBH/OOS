# Aircraft backend deployment requirements

- Live aircraft ingestion uses **adsb.fi**. Do not restore a previous provider or
  change the provider unless Jackson explicitly requests that change.
- The canonical deployed backend is `supabase/functions/oos-{ingest,app,api}/index.js`.
  These versioned bundles include production changes absent from the older
  Netlify source. Do not deploy cached bundles, old chat artifacts, or rebuild
  from an older checkout.
- Preserve last-known tracking: stored observations and the active flight trail
  remain available through feed gaps. Keep the separate `source_ok` freshness
  status. Do not remove this behavior while updating the provider.
- Before every backend deployment, fetch `origin/main`, reconcile its backend
  changes, read the current live function, and preserve any newer live changes.
  Run `node scripts/prepare-aircraft-deploy.mjs FUNCTION OUTPUT_JSON` and deploy
  only the generated payload. This runs provider/tracking tests and rejects a
  checkout behind `origin/main` or uncommitted backend changes.
- After deployment, verify the deployed source matches the payload and confirm
  scheduled ingestion succeeds with `source = adsbfi`. Update the release record.
- Scheduler identifiers use the provider-neutral `aircraft` prefix. Do not rename
  credentials or leases without migrating their consumers in the same release.
