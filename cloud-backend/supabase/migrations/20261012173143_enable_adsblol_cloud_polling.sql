-- Apply after oos-ingest is deployed and its credential validation is checked.
select cron.alter_job(jobid, active := true)
from cron.job where jobname = 'oos-adsblol-30s';
