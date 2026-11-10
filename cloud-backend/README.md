# ADSB.lol cloud backend

Deployed in the **OOS** organization, project **OutOfSight**
(`ohhixakjamjocgmatbha`, us-east-2).

The database contains 29 Washington, 230 California, and 84 Texas aircraft from
the OOS catalog. State membership is each aircraft's home state, not its current
geographic position. No aircraft are excluded by a device's notification settings.

Supabase Cron invokes `oos-ingest` every 15 seconds. Each invocation makes one
combined ADSB.lol lookup for all 343 aircraft. A database lease prevents overlap;
failed requests retry on the next scheduled 15-second tick without exponential
backoff or a provider-supplied waiting period. The HTTP request times out after
15 seconds. A still-running worker prevents overlapping requests.
The scheduled job remains active even when the Mac and app are closed.

The worker reuses the app's existing lifecycle processing. It writes current
state, active-flight positions, minimal flight sessions, takeoff event records,
provider health, and ingestion logs. Missing observations remain unknown rather
than implying a landing. Unchanged source timestamps do not duplicate positions.
Positions are purged when the flight is finalized. Minimal session metadata and
worker logs have seven-day retention. Push delivery runs in `oos-notifications`
on Supabase, using the existing delivery queue, credentials, and subscriptions.

## Read API

Base URL: `https://ohhixakjamjocgmatbha.supabase.co/functions/v1/oos-api`

| Path | Result |
| --- | --- |
| `/aircraft?state=WA` | App-compatible Washington snapshot |
| `/aircraft?state=CA` | App-compatible California snapshot |
| `/aircraft?state=TX` | App-compatible Texas snapshot |
| `/flight-paths?state=CA&tails=N153HP` | GeoJSON active-flight paths; tails optional |
| `/activity?state=CA&limit=50` | Recent flight activity |
| `/health` | Freshness, catalog count, recent run results; 503 when unhealthy |

Requests are GET-only and require `Authorization: Bearer <project anon JWT>`;
the project's legacy anon key works with the enabled gateway JWT verification.
Use an `apikey` header with the same key as well. A modern publishable key is
not a JWT and cannot replace the bearer token on these endpoints. Client reads
only access saved database state; they never cause an upstream aircraft lookup.
Neither service-role keys nor the private ingestion token belong in a client.

The public API exposes only operational aircraft data. Private settings,
subscription credentials, and worker control tables are protected by grants and
row-level security. The ingestion function checks a random 256-bit token whose
plaintext stays in Supabase Vault. Only the scheduler reads that token; the
function compares its hash with a private setting. Its gateway JWT check is off
because it implements this custom authentication.

## Native app API (next build, October 19)

The installed app now calls
`https://ohhixakjamjocgmatbha.supabase.co/functions/v1/oos-app` directly.
This Supabase Edge Function reads/writes the same database using server-only
credentials. It does not forward any request to Netlify. The website and older
installed builds retain their existing Netlify API. Scheduled takeoff delivery
now runs on Supabase as well. Forecasts were subsequently removed at the owner’s request.

`src/app.ts` and `src/app-handler.ts` reuse the portable website route handlers
for catalog, settings, flight history, activity, trails, location-state,
and alert subscription/test requests. Aircraft snapshots use the shared database
reader, including retained last-known state. No client request polls ADSB.lol.

Clients send the project **publishable** key in `apikey`; the handler validates it
against `SUPABASE_PUBLISHABLE_KEYS` and fails closed. `verify_jwt=false` is required
because these keys are not JWTs. Device subscription ownership continues to use
the existing random device capability ID; publishable keys do not grant access
to private tables. No service-role key or push credential ships in the app.

Public configuration lives in `mobile/backend.json`. The mobile build generates
`ios/App/Shared/AppBackend.swift` from that same file for both native targets.
`npm run check:backend` in `mobile/` verifies the deployed routes, native push
configuration, key rejection, and Capacitor CORS without sending notifications.
`npm run check:ios:release` checks packaged endpoint/config consistency.

Deploy `.local/cloud-functions/app.js` as `oos-app`. Its server environment needs
`FCM_RELAY_URL` and `FCM_RELAY_SECRET` from the existing Firebase relay setup.
The existing relay credentials were copied into Supabase Edge Function secrets
on October 19, and the full read-only mobile backend check passed. The existing
Firebase relay accepted an authenticated empty-body validation request; no push
notification was sent. The existing browser web-push key pair was also securely
copied into Supabase, preserving all current browser subscriptions.

## Scheduled worker handoff — October 19, 2026

Supabase Cron owns the remaining scheduled app workers:

| Job | Schedule | Function |
| --- | --- | --- |
| Aircraft collection | Every 30 seconds | `oos-ingest` |
| Automatic alert delivery | Every minute | `oos-notifications` |

The notification worker authenticates with a private 256-bit Vault
token and expose no public control API. Their SQL queue functions deny execution
to public, anon, authenticated, and service_role roles. Notification processing
uses a database lease plus atomic per-delivery claims, rechecks current aircraft
selections before sending, and retains retries and expired-subscription handling.
Each pass has a 45-second dispatch budget and bounded push-provider timeouts.
Unclaimed deliveries remain queued for the next minute.

`oos-notifications` dry runs only inspect the queue and exercise browser push
signing/encryption with a synthetic endpoint; they never send a notification.
The live dry run passed with both delivery providers configured. A natural
scheduled invocation completed successfully after cutover. The forecast worker was verified during the handoff, then removed below. All five enabled native endpoints and
four enabled browser endpoints were preserved. Device receipt was not tested.

Netlify deploy `6ad6904098e943d686b8b2f1` removes all three old scheduled/background
functions and the temporary encrypted credential-transfer function, while
retaining the existing website handler and assets. The source triggers are now
unscheduled tombstones; the legacy background implementation also checks the
database handoff flag. Future Git deployments must include these source changes.
The next installed build's data and automatic alerts no longer depend on Netlify.
The website and older installed builds still do. Firebase/Apple push delivery
remains part of native notifications.

Validation: 148 automated tests, TypeScript, authenticated live dry run, denied
unauthenticated worker calls, scheduled execution, and the mobile backend check.
Supabase security advisors reported no findings. No test pushes, TestFlight
upload, public App Store release, or tester notifications were made.

## Website connection

The existing app can use the new project with its standard server-side database
access. Set these variables in the app's deployment, then redeploy:

```dotenv
SUPABASE_URL=https://ohhixakjamjocgmatbha.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-side key from this project>
AIRCRAFT_INGESTION_MODE=supabase-cron
```

The mode setting was used during the first ingestion migration. Following the
October 19 handoff, Netlify no longer schedules ingestion or alert delivery.
Keep the website's notification credentials for its registration/test endpoints.
The app uses this project for its backend. Its state selector and catalog are
limited to Washington, California, and Texas; obsolete saved state selections fall
back to Washington. The shared mobile interface uses the same state choices
on its next native release. Existing notification subscriptions could not be
migrated because the old project timed out on database reads; users with
existing alerts must re-enable them after the switch. The new notification
worker was verified to complete successfully.

## Source and deployment

`src/ingest.ts` and `src/api.ts` are the Edge Function entrypoints. Run
`npm run build:cloud-backend` from the repository root to produce deployable
bundles in `.local/cloud-functions/`. The build pins the Supabase JS import to
the app's installed version. Deploy the ingestion bundle as `oos-ingest` with
custom token authentication and the API bundle as `oos-api` with JWT verification.

`supabase/migrations/` mirrors migrations applied only to this new project.
The first migration combines the existing app's schema and lifecycle migrations;
the remaining ones seed WA/CA, provision the protected scheduler, and enable it.
Use this directory as the CLI workdir when managing the new project. Do not run
the main repository's historical nationwide seed migrations against it.

To pause polling from this project's SQL editor:

```sql
select cron.alter_job(jobid, active := false)
from cron.job where jobname = 'oos-adsblol-30s';
```

Set `active := true` to resume. Review `public.ingestion_runs`,
`public.data_source_health`, and the Cron jobs page for operational status.

Verified after deployment: all 259 catalog entries, successful scheduled
requests, persisted live positions and flight paths, API state filtering,
unauthorized ingestion rejection, and denied public access to private settings.
Supabase security advisors reported no warnings. Performance advisors only
reported indexes not yet used in the new database; they are retained for app
workloads ([Supabase guidance](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)).

Data is from [ADSB.lol](https://www.adsb.lol/docs/open-data/api/) under ODbL 1.0.
Provider timeouts can occur; the collector keeps attempting on its 15-second schedule,
with no escalating delay after failures.
A configured 15-second schedule does not guarantee a fresh response every cycle.


## Texas expansion — October 18, 2026

84 Texas aircraft and performance profiles were seeded, and the live collector
and Supabase read API were extended to WA/CA/TX. A successful scheduled run
verified all 343 tracked aircraft, including all 84 Texas entries, at the
unchanged 30-second cadence. Live bundles were patched only for Texas from the
existing deployed versions; unrelated pending app changes remain local.
Rollback copies are in `.local/texas/`.

The state selector, catalog filtering, location detection, and notification
subscription validation now accept Texas. The matching website update was
published on October 18 as Netlify deploy `6ad5133481b34cfde8049ca6`.
Production verification returned 343 entries from `/api/mobile?kind=catalog`
(WA 29, CA 230, TX 84) and 84 Texas aircraft with a healthy source from
`/api/aircraft?state=TX`. Native build 1.0 (12) was uploaded for TestFlight only;
no new public App Store submission or release was made.

## Forecast removal — October 19, 2026

Removed all flight prediction screens, cards, calculations, and app API routes.
The `oos-predictor` Edge Function, its hourly Cron job/run history, and
`queue_oos_predictor()` were deleted. The derived `predictor:current` cache was
deleted. A constraint on the shared runtime cache prevents older deployments
from restoring retired prediction entries. Aircraft observations, actual flight
history, aircraft selections, and notification subscriptions remain in use.

The current `oos-app` API rejects `/predict` (404) and
`/mobile?kind=forecast` (400); the older development `mobile-api` also rejects
`/predict`. Its deployed bundle was patched to remove only the prediction logic.
Historical migration files remain as an audit trail; the removal migration
records the final state. Native assets were rebuilt and synced for the next
TestFlight build, with no native upload or App Store submission.

The matching website removal was deployed as `6ad693df8e2960340282b5bd`.
The former forecast page and prediction API return 404; the former mobile
forecast request returns 400. The home page and catalog remain available.
Validation passed: 149 tests, mobile type check and asset build/iOS sync,
production website build, live route checks, and zero security-advisor findings.

### November 3 provider polling interval

The active provider polling interval is 15 seconds. The existing job retains its
legacy name `oos-adsblol-30s` so job history and retention rules keep working.
`operations/set-provider-poll-15s.sql` records the schedule and settings update.
The app reads aircraft and flight-path data from the server every 5 seconds.


### November 4 live app delivery

The mobile interface now subscribes to private Supabase Realtime Broadcast topics
`oos-live:WA`, `oos-live:CA`, and `oos-live:TX`. The scheduled ingestion worker
builds a shared snapshot and current-flight trails once per state, then broadcasts
them to connected apps. It also broadcasts feed-unavailable status after failed
provider requests. This changes delivery without adding provider requests or
changing the existing collection schedule (observed live: every 30 seconds).

Client keys have SELECT-only broadcast authorization on these three topics.
There is no client INSERT policy. Live tests confirmed anonymous WebSocket sends
are denied and REST injection attempts do not reach receivers. Messages contain
only the existing public aircraft data; device identifiers, notification tokens,
and user locations are excluded.

`/live?state=WA` on `oos-app` provides the initial/reconnection snapshot. Screens
and layers share one channel per state and one WebSocket per app. They receive
full versioned state updates, assembled atomically from bounded message chunks.
Old or incomplete updates cannot overwrite newer state. Visibility/offline
changes suspend the connection; rejoining loads a snapshot. A silent stream can
recover once per minute, while healthy streams make no recurring data requests.
Mock data retains its separate demonstration polling path.

Deployed: receive-only policy `20261104232938_live_aircraft_broadcast`, `oos-app`
version 9, and `oos-ingest` version 11. The website was not deployed, per the
owner's instruction. Existing mobile builds continue polling until updated;
the new packaged interface is included in iOS build 35.

Validation: 173 unit/backend checks; website and mobile type checks; packaged
mobile build; signed iOS archive/export; live bootstrap CORS; two saved-data
broadcasts to all three states; two natural scheduled broadcasts to all three
states; and a real packaged-interface browser check showing one WebSocket,
one bootstrap read, pushed updates, and no recurring aircraft/trail requests.
The source was returning HTTP 429 during validation, so feed-health delivery
was verified along with saved aircraft/trail data. No extra upstream requests
or test takeoff notifications were sent. Security advisors show no new findings;
the existing private notification receipt table remains intentionally without
client policies.
