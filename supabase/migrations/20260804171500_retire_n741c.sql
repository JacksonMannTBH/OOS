do $$
declare
  previous_aircraft jsonb;
begin
  select to_jsonb(aircraft_row)
  into previous_aircraft
  from public.aircraft as aircraft_row
  where aircraft_row.tail = 'N741C'
    and aircraft_row.active = true
  for update;

  if previous_aircraft is not null then
    update public.aircraft
    set active = false,
        updated_at = now()
    where tail = 'N741C';

    insert into public.registry_audit (
      operation,
      aircraft_tail,
      previous_value,
      next_value,
      actor
    )
    values (
      'delete',
      'N741C',
      previous_aircraft,
      null,
      'migration'
    );
  end if;
end;
$$;
