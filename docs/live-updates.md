# Aircraft live updates

The ingestion worker reads the nationwide aircraft view once per completed cycle,
with pagination, and divides the result into the existing state channels. It reads
the latest two successful ingestion timestamps once for the entire country.

Version 2 broadcasts contain a current state snapshot, active flight-session IDs,
and only positions inserted since the preceding successful ingestion. The cursor
comes from persisted ingestion runs, so an Edge Function cold start does not
require loading all flight histories. Position queries use insertion time rather
than observation time so delayed provider observations are included. Reads are
batched by session and paginated; there are no individual aircraft/session lookups.

The app retains trails and merges incoming points by timestamp. It removes trails
for closed sessions. A new session or a gap in ingestion cursors requests a full
state from /live. That endpoint batches and paginates complete current-flight
histories, including histories longer than the database's default row limit.
Each connection or reconnection also receives that full state. Partial messages
are assembled atomically, and frames received during recovery are queued with a
bounded size. Concurrent recovery requests are coalesced.

The socket watchdog waits 60 seconds of silence; normal nationwide cycles take
about 20 seconds. Explicit cursor gaps recover immediately. Healthy connections
do not periodically download full histories.

The complete /live response remains version 1 with added cursor/session fields,
so older installed builds retain their existing recovery path. Version 2 is the
only scheduled broadcast format; no parallel legacy full-history broadcast runs.
Updated app builds use incremental messages. Older builds need an app update to
gain the reduced connection workload.

Full /live downloads, legacy aircraft responses, and nationwide marker responses
now share prepared results. The first request for a state builds the response;
other requests reuse it until the latest completed ingestion changes or the
30-second maximum cache lifetime expires. Each cache read checks the ingestion
generation through an indexed lookup. Requests in one worker share a pending
promise; a 15-second database lease coordinates separate workers. Slow builders
cannot overwrite a newer owner's response, and a generation change during a
build prevents that result from entering the cache. Failed builds release their
lease. Unavailable or busy caches fall back to the normal data path after a
bounded wait. The cache stores only these public aircraft responses, remains
service-only, and does not change the existing app response formats or HTTP
no-store headers. Full trail reads happen on demand, not for every state/cycle.

Ingestion reuses the catalog it already loaded and resolves state boundaries for
new positioned observations in batches of at most 100. The batch function uses
the same existing state resolver; missing coordinates and home-state fallbacks
retain their behavior. Duplicate observations still do not advance takeoff or
landing confirmation.

Takeoff notification delivery processes at most four rows concurrently. Each
delivery keeps its atomic claim, preference check, existing retry rules, and
claim-token completion writes. No new deliveries are claimed after the worker's
time budget, and in-flight work settles before the lease is released. The live
deployment also preserves existing confirmed-landing cleanup behavior.

ADSB.fi, ingestion authorization, worker lease names, and the live scheduler are
unchanged. The nationwide marker-only endpoint remains separate from state alerts.

Verification includes 1,104 aircraft spanning 50 test states, pagination beyond
1,000 trail points, late observations, duplicate/missed/out-of-order messages,
new flights, landings, reconnect races, and independent state delivery failures.

## App build 145: prepared for a later v3 backend rollout

The owner requested shipping the app first and converting the backend only after
Apple publishes it. No backend deployment is part of this build.

The release receiver requests `/live?state=WA&version=3` at connection/recovery.
The current endpoint ignores the extra parameter and returns its existing v1
full state, so the app continues using `oos-live:WA` and v2 broadcasts. Current
WA, CA and TX responses were checked read-only with the new parameter.

After publication, a future backend may answer that opt-in request with a valid
v3 `FullMessage` from `lib/aircraft-delta-protocol.ts`. Only that response switches
the app to private topic `oos-live-v3:WA`, event `state`. It then reads again after
joining to cover the channel-switch gap. Normal healthy delivery never polls
for a full snapshot. An already-connected legacy stream discovers the upgrade
on its next reconnect/recovery. Returning v1 on a later recovery rolls it back
to the existing topic. Invalid data never selects v3, late callbacks are ignored,
and a lagging baseline cannot move visible aircraft backwards.

The future publisher must persist the exact v3 baseline, stream ID and sequence
before broadcasting, and serve that same baseline to joining/recovering apps.
An independently rebuilt v1 response cannot be wrapped as v3. Keep the existing
endpoint behavior for requests without `version=3`, retain v2 broadcasts for old
installed apps, and authorize the separate v3 private topics before enabling
the opt-in response. Production Supabase delivery still needs validation then.

The release codec is also used by the recorded-data test harness. Automated
checks cover current-backend compatibility, later activation, rollback, invalid
responses, channel-switch races, shared recovery, backgrounding, and healthy
v3 delivery without polling. OOS Test controls and its Mac address are excluded
from the regular app package.
