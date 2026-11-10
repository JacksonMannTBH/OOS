create extension if not exists pg_net with schema extensions;

-- Generate the cron credential inside Vault; only its hash is needed by the
-- ingestion function. Neither credential is sent to public clients.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'oos_adsblol_ingest_token') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'),
      'oos_adsblol_ingest_token', 'Private OOS scheduled ingestion credential');
  end if;
end;
$$;

insert into public.app_settings(key, value)
select 'adsblol_ingest_token_hash',
  to_jsonb(encode(extensions.digest(decrypted_secret, 'sha256'), 'hex'))
from vault.decrypted_secrets where name = 'oos_adsblol_ingest_token'
on conflict (key) do update set value = excluded.value, updated_at = now();

insert into public.app_settings(key, value) values
  ('adsblol_poll_control', '{"failures":0,"next_allowed_at":0}'),
  ('adsblol_backend', '{"states":["WA","CA"],"interval_seconds":30,"provider":"adsblol"}')
on conflict (key) do nothing;

create or replace function public.queue_adsblol_poll()
returns bigint
language sql
security invoker
set search_path = ''
as $$
  select net.http_post(
    url := 'https://ohhixakjamjocgmatbha.supabase.co/functions/v1/oos-ingest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-oos-ingest-token', (select decrypted_secret from vault.decrypted_secrets
        where name = 'oos_adsblol_ingest_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
$$;
revoke all on function public.queue_adsblol_poll() from public, anon, authenticated, service_role;

select cron.schedule('oos-adsblol-30s', '30 seconds', 'select public.queue_adsblol_poll()');
-- Enable only after the authenticated worker has been deployed and checked.
select cron.alter_job(jobid, active := false) from cron.job where jobname = 'oos-adsblol-30s';

select cron.schedule('oos-cron-log-retention', '17 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'
    and jobid in (select jobid from cron.job where jobname in
      ('oos-adsblol-30s','oos-cron-log-retention','cleanup-expired-operational-data'));$$);
