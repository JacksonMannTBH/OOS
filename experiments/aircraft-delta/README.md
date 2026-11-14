# Aircraft delta delivery: local experiment

This is the local test implementation of recommendation 1: retain aircraft
details on the device and send changed fields, additions, removals and new trail
points. Nothing in the current app or backend imports this directory. No live
backend deployment, database change, provider request, or notification is part
of these tests.

## Validation on November 13, 2026

- 24 prototype tests passed, including 1,000 deterministic mixed updates.
- 16 existing live-feed checks passed alongside the prototype (40 total).
- All 6,000 nationwide replay comparisons matched the current v2 receiver and
  independently reconstructed full snapshots. All 300 recovery comparisons passed.
- Safari in the booted iPhone 18 Pro simulator passed 50 checks: 19 protocol
  scenarios, 30 recorded-data comparisons over loopback HTTP, and automatic
  recovery through the prototype stream.
- The repository TypeScript check passed.

The replay uses an existing November 13 capture with 1,104 aircraft and 1,052
recorded trail points. It reconstructs 120 twenty-second cycles for all 50
states (40 simulated minutes). It uses a fixed catalog and final known flight
statuses, with recorded positions revealed by their arrival times. This is a
simulation using recorded data, not a complete historical production recording.
Takeoffs, landings, catalog edits and other failure cases are tested separately.

| JSON frame bytes across the replay | Current v2 | Prototype v3 |
| --- | ---: | ---: |
| Scheduled updates | 113,497,545 | 4,154,647 |
| Initial full downloads, separately | 868,147 | 872,297 |

Scheduled update messages were **96.3% smaller**; including one initial download
per state gives **95.6%**. This counts each state once, not actual subscribers.
It excludes network headers, production compression, retries, recovery traffic,
notifications and other app traffic. Independently gzipping each frame gave
79.2% smaller payloads, but that is not a claim about Supabase's compression.
These are neither a production bandwidth forecast nor a billing estimate.

Detailed local evidence is in `.local/aircraft-delta-test/`: `tests.log`,
`replay-results.json`, `simulator-results.json`, `simulator.png`, and
`validation-manifest.json`. The manifest identifies the tested source files.
Replay timings measure local encoding/decoding, not backend queries or worker
capacity. Simulator timings do not establish physical-device battery usage.

## Behavior covered

- Static details remain cached; changed names, models and descriptions still arrive.
- Explicit null, false and zero values are preserved. Missing optional fields
  are explicitly removed so stale values cannot survive.
- The common per-aircraft `as_of` clock is sent once per update; exceptions and
  removed clocks also work.
- Aircraft additions, deletions, ordering, state isolation, provider health,
  landings and new flight sessions reconstruct the expected complete state.
- Trails append or replace as needed; late, corrected, repeated and out-of-order
  observations use the existing merger's last-point-at-a-timestamp semantics.
- Updates commit only when all message chunks are present. Missing messages
  trigger a full recovery, with at most eight pending messages retained.
- The stream coalesces recovery reads, ignores aborted reads and old connection
  callbacks, reconnects after backgrounding, and retries a silent connection.
- Existing v1/v2 consumers still decode their existing messages and ignore v3.

## Run locally

From the repository root, with Node and existing dependencies available:

```sh
node --import tsx --test experiments/aircraft-delta/*.test.ts lib/live-data*.test.ts
node --import tsx experiments/aircraft-delta/replay.ts
node --import tsx experiments/aircraft-delta/serve-local.mjs
```

The replay defaults to
`.local/incremental-live-20261113/data-savings-snapshot.json`. Pass another saved
capture as the first argument and an output directory as the second. No capture
is fetched automatically. The unit tests and replay reject network requests.

The browser server binds only to `127.0.0.1` on an available port, prints its
address, and serves only local test data. Open that address in simulator Safari.
Its content policy limits requests to itself. Stop the server after testing.

## Required before an app release

The codec and receiver are tested locally, including an isolated OOS build on a
physical iPhone. Production Supabase wiring and its device validation remain.

1. Use a separate opt-in v3 topic and bootstrap endpoint. Preserve the current
   v1/v2 endpoints and topics for installed builds.
2. Persist the exact publisher baseline and its stream/sequence identity. An
   independently generated `/live` snapshot cannot safely substitute for that
   baseline: field deltas depend on the precise prior state, not only a time.
   Publish only from a single lease owner, and persist before broadcasting so a
   crash or partial broadcast can recover. A restarted stream must supply a full
   baseline before clients apply its deltas.
3. Adapt the encoder to the existing shared aircraft read and incremental trail
   queries. The replay's full-history construction is a test oracle and must not
   become a new production history scan or a second ingestion worker.
4. Wire the next app's opt-in receiver to the versioned feed, test real Supabase
   authentication and delivery, then verify background/foreground behavior,
   memory, recovery traffic and battery behavior on a phone. Measure publisher
   persistence costs and real subscriber-weighted savings before enabling broadly.

No production configuration flag or deployment script was added by this experiment.

## Physical iPhone test build

On November 13, a separately signed **OOS Test** app
(`live.outofsight.app.localtest`, version 1.0.2, build 1) was installed and opened
on the connected iPhone 15. The regular Out Of Sight app remained at build 144
in its existing installation. The original backend configuration, native project,
Info.plist and live receiver hashes were unchanged.

The phone passed 19 protocol scenarios and received recorded Washington aircraft
updates from the Mac. Its telemetry also confirmed background/foreground
reconnection and subsequent updates. Separate real HTTP/WebSocket checks on the
Mac deliberately dropped an update for WA, CA and TX; all three recovered to the
exact expected full state.

The user subsequently reported that all phone tests worked. Build 2 telemetry
confirmed updates in WA, CA and TX, 10 deliberately dropped updates recovered
through seven full downloads (including consecutive missed updates), resumed
delivery after backgrounding, and two fresh launches that reran all 19 protocol
checks successfully. No protocol-check failures were reported. This establishes
successful manual replay testing, not exact full-state comparisons on the phone
or production Supabase validation.

The amber **OOS TEST** banner opens diagnostics and a **Test recovery** button.
Build 2 makes this a floating control above the bottom action buttons, so the
home and map backgrounds cannot cover it.
Keep the phone and Mac on the same Wi-Fi and the Mac awake. This feed replays
saved aircraft positions every five seconds; it does not fetch live aircraft or
test live push notifications. Production alert registration and Live Activities
are disabled in this isolated build.

`prepare-phone.py` creates the isolated source/build directory under
`.local/oos-test-phone/`; it refuses to overwrite an existing project. Its local
server configuration contains a generated test key and must stay local. Run the
recorded-feed server from the repository root with:

```sh
node --import tsx experiments/aircraft-delta/phone-server.ts
```

The server uses the saved local configuration and capture and rejects outbound
fetches. Rebuilding is needed if the Mac's configured LAN address changes.
Evidence is saved in `.local/oos-test-phone/phone-validation.json`,
`phone-events.jsonl`, `socket-checks.json` and the build/install logs.
