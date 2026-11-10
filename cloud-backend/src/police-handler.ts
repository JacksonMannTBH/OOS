import { isSupportedStateCode } from "../../lib/app-states";
import { stateCodeFromCensusResponse, validCoordinates } from "../../lib/location-state";

type Env = (name: string) => string | undefined;
type Rpc = (name: string, args: Record<string, unknown>) => Promise<unknown>;
type StateLookup = (lat: number, lon: number) => Promise<string | null>;

export async function lookupPoliceState(lat: number, lon: number): Promise<string | null> {
  const url = new URL("https://geocoding.geo.census.gov/geocoder/geographies/coordinates");
  url.search = new URLSearchParams({ x: String(lon), y: String(lat), benchmark: "Public_AR_Current", vintage: "Current_Current", format: "json" }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error("state_lookup_unavailable");
  return stateCodeFromCensusResponse(await response.json());
}

export function createPoliceHandler(env: Env, rpc: Rpc, lookup: StateLookup = lookupPoliceState) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin");
    const headers = new Headers({ "Cache-Control": "no-store", Vary: "Origin" });
    const origins = ["capacitor://localhost", "https://localhost", "http://localhost", "http://localhost:5173"];
    const reply = (data: unknown, status = 200) => Response.json(data, { status, headers });
    if (origin && !origins.includes(origin)) return reply({ error: "origin_not_allowed" }, 403);
    if (origin) headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Headers", "apikey, content-type");
    headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    let keys: unknown;
    try { keys = JSON.parse(env("SUPABASE_PUBLISHABLE_KEYS") ?? "{}"); } catch { return reply({ error: "unavailable" }, 503); }
    if (!keys || typeof keys !== "object" || !Object.values(keys).some(k => typeof k === "string" && k.startsWith("sb_publishable_") && k === request.headers.get("apikey"))) {
      return reply({ error: "invalid_client_key" }, 401);
    }
    try {
      if (request.method === "GET") {
        const state = new URL(request.url).searchParams.get("state");
        if (!isSupportedStateCode(state)) return reply({ error: "invalid_state" }, 400);
        return reply({ sightings: await rpc("oos_police_read", { p_state: state.toUpperCase() }), serverTime: Date.now() });
      }
      if (request.method !== "POST" && request.method !== "DELETE") return reply({ error: "method_not_allowed" }, 405);
      const raw = await request.text();
      if (raw.length > 2048) return reply({ error: "invalid_request" }, 413);
      let body: Record<string, unknown>;
      try { body = JSON.parse(raw); } catch { return reply({ error: "invalid_request" }, 400); }
      if (!body || typeof body !== "object" || typeof body.reporterToken !== "string" || !/^[a-f0-9]{64}$/.test(body.reporterToken)) return reply({ error: "invalid_reporter" }, 400);
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body.reporterToken));
      const reporter = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
      if (request.method === "DELETE") {
        if (typeof body.reportId !== "string" || !/^[a-f0-9-]{36}$/.test(body.reportId)) return reply({ error: "invalid_report" }, 400);
        await rpc("oos_police_withdraw", { p_reporter: reporter, p_report_id: body.reportId });
        return reply({ status: "withdrawn" });
      }
      const { lat, lon, accuracy, capturedAt } = body;
      const action = body.action ?? "legacy_report";
      if (!["legacy_report", "prepare", "report", "vote"].includes(String(action))) return reply({ error: "invalid_action" }, 400);
      if (action === "vote" && (typeof body.sightingId !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(body.sightingId) || !["still_here", "not_seen"].includes(String(body.vote)))) return reply({ error: "invalid_vote" }, 400);
      if (typeof lat !== "number" || typeof lon !== "number" || !validCoordinates(lat, lon) || typeof accuracy !== "number" || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100 || typeof capturedAt !== "number" || !Number.isFinite(capturedAt) || Date.now() - capturedAt > 30_000 || capturedAt > Date.now() + 10_000) {
        return reply({ error: "fresh_location_required" }, 400);
      }
      // Check cooldown before the external geocoder; the write RPC checks again under locks.
      const remaining = action === "prepare" ? 0 : await rpc("oos_police_cooldown", { p_reporter: reporter });
      if (typeof remaining === "number" && remaining > 0) return reply({ status: "cooldown", retryAfterMs: remaining });
      const state = await lookup(lat, lon);
      if (!state || !isSupportedStateCode(state)) return reply({ error: "unsupported_location" }, 422);
      if (action === "prepare") return reply(await rpc("oos_police_prepare", { p_state: state, p_lat: lat, p_lon: lon }));
      if (action === "report" || action === "vote") return reply(await rpc("oos_police_submit", {
        p_reporter: reporter, p_state: state, p_lat: lat, p_lon: lon,
        p_sighting: action === "vote" ? body.sightingId : null,
        p_vote: action === "vote" ? body.vote : "still_here", p_require_new: action === "report",
      }));
      return reply(await rpc("oos_police_report", { p_reporter: reporter, p_state: state, p_lat: lat, p_lon: lon }));
    } catch {
      // Never log report bodies, capability tokens, or rider coordinates.
      return reply({ error: "reporting_unavailable" }, 503);
    }
  };
}
