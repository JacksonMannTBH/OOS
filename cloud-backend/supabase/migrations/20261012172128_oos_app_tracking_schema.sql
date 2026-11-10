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
create index aircraft_current_state_flight_session_idx
  on public.aircraft_current_state (flight_session_id)
  where flight_session_id is not null;

create index aircraft_current_state_state_code_idx
  on public.aircraft_current_state (current_state_code)
  where current_state_code is not null;

create policy "Deny public access to push endpoints"
  on public.push_endpoints for all to anon, authenticated
  using (false) with check (false);

create policy "Deny public access to notification subscriptions"
  on public.notification_subscriptions for all to anon, authenticated
  using (false) with check (false);

create policy "Deny public access to notification events"
  on public.notification_events for all to anon, authenticated
  using (false) with check (false);

create policy "Deny public access to notification deliveries"
  on public.notification_deliveries for all to anon, authenticated
  using (false) with check (false);

create policy "Deny public access to ingestion runs"
  on public.ingestion_runs for all to anon, authenticated
  using (false) with check (false);

create policy "Deny public access to notification worker runs"
  on public.notification_worker_runs for all to anon, authenticated
  using (false) with check (false);

create policy "Deny public access to data source health"
  on public.data_source_health for all to anon, authenticated
  using (false) with check (false);

create policy "Deny public access to registry audit"
  on public.registry_audit for all to anon, authenticated
  using (false) with check (false);

create policy "Deny public access to spots"
  on public.spots for all to anon, authenticated
  using (false) with check (false);

create policy "Deny public access to app settings"
  on public.app_settings for all to anon, authenticated
  using (false) with check (false);

create policy "Deny public access to runtime cache"
  on public.runtime_cache for all to anon, authenticated
  using (false) with check (false);

create policy "Deny public access to worker leases"
  on public.worker_leases for all to anon, authenticated
  using (false) with check (false);
-- Positions remain operational state, while minimal completed-session metadata
-- is retained long enough to support recent-flight and activity surfaces.

drop policy if exists "Recent positions are readable"
  on public.aircraft_positions;

create policy "Active flight positions are readable"
  on public.aircraft_positions for select to anon, authenticated
  using (
    flight_session_id is not null
    and exists (
      select 1
      from public.flight_sessions as sessions
      where sessions.id = aircraft_positions.flight_session_id
        and sessions.detected_landing_at is null
        and sessions.status in ('tracking', 'airborne', 'unknown')
    )
  );

create or replace function public.cleanup_expired_operational_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cache_deleted integer;
  ingestion_runs_deleted integer;
  notification_worker_runs_deleted integer;
begin
  update public.notification_deliveries
  set status = 'failed',
      next_attempt_at = now(),
      failure_reason = 'processing_lease_expired',
      claim_token = null,
      updated_at = now()
  where status = 'processing'
    and claimed_at < now() - interval '5 minutes';

  delete from public.runtime_cache
  where expires_at is not null and expires_at <= now();
  get diagnostics cache_deleted = row_count;

  delete from public.notification_deliveries
  where created_at < now() - interval '30 days';

  delete from public.ingestion_runs
  where started_at < now() - interval '7 days';
  get diagnostics ingestion_runs_deleted = row_count;

  delete from public.notification_worker_runs
  where started_at < now() - interval '7 days';
  get diagnostics notification_worker_runs_deleted = row_count;

  delete from public.flight_sessions as sessions
  where sessions.status in ('landed', 'unknown')
    and sessions.last_seen_at < now() - interval '7 days'
    and not exists (
      select 1
      from public.notification_events as events
      join public.notification_deliveries as deliveries
        on deliveries.notification_event_id = events.id
      where events.flight_session_id = sessions.id
        and deliveries.status in ('pending', 'processing', 'failed')
    );

  delete from public.spots
  where observed_at < now() - interval '7 days';

  return jsonb_build_object(
    'cache_deleted', cache_deleted,
    'ingestion_runs_deleted', ingestion_runs_deleted,
    'notification_worker_runs_deleted', notification_worker_runs_deleted
  );
end;
$$;

revoke execute on function public.cleanup_expired_operational_data()
  from public, anon, authenticated;
grant execute on function public.cleanup_expired_operational_data()
  to service_role;
-- Persist lifecycle transitions independently from the estimated landing time.
-- A closed session may represent either a confirmed landing or a loss of
-- coverage; only confirmed landings populate the landing timestamps.

alter table public.flight_sessions
  add column closed_at timestamptz,
  add column end_reason text,
  add column landing_confirmed_at timestamptz;

alter table public.aircraft_current_state
  add column last_airborne_at timestamptz,
  add column landing_candidate_started_at timestamptz;

-- The legacy partial index classified unknown sessions with a null landing
-- timestamp as open. The normalization below intentionally clears that
-- timestamp, so remove the obsolete index before rewriting historical rows.
-- A closed_at-based replacement is created after the rows are reconciled.
drop index if exists public.flight_sessions_one_open_per_aircraft;

-- Remove precise-looking takeoff timestamps when the source did not observe a
-- trustworthy transition. An interpolated timestamp more than one minute
-- before tracking began implies a provider observation gap over two minutes.
update public.flight_sessions
set detected_takeoff_at = null,
    takeoff_time_source = 'tracking_started_airborne',
    confidence = 'low'
where takeoff_time_source = 'tracking_started_airborne'
   or (
     takeoff_time_source = 'interpolated'
     and tracking_started_at - detected_takeoff_at > interval '1 minute'
   );

-- Historical rows used detected_landing_at as a generic session end marker.
-- Preserve true landings, but reclassify unknown closures so they no longer
-- surface as detected landings in recent-flight reads.
update public.flight_sessions
set detected_landing_at = coalesce(detected_landing_at, last_seen_at),
    landing_confirmed_at = coalesce(detected_landing_at, last_seen_at),
    closed_at = coalesce(detected_landing_at, last_seen_at),
    end_reason = 'confirmed_landing'
where status = 'landed';

update public.flight_sessions
set closed_at = coalesce(detected_landing_at, last_seen_at),
    end_reason = 'coverage_lost',
    detected_landing_at = null,
    landing_confirmed_at = null
where status = 'unknown';

-- Reconcile any open session left behind by the former multi-write ingestion
-- path before enforcing one atomic, current-state-linked session per aircraft.
update public.flight_sessions as sessions
set status = 'unknown',
    closed_at = sessions.last_seen_at,
    end_reason = 'stale_session',
    detected_landing_at = null,
    landing_confirmed_at = null,
    updated_at = now()
where sessions.status in ('tracking', 'airborne')
  and not exists (
    select 1
    from public.aircraft_current_state as current_state
    where current_state.flight_session_id = sessions.id
  );

update public.aircraft_current_state as current_state
set flight_session_id = null,
    updated_at = now()
where exists (
  select 1
  from public.flight_sessions as sessions
  where sessions.id = current_state.flight_session_id
    and sessions.closed_at is not null
);

update public.aircraft_current_state
set last_airborne_at = observed_at
where last_airborne_at is null
  and observation_status in ('airborne_candidate', 'airborne');

update public.aircraft_current_state as current_state
set last_airborne_at = coalesce(
      current_state.last_airborne_at,
      sessions.last_seen_at
    ),
    landing_candidate_started_at = coalesce(
      current_state.landing_candidate_started_at,
      current_state.observed_at
    )
from public.flight_sessions as sessions
where current_state.flight_session_id = sessions.id
  and current_state.observation_status = 'landing_candidate';

-- Migration-first deploys briefly coexist with the legacy writer, which used
-- detected_landing_at for both confirmed landings and unknown closures. Keep
-- that writer valid until all old application instances have drained.
create or replace function public.normalize_legacy_flight_session_closure()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.closed_at is null
    and new.status = 'landed'
    and new.detected_landing_at is not null
  then
    new.landing_confirmed_at := coalesce(
      new.landing_confirmed_at,
      new.detected_landing_at
    );
    new.closed_at := new.landing_confirmed_at;
    new.end_reason := 'confirmed_landing';
  elsif new.closed_at is null
    and new.status = 'unknown'
    and new.detected_landing_at is not null
  then
    new.closed_at := new.detected_landing_at;
    new.end_reason := 'coverage_lost';
    new.detected_landing_at := null;
    new.landing_confirmed_at := null;
  end if;

  return new;
end;
$$;

create trigger flight_sessions_normalize_legacy_closure
before insert or update on public.flight_sessions
for each row execute function public.normalize_legacy_flight_session_closure();

revoke all on function public.normalize_legacy_flight_session_closure()
  from public, anon, authenticated;

alter table public.flight_sessions
  add constraint flight_sessions_end_reason_check
    check (
      end_reason is null
      or end_reason in ('confirmed_landing', 'coverage_lost', 'stale_session')
    ),
  add constraint flight_sessions_closed_pair_check
    check (
      (closed_at is null and end_reason is null)
      or (closed_at is not null and end_reason is not null)
    ),
  add constraint flight_sessions_open_status_check
    check (
      (closed_at is null and status in ('tracking', 'airborne'))
      or (closed_at is not null and status in ('landed', 'unknown'))
    ),
  add constraint flight_sessions_landed_metadata_check
    check (
      status <> 'landed'
      or (
        end_reason = 'confirmed_landing'
        and detected_landing_at is not null
        and landing_confirmed_at is not null
      )
    ),
  add constraint flight_sessions_unknown_metadata_check
    check (
      status <> 'unknown'
      or (
        end_reason in ('coverage_lost', 'stale_session')
        and detected_landing_at is null
        and landing_confirmed_at is null
      )
    ),
  add constraint flight_sessions_landing_confirmation_order_check
    check (
      landing_confirmed_at is null
      or (
        detected_landing_at is not null
        and landing_confirmed_at >= detected_landing_at
      )
    ),
  add constraint flight_sessions_closed_time_order_check
    check (
      closed_at is null
      or (
        closed_at >= tracking_started_at
        and (
          landing_confirmed_at is null
          or closed_at >= landing_confirmed_at
        )
      )
    );

drop index if exists public.flight_sessions_one_open_per_aircraft;
create unique index flight_sessions_one_open_per_aircraft
  on public.flight_sessions (aircraft_id)
  where closed_at is null;

create index flight_sessions_closed_at_idx
  on public.flight_sessions (closed_at)
  where closed_at is not null;

drop policy if exists "Active flight positions are readable"
  on public.aircraft_positions;
drop policy if exists "Recent positions are readable"
  on public.aircraft_positions;

create policy "Active flight positions are readable"
  on public.aircraft_positions for select to anon, authenticated
  using (
    flight_session_id is not null
    and exists (
      select 1
      from public.flight_sessions as sessions
      where sessions.id = aircraft_positions.flight_session_id
        and sessions.closed_at is null
    )
  );

create or replace function public.apply_aircraft_lifecycle_batch(
  input_sessions jsonb,
  input_state_rows jsonb,
  input_position_rows jsonb,
  input_finalizations jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  session_rows jsonb := coalesce(input_sessions, '[]'::jsonb);
  state_rows jsonb := coalesce(input_state_rows, '[]'::jsonb);
  position_rows jsonb := coalesce(input_position_rows, '[]'::jsonb);
  finalization_rows jsonb := coalesce(input_finalizations, '[]'::jsonb);
  locked_aircraft_id uuid;
  inserted_session_ids uuid[] := array[]::uuid[];
  inserted_position_aircraft_ids jsonb := '[]'::jsonb;
  sessions_inserted integer := 0;
  positions_backfilled integer := 0;
  positions_inserted integer := 0;
  sessions_finalized integer := 0;
begin
  if pg_catalog.jsonb_typeof(session_rows) <> 'array'
    or pg_catalog.jsonb_typeof(state_rows) <> 'array'
    or pg_catalog.jsonb_typeof(position_rows) <> 'array'
    or pg_catalog.jsonb_typeof(finalization_rows) <> 'array'
  then
    raise exception using
      errcode = '22023',
      message = 'Lifecycle batch inputs must be JSON arrays.';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(session_rows) as rows(
      id uuid,
      aircraft_id uuid,
      status text,
      tracking_started_at timestamptz,
      detected_takeoff_at timestamptz,
      last_seen_at timestamptz
    )
    where rows.id is null
      or rows.aircraft_id is null
      or rows.tracking_started_at is null
      or rows.last_seen_at is null
      or coalesce(rows.status, 'airborne') not in ('tracking', 'airborne')
  ) then
    raise exception using
      errcode = '22023',
      message = 'Each session row requires an id, aircraft_id, tracking timestamps, and an open status.';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(session_rows) as rows(
      id uuid,
      aircraft_id uuid
    )
    group by rows.aircraft_id
    having count(*) > 1
  ) or exists (
    select 1
    from pg_catalog.jsonb_to_recordset(session_rows) as rows(id uuid)
    group by rows.id
    having count(*) > 1
  ) then
    raise exception using
      errcode = '22023',
      message = 'A lifecycle batch may create at most one session per aircraft and session id.';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(state_rows) as rows(
      aircraft_id uuid,
      observation_status text
    )
    where rows.aircraft_id is null
      or rows.observation_status is null
      or rows.observation_status not in (
        'grounded',
        'airborne_candidate',
        'airborne',
        'landing_candidate',
        'unknown'
      )
  ) or exists (
    select 1
    from pg_catalog.jsonb_to_recordset(state_rows) as rows(aircraft_id uuid)
    group by rows.aircraft_id
    having count(*) > 1
  ) then
    raise exception using
      errcode = '22023',
      message = 'State rows require a unique aircraft_id and a valid observation_status.';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(position_rows) as rows(
      aircraft_id uuid,
      observed_at timestamptz,
      latitude double precision,
      longitude double precision,
      source text
    )
    where rows.aircraft_id is null
      or rows.observed_at is null
      or rows.latitude is null
      or rows.longitude is null
      or rows.source is null
  ) or exists (
    select 1
    from pg_catalog.jsonb_to_recordset(position_rows) as rows(aircraft_id uuid)
    group by rows.aircraft_id
    having count(*) > 1
  ) then
    raise exception using
      errcode = '22023',
      message = 'Position rows require complete coordinates and at most one row per aircraft.';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(finalization_rows) as rows(
      flight_session_id uuid,
      status text,
      closed_at timestamptz,
      end_reason text,
      detected_landing_at timestamptz,
      landing_confirmed_at timestamptz
    )
    where rows.flight_session_id is null
      or rows.closed_at is null
      or not coalesce((
        (
          rows.status = 'landed'
          and rows.end_reason = 'confirmed_landing'
          and rows.detected_landing_at is not null
          and rows.landing_confirmed_at is not null
          and rows.landing_confirmed_at >= rows.detected_landing_at
          and rows.closed_at >= rows.landing_confirmed_at
        )
        or (
          rows.status = 'unknown'
          and rows.end_reason in ('coverage_lost', 'stale_session')
          and rows.detected_landing_at is null
          and rows.landing_confirmed_at is null
        )
      ), false)
  ) or exists (
    select 1
    from pg_catalog.jsonb_to_recordset(finalization_rows) as rows(
      flight_session_id uuid
    )
    group by rows.flight_session_id
    having count(*) > 1
  ) then
    raise exception using
      errcode = '22023',
      message = 'Finalizations require one valid closure per flight_session_id.';
  end if;

  -- Serialize every affected aircraft in UUID order. Consistent lock ordering
  -- prevents two overlapping ingestion batches from deadlocking.
  for locked_aircraft_id in
    select distinct lock_ids.aircraft_id
    from (
      select rows.aircraft_id
      from pg_catalog.jsonb_to_recordset(session_rows) as rows(aircraft_id uuid)
      union all
      select rows.aircraft_id
      from pg_catalog.jsonb_to_recordset(state_rows) as rows(aircraft_id uuid)
      union all
      select rows.aircraft_id
      from pg_catalog.jsonb_to_recordset(position_rows) as rows(aircraft_id uuid)
      union all
      select sessions.aircraft_id
      from pg_catalog.jsonb_to_recordset(finalization_rows) as rows(
        flight_session_id uuid
      )
      join public.flight_sessions as sessions
        on sessions.id = rows.flight_session_id
    ) as lock_ids
    where lock_ids.aircraft_id is not null
    order by lock_ids.aircraft_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'aircraft_lifecycle:' || locked_aircraft_id::text,
        0
      )
    );
  end loop;

  with parsed_sessions as (
    select rows.*
    from pg_catalog.jsonb_to_recordset(session_rows) as rows(
      id uuid,
      aircraft_id uuid,
      status text,
      tracking_started_at timestamptz,
      detected_takeoff_at timestamptz,
      last_seen_at timestamptz,
      takeoff_time_source text,
      confidence text,
      starting_fuel_estimate_gal numeric,
      notes text,
      created_at timestamptz,
      updated_at timestamptz
    )
  ),
  inserted_sessions as (
    insert into public.flight_sessions (
      id,
      aircraft_id,
      status,
      tracking_started_at,
      detected_takeoff_at,
      last_seen_at,
      takeoff_time_source,
      confidence,
      starting_fuel_estimate_gal,
      notes,
      created_at,
      updated_at
    )
    select
      parsed_sessions.id,
      parsed_sessions.aircraft_id,
      coalesce(parsed_sessions.status, 'airborne'),
      parsed_sessions.tracking_started_at,
      parsed_sessions.detected_takeoff_at,
      parsed_sessions.last_seen_at,
      coalesce(parsed_sessions.takeoff_time_source, 'unknown'),
      coalesce(parsed_sessions.confidence, 'low'),
      parsed_sessions.starting_fuel_estimate_gal,
      parsed_sessions.notes,
      coalesce(parsed_sessions.created_at, now()),
      coalesce(parsed_sessions.updated_at, now())
    from parsed_sessions
    on conflict (id) do nothing
    returning id
  )
  select
    coalesce(
      pg_catalog.array_agg(inserted_sessions.id order by inserted_sessions.id),
      array[]::uuid[]
    ),
    count(*)::integer
  into inserted_session_ids, sessions_inserted
  from inserted_sessions;

  update public.aircraft_positions as positions
  set flight_session_id = sessions.id
  from public.flight_sessions as sessions
  where sessions.id = any(inserted_session_ids)
    and positions.aircraft_id = sessions.aircraft_id
    and positions.flight_session_id is null
    and positions.observed_at >= sessions.tracking_started_at
    and positions.observed_at <= sessions.last_seen_at;
  get diagnostics positions_backfilled = row_count;

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(state_rows) as rows(
      aircraft_id uuid,
      flight_session_id uuid
    )
    left join public.flight_sessions as sessions
      on sessions.id = rows.flight_session_id
    where rows.flight_session_id is not null
      and (
        sessions.id is null
        or sessions.aircraft_id <> rows.aircraft_id
        or sessions.closed_at is not null
      )
  ) then
    raise exception using
      errcode = '23503',
      message = 'A state row references a missing, closed, or different-aircraft session.';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(position_rows) as rows(
      aircraft_id uuid,
      flight_session_id uuid
    )
    left join public.flight_sessions as sessions
      on sessions.id = rows.flight_session_id
    where rows.flight_session_id is not null
      and (
        sessions.id is null
        or sessions.aircraft_id <> rows.aircraft_id
        or sessions.closed_at is not null
      )
  ) then
    raise exception using
      errcode = '23503',
      message = 'A position row references a missing, closed, or different-aircraft session.';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(finalization_rows) as rows(
      flight_session_id uuid
    )
    left join public.flight_sessions as sessions
      on sessions.id = rows.flight_session_id
    where sessions.id is null
  ) then
    raise exception using
      errcode = '23503',
      message = 'A finalization references a missing flight session.';
  end if;

  insert into public.aircraft_current_state as current_state (
    aircraft_id,
    flight_session_id,
    observation_status,
    consecutive_airborne,
    consecutive_grounded,
    current_state_code,
    observed_at,
    last_seen_at,
    last_grounded_at,
    last_airborne_at,
    airborne_candidate_started_at,
    landing_candidate_started_at,
    latitude,
    longitude,
    altitude_ft,
    ground_speed_kt,
    heading_deg,
    squawk,
    source,
    updated_at
  )
  select
    rows.aircraft_id,
    rows.flight_session_id,
    rows.observation_status,
    coalesce(rows.consecutive_airborne, 0),
    coalesce(rows.consecutive_grounded, 0),
    rows.current_state_code,
    rows.observed_at,
    rows.last_seen_at,
    rows.last_grounded_at,
    rows.last_airborne_at,
    rows.airborne_candidate_started_at,
    rows.landing_candidate_started_at,
    rows.latitude,
    rows.longitude,
    rows.altitude_ft,
    rows.ground_speed_kt,
    rows.heading_deg,
    rows.squawk,
    rows.source,
    coalesce(rows.updated_at, now())
  from pg_catalog.jsonb_to_recordset(state_rows) as rows(
    aircraft_id uuid,
    flight_session_id uuid,
    observation_status text,
    consecutive_airborne smallint,
    consecutive_grounded smallint,
    current_state_code text,
    observed_at timestamptz,
    last_seen_at timestamptz,
    last_grounded_at timestamptz,
    last_airborne_at timestamptz,
    airborne_candidate_started_at timestamptz,
    landing_candidate_started_at timestamptz,
    latitude double precision,
    longitude double precision,
    altitude_ft integer,
    ground_speed_kt real,
    heading_deg real,
    squawk text,
    source text,
    updated_at timestamptz
  )
  on conflict (aircraft_id) do update
  set flight_session_id = excluded.flight_session_id,
      observation_status = excluded.observation_status,
      consecutive_airborne = excluded.consecutive_airborne,
      consecutive_grounded = excluded.consecutive_grounded,
      current_state_code = excluded.current_state_code,
      observed_at = excluded.observed_at,
      last_seen_at = excluded.last_seen_at,
      last_grounded_at = excluded.last_grounded_at,
      last_airborne_at = excluded.last_airborne_at,
      airborne_candidate_started_at = excluded.airborne_candidate_started_at,
      landing_candidate_started_at = excluded.landing_candidate_started_at,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      altitude_ft = excluded.altitude_ft,
      ground_speed_kt = excluded.ground_speed_kt,
      heading_deg = excluded.heading_deg,
      squawk = excluded.squawk,
      source = excluded.source,
      updated_at = excluded.updated_at
  where excluded.updated_at >= current_state.updated_at;

  -- Current-state rows are also the active-session heartbeat. Grounded
  -- candidates remain airborne until the confirmation row finalizes them.
  update public.flight_sessions as sessions
  set status = case
        when rows.observation_status in ('airborne', 'landing_candidate')
          then 'airborne'
        else sessions.status
      end,
      last_seen_at = greatest(
        sessions.last_seen_at,
        coalesce(rows.last_seen_at, rows.observed_at, sessions.last_seen_at)
      ),
      updated_at = greatest(
        sessions.updated_at,
        coalesce(rows.updated_at, now())
      )
  from pg_catalog.jsonb_to_recordset(state_rows) as rows(
    aircraft_id uuid,
    flight_session_id uuid,
    observation_status text,
    observed_at timestamptz,
    last_seen_at timestamptz,
    updated_at timestamptz
  )
  where rows.flight_session_id = sessions.id
    and rows.aircraft_id = sessions.aircraft_id
    and sessions.closed_at is null;

  with inserted_positions as (
    insert into public.aircraft_positions (
      aircraft_id,
      flight_session_id,
      observed_at,
      latitude,
      longitude,
      altitude_ft,
      ground_speed_kt,
      heading_deg,
      source
    )
    select
      rows.aircraft_id,
      rows.flight_session_id,
      rows.observed_at,
      rows.latitude,
      rows.longitude,
      rows.altitude_ft,
      rows.ground_speed_kt,
      rows.heading_deg,
      rows.source
    from pg_catalog.jsonb_to_recordset(position_rows) as rows(
      aircraft_id uuid,
      flight_session_id uuid,
      observed_at timestamptz,
      latitude double precision,
      longitude double precision,
      altitude_ft integer,
      ground_speed_kt real,
      heading_deg real,
      source text
    )
    on conflict (aircraft_id, observed_at) do nothing
    returning aircraft_id
  )
  select
    count(*)::integer,
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(inserted_positions.aircraft_id)
        order by inserted_positions.aircraft_id
      ),
      '[]'::jsonb
    )
  into positions_inserted, inserted_position_aircraft_ids
  from inserted_positions;

  with parsed_finalizations as (
    select rows.*
    from pg_catalog.jsonb_to_recordset(finalization_rows) as rows(
      flight_session_id uuid,
      status text,
      closed_at timestamptz,
      end_reason text,
      detected_landing_at timestamptz,
      landing_confirmed_at timestamptz
    )
  ),
  finalized_sessions as (
    update public.flight_sessions as sessions
    set status = parsed_finalizations.status,
        detected_landing_at = parsed_finalizations.detected_landing_at,
        landing_confirmed_at = parsed_finalizations.landing_confirmed_at,
        closed_at = parsed_finalizations.closed_at,
        end_reason = parsed_finalizations.end_reason,
        last_seen_at = greatest(
          sessions.last_seen_at,
          coalesce(
            parsed_finalizations.landing_confirmed_at,
            parsed_finalizations.closed_at
          )
        ),
        updated_at = now()
    from parsed_finalizations
    where sessions.id = parsed_finalizations.flight_session_id
      and sessions.closed_at is null
      and sessions.last_seen_at <= parsed_finalizations.closed_at
    returning sessions.id, sessions.status
  ),
  cleared_states as (
    update public.aircraft_current_state as current_state
    set flight_session_id = null,
        observation_status = case
          when finalized_sessions.status = 'landed' then 'grounded'
          else 'unknown'
        end,
        consecutive_airborne = 0,
        airborne_candidate_started_at = null,
        landing_candidate_started_at = null,
        updated_at = now()
    from finalized_sessions
    where current_state.flight_session_id = finalized_sessions.id
    returning current_state.aircraft_id
  ),
  purged_positions as (
    delete from public.aircraft_positions as positions
    using finalized_sessions
    where positions.flight_session_id = finalized_sessions.id
    returning positions.id
  )
  select count(*)::integer
  into sessions_finalized
  from finalized_sessions;

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(finalization_rows) as rows(
      flight_session_id uuid
    )
    join public.flight_sessions as sessions
      on sessions.id = rows.flight_session_id
    where sessions.closed_at is null
  ) then
    raise exception using
      errcode = '40001',
      message = 'A session received a newer heartbeat than its requested finalization.';
  end if;

  return pg_catalog.jsonb_build_object(
    'inserted_aircraft_ids', inserted_position_aircraft_ids,
    'positions_inserted', positions_inserted,
    'positions_backfilled', positions_backfilled,
    'sessions_inserted', sessions_inserted,
    'sessions_finalized', sessions_finalized
  );
end;
$$;

revoke all on function public.apply_aircraft_lifecycle_batch(
  jsonb,
  jsonb,
  jsonb,
  jsonb
) from public, anon, authenticated;
grant execute on function public.apply_aircraft_lifecycle_batch(
  jsonb,
  jsonb,
  jsonb,
  jsonb
) to service_role;

-- Keep closed session metadata for the same seven-day window used by recent
-- flight reads. Positions still remain operational data and are purged when a
-- session closes; orphan candidate positions receive a one-hour safety cleanup.
create or replace function public.cleanup_expired_operational_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  positions_deleted integer;
  cache_deleted integer;
  ingestion_runs_deleted integer;
  notification_worker_runs_deleted integer;
  flight_sessions_deleted integer;
begin
  update public.notification_deliveries
  set status = 'failed',
      next_attempt_at = now(),
      failure_reason = 'processing_lease_expired',
      claim_token = null,
      updated_at = now()
  where status = 'processing'
    and claimed_at < now() - interval '5 minutes';

  delete from public.aircraft_positions as positions
  where (
      positions.flight_session_id is null
      and positions.observed_at < now() - interval '1 hour'
    )
    or exists (
      select 1
      from public.flight_sessions as sessions
      where sessions.id = positions.flight_session_id
        and sessions.closed_at is not null
    );
  get diagnostics positions_deleted = row_count;

  delete from public.runtime_cache
  where expires_at is not null and expires_at <= now();
  get diagnostics cache_deleted = row_count;

  delete from public.notification_deliveries
  where created_at < now() - interval '30 days';

  delete from public.ingestion_runs
  where started_at < now() - interval '7 days';
  get diagnostics ingestion_runs_deleted = row_count;

  delete from public.notification_worker_runs
  where started_at < now() - interval '7 days';
  get diagnostics notification_worker_runs_deleted = row_count;

  delete from public.flight_sessions as sessions
  where sessions.closed_at < now() - interval '7 days'
    and not exists (
      select 1
      from public.notification_events as events
      join public.notification_deliveries as deliveries
        on deliveries.notification_event_id = events.id
      where events.flight_session_id = sessions.id
        and deliveries.status in ('pending', 'processing', 'failed')
    );
  get diagnostics flight_sessions_deleted = row_count;

  delete from public.spots
  where observed_at < now() - interval '7 days';

  return pg_catalog.jsonb_build_object(
    'positions_deleted', positions_deleted,
    'cache_deleted', cache_deleted,
    'ingestion_runs_deleted', ingestion_runs_deleted,
    'notification_worker_runs_deleted', notification_worker_runs_deleted,
    'flight_sessions_deleted', flight_sessions_deleted
  );
end;
$$;

revoke execute on function public.cleanup_expired_operational_data()
  from public, anon, authenticated;
grant execute on function public.cleanup_expired_operational_data()
  to service_role;
alter table public.push_endpoints
  add column transport text not null default 'web_push'
    check (transport in ('web_push', 'fcm'));

alter table public.push_endpoints
  alter column p256dh drop not null,
  alter column auth drop not null;

alter table public.push_endpoints
  add constraint push_endpoints_transport_credentials_check
  check (
    (transport = 'web_push' and p256dh is not null and auth is not null)
    or
    (transport = 'fcm' and p256dh is null and auth is null)
  );

comment on column public.push_endpoints.transport is
  'Delivery provider: web_push for VAPID subscriptions or fcm for Capacitor Android tokens.';
-- Device preferences retain exclusions for every state; an empty map tracks all.
alter table public.notification_subscriptions
  add column if not exists excluded_aircraft_by_state jsonb not null default '{}'::jsonb
  check (jsonb_typeof(excluded_aircraft_by_state) = 'object');

comment on column public.notification_subscriptions.excluded_aircraft_by_state
  is 'Aircraft tail numbers excluded from tracking and takeoff alerts, keyed by state code.';
-- The worker reads its last five minutes of batches before sampling aircraft.
-- Avoid scanning the entire seven-day history on every worker/API request.
create index if not exists ingestion_runs_started_at_idx
  on public.ingestion_runs (started_at desc);


