create index if not exists ingestion_runs_started_at_idx
  on public.ingestion_runs (started_at desc);

create index if not exists ingestion_runs_skipped_started_at_idx
  on public.ingestion_runs (started_at desc)
  where status = 'skipped';

create index if not exists ingestion_runs_successful_started_at_idx
  on public.ingestion_runs (started_at desc)
  where status in ('succeeded', 'partial') and finished_at is not null;

create index if not exists notification_worker_runs_started_at_idx
  on public.notification_worker_runs (started_at desc);

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
  where started_at < now() - interval '7 days';
  get diagnostics ingestion_runs_deleted = row_count;

  delete from public.notification_worker_runs
  where started_at < now() - interval '7 days';
  get diagnostics notification_worker_runs_deleted = row_count;

  delete from public.spots
  where observed_at < now() - interval '7 days';

  return jsonb_build_object(
    'positions_deleted', positions_deleted,
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
