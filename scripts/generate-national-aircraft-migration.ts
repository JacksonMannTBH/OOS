import { writeFile } from "node:fs/promises";
import { APP_STATES, stateCodeForId } from "../lib/app-states";
import { AIRCRAFT_DURATION_MINUTES, stateIdForOpsAircraftTail } from "../lib/aircraft-directory";
import { NATIONAL_AIRCRAFT_ROWS, NATIONAL_AIRCRAFT_REGISTRY_DATE } from "../lib/national-aircraft-data";
import { FLEET, fleetHex } from "../lib/seed";

const path = process.argv[2];
if (!path) throw new Error("Pass a migration path created with supabase migration new.");
const originalStates = new Set(["WA", "CA", "TX", "FL", "OH", "CO"]);
const tails = new Set(NATIONAL_AIRCRAFT_ROWS.map((row) => row[1]));
const entries = FLEET.filter((entry) => tails.has(entry.tail));
const sql = (value: string | null | undefined) => value == null ? "null" : `'${value.replaceAll("'", "''")}'`;
const stateRows = APP_STATES.filter((state) => !originalStates.has(state.code)).map(
  (state) => `  (${sql(state.code)}, ${sql(state.id)}, ${sql(state.label)}, ${state.centerLat}, ${state.centerLon})`,
);
const aircraftRows = entries.map((entry) => {
  const state = stateIdForOpsAircraftTail(entry.tail);
  if (!state) throw new Error(`Missing state for ${entry.tail}`);
  return `  (${[
    entry.tail, fleetHex(entry).toUpperCase(), stateCodeForId(state), entry.operator,
    entry.model, entry.nickname, entry.base, entry.role, entry.roleConfidence,
    entry.roleDescription, entry.roleNote,
  ].map(sql).join(", ")})`;
});
const durations = entries.flatMap((entry) => {
  const duration = AIRCRAFT_DURATION_MINUTES[entry.tail];
  return duration ? [`  (${sql(entry.tail)}, ${duration})`] : [];
});

const migration = `-- Nationwide law-enforcement catalog; FAA snapshot ${NATIONAL_AIRCRAFT_REGISTRY_DATE}.
-- Reproduce with scripts/generate-national-aircraft-migration.ts.
-- Preserve existing aircraft, admin edits, retirements, and performance profiles.
insert into public.states (code, slug, name, center_lat, center_lon)
values
${stateRows.join(",\n")}
on conflict (code) do nothing;

insert into public.aircraft (
  tail, icao24, home_state_code, operator, model, nickname, base,
  role, role_confidence, role_description, role_note
)
values
${aircraftRows.join(",\n")}
on conflict (tail) do nothing;

insert into public.aircraft_performance_profiles (
  aircraft_id, nominal_endurance_min, reserve_min, source_note, updated_at
)
select aircraft.id, durations.nominal_endurance_min, 30,
  'Existing catalog type-family estimate; airframe configuration and actual fuel are unverified.', now()
from (values
${durations.join(",\n")}
) as durations(tail, nominal_endurance_min)
join public.aircraft on aircraft.tail = durations.tail
on conflict (aircraft_id) do nothing;
`;
void writeFile(path, migration, "utf8").then(() => {
  console.log(`Wrote ${stateRows.length} states, ${aircraftRows.length} aircraft, ${durations.length} type estimates.`);
});
