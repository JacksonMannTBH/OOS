-- Icon belongs to one shared sighting. Existing and older-client reports stay police.
alter table public.oos_police_sightings add column icon text not null default 'police'
  constraint oos_police_sightings_icon_check check (icon in ('police', 'pig'));

create or replace function public.oos_police_read(p_state text) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'stateCode', s.state_code, 'lat', latest.lat, 'lon', latest.lon,
    'reportCount', tally.positive, 'lastReportedAt', extract(epoch from latest.created_at) * 1000,
    'expiresAt', extract(epoch from tally.expires_at) * 1000, 'icon', s.icon
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

-- Reuse all existing proximity, grouping, duplicate, expiry, cooldown and lock rules.
-- The original RPC retains its signature and service-only privileges for old clients.
create function public.oos_police_submit_icon(p_reporter text, p_state text,
  p_lat double precision, p_lon double precision, p_sighting uuid, p_vote text,
  p_require_new boolean, p_icon text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_result jsonb;
begin
  if p_icon is null or p_icon not in ('police', 'pig') then
    raise exception 'invalid_icon';
  end if;
  v_result := public.oos_police_submit(p_reporter,p_state,p_lat,p_lon,p_sighting,p_vote,p_require_new);
  -- Only a newly accepted positive report may mark its one sighting as a pig.
  -- Duplicates, negative votes, cooldowns and confirmation prompts cannot change it.
  if p_icon = 'pig' and p_vote = 'still_here' and v_result->>'status' in ('reported','voted') then
    update public.oos_police_sightings set icon = 'pig'
      where id = (v_result->>'sightingId')::uuid;
  end if;
  return v_result;
end;
$$;
revoke all on function public.oos_police_submit_icon(text,text,double precision,double precision,uuid,text,boolean,text) from public,anon,authenticated;
grant execute on function public.oos_police_submit_icon(text,text,double precision,double precision,uuid,text,boolean,text) to service_role;
