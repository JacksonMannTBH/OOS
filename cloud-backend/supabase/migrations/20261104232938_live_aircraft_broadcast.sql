-- Public operational aircraft data, delivered on private receive-only channels.
-- A client key can subscribe, but cannot inject aircraft positions or messages.
create policy "oos_live_receive"
on realtime.messages
for select
to anon, authenticated
using (
  extension = 'broadcast'
  and (select realtime.topic()) in ('oos-live:WA', 'oos-live:CA', 'oos-live:TX')
);
