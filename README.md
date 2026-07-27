# Out Of Sight

Out Of Sight is a Netlify-hosted aircraft situational-awareness PWA. It tracks
a curated public-safety aircraft catalog, shows live state-scoped positions and
one-hour flight paths, records flight sessions and takeoff times, and sends
state-wide takeoff notifications.

## Architecture

- Next.js 14 App Router for the application and API routes
- Netlify for hosting, builds, scheduled work, and background functions
- Supabase Postgres/PostGIS for the aircraft catalog, current state, flight
  sessions, one-hour position history, notification subscriptions, delivery
  records, settings, and operational health
- adsb.fi with OpenSky fallback for live aircraft observations
- Web Push with VAPID for notifications

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Create a Supabase project and apply
   `supabase/migrations/20260727225731_out_of_sight_core.sql`.
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
- `NEXT_PUBLIC_BASE_URL`
- Optional: `OPENSKY_CLIENT_ID` and `OPENSKY_CLIENT_SECRET`

The scheduled `aircraft-ingest` function runs once per minute and starts a
background function that samples twice, 30 seconds apart. The database retains
aircraft coordinates for one hour. Flight sessions, detected takeoff/landing
times, notification history, and catalog records remain available after the
coordinate cleanup.

See [supabase/README.md](supabase/README.md) for database details and state
boundary import guidance.
