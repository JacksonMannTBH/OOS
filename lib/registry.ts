import { getCatalog, saveCatalog } from "./aircraft-data";
import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase/server";
import type { FleetEntry } from "./types";

export async function getRegistry(): Promise<FleetEntry[]> {
  return getCatalog();
}

export function invalidateRegistryCache(): void {
  // Supabase is authoritative; public responses are cached at the Netlify CDN.
}

export async function saveRegistry(tails: FleetEntry[]): Promise<void> {
  await saveCatalog(tails, "update");
}

export type BackupInfo = {
  key: string;
  timestamp: string;
  tailCount: number;
};

export async function listBackups(): Promise<BackupInfo[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabaseAdmin()
    .from("registry_audit")
    .select("id,created_at,previous_value")
    .not("previous_value", "is", null)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) return [];
  return (data ?? []).map((row) => ({
    key: `registry-audit:${row.id}`,
    timestamp: String(row.created_at),
    tailCount: Array.isArray(row.previous_value) ? row.previous_value.length : 0,
  }));
}

export async function restoreBackup(backupKey: string): Promise<FleetEntry[]> {
  const id = Number(backupKey.replace(/^registry-audit:/, ""));
  if (!Number.isInteger(id) || id <= 0) throw new Error("invalid backup key");
  const { data, error } = await getSupabaseAdmin()
    .from("registry_audit")
    .select("previous_value")
    .eq("id", id)
    .single();
  if (error || !Array.isArray(data?.previous_value)) {
    throw new Error("backup not found");
  }
  const restored = data.previous_value as FleetEntry[];
  await saveCatalog(restored, "restore");
  return restored;
}

export type AuditOp = "create" | "update" | "delete" | "restore";

export type AuditEntry = {
  ts: string;
  op: AuditOp;
  tail: string;
  prev: FleetEntry | null;
  next: FleetEntry | null;
};

export async function appendAudit(entry: AuditEntry): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await getSupabaseAdmin().from("registry_audit").insert({
    operation: entry.op,
    aircraft_tail: entry.tail,
    previous_value: entry.prev,
    next_value: entry.next,
    actor: "admin",
    created_at: entry.ts,
  });
  if (error) console.warn("[catalog] audit append failed:", error.message);
}

export async function getAudit(limit = 20): Promise<AuditEntry[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabaseAdmin()
    .from("registry_audit")
    .select("created_at,operation,aircraft_tail,previous_value,next_value")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? [])
    .filter((row) =>
      ["create", "update", "delete", "restore"].includes(String(row.operation)),
    )
    .map((row) => ({
      ts: String(row.created_at),
      op: row.operation as AuditOp,
      tail: String(row.aircraft_tail),
      prev:
        row.previous_value && !Array.isArray(row.previous_value)
          ? (row.previous_value as FleetEntry)
          : null,
      next:
        row.next_value && !Array.isArray(row.next_value)
          ? (row.next_value as FleetEntry)
          : null,
    }));
}
