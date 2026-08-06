do $$
declare
  target_tails text[] := array[
    'N1977G',
    'N2108J',
    'N741C',
    'N128J',
    'N144CS',
    'N146CS',
    'N149CS',
    'N403SK',
    'N480SK',
    'N741SK',
    'N142CS',
    'N143CS',
    'N147CS',
    'N148CS',
    'N423SK',
    'N431SK',
    'N769SK'
  ];
  tail_value text;
  previous_aircraft jsonb;
begin
  foreach tail_value in array target_tails loop
    select to_jsonb(aircraft_row)
    into previous_aircraft
    from public.aircraft as aircraft_row
    where aircraft_row.tail = tail_value
      and aircraft_row.active = true
    for update;

    if previous_aircraft is not null then
      update public.aircraft
      set active = false,
          updated_at = now()
      where tail = tail_value;

      insert into public.registry_audit (
        operation,
        aircraft_tail,
        previous_value,
        next_value,
        actor
      )
      values (
        'delete',
        tail_value,
        previous_aircraft,
        null,
        'migration'
      );
    end if;
  end loop;
end;
$$;
