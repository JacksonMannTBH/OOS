-- Additive: no changes to aircraft, notifications, or existing API objects.
create table public.oos_police_sightings (
  id uuid primary key default gen_random_uuid(),
  state_code text not null check (state_code ~ '^[A-Z]{2}$'),
  anchor extensions.geography(point,4326) not null,
  created_at timestamptz not null default now()
);
create index oos_police_sightings_area on public.oos_police_sightings using gist(anchor);
create index oos_police_sightings_state on public.oos_police_sightings(state_code);
create table public.oos_police_reports (
  id uuid primary key default gen_random_uuid(),
  sighting_id uuid not null references public.oos_police_sightings(id) on delete cascade,
  reporter_hash text not null check (reporter_hash ~ '^[a-f0-9]{64}$'),
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  withdrawn boolean not null default false
);
create index oos_police_reports_sighting on public.oos_police_reports(sighting_id, expires_at);
create index oos_police_reports_reporter on public.oos_police_reports(reporter_hash, created_at desc);
create index oos_police_reports_expiry on public.oos_police_reports(expires_at);
alter table public.oos_police_sightings enable row level security;
alter table public.oos_police_reports enable row level security;
revoke all on public.oos_police_sightings, public.oos_police_reports from public, anon, authenticated;
grant all on public.oos_police_sightings, public.oos_police_reports to service_role;
create policy police_server_only on public.oos_police_sightings to service_role using (true) with check (true);
create policy police_server_only on public.oos_police_reports to service_role using (true) with check (true);

create function public.oos_police_cooldown(p_reporter text) returns integer
language sql stable security invoker set search_path = '' as $$
  select coalesce(greatest(0, ceil(extract(epoch from (max(created_at) + interval '30 seconds' - now())) * 1000)::integer), 0)
  from public.oos_police_reports where reporter_hash = p_reporter and created_at > now() - interval '30 seconds';
$$;

create function public.oos_police_read(p_state text) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'stateCode', s.state_code, 'lat', latest.lat, 'lon', latest.lon,
    'reportCount', active.n, 'lastReportedAt', extract(epoch from latest.created_at) * 1000,
    'expiresAt', extract(epoch from active.expires_at) * 1000
  ) order by latest.created_at desc), '[]'::jsonb)
  from public.oos_police_sightings s
  cross join lateral (
    select count(*) n, max(expires_at) expires_at from public.oos_police_reports
    where sighting_id = s.id and expires_at > now() and not withdrawn
  ) active
  cross join lateral (
    select lat, lon, created_at from public.oos_police_reports
    where sighting_id = s.id and expires_at > now() and not withdrawn order by created_at desc, id limit 1
  ) latest
  where s.state_code = p_state and active.n > 0;
$$;

create function public.oos_police_report(p_reporter text, p_state text, p_lat double precision, p_lon double precision) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_point extensions.geography := extensions.st_setsrid(extensions.st_makepoint(p_lon, p_lat),4326)::extensions.geography;
  v_sighting uuid;
  v_existing uuid;
  v_report uuid;
  v_remaining integer;
begin
  if p_reporter !~ '^[a-f0-9]{64}$' or p_state !~ '^[A-Z]{2}$' or p_lat not between -90 and 90 or p_lon not between -180 and 180 then
    raise exception 'invalid_report';
  end if;
  -- Serialize a rider across states, then matching within a state. Prevents
  -- simultaneous taps and two first reporters from creating duplicate clusters.
  perform pg_advisory_xact_lock(hashtextextended('police-rider:' || p_reporter, 0));
  perform pg_advisory_xact_lock(hashtextextended('police-state:' || p_state, 0));
  select s.id into v_sighting from public.oos_police_sightings s
    where s.state_code = p_state and extensions.st_dwithin(s.anchor, v_point, 402.336)
      and exists(select 1 from public.oos_police_reports r where r.sighting_id = s.id and r.expires_at > now() and not r.withdrawn)
    order by extensions.st_distance(s.anchor, v_point), s.created_at, s.id limit 1;
  if v_sighting is not null then
    select id into v_existing from public.oos_police_reports where sighting_id = v_sighting
      and reporter_hash = p_reporter and expires_at > now() and not withdrawn limit 1;
    if v_existing is not null then
      return jsonb_build_object('status', 'duplicate', 'sightingId', v_sighting);
    end if;
  end if;
  v_remaining := public.oos_police_cooldown(p_reporter);
  if v_remaining > 0 then return jsonb_build_object('status', 'cooldown', 'retryAfterMs', v_remaining); end if;
  if v_sighting is null then
    insert into public.oos_police_sightings(state_code, anchor) values (p_state, v_point) returning id into v_sighting;
  end if;
  insert into public.oos_police_reports(sighting_id, reporter_hash, lat, lon)
    values(v_sighting, p_reporter, p_lat, p_lon) returning id into v_report;
  return jsonb_build_object('status', 'reported', 'sightingId', v_sighting, 'reportId', v_report, 'stateCode', p_state, 'retryAfterMs', 30000);
end;
$$;

create function public.oos_police_withdraw(p_reporter text, p_report_id uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('police-rider:' || p_reporter, 0));
  update public.oos_police_reports set withdrawn = true where id = p_report_id and reporter_hash = p_reporter;
  return jsonb_build_object('status','withdrawn');
end;
$$;

revoke all on function public.oos_police_cooldown(text), public.oos_police_read(text), public.oos_police_report(text,text,double precision,double precision), public.oos_police_withdraw(text,uuid) from public, anon, authenticated;
grant execute on function public.oos_police_cooldown(text), public.oos_police_read(text), public.oos_police_report(text,text,double precision,double precision), public.oos_police_withdraw(text,uuid) to service_role;

-- Expiration is enforced on every read; physical deletion follows within a minute.
select cron.schedule('oos-police-expiry', '* * * * *', $job$
  delete from public.oos_police_reports where expires_at <= now();
  delete from public.oos_police_sightings s where not exists (select 1 from public.oos_police_reports r where r.sighting_id = s.id);
$job$);
