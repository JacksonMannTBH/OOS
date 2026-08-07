# Supabase

Supabase is the durable data service for the aircraft catalog, live state,
the active flight's coordinate trail, notification subscriptions, delivery
records, and worker health.

Live project:

```text
Name: Out Of Sight
Project ref: ehnqmsrelqlkzwbrqclm
Region: us-west-1
API URL: https://ehnqmsrelqlkzwbrqclm.supabase.co
```

The core, aircraft-catalog seed, and database-hardening migrations have been
applied. Apply future migrations with the Supabase CLI:

```bash
supabase link --project-ref ehnqmsrelqlkzwbrqclm
supabase db push
```

Required Netlify environment variables:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
CRON_SECRET
AIRCRAFT_SAMPLE_INTERVAL_MS=10000
```

The service-role key is server-only. Never expose it through a
`NEXT_PUBLIC_` variable.

`AIRCRAFT_SAMPLE_INTERVAL_MS` is optional and accepts values from 5000 through
60000 milliseconds. Production defaults to a 10-second ingestion interval.
Upstream observation timestamps are stored with positions so an unchanged
provider sample does not create another coordinate row. Operational ingestion
and notification-worker runs are retained for seven days.

Completed flight positions are purged when landing is confirmed. The minimal
session remains only until any notification retries finish, then is removed. A
short ingestion grace period handles temporary provider coverage gaps; it is
not a historical retention window.

Import official state boundary polygons into `states.boundary` before enabling
coordinate-derived state display. Subscription matching uses an aircraft's
catalog `home_state_code`; physical state is informational.

The cleanup job no longer removes aircraft positions by age. Database backups
can retain deleted rows according to the Supabase project's backup policy.
