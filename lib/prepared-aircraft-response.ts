import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase/server";

// Coalesce callers in this worker; the database lease coordinates other workers.
const preparingAircraftResponses = new Map<string, Promise<unknown>>();

export function getPreparedAircraftResponse<T>(key: string, build: () => Promise<T>): Promise<T> {
  if (!isSupabaseConfigured()) return build();
  const existing = preparingAircraftResponses.get(key);
  if (existing) return existing as Promise<T>;
  const pending = prepareAircraftResponse(key, build).finally(() => preparingAircraftResponses.delete(key));
  preparingAircraftResponses.set(key, pending);
  return pending;
}

async function prepareAircraftResponse<T>(key: string, build: () => Promise<T>): Promise<T> {
  const db = getSupabaseAdmin();
  const owner = crypto.randomUUID();
  // Waiting for another worker is bounded. Cache trouble must not hide live data.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await db.rpc("read_prepared_aircraft_response", { input_key: key, input_owner: owner });
    if (error || !data || typeof data !== "object") return build();
    if (data.status === "ready" && data.payload != null) return data.payload as T;
    if (data.status === "claimed" && typeof data.generation === "string") {
      let payload: T | null = null;
      try { payload = await build(); return payload; }
      finally {
        // The database rejects stale generations and expired owners atomically.
        const saved = await db.rpc("finish_prepared_aircraft_response", {
          input_key: key, input_owner: owner, input_generation: data.generation, input_payload: payload,
        });
        if (saved.error) console.warn("[prepared-aircraft] cache write failed", saved.error.message);
      }
    }
    if (data.status !== "busy") return build();
    await new Promise(resolve => setTimeout(resolve, 100 * 2 ** attempt));
  }
  return build();
}
