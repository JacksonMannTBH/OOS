-- Next build: prepare and support/deny share the 0.3 statute mile radius.
-- CREATE OR REPLACE preserves the existing service-role-only grants.
create or replace function public.oos_police_prepare(p_state text, p_lat double precision, p_lon double precision) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce((
    select jsonb_build_object('status', 'nearby', 'sightingId', s.id)
    from public.oos_police_sightings s
    where s.state_code = p_state and s.removed_at is null
      and extensions.st_dwithin(s.anchor, extensions.st_setsrid(extensions.st_makepoint(p_lon,p_lat),4326)::extensions.geography,482.8032)
      and exists(select 1 from jsonb_array_elements(public.oos_police_read(p_state)) item where item->>'id' = s.id::text)
    order by extensions.st_distance(s.anchor, extensions.st_setsrid(extensions.st_makepoint(p_lon,p_lat),4326)::extensions.geography),s.created_at,s.id limit 1
  ), jsonb_build_object('status', 'clear'));
$$;

create or replace function public.oos_police_submit(p_reporter text, p_state text, p_lat double precision, p_lon double precision,
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
    if not exists(select 1 from public.oos_police_sightings where id = v_sighting and extensions.st_dwithin(anchor,v_point,482.8032)) then
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
