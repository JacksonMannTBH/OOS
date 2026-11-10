-- Applied November 3, 2026. Preserve the job identity for history and retention.
begin;
select cron.alter_job(jobid, schedule := '15 seconds')
from cron.job where jobname = 'oos-adsblol-30s';
update public.app_settings
set value = jsonb_set(value, '{interval_seconds}', '15'::jsonb), updated_at = now()
where key = 'adsblol_backend';
commit;
