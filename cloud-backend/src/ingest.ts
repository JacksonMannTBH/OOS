import { SUPPORTED_STATE_CODES } from "../../lib/app-states";
import { runtime, json } from "./runtime";
import { getSupabaseAdmin } from "../../lib/supabase/server";
import { ingestSnapshot, type AircraftCatalogEntry } from "../../lib/aircraft-data";
import { buildAdsbFiIngestionSnapshot } from "../../lib/adsb";
import type { FleetEntry } from "../../lib/types";
import { broadcastLiveStates } from "../../lib/live-data-server";

runtime.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Use POST" }, 405);
  const token = request.headers.get("x-oos-ingest-token");
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return json({ error: "Unauthorized" }, 401);
  const db = getSupabaseAdmin();
  // Legacy credential/lease names stay stable; the selected supplier is ADSB.fi.
  const auth = await db.from("app_settings").select("value").eq("key", "adsblol_ingest_token_hash").single();
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (auth.error || auth.data?.value !== digest) return json({ error: "Unauthorized" }, 401);

  const workerId = crypto.randomUUID();
  const claim = await db.rpc("claim_worker_lease", {
    lease_name: "adsblol-ingestion", lease_owner: workerId, lease_seconds: 90,
  });
  if (claim.error) return json({ error: "Worker lease unavailable" }, 503);
  if (!claim.data) return json({ skipped: "another worker is active" });
  let runId: string | undefined;
  const started = Date.now();
  try {
    // Preserve the existing live scheduler cadence, including after failures.
    const run = await db.from("ingestion_runs").insert({
      worker_id: workerId, source: "adsbfi", started_at: new Date(started).toISOString(),
      metadata: { states: SUPPORTED_STATE_CODES, interval_seconds: 30 },
    }).select("id").single();
    if (run.error) throw new Error(run.error.message);
    runId = run.data.id;
    // Read the database catalog directly: do not merge nationwide seed entries.
    const result = await db.from("aircraft_catalog_public").select("*")
      .in("home_state_code", SUPPORTED_STATE_CODES).order("tail").limit(1000);
    if (result.error) throw new Error(result.error.message);
    if (!result.data.length || result.data.length >= 1000) throw new Error("Unexpected supported-state catalog size");
    const catalog: AircraftCatalogEntry[] = result.data.map((row) => ({
      aircraft: {
        tail: row.tail, hex: row.icao24, operator: row.operator, model: row.model,
        nickname: null, base: row.base, role: row.role as FleetEntry["role"],
        roleConfidence: row.role_confidence, roleDescription: row.role_description,
        roleNote: row.role_note ?? undefined,
      }, homeStateCode: row.home_state_code, nominalEnduranceMin: row.nominal_endurance_min,
      usableFuelGallons: row.usable_fuel_gallons, lowBurnGph: row.low_burn_gph,
      highBurnGph: row.high_burn_gph, reserveMin: row.reserve_min,
    }));
    const snapshot = await buildAdsbFiIngestionSnapshot(catalog);
    const summary = await ingestSnapshot(snapshot, workerId, { catalogSeeded: true });
    const finished = new Date().toISOString();
    const update = await db.from("ingestion_runs").update({
      status: "succeeded", finished_at: finished,
      source_aircraft_count: snapshot.live_seen_count, tracked_aircraft_count: snapshot.aircraft.length,
      positions_inserted: summary.positionsInserted, takeoffs_created: summary.takeoffsCreated,
      metadata: { states: SUPPORTED_STATE_CODES, interval_seconds: 30, duration_ms: Date.now() - started, by_state: summary.byState },
    }).eq("id", runId);
    if (update.error) throw new Error(update.error.message);
    // Delivery errors must not turn a successfully saved provider sample into
    // a failed ingestion. The next tick and client recovery remain available.
    try { await broadcastLiveStates(); }
    catch (error) { console.error("Live broadcast failed:", error instanceof Error ? error.message : "unknown"); }
    return json({ ok: true, aircraft: snapshot.aircraft.length, observed: snapshot.live_seen_count, positions: summary.positionsInserted });
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    const failedAt = new Date().toISOString();
    const writes = await Promise.all([
      db.from("data_source_health").upsert({ source: "adsbfi", last_attempt_at: new Date(started).toISOString(),
        last_failure_at: failedAt, last_error: message, updated_at: failedAt }),
      ...(runId ? [db.from("ingestion_runs").update({ status: "failed", error: message, finished_at: failedAt }).eq("id", runId)] : []),
    ]);
    for (const write of writes) if (write.error) console.error("Failure log write:", write.error.message);
    console.error("ADSB.fi ingestion failed:", message);
    // Push source health as well, so connected apps keep their last-known
    // display without each polling the API during a provider outage.
    try { await broadcastLiveStates(true); }
    catch (error) { console.error("Live health broadcast failed:", error instanceof Error ? error.message : "unknown"); }
    return json({ ok: false, error: message, retry_after_seconds: 30 }, 503);
  } finally {
    const release = await db.rpc("release_worker_lease", { lease_name: "adsblol-ingestion", lease_owner: workerId });
    if (release.error) console.error("Lease release failed:", release.error.message);
  }
});
