create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists pg_cron;

create table public.states (
  code text primary key check (code ~ '^[A-Z]{2}$'),
  slug text not null unique,
  name text not null unique,
  center_lat double precision not null,
  center_lon double precision not null,
  search_radius_nm integer not null default 250 check (search_radius_nm between 1 and 250),
  boundary extensions.geography(multipolygon, 4326),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.states (code, slug, name, center_lat, center_lon)
values
  ('WA', 'washington', 'Washington', 47.4, -120.8),
  ('CA', 'california', 'California', 37.2, -119.7),
  ('TX', 'texas', 'Texas', 31.0, -99.0),
  ('FL', 'florida', 'Florida', 28.1, -82.1),
  ('OH', 'ohio', 'Ohio', 40.2, -82.8),
  ('CO', 'colorado', 'Colorado', 39.0, -105.5)
on conflict (code) do update set
  slug = excluded.slug,
  name = excluded.name,
  center_lat = excluded.center_lat,
  center_lon = excluded.center_lon,
  updated_at = now();

create table public.aircraft (
  id uuid primary key default gen_random_uuid(),
  tail text not null unique check (tail ~ '^[A-Z0-9]{2,12}$'),
  icao24 text not null unique check (icao24 ~ '^[0-9A-F]{6}$'),
  home_state_code text not null references public.states(code),
  operator text not null,
  model text not null,
  nickname text,
  base text not null,
  role text not null check (role in ('fixed_wing', 'patrol', 'sar', 'transport', 'unknown')),
  role_confidence text not null check (role_confidence in ('confirmed', 'tentative', 'unknown')),
  role_description text not null default '—',
  role_note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index aircraft_active_state_tail_idx
  on public.aircraft (home_state_code, tail)
  where active = true;

create table public.aircraft_performance_profiles (
  aircraft_id uuid primary key references public.aircraft(id) on delete cascade,
  usable_fuel_gallons numeric,
  nominal_endurance_min integer check (nominal_endurance_min > 0),
  low_burn_gph numeric check (low_burn_gph > 0),
  high_burn_gph numeric check (high_burn_gph > 0),
  reserve_min integer not null default 30 check (reserve_min >= 0),
  source_url text,
  source_note text,
  verified_at timestamptz,
  updated_at timestamptz not null default now(),
  check (
    low_burn_gph is null
    or high_burn_gph is null
    or low_burn_gph <= high_burn_gph
  )
);

create table public.flight_sessions (
  id uuid primary key default gen_random_uuid(),
  aircraft_id uuid not null references public.aircraft(id) on delete cascade,
  status text not null check (status in ('tracking', 'airborne', 'landed', 'unknown')),
  tracking_started_at timestamptz not null,
  detected_takeoff_at timestamptz,
  detected_landing_at timestamptz,
  last_seen_at timestamptz not null,
  takeoff_time_source text not null default 'unknown'
    check (takeoff_time_source in ('observed_transition', 'interpolated', 'tracking_started_airborne', 'unknown')),
  confidence text not null default 'low' check (confidence in ('low', 'medium', 'high')),
  starting_fuel_estimate_gal numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    detected_landing_at is null
    or detected_takeoff_at is null
    or detected_landing_at >= detected_takeoff_at
  )
);

create unique index flight_sessions_one_open_per_aircraft
  on public.flight_sessions (aircraft_id)
  where detected_landing_at is null and status in ('tracking', 'airborne', 'unknown');
create index flight_sessions_aircraft_takeoff_idx
  on public.flight_sessions (aircraft_id, detected_takeoff_at desc);

create table public.aircraft_current_state (
  aircraft_id uuid primary key references public.aircraft(id) on delete cascade,
  flight_session_id uuid references public.flight_sessions(id) on delete set null,
  observation_status text not null default 'unknown'
    check (observation_status in ('grounded', 'airborne_candidate', 'airborne', 'landing_candidate', 'unknown')),
  consecutive_airborne smallint not null default 0,
  consecutive_grounded smallint not null default 0,
  current_state_code text references public.states(code),
  observed_at timestamptz,
  last_seen_at timestamptz,
  last_grounded_at timestamptz,
  airborne_candidate_started_at timestamptz,
  latitude double precision,
  longitude double precision,
  altitude_ft integer,
  ground_speed_kt real,
  heading_deg real,
  squawk text,
  source text,
  updated_at timestamptz not null default now()
);

create table public.aircraft_positions (
  id bigint generated always as identity primary key,
  aircraft_id uuid not null references public.aircraft(id) on delete cascade,
  flight_session_id uuid references public.flight_sessions(id) on delete cascade,
  observed_at timestamptz not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  position extensions.geography(point, 4326)
    generated always as (
      extensions.st_setsrid(
        extensions.st_makepoint(longitude, latitude),
        4326
      )::extensions.geography
    ) stored,
  altitude_ft integer,
  ground_speed_kt real,
  heading_deg real,
  source text not null,
  created_at timestamptz not null default now(),
  unique (aircraft_id, observed_at)
);

create index aircraft_positions_aircraft_time_idx
  on public.aircraft_positions (aircraft_id, observed_at desc);
create index aircraft_positions_observed_at_brin
  on public.aircraft_positions using brin (observed_at);
create index aircraft_positions_position_gist
  on public.aircraft_positions using gist (position);
create index aircraft_positions_flight_session_idx
  on public.aircraft_positions (flight_session_id, observed_at)
  where flight_session_id is not null;

create table public.push_endpoints (
  id uuid primary key default gen_random_uuid(),
  device_id text not null unique,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  enabled boolean not null default true,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_subscriptions (
  id uuid primary key default gen_random_uuid(),
  push_endpoint_id uuid not null unique references public.push_endpoints(id) on delete cascade,
  state_code text not null references public.states(code),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notification_subscriptions_state_enabled_idx
  on public.notification_subscriptions (state_code, push_endpoint_id)
  where enabled = true;

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  flight_session_id uuid not null references public.flight_sessions(id) on delete cascade,
  aircraft_id uuid not null references public.aircraft(id) on delete cascade,
  state_code text not null references public.states(code),
  event_type text not null check (event_type in ('takeoff')),
  occurred_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (flight_session_id, event_type)
);

create index notification_events_aircraft_time_idx
  on public.notification_events (aircraft_id, occurred_at desc);
create index notification_events_state_time_idx
  on public.notification_events (state_code, occurred_at desc);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_event_id uuid not null references public.notification_events(id) on delete cascade,
  push_endpoint_id uuid not null references public.push_endpoints(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'expired')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  claim_token uuid,
  sent_at timestamptz,
  response_status integer,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_event_id, push_endpoint_id)
);

create index notification_deliveries_pending_idx
  on public.notification_deliveries (next_attempt_at, created_at)
  where status in ('pending', 'failed');
create index notification_deliveries_endpoint_idx
  on public.notification_deliveries (push_endpoint_id, created_at desc);

create table public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  worker_id text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'succeeded', 'partial', 'failed', 'skipped')),
  source text,
  source_aircraft_count integer not null default 0,
  tracked_aircraft_count integer not null default 0,
  positions_inserted integer not null default 0,
  takeoffs_created integer not null default 0,
  error text,
  metadata jsonb not null default '{}'::jsonb
);

create table public.notification_worker_runs (
  id uuid primary key default gen_random_uuid(),
  worker_id text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed', 'skipped')),
  deliveries_claimed integer not null default 0,
  deliveries_sent integer not null default 0,
  deliveries_failed integer not null default 0,
  error text
);

create table public.data_source_health (
  source text primary key,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  latency_ms integer,
  rate_limit_remaining integer,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.registry_audit (
  id bigint generated always as identity primary key,
  operation text not null check (operation in ('create', 'update', 'delete', 'restore', 'seed', 'backup')),
  aircraft_tail text not null,
  previous_value jsonb,
  next_value jsonb,
  actor text,
  created_at timestamptz not null default now()
);

create table public.spots (
  id uuid primary key default gen_random_uuid(),
  observed_at timestamptz not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m real,
  airborne_tails jsonb not null default '[]'::jsonb,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.runtime_cache (
  key text primary key,
  value jsonb not null,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.worker_leases (
  name text primary key,
  owner text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create or replace function public.cleanup_expired_operational_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  positions_deleted integer;
  cache_deleted integer;
begin
  update public.notification_deliveries
  set status = 'failed',
      next_attempt_at = now(),
      failure_reason = 'processing_lease_expired',
      claim_token = null,
      updated_at = now()
  where status = 'processing'
    and claimed_at < now() - interval '5 minutes';

  delete from public.aircraft_positions
  where observed_at < now() - interval '1 hour';
  get diagnostics positions_deleted = row_count;

  delete from public.runtime_cache
  where expires_at is not null and expires_at <= now();
  get diagnostics cache_deleted = row_count;

  delete from public.notification_deliveries
  where created_at < now() - interval '30 days';

  delete from public.ingestion_runs
  where started_at < now() - interval '30 days';

  delete from public.notification_worker_runs
  where started_at < now() - interval '30 days';

  delete from public.spots
  where observed_at < now() - interval '7 days';

  return jsonb_build_object(
    'positions_deleted', positions_deleted,
    'cache_deleted', cache_deleted
  );
end;
$$;

create or replace function public.claim_worker_lease(
  lease_name text,
  lease_owner text,
  lease_seconds integer default 90
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed boolean;
begin
  insert into public.worker_leases (name, owner, expires_at)
  values (lease_name, lease_owner, now() + make_interval(secs => lease_seconds))
  on conflict (name) do update
  set owner = excluded.owner,
      expires_at = excluded.expires_at,
      updated_at = now()
  where public.worker_leases.expires_at <= now()
     or public.worker_leases.owner = excluded.owner;

  select exists (
    select 1
    from public.worker_leases
    where name = lease_name
      and owner = lease_owner
      and expires_at > now()
  ) into claimed;

  return claimed;
end;
$$;

create or replace function public.release_worker_lease(
  lease_name text,
  lease_owner text
)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.worker_leases
  where name = lease_name and owner = lease_owner;
$$;

create or replace function public.resolve_state_code(
  input_latitude double precision,
  input_longitude double precision
)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select code
  from public.states
  where boundary is not null
    and extensions.st_covers(
      boundary,
      extensions.st_setsrid(
        extensions.st_makepoint(input_longitude, input_latitude),
        4326
      )::extensions.geography
    )
  limit 1;
$$;

create or replace function public.enqueue_takeoff_deliveries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_deliveries (
    notification_event_id,
    push_endpoint_id
  )
  select new.id, subscriptions.push_endpoint_id
  from public.notification_subscriptions as subscriptions
  join public.push_endpoints as endpoints
    on endpoints.id = subscriptions.push_endpoint_id
  where subscriptions.enabled = true
    and endpoints.enabled = true
    and subscriptions.state_code = new.state_code
  on conflict (notification_event_id, push_endpoint_id) do nothing;
  return new;
end;
$$;

create trigger notification_events_enqueue_deliveries
after insert on public.notification_events
for each row execute function public.enqueue_takeoff_deliveries();

create or replace view public.aircraft_catalog_public
with (security_invoker = true)
as
select
  aircraft.id,
  aircraft.tail,
  aircraft.icao24,
  aircraft.home_state_code,
  aircraft.operator,
  aircraft.model,
  aircraft.nickname,
  aircraft.base,
  aircraft.role,
  aircraft.role_confidence,
  aircraft.role_description,
  aircraft.role_note,
  profiles.usable_fuel_gallons,
  profiles.nominal_endurance_min,
  profiles.low_burn_gph,
  profiles.high_burn_gph,
  profiles.reserve_min,
  profiles.source_url,
  profiles.verified_at
from public.aircraft
left join public.aircraft_performance_profiles as profiles
  on profiles.aircraft_id = aircraft.id
where aircraft.active = true;

create or replace view public.aircraft_live_public
with (security_invoker = true)
as
select
  aircraft.id,
  aircraft.tail,
  aircraft.icao24,
  aircraft.home_state_code,
  aircraft.operator,
  aircraft.model,
  aircraft.nickname,
  aircraft.base,
  aircraft.role,
  aircraft.role_confidence,
  aircraft.role_description,
  aircraft.role_note,
  current.flight_session_id,
  current.observation_status,
  current.current_state_code,
  current.observed_at,
  current.last_seen_at,
  current.latitude,
  current.longitude,
  current.altitude_ft,
  current.ground_speed_kt,
  current.heading_deg,
  current.squawk,
  sessions.detected_takeoff_at,
  sessions.tracking_started_at,
  sessions.takeoff_time_source,
  sessions.confidence as takeoff_confidence,
  sessions.starting_fuel_estimate_gal,
  profiles.usable_fuel_gallons,
  profiles.nominal_endurance_min,
  profiles.low_burn_gph,
  profiles.high_burn_gph,
  profiles.reserve_min
from public.aircraft
left join public.aircraft_current_state as current
  on current.aircraft_id = aircraft.id
left join public.flight_sessions as sessions
  on sessions.id = current.flight_session_id
left join public.aircraft_performance_profiles as profiles
  on profiles.aircraft_id = aircraft.id
where aircraft.active = true;

alter table public.states enable row level security;
alter table public.aircraft enable row level security;
alter table public.aircraft_performance_profiles enable row level security;
alter table public.flight_sessions enable row level security;
alter table public.aircraft_current_state enable row level security;
alter table public.aircraft_positions enable row level security;
alter table public.push_endpoints enable row level security;
alter table public.notification_subscriptions enable row level security;
alter table public.notification_events enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.ingestion_runs enable row level security;
alter table public.notification_worker_runs enable row level security;
alter table public.data_source_health enable row level security;
alter table public.registry_audit enable row level security;
alter table public.spots enable row level security;
alter table public.app_settings enable row level security;
alter table public.runtime_cache enable row level security;
alter table public.worker_leases enable row level security;

create policy "Public states are readable"
  on public.states for select to anon, authenticated using (true);
create policy "Active aircraft are readable"
  on public.aircraft for select to anon, authenticated using (active = true);
create policy "Aircraft performance is readable"
  on public.aircraft_performance_profiles for select to anon, authenticated using (true);
create policy "Current aircraft state is readable"
  on public.aircraft_current_state for select to anon, authenticated using (true);
create policy "Recent positions are readable"
  on public.aircraft_positions for select to anon, authenticated
  using (observed_at >= now() - interval '1 hour');
create policy "Public flight sessions are readable"
  on public.flight_sessions for select to anon, authenticated using (true);

grant select on public.states to anon, authenticated;
grant select on public.aircraft to anon, authenticated;
grant select on public.aircraft_performance_profiles to anon, authenticated;
grant select on public.aircraft_current_state to anon, authenticated;
grant select on public.aircraft_positions to anon, authenticated;
grant select on public.flight_sessions to anon, authenticated;
grant select on public.aircraft_catalog_public to anon, authenticated;
grant select on public.aircraft_live_public to anon, authenticated;

grant usage on schema public, extensions to anon, authenticated, service_role;
grant select, insert, update, delete on
  public.states,
  public.aircraft,
  public.aircraft_performance_profiles,
  public.flight_sessions,
  public.aircraft_current_state,
  public.aircraft_positions,
  public.push_endpoints,
  public.notification_subscriptions,
  public.notification_events,
  public.notification_deliveries,
  public.ingestion_runs,
  public.notification_worker_runs,
  public.data_source_health,
  public.registry_audit,
  public.spots,
  public.app_settings,
  public.runtime_cache,
  public.worker_leases
to service_role;
grant select on public.aircraft_catalog_public, public.aircraft_live_public
  to service_role;
grant usage, select on all sequences in schema public to service_role;

revoke all on public.push_endpoints from anon, authenticated;
revoke all on public.notification_subscriptions from anon, authenticated;
revoke all on public.notification_events from anon, authenticated;
revoke all on public.notification_deliveries from anon, authenticated;
revoke all on public.ingestion_runs from anon, authenticated;
revoke all on public.notification_worker_runs from anon, authenticated;
revoke all on public.data_source_health from anon, authenticated;
revoke all on public.registry_audit from anon, authenticated;
revoke all on public.spots from anon, authenticated;
revoke all on public.app_settings from anon, authenticated;
revoke all on public.runtime_cache from anon, authenticated;
revoke all on public.worker_leases from anon, authenticated;

revoke execute on function public.cleanup_expired_operational_data() from public, anon, authenticated;
revoke execute on function public.claim_worker_lease(text, text, integer) from public, anon, authenticated;
revoke execute on function public.release_worker_lease(text, text) from public, anon, authenticated;
revoke execute on function public.enqueue_takeoff_deliveries() from public, anon, authenticated;
revoke execute on function public.resolve_state_code(double precision, double precision) from public;
grant execute on function public.cleanup_expired_operational_data() to service_role;
grant execute on function public.claim_worker_lease(text, text, integer) to service_role;
grant execute on function public.release_worker_lease(text, text) to service_role;
grant execute on function public.resolve_state_code(double precision, double precision) to anon, authenticated;
grant execute on function public.resolve_state_code(double precision, double precision) to service_role;

select cron.schedule(
  'cleanup-expired-operational-data',
  '* * * * *',
  $$select public.cleanup_expired_operational_data();$$
);
