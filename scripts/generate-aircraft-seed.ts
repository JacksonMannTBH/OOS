import { writeFile } from "node:fs/promises";
import { AIRCRAFT_DURATION_MINUTES, stateIdForOpsAircraftTail } from "../lib/aircraft-directory";
import { stateCodeForId } from "../lib/app-states";
import { FLEET, fleetHex } from "../lib/seed";

const outputPath = process.argv[2];
if (!outputPath) {
  throw new Error("Usage: tsx scripts/generate-aircraft-seed.ts <migration.sql>");
}

function sqlString(value: string | null | undefined): string {
  if (value == null) return "null";
  return `'${value.replaceAll("'", "''")}'`;
}

const aircraftRows = FLEET.map((entry) => {
  const stateId = stateIdForOpsAircraftTail(entry.tail) ?? "washington";
  return `  (${[
    sqlString(entry.tail.toUpperCase()),
    sqlString(fleetHex(entry).toUpperCase()),
    sqlString(stateCodeForId(stateId)),
    sqlString(entry.operator),
    sqlString(entry.model),
    sqlString(entry.nickname),
    sqlString(entry.base),
    sqlString(entry.role),
    sqlString(entry.roleConfidence),
    sqlString(entry.roleDescription),
    sqlString(entry.roleNote),
  ].join(", ")})`;
});

const durationRows = FLEET.flatMap((entry) => {
  const minutes = AIRCRAFT_DURATION_MINUTES[entry.tail];
  return minutes ? [`  (${sqlString(entry.tail.toUpperCase())}, ${minutes})`] : [];
});

const migration = `insert into public.aircraft (
  tail,
  icao24,
  home_state_code,
  operator,
  model,
  nickname,
  base,
  role,
  role_confidence,
  role_description,
  role_note
)
values
${aircraftRows.join(",\n")}
on conflict (tail) do update set
  icao24 = excluded.icao24,
  home_state_code = excluded.home_state_code,
  operator = excluded.operator,
  model = excluded.model,
  nickname = excluded.nickname,
  base = excluded.base,
  role = excluded.role,
  role_confidence = excluded.role_confidence,
  role_description = excluded.role_description,
  role_note = excluded.role_note,
  active = true,
  updated_at = now();

insert into public.aircraft_performance_profiles (
  aircraft_id,
  nominal_endurance_min,
  reserve_min,
  source_note,
  updated_at
)
select
  aircraft.id,
  durations.nominal_endurance_min,
  30,
  'Catalog endurance estimate; verify against an authoritative aircraft source.',
  now()
from (
  values
${durationRows.join(",\n")}
) as durations(tail, nominal_endurance_min)
join public.aircraft
  on aircraft.tail = durations.tail
on conflict (aircraft_id) do update set
  nominal_endurance_min = excluded.nominal_endurance_min,
  reserve_min = excluded.reserve_min,
  source_note = excluded.source_note,
  updated_at = excluded.updated_at;
`;

writeFile(outputPath, migration, "utf8")
  .then(() => {
    console.log(
      `Wrote ${FLEET.length} aircraft and ${durationRows.length} performance profiles to ${outputPath}`,
    );
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
