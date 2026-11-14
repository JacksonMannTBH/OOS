-- Service-only helpers. Public clients continue to use the existing app routes.
create index if not exists ingestion_runs_finished_at_idx
  on public.ingestion_runs(finished_at desc) where finished_at is not null;

create or replace function public.resolve_aircraft_states_batch(input_positions jsonb)
returns table(aircraft_id text, state_code text)
language sql stable security invoker set search_path = ''
as $$
  select p.aircraft_id, public.resolve_state_code(p.latitude, p.longitude)
  from pg_catalog.jsonb_to_recordset(input_positions)
    as p(aircraft_id text, latitude double precision, longitude double precision);
$$;

create or replace function public.read_prepared_aircraft_response(input_key text, input_owner text)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  generation text;
  cached jsonb;
begin
  if input_key <> 'oos-prepared-v1:nationwide'
    and input_key !~ '^oos-prepared-v1:(live|aircraft):[A-Z]{2}$' then
    raise exception 'Invalid prepared response key';
  end if;
  select r.finished_at::text || ':' || r.status into generation
  from public.ingestion_runs r where r.finished_at is not null
  order by r.finished_at desc limit 1;
  generation := coalesce(generation, 'none');
  select c.value->'payload' into cached from public.runtime_cache c
  where c.key = input_key and c.expires_at > now()
    and c.value->>'generation' = generation;
  if cached is not null and cached <> 'null'::jsonb then
    return pg_catalog.jsonb_build_object('status', 'ready', 'payload', cached);
  end if;
  if public.claim_worker_lease('prepared:' || input_key, input_owner, 15) then
    return pg_catalog.jsonb_build_object('status', 'claimed', 'generation', generation);
  end if;
  return pg_catalog.jsonb_build_object('status', 'busy');
end;
$$;

create or replace function public.finish_prepared_aircraft_response(
  input_key text, input_owner text, input_generation text, input_payload jsonb
)
returns boolean language plpgsql security invoker set search_path = ''
as $$
declare
  generation text;
  saved boolean := false;
begin
  if input_key <> 'oos-prepared-v1:nationwide'
    and input_key !~ '^oos-prepared-v1:(live|aircraft):[A-Z]{2}$' then
    raise exception 'Invalid prepared response key';
  end if;
  -- A slow builder cannot replace a newer worker's result or release its lease.
  perform 1 from public.worker_leases
  where name = 'prepared:' || input_key and owner = input_owner and expires_at > now()
  for update;
  if not found then return false; end if;
  select r.finished_at::text || ':' || r.status into generation
  from public.ingestion_runs r where r.finished_at is not null
  order by r.finished_at desc limit 1;
  generation := coalesce(generation, 'none');
  if input_payload is not null and input_payload <> 'null'::jsonb and input_generation = generation then
    insert into public.runtime_cache(key, value, expires_at, updated_at)
    values(input_key, pg_catalog.jsonb_build_object('generation', generation, 'payload', input_payload),
      now() + interval '30 seconds', now())
    on conflict(key) do update set value = excluded.value, expires_at = excluded.expires_at, updated_at = excluded.updated_at;
    saved := true;
  end if;
  perform public.release_worker_lease('prepared:' || input_key, input_owner);
  return saved;
end;
$$;

revoke all on function public.resolve_aircraft_states_batch(jsonb) from public, anon, authenticated;
revoke all on function public.read_prepared_aircraft_response(text,text) from public, anon, authenticated;
revoke all on function public.finish_prepared_aircraft_response(text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.resolve_aircraft_states_batch(jsonb) to service_role;
grant execute on function public.read_prepared_aircraft_response(text,text) to service_role;
grant execute on function public.finish_prepared_aircraft_response(text,text,text,jsonb) to service_role;
