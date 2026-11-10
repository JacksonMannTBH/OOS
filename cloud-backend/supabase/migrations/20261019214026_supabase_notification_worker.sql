-- Keep the scheduler's token in Vault; only a digest is visible to the worker.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'oos_notification_worker_token') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'),
      'oos_notification_worker_token', 'Private OOS scheduled notification credential');
  end if;
end;
$$;

insert into public.app_settings(key, value)
select 'notification_worker_token_hash',
  to_jsonb(encode(extensions.digest(decrypted_secret, 'sha256'), 'hex'))
from vault.decrypted_secrets where name = 'oos_notification_worker_token'
on conflict (key) do update set value = excluded.value, updated_at = now();

insert into public.app_settings(key, value) values ('notification_worker_backend', '"netlify"')
on conflict (key) do nothing;

create or replace function public.queue_oos_notifications(dry_run boolean default false)
returns bigint
language sql
security invoker
set search_path = ''
as $$
  select net.http_post(
    url := 'https://ohhixakjamjocgmatbha.supabase.co/functions/v1/oos-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-oos-notification-token', (select decrypted_secret from vault.decrypted_secrets
        where name = 'oos_notification_worker_token')
    ),
    body := jsonb_build_object('dryRun', dry_run),
    timeout_milliseconds := 60000
  );
$$;
revoke all on function public.queue_oos_notifications(boolean) from public, anon, authenticated, service_role;

select cron.schedule('oos-notifications-minute', '* * * * *', 'select public.queue_oos_notifications()');
-- Activate separately after both push providers and a dry run pass verification.
select cron.alter_job(jobid, active := false) from cron.job where jobname = 'oos-notifications-minute';

select cron.schedule('oos-cron-log-retention', '17 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'
    and jobid in (select jobid from cron.job where jobname in
      ('oos-adsblol-30s','oos-notifications-minute','oos-cron-log-retention','cleanup-expired-operational-data'));$$);
