-- Preserve old clients: an ordinary report remains a positive confirmation.
alter table public.oos_police_reports add column vote text not null default 'still_here'
  check (vote in ('still_here', 'not_seen'));
alter table public.oos_police_sightings add column removed_at timestamptz;
create index oos_police_reports_voter on public.oos_police_reports(sighting_id, reporter_hash);

create or replace function public.oos_police_read(p_state text) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'stateCode', s.state_code, 'lat', latest.lat, 'lon', latest.lon,
    'reportCount', tally.positive, 'lastReportedAt', extract(epoch from latest.created_at) * 1000,
    'expiresAt', extract(epoch from tally.expires_at) * 1000
  ) order by latest.created_at desc), '[]'::jsonb)
  from public.oos_police_sightings s
  cross join lateral (
    select count(distinct reporter_hash) filter (where vote = 'still_here') positive,
      count(distinct reporter_hash) filter (where vote = 'not_seen') negative,
      max(expires_at) filter (where vote = 'still_here') expires_at
    from public.oos_police_reports where sighting_id = s.id and not withdrawn
  ) tally
  cross join lateral (
    select lat, lon, created_at from public.oos_police_reports
    where sighting_id = s.id and vote = 'still_here' and not withdrawn order by created_at desc, id limit 1
  ) latest
  where s.state_code = p_state and s.removed_at is null and tally.expires_at > now()
    and tally.positive > 0 and tally.negative < 2 * tally.positive;
$$;

-- A fresh, read-only proximity check before the client decides which dialog to show.
create function public.oos_police_prepare(p_state text, p_lat double precision, p_lon double precision) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce((
    select jsonb_build_object('status', 'nearby', 'sightingId', s.id)
    from public.oos_police_sightings s
    where s.state_code = p_state and s.removed_at is null
      and extensions.st_dwithin(s.anchor, extensions.st_setsrid(extensions.st_makepoint(p_lon,p_lat),4326)::extensions.geography,402.336)
      and exists(select 1 from jsonb_array_elements(public.oos_police_read(p_state)) item where item->>'id' = s.id::text)
    order by extensions.st_distance(s.anchor, extensions.st_setsrid(extensions.st_makepoint(p_lon,p_lat),4326)::extensions.geography),s.created_at,s.id limit 1
  ), jsonb_build_object('status', 'clear'));
$$;

create function public.oos_police_submit(p_reporter text, p_state text, p_lat double precision, p_lon double precision,
  p_sighting uuid, p_vote text, p_require_new boolean) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_point extensions.geography := extensions.st_setsrid(extensions.st_makepoint(p_lon,p_lat),4326)::extensions.geography;
  v_sighting uuid;
  v_existing uuid;
  v_report uuid;
  v_remaining integer;
  v_positive bigint;
  v_negative bigint;
  v_removed boolean := false;
begin
  if p_reporter is null or p_reporter !~ '^[a-f0-9]{64}$' or p_state is null or p_state !~ '^[A-Z]{2}$'
    or p_lat is null or p_lon is null or p_lat not between -90 and 90 or p_lon not between -180 and 180
    or p_vote is null or p_vote not in ('still_here','not_seen') or (p_sighting is null and p_vote = 'not_seen') then
    raise exception 'invalid_report';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('police-rider:' || p_reporter,0));
  perform pg_advisory_xact_lock(hashtextextended('police-state:' || p_state,0));
  if p_sighting is not null then
    select s.id into v_sighting from public.oos_police_sightings s where s.id = p_sighting
      and s.state_code = p_state and s.removed_at is null
      and exists(select 1 from jsonb_array_elements(public.oos_police_read(p_state)) item where item->>'id' = s.id::text);
    if v_sighting is null then return jsonb_build_object('status','gone'); end if;
    if not exists(select 1 from public.oos_police_sightings where id = v_sighting and extensions.st_dwithin(anchor,v_point,402.336)) then
      return jsonb_build_object('status','too_far');
    end if;
  else
    select (public.oos_police_prepare(p_state,p_lat,p_lon)->>'sightingId')::uuid into v_sighting;
    -- A new sighting may have appeared after preparation: ask, never silently vote.
    if v_sighting is not null and p_require_new then
      return jsonb_build_object('status','confirmation_required','sightingId',v_sighting);
    end if;
  end if;
  if v_sighting is not null then
    select id into v_existing from public.oos_police_reports where sighting_id = v_sighting and reporter_hash = p_reporter limit 1;
    if v_existing is not null then return jsonb_build_object('status','duplicate','sightingId',v_sighting); end if;
  end if;
  v_remaining := public.oos_police_cooldown(p_reporter);
  if v_remaining > 0 then return jsonb_build_object('status','cooldown','retryAfterMs',v_remaining); end if;
  if v_sighting is null then
    insert into public.oos_police_sightings(state_code,anchor) values(p_state,v_point) returning id into v_sighting;
  end if;
  insert into public.oos_police_reports(sighting_id,reporter_hash,lat,lon,vote)
    values(v_sighting,p_reporter,p_lat,p_lon,p_vote) returning id into v_report;
  select count(distinct reporter_hash) filter (where vote = 'still_here'), count(distinct reporter_hash) filter (where vote = 'not_seen')
    into v_positive,v_negative from public.oos_police_reports where sighting_id = v_sighting and not withdrawn;
  if v_negative >= 2 * v_positive then
    update public.oos_police_sightings set removed_at = now() where id = v_sighting;
    v_removed := true;
  end if;
  return jsonb_build_object('status',case when p_sighting is null then 'reported' else 'voted' end,
    'sightingId',v_sighting,'reportId',v_report,'stateCode',p_state,'retryAfterMs',30000,'removed',v_removed);
end;
$$;

create or replace function public.oos_police_report(p_reporter text,p_state text,p_lat double precision,p_lon double precision) returns jsonb
language sql security invoker set search_path = '' as $$
  select public.oos_police_submit(p_reporter,p_state,p_lat,p_lon,null,'still_here',false);
$$;

-- Old clients' withdrawal endpoint stays available, with the same lock order as voting.
create or replace function public.oos_police_withdraw(p_reporter text,p_report_id uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_state text; v_sighting uuid; v_positive bigint; v_negative bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('police-rider:' || p_reporter,0));
  select s.state_code,s.id into v_state,v_sighting from public.oos_police_reports r
    join public.oos_police_sightings s on s.id=r.sighting_id where r.id=p_report_id and r.reporter_hash=p_reporter;
  if v_state is not null then
    perform pg_advisory_xact_lock(hashtextextended('police-state:' || v_state,0));
    update public.oos_police_reports set withdrawn=true where id=p_report_id and reporter_hash=p_reporter;
    select count(distinct reporter_hash) filter(where vote='still_here'),count(distinct reporter_hash) filter(where vote='not_seen')
      into v_positive,v_negative from public.oos_police_reports where sighting_id=v_sighting and not withdrawn;
    if v_negative >= 2*v_positive then
      update public.oos_police_sightings set removed_at=coalesce(removed_at,now()) where id=v_sighting;
    end if;
  end if;
  return jsonb_build_object('status','withdrawn');
end;
$$;

revoke all on function public.oos_police_prepare(text,double precision,double precision), public.oos_police_submit(text,text,double precision,double precision,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.oos_police_prepare(text,double precision,double precision), public.oos_police_submit(text,text,double precision,double precision,uuid,text,boolean) to service_role;

-- Keep every voter's identity for the lifetime of an extended sighting. Only a
-- positive vote extends its expiry. Removed sightings cannot resurrect; retain
-- their rows for 30 minutes so removal cannot bypass the per-device cooldown.
select cron.schedule('oos-police-expiry','* * * * *',$job$
  delete from public.oos_police_sightings s
  where (s.removed_at is not null and s.removed_at <= now()-interval '30 minutes')
    or (s.removed_at is null and not exists(select 1 from public.oos_police_reports r
      where r.sighting_id=s.id and r.vote='still_here' and not r.withdrawn and r.expires_at>now())
      and not exists(select 1 from public.oos_police_reports r where r.sighting_id=s.id and r.created_at>now()-interval '30 seconds'));
$job$);
