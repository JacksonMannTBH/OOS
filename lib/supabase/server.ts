import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    readServerEnv("SUPABASE_URL") &&
      readServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );
}

export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;

  const url = readServerEnv("SUPABASE_URL");
  const serviceRoleKey = readServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  client = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        "X-Client-Info": "out-of-sight-netlify",
      },
    },
  });
  return client;
}

export function readServerEnv(name: string): string | undefined {
  const netlify = (globalThis as typeof globalThis & {
    Netlify?: { env?: { get(name: string): string | undefined } };
  }).Netlify;
  return netlify?.env?.get(name) ?? process.env[name];
}

export async function requireSupabaseHealth(): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("states")
    .select("code", { head: true, count: "exact" });
  if (error) throw new Error(`Supabase health check failed: ${error.message}`);
}
