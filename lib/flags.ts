import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase/server";

const KEY_SPEED_WARNING = "speed_warning";

export async function getSpeedWarningEnabled(): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;
  const { data, error } = await getSupabaseAdmin()
    .from("app_settings")
    .select("value")
    .eq("key", KEY_SPEED_WARNING)
    .maybeSingle();
  if (error || data == null) return true;
  return typeof data.value === "boolean" ? data.value : true;
}

export async function setSpeedWarningEnabled(value: boolean): Promise<void> {
  const { error } = await getSupabaseAdmin().from("app_settings").upsert(
    {
      key: KEY_SPEED_WARNING,
      value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) throw new Error(`Feature flag write failed: ${error.message}`);
}
