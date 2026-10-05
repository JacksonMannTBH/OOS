-- Device preferences retain exclusions for every state; an empty map tracks all.
alter table public.notification_subscriptions
  add column if not exists excluded_aircraft_by_state jsonb not null default '{}'::jsonb
  check (jsonb_typeof(excluded_aircraft_by_state) = 'object');

comment on column public.notification_subscriptions.excluded_aircraft_by_state
  is 'Aircraft tail numbers excluded from tracking and takeoff alerts, keyed by state code.';
