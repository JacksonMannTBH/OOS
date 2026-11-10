import { DEFAULT_STATE_CODE, isSupportedStateCode, type StateCode } from "../../lib/app-states";
import { getDatabaseSnapshot } from "../../lib/aircraft-data";
import { readServerEnv } from "../../lib/supabase/server";
import * as mobile from "../../app/api/mobile/route";
import * as activity from "../../app/api/activity/route";
import * as trails from "../../app/api/trails/route";
import * as paths from "../../app/api/flight-paths/route";
import * as live from "../../app/api/live/route";
import * as location from "../../app/api/location-state/route";
import * as subscription from "../../app/api/aircraft-alerts/subscription/route";
import * as testAlert from "../../app/api/aircraft-alerts/test/route";

type Handler = (request: Request) => Promise<Response>;
export const appRoutes: Record<string, Partial<Record<string, Handler>>> = {
  live: { GET: live.GET },
  aircraft: { GET: async request => {
    const state = new URL(request.url).searchParams.get("state") ?? DEFAULT_STATE_CODE;
    if (!isSupportedStateCode(state)) return Response.json({ error: "invalid_state" }, { status: 400 });
    return Response.json({ ...await getDatabaseSnapshot(state.toUpperCase() as StateCode), attribution: "ADSB.lol", license: "ODbL-1.0" });
  } },
  mobile: { GET: mobile.GET },
  activity: { GET: activity.GET },
  trails: { GET: trails.GET },
  "flight-paths": { GET: paths.GET },
  "location-state": { POST: location.POST },
  "aircraft-alerts/subscription": { GET: subscription.GET, POST: subscription.POST, PATCH: subscription.PATCH, DELETE: subscription.DELETE },
  "aircraft-alerts/test": { POST: testAlert.POST },
};

// The publishable key identifies the public app, not an individual user.
// Subscription handlers retain the existing high-entropy device capability ID;
// they never return push tokens and never expose private tables to client keys.
export function createAppHandler(
  routes = appRoutes,
  env: (name: string) => string | undefined = readServerEnv,
): Handler {
  return async request => {
    const origin = request.headers.get("origin");
    const allowedOrigins = ["capacitor://localhost", "https://localhost", "http://localhost", "http://localhost:5173"];
    const headers = new Headers({ "Cache-Control": "no-store", Vary: "Origin" });
    if (origin && allowedOrigins.includes(origin)) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Headers", "apikey, content-type, authorization, x-client-info");
      headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    }
    const reply = (body: unknown, status: number) => Response.json(body, { status, headers });
    if (origin && !allowedOrigins.includes(origin)) return reply({ error: "origin_not_allowed" }, 403);
    // Browser preflight carries header names, not the client key itself.
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    let keys: unknown;
    try { keys = JSON.parse(env("SUPABASE_PUBLISHABLE_KEYS") ?? "{}"); } catch { return reply({ error: "client_keys_not_configured" }, 503); }
    const allowed = keys && typeof keys === "object" ? Object.values(keys).filter((key): key is string => typeof key === "string" && key.startsWith("sb_publishable_")) : [];
    if (!allowed.length) return reply({ error: "client_keys_not_configured" }, 503);
    if (!allowed.includes(request.headers.get("apikey") ?? "")) return reply({ error: "invalid_client_key" }, 401);
    const path = new URL(request.url).pathname.replace(/^\/(?:functions\/v1\/)?oos-app\//, "");
    const route = Object.hasOwn(routes, path) ? routes[path] : undefined;
    if (!route) return reply({ error: "not_found" }, 404);
    const handler = Object.hasOwn(route, request.method) ? route[request.method] : undefined;
    if (!handler) { headers.set("Allow", Object.keys(route).join(", ")); return reply({ error: "method_not_allowed" }, 405); }
    try {
      const response = await handler(request);
      for (const [key, value] of headers) response.headers.set(key, value);
      // Website CDN hints must not override native app freshness.
      response.headers.delete("Netlify-CDN-Cache-Control");
      response.headers.delete("CDN-Cache-Control");
      return response;
    } catch (error) {
      console.error("[oos-app] request failed", path, error instanceof Error ? error.message : "unknown");
      return reply({ error: "request_unavailable" }, 503);
    }
  };
}
