create index aircraft_current_state_flight_session_idx
  on public.aircraft_current_state (flight_session_id)
  where flight_session_id is not null;

create index aircraft_current_state_state_code_idx
  on public.aircraft_current_state (current_state_code)
  where current_state_code is not null;

create policy "Deny public access to push endpoints"
  on public.push_endpoints for all to anon, authenticated
  using (false) with check (false);

create policy "Deny public access to notification subscriptions"
  on public.notification_subscriptions for all to anon, authenticated
  using (false) with check (false);

create policy "Deny public access to notification events"
  on public.notification_events for all to anon, authenticated
  using (false) with check (false);

create policy "Deny public access to notification deliveries"
  on public.notification_deliveries for all to anon, authenticated
  using (false) with check (false);

create policy "Deny public access to ingestion runs"
  on public.ingestion_runs for all to anon, authenticated
  using (false) with check (false);

create policy "Deny public access to notification worker runs"
  on public.notification_worker_runs for all to anon, authenticated
  using (false) with check (false);

create policy "Deny public access to data source health"
  on public.data_source_health for all to anon, authenticated
  using (false) with check (false);

create policy "Deny public access to registry audit"
  on public.registry_audit for all to anon, authenticated
  using (false) with check (false);

create policy "Deny public access to spots"
  on public.spots for all to anon, authenticated
  using (false) with check (false);

create policy "Deny public access to app settings"
  on public.app_settings for all to anon, authenticated
  using (false) with check (false);

create policy "Deny public access to runtime cache"
  on public.runtime_cache for all to anon, authenticated
  using (false) with check (false);

create policy "Deny public access to worker leases"
  on public.worker_leases for all to anon, authenticated
  using (false) with check (false);
