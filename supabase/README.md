# Supabase

Supabase is the durable data service for the aircraft catalog, live state,
one-hour coordinate trails, flight sessions, notification subscriptions,
delivery records, and worker health.

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
```

The service-role key is server-only. Never expose it through a
`NEXT_PUBLIC_` variable.

Import official state boundary polygons into `states.boundary` before enabling
coordinate-derived state display. Subscription matching uses an aircraft's
catalog `home_state_code`; physical state is informational.

The cleanup job removes live coordinate rows older than one hour every minute.
Database backups can retain deleted rows according to the Supabase
project's backup policy.
