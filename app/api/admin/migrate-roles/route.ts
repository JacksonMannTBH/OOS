// Idempotent catalog sync that imports seed tails missing from Supabase and
// merges seed role metadata into existing catalog rows.
//
// Auth: same admin cookie as the rest of /admin. Returns a small JSON
// summary of what changed so it's easy to confirm in the deploy log.

import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { appendAudit, getRegistry, saveRegistry } from "@/lib/registry";
import { FLEET, SEED_VERSION } from "@/lib/seed";
import type { FleetEntry } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const seedByTail = new Map<string, FleetEntry>(
    FLEET.map((f) => [f.tail, f]),
  );
  const current = await getRegistry();
  const currentTails = new Set(current.map((entry) => entry.tail));
  const merged: FleetEntry[] = [];
  let changed = 0;
  const summary: Array<{ tail: string; before: string; after: string }> = [];

  for (const entry of current) {
    const seed = seedByTail.get(entry.tail);
    const wasUnknown =
      entry.role === "unknown" || entry.roleConfidence === "unknown";
    let next = entry;
    if (seed && wasUnknown) {
      next = {
        ...entry,
        role: seed.role,
        roleConfidence: seed.roleConfidence,
        roleNote: seed.roleNote ?? entry.roleNote,
        roleDescription: entry.roleDescription || seed.roleDescription,
      };
      if (
        next.role !== entry.role ||
        next.roleConfidence !== entry.roleConfidence ||
        next.roleNote !== entry.roleNote
      ) {
        changed++;
        summary.push({
          tail: entry.tail,
          before: `${entry.role}/${entry.roleConfidence}`,
          after: `${next.role}/${next.roleConfidence}`,
        });
      }
    }
    merged.push(next);
  }

  for (const seed of FLEET) {
    if (currentTails.has(seed.tail)) continue;
    currentTails.add(seed.tail);
    merged.push(seed);
    changed++;
    summary.push({
      tail: seed.tail,
      before: "missing",
      after: `${seed.role}/${seed.roleConfidence}`,
    });
  }

  if (changed === 0) {
    return NextResponse.json({
      ok: true,
      changed: 0,
      seed_version: SEED_VERSION,
      total: current.length,
      message: "registry already at current shape",
    });
  }

  await saveRegistry(merged);
  await appendAudit({
    ts: new Date().toISOString(),
    op: "update",
    tail: "(sync-seed-registry)",
    prev: null,
    next: null,
  });

  return NextResponse.json({
    ok: true,
    changed,
    seed_version: SEED_VERSION,
    total: current.length,
    summary,
  });
}
