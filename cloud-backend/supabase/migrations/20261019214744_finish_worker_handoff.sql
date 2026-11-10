-- Apply only after authenticated dry-run checks and credential transfer pass.
create or replace function public.queue_oos_predictor()
returns bigint
language sql
security invoker
set search_path = ''
as $$
  select net.http_post(
    url := 'https://ohhixakjamjocgmatbha.supabase.co/functions/v1/oos-predictor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-oos-notification-token', (select decrypted_secret from vault.decrypted_secrets
        where name = 'oos_notification_worker_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$;
revoke all on function public.queue_oos_predictor() from public, anon, authenticated, service_role;

update public.app_settings set value = '"supabase"', updated_at = now()
where key = 'notification_worker_backend';
select cron.alter_job(jobid, active := true) from cron.job where jobname = 'oos-notifications-minute';
select cron.schedule('oos-predictor-hourly', '17 * * * *', 'select public.queue_oos_predictor()');

select cron.schedule('oos-cron-log-retention', '17 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'
    and jobid in (select jobid from cron.job where jobname in
      ('oos-adsblol-30s','oos-notifications-minute','oos-predictor-hourly',
       'oos-cron-log-retention','cleanup-expired-operational-data'));$$);
