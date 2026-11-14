import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveAircraftStateRows } from "./aircraft-state-batch";

test("state lookups batch positioned rows, preserve missing positions, and keep per-aircraft fallback", async () => {
  const rows: Record<string, unknown>[] = Array.from({ length: 205 }, (_, i) => ({ aircraft_id: String(i), latitude: 47, longitude: -122, current_state_code: null }));
  rows.push({ aircraft_id: "missing", latitude: null, longitude: null, current_state_code: null });
  const catalog = new Map(rows.map(row => [String(row.aircraft_id), { home_state_code: "WA" }]));
  const sizes: number[] = [];
  const db = { rpc: async (name: string, args: any) => {
    assert.equal(name, "resolve_aircraft_states_batch"); sizes.push(args.input_positions.length);
    return { data: args.input_positions.map((p: any) => ({ aircraft_id: p.aircraft_id, state_code: p.aircraft_id === "0" ? null : "OR" })), error: null };
  } };
  await resolveAircraftStateRows(db as any, rows, catalog);
  assert.deepEqual(sizes, [100, 100, 5]);
  assert.equal(rows[0]!.current_state_code, "WA");
  assert.equal(rows[1]!.current_state_code, "OR");
  assert.equal(rows.at(-1)!.current_state_code, null);
  await resolveAircraftStateRows({ rpc: async () => ({ data: null, error: { message: "temporary failure" } }) } as any, rows.slice(0, 2), catalog);
  assert.equal(rows[1]!.current_state_code, "WA");
});
