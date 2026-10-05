alter table public.push_endpoints
  add column transport text not null default 'web_push'
    check (transport in ('web_push', 'fcm'));

alter table public.push_endpoints
  alter column p256dh drop not null,
  alter column auth drop not null;

alter table public.push_endpoints
  add constraint push_endpoints_transport_credentials_check
  check (
    (transport = 'web_push' and p256dh is not null and auth is not null)
    or
    (transport = 'fcm' and p256dh is null and auth is null)
  );

comment on column public.push_endpoints.transport is
  'Delivery provider: web_push for VAPID subscriptions or fcm for Capacitor Android tokens.';
