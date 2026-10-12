-- The worker reads its last five minutes of batches before sampling aircraft.
-- Avoid scanning the entire seven-day history on every worker/API request.
create index if not exists ingestion_runs_started_at_idx
  on public.ingestion_runs (started_at desc);

