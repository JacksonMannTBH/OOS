import { writeFile } from "node:fs/promises";
import { ALL_STATES, stateCodeForId } from "../lib/app-states";
import { AIRCRAFT_DURATION_MINUTES, stateIdForOpsAircraftTail } from "../lib/aircraft-directory";
import { FLEET, fleetHex } from "../lib/seed";

const path = process.argv[2];
if (!path) throw new Error("Pass a migration path created with supabase migration new.");
const sql = (value: string | null | undefined) => value == null ? "null" : `'${value.replaceAll("'", "''")}'`;
const states = ALL_STATES.map(s => `(${[s.code, s.id, s.label].map(sql)}, ${s.centerLat}, ${s.centerLon})`);
const aircraft = FLEET.map(a => {
  const state = stateIdForOpsAircraftTail(a.tail);
  if (!state) throw new Error(`Missing home state: ${a.tail}`);
  return `(${[a.tail, fleetHex(a).toUpperCase(), stateCodeForId(state), a.operator, a.model, null,
    a.base, a.role, a.roleConfidence, a.roleDescription, a.roleNote].map(sql)})`;
});
const durations = FLEET.flatMap(a => AIRCRAFT_DURATION_MINUTES[a.tail]
  ? [`(${sql(a.tail)}, ${AIRCRAFT_DURATION_MINUTES[a.tail]})`] : []);
void writeFile(path, `-- Restore the saved nationwide catalog without replacing existing records or retirements.
insert into public.states (code,slug,name,center_lat,center_lon)
values ${states.join(",\n")} on conflict(code) do nothing;
insert into public.aircraft (tail,icao24,home_state_code,operator,model,nickname,base,role,role_confidence,role_description,role_note)
values ${aircraft.join(",\n")} on conflict(tail) do nothing;
insert into public.aircraft_performance_profiles (aircraft_id,nominal_endurance_min,reserve_min,source_note,updated_at)
select a.id,d.minutes,30,'Catalog type-family estimate; configuration and actual fuel are unverified.',now()
from (values ${durations.join(",\n")}) d(tail,minutes)
join public.aircraft a on a.tail=d.tail on conflict(aircraft_id) do nothing;
alter policy oos_live_receive on realtime.messages
using (extension = 'broadcast' and (select realtime.topic()) in (${ALL_STATES.map(s => sql(`oos-live:${s.code}`)).join(",")}));
`).then(() => console.log(`Prepared ${states.length} states and ${aircraft.length} catalog aircraft; existing rows are preserved.`));
