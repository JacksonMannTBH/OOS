# Aircraft backend

The versioned `oos-ingest`, `oos-app`, `oos-api`, and `mobile-api` bundles are the
canonical source for their deployed functions in project `ohhixakjamjocgmatbha`.
They preserve production behavior absent from the older Netlify application.
Do not regenerate these bundles from an older checkout or a cached chat artifact.

Ingestion uses adsb.fi `/api/v2/icao/`: batches of 75 aircraft, at least 1,100 ms
between requests, and a 30-second scheduled cycle. Stored observations and the
active flight trail remain available during feed gaps. `source_ok` continues to
report freshness separately. The parser still rejects stale upstream samples.

Before deployment, fetch the latest main branch, reconcile any newer live
function changes, commit the change, and run:

```sh
node scripts/prepare-aircraft-deploy.mjs oos-ingest /tmp/aircraft-deploy.json
```

Submit exactly the generated payload using the Supabase deployment tool with
the connected OOS account. The preparation command checks provider URLs, runs
tracking/provider regressions, rejects stale checkouts, and requires committed
backend files. The same checks run in GitHub Actions on pushes and PRs.

The scheduler calls `public.queue_aircraft_poll()` through `oos-aircraft-30s`.
Authentication uses the `aircraft_ingest_token_hash` setting and Vault secret
`oos_aircraft_ingest_token`. The worker lease is `aircraft-ingestion`.
Previous credential-setting names have been removed: stale bundles cannot
authenticate to ingestion using the old configuration.

Release on November 4, 2026: ingestion v14, app v12, API v10, mobile API v6.
The previous provider's ingestion/health logs were deleted at the owner's
request. Flight coordinates were retained with neutral historical source tags.
Provider attribution links to https://adsb.fi/ and its published terms.

This repository and release process prevent accidental provider regressions;
an administrator can still bypass the process by deploying unrelated code.
