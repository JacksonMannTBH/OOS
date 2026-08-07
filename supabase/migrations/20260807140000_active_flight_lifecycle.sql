-- Flight data is operational state, not a historical archive. Completed flight
-- sessions and their cascaded position/notification rows are removed by the
-- ingestion flow at confirmed landing.

delete from public.flight_sessions
where detected_landing_at is not null;

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
  where sessions.detected_landing_at is not null
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
