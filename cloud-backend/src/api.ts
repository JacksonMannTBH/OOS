import { isSupportedStateCode, stateIdForCode, SUPPORTED_STATE_CODES, type StateCode } from "../../lib/app-states";
import { runtime, json } from "./runtime";
import { getDatabaseSnapshot } from "../../lib/aircraft-data";
import { getSupabaseAdmin } from "../../lib/supabase/server";
import { getRecentActivity } from "../../lib/activity";

// Supabase's gateway verifies the project JWT before executing this function.
// These routes only expose public aircraft data, never subscription credentials.
runtime.serve(async (request) => {
  if (request.method !== "GET") return json({ error: "Use GET" }, 405);
  const url = new URL(request.url);
  const endpoint = url.pathname.split("/").filter(Boolean).at(-1);
  const state = (url.searchParams.get("state") ?? "WA").toUpperCase();
  if (!isSupportedStateCode(state)) return json({ error: `Supported states: ${SUPPORTED_STATE_CODES.join(", ")}` }, 400);
  try {
    const db = getSupabaseAdmin();
    if (endpoint === "health") {
      const [health, runs, count] = await Promise.all([
        db.from("data_source_health").select("source,last_attempt_at,last_success_at,last_failure_at,last_error").eq("source", "adsblol").maybeSingle(),
        db.from("ingestion_runs").select("started_at,finished_at,status,tracked_aircraft_count,source_aircraft_count,positions_inserted,error").order("started_at", { ascending: false }).limit(10),
        db.from("aircraft").select("id", { count: "exact", head: true }).eq("active", true).in("home_state_code", SUPPORTED_STATE_CODES),
      ]);
      if (health.error || runs.error || count.error) throw new Error("Health read failed");
      const healthy = !health.data?.last_error && !!health.data?.last_success_at && Date.now() - Date.parse(health.data.last_success_at) < 90_000;
      return json({ healthy, source: "adsblol", interval_seconds: 15, states: SUPPORTED_STATE_CODES,
        catalog_count: count.count, health: health.data, recent_runs: runs.data }, healthy ? 200 : 503);
    }
    if (endpoint === "aircraft" || endpoint === "oos-api") {
      return json({ ...await getDatabaseSnapshot(state), attribution: "ADSB.lol", license: "ODbL-1.0" });
    }
    if (endpoint === "activity") {
      const rawLimit = Number(url.searchParams.get("limit") ?? 50);
      const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(500, Math.floor(rawLimit))) : 50;
      return json({ entries: await getRecentActivity(limit, stateIdForCode(state as StateCode)), fetched_at: Date.now() });
    }
    if (endpoint === "flight-paths") {
      const snapshot = await getDatabaseSnapshot(state);
      const requested = (url.searchParams.get("tails") ?? "").split(",").filter(Boolean).map((tail) => tail.trim().toUpperCase());
      const allowed = snapshot.aircraft.filter((row) => row.observed && row.flight_session_id && (!requested.length || requested.includes(row.tail)));
      const features = [];
      for (const row of allowed) {
        const points: number[][] = [];
        // Paginate long flights so PostgREST's row limit cannot truncate a path.
        for (let offset = 0; ; offset += 1000) {
          const result = await db.from("aircraft_positions").select("longitude,latitude")
            .eq("flight_session_id", row.flight_session_id!).order("observed_at").order("id").range(offset, offset + 999);
          if (result.error) throw new Error(result.error.message);
          points.push(...result.data.map((point) => [point.longitude, point.latitude]));
          if (result.data.length < 1000) break;
        }
        if (points.length >= 2) features.push({ type: "Feature", properties: { tail: row.tail, count: points.length },
          geometry: { type: "LineString", coordinates: points } });
      }
      return json({ type: "FeatureCollection", features, state });
    }
    return json({ error: "Not found" }, 404);
  } catch (error) {
    console.error("OOS API:", error instanceof Error ? error.message : error);
    return json({ error: "Backend temporarily unavailable" }, 503);
  }
});
