import { getSupabaseAdmin } from "./supabase/server";

export type SpotAirborneTail = {
  tail: string;
  lat: number | null;
  lon: number | null;
  distance_nm: number | null;
};

export type SpotPayload = {
  lat: number;
  lon: number;
  ts: number;
  airborne_tails: SpotAirborneTail[];
};

export type StoredSpot = SpotPayload & { id: string };

const LOOKBACK_DAYS = 7;

export async function saveSpot(payload: SpotPayload): Promise<StoredSpot> {
  const observedAt = new Date(payload.ts).toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("spots")
    .insert({
      observed_at: observedAt,
      latitude: payload.lat,
      longitude: payload.lon,
      airborne_tails: payload.airborne_tails,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Spot write failed: ${error.message}`);
  return { ...payload, id: String(data.id) };
}

export async function listRecentSpots(limit = 100): Promise<StoredSpot[]> {
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("spots")
    .select("id,observed_at,latitude,longitude,airborne_tails")
    .gte("observed_at", cutoff)
    .order("observed_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[spots] read failed:", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    ts: Date.parse(String(row.observed_at)),
    lat: Number(row.latitude),
    lon: Number(row.longitude),
    airborne_tails: Array.isArray(row.airborne_tails)
      ? row.airborne_tails as SpotAirborneTail[]
      : [],
  }));
}
