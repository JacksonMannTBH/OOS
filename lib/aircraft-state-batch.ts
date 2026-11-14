import { getSupabaseAdmin } from "./supabase/server";
import { catalogBatches } from "./catalog-pagination";

/** Resolve only rows we are actually writing, in bounded batches. */
export async function resolveAircraftStateRows(
  db: ReturnType<typeof getSupabaseAdmin>,
  rows: Record<string, unknown>[],
  catalog: ReadonlyMap<string, { home_state_code: string }>,
): Promise<void> {
  const positioned = rows.filter(row => typeof row.latitude === "number" && Number.isFinite(row.latitude)
    && typeof row.longitude === "number" && Number.isFinite(row.longitude));
  for (const batch of catalogBatches(positioned)) {
    for (const row of batch) row.current_state_code = catalog.get(String(row.aircraft_id))?.home_state_code ?? null;
    const { data, error } = await db.rpc("resolve_aircraft_states_batch", { input_positions: batch.map(row => ({
      aircraft_id: row.aircraft_id, latitude: row.latitude, longitude: row.longitude,
    })) });
    if (error) { console.warn("[ingest] state-code batch resolution failed", error.message); continue; }
    const resolved = new Map((data ?? []).map((row: { aircraft_id: string; state_code: string | null }) => [row.aircraft_id, row.state_code]));
    for (const row of batch) {
      const state = resolved.get(String(row.aircraft_id));
      if (typeof state === "string") row.current_state_code = state;
    }
  }
}
