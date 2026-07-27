import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase/server";

export function hasPersistentStore(): boolean {
  return isSupabaseConfigured();
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isSupabaseConfigured()) return null;
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("runtime_cache")
    .select("value,expires_at")
    .eq("key", key)
    .maybeSingle();
  if (error) {
    console.warn(`[cache] read failed for ${key}:`, error.message);
    return null;
  }
  if (!data) return null;
  if (data.expires_at && Date.parse(String(data.expires_at)) <= Date.now()) {
    await db.from("runtime_cache").delete().eq("key", key);
    return null;
  }
  return data.value as T;
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const expiresAt =
    ttlSeconds > 0
      ? new Date(Date.now() + ttlSeconds * 1000).toISOString()
      : null;
  const { error } = await getSupabaseAdmin().from("runtime_cache").upsert(
    {
      key,
      value,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) throw new Error(`Cache write failed for ${key}: ${error.message}`);
}

export async function cacheSetIfAbsent<T>(
  key: string,
  value: T,
  ttlSeconds = 0,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const expiresAt =
    ttlSeconds > 0
      ? new Date(Date.now() + ttlSeconds * 1000).toISOString()
      : null;
  const { error } = await getSupabaseAdmin().from("runtime_cache").insert({
    key,
    value,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(`Cache insert failed for ${key}: ${error.message}`);
}

export async function cacheDelete(key: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await getSupabaseAdmin()
    .from("runtime_cache")
    .delete()
    .eq("key", key);
  if (error) throw new Error(`Cache delete failed for ${key}: ${error.message}`);
}
