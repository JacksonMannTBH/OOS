-- Stop the prediction writer before removing its derived data.
delete from cron.job_run_details
where jobid in (select jobid from cron.job where jobname = 'oos-predictor-hourly');
select cron.unschedule(jobid) from cron.job where jobname = 'oos-predictor-hourly';
drop function if exists public.queue_oos_predictor();
delete from public.runtime_cache where key like 'predictor:%' or key like 'forecast:%';

-- Reject stale website deployments attempting to restore this retired cache.
alter table public.runtime_cache add constraint runtime_cache_no_flight_forecasts
  check (key not like 'predictor:%' and key not like 'forecast:%');

select cron.schedule('oos-cron-log-retention', '17 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'
    and jobid in (select jobid from cron.job where jobname in
      ('oos-adsblol-30s','oos-notifications-minute',
       'oos-cron-log-retention','cleanup-expired-operational-data'));$$);
