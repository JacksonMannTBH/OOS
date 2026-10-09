# Out Of Sight

Out Of Sight is a Netlify-hosted aircraft situational-awareness PWA. It tracks
a curated public-safety aircraft catalog, shows live state-scoped positions and
the active flight path, estimates flight time and fuel, and sends state-wide
takeoff notifications.

## Architecture

- Next.js 14 App Router for the application and API routes
- Netlify for hosting, builds, scheduled work, and background functions
- Supabase Postgres/PostGIS for the aircraft catalog, current state, active
  flight session, notification subscriptions, delivery records, settings, and
  operational health
- adsb.fi with OpenSky fallback for live aircraft observations
- Web Push with VAPID for browsers and Firebase Cloud Messaging for the
  Capacitor Android app
- Capacitor 8 Android and iPhone apps with a bundled interface in `mobile/`; live data uses the HTTPS backend

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Create a Supabase project and apply the files in `supabase/migrations/`
   in filename order.
3. Add the Supabase URL and service-role key to `.env.local`.
4. Run `npm install` and `npm run dev`.

The application can render without Supabase during UI work, but persistence,
ingestion, flight paths, catalog editing, and notifications require it.

## Netlify setup

Set these encrypted environment variables in Netlify:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `FCM_RELAY_URL`
- `FCM_RELAY_SECRET`
- `NEXT_PUBLIC_BASE_URL`
- Optional: `AIRCRAFT_SAMPLE_INTERVAL_MS` (defaults to `10000`)
- Optional: `OPENSKY_CLIENT_ID` and `OPENSKY_CLIENT_SECRET`

The scheduled `aircraft-ingest` function runs once per minute and starts a
background worker with two queues sharing one provider request budget.
Airborne aircraft, takeoff candidates, and open flight sessions target the
configured interval (10 seconds by default); other aircraft target at least
30 seconds so new takeoffs are still discovered. Each batch contains at most
75 aircraft and is published to Supabase before the next batch starts.
Only queried aircraft are updated; other batches retain their current state.
Landing candidates stay in the fast queue until landing is confirmed.

The worker starts batches for up to 55 seconds and leaves at least 1.1 seconds
between batches. Provider calls have an 8-second timeout. Slow providers,
persistence, and a large airborne fleet can extend actual update intervals.
When both queues are overdue, discovery receives at least every other batch.
Recent ingestion logs preserve per-aircraft attempt times across workers so
unfinished discovery work stays ahead of aircraft already checked. Logs now
describe individual batches, including `batch_kind`, `queried_tails`, the
target interval, and scheduling lag; per-state counts cover that batch only.
The browser's existing 10-second refresh interval is unchanged.

Source observation times
deduplicate unchanged positions, and already-unknown aircraft are not rewritten
on every pass. Notification retries run once per minute and immediately after a
detected takeoff. The database retains only the active flight's aircraft
coordinates. Confirmed landing purges the coordinates and finalizes the flight
session; the minimal session is removed after any notification retries finish.
Worker-run logs remain available for seven days.

See [supabase/README.md](supabase/README.md) for database details and state
boundary import guidance.

See [mobile/README.md](mobile/README.md) for Android, Xcode/iPhone, and Firebase
setup, including the remaining iOS signing and push requirements.

## Aircraft coverage

Aircraft checkboxes in **Settings → Notifications & state** control the home
status, map, Ride Mode, aircraft list, and takeoff notifications. All aircraft,
including newly added catalog entries, are selected by default. Exclusions are
saved on the device separately for each state; **Reset** restores only the
current state's selections. Enabled notification subscriptions also save those
exclusions in Supabase. Queued and retried deliveries check the latest selection
before sending. Offline edits sync when the app reconnects or becomes visible.

All 50 states are selectable. The catalog contains 1,090 aircraft, including
565 added from the September 4, 2026 FAA registry snapshot and supplemental
agency sources. Rhode Island and Vermont show coverage gaps because no crewed
law enforcement aircraft assignment was verified. Registration does not establish
current operational status. See [national coverage](docs/national-aircraft-coverage.md)
for the state inventory, sources, limitations, and import workflow.
