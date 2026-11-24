-- No test sightings are published: every fixture is rolled back.
begin;
set local statement_timeout = '30s';
set local role service_role;
do $$
declare
  a text := md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
  b text := md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
  c text := md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
  d text := md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
  e text := md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
  f text := md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
  g text := md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
  h text := md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
  s uuid; t uuid; u uuid; r jsonb;
begin
  r := public.oos_police_submit(a,'ZZ',1,1,null,'still_here',true);
  assert r->>'status' = 'reported'; s := (r->>'sightingId')::uuid;
  assert (select icon from public.oos_police_sightings where id=s) = 'police';
  r := public.oos_police_submit_icon(b,'ZZ',2,2,null,'still_here',true,'pig');
  assert r->>'status' = 'reported'; t := (r->>'sightingId')::uuid;
  assert (select icon from public.oos_police_sightings where id=t) = 'pig';
  assert exists(select 1 from jsonb_array_elements(public.oos_police_read('ZZ')) x where x->>'id'=t::text and x->>'icon'='pig');
  -- Ordinary confirmation preserves an existing pig; unrelated markers stay police.
  perform public.oos_police_submit(c,'ZZ',2,2,t,'still_here',false);
  assert (select icon from public.oos_police_sightings where id=t) = 'pig';
  r := public.oos_police_report(d,'ZZ',3,3); u := (r->>'sightingId')::uuid;
  assert (select icon from public.oos_police_sightings where id=u) = 'police';
  -- A duplicate, negative vote, race prompt, or distant vote cannot change an icon.
  assert public.oos_police_submit_icon(a,'ZZ',1,1,s,'still_here',false,'pig')->>'status' = 'duplicate';
  assert (select icon from public.oos_police_sightings where id=s) = 'police';
  perform public.oos_police_submit_icon(e,'ZZ',1,1,s,'not_seen',false,'pig');
  assert (select icon from public.oos_police_sightings where id=s) = 'police';
  assert public.oos_police_submit_icon(f,'ZZ',1,1,null,'still_here',true,'pig')->>'status' = 'confirmation_required';
  assert (select icon from public.oos_police_sightings where id=s) = 'police';
  assert public.oos_police_submit_icon(f,'ZZ',1.01,1,s,'still_here',false,'pig')->>'status' = 'too_far';
  -- One explicit positive confirmation changes only its target sighting.
  assert public.oos_police_submit_icon(f,'ZZ',1,1,s,'still_here',false,'pig')->>'status' = 'voted';
  assert (select icon from public.oos_police_sightings where id=s) = 'pig';
  assert (select icon from public.oos_police_sightings where id=u) = 'police';
  assert public.oos_police_submit_icon(f,'ZZ',4,4,null,'still_here',true,'pig')->>'status' = 'cooldown';
  -- Removal/expiry still hide pig sightings and do not allow resurrection.
  update public.oos_police_sightings set removed_at=now() where id=t;
  assert public.oos_police_submit_icon(g,'ZZ',2,2,t,'still_here',false,'pig')->>'status' = 'gone';
  update public.oos_police_reports set expires_at=now()-interval '1 second' where sighting_id=s;
  assert not exists(select 1 from jsonb_array_elements(public.oos_police_read('ZZ')) x where x->>'id'=s::text);
  begin
    perform public.oos_police_submit_icon(h,'ZZ',5,5,null,'still_here',true,'invalid');
    raise exception 'Invalid icon accepted';
  exception when raise_exception then
    assert sqlerrm = 'invalid_icon';
  end;
  assert not has_function_privilege('anon','public.oos_police_submit_icon(text,text,double precision,double precision,uuid,text,boolean,text)','execute');
  assert not has_function_privilege('authenticated','public.oos_police_submit_icon(text,text,double precision,double precision,uuid,text,boolean,text)','execute');
end;
$$;
rollback;
select 'Per-sighting sharing, compatibility, proximity, duplicate, cooldown, expiry and service-only access passed; fixtures rolled back' as verification;
