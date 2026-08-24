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
