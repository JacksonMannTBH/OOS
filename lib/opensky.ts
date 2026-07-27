// OpenSky Network adapter — OAuth2 client_credentials + authenticated state fetch.
//
// Auth: OpenSky deprecated basic auth in March 2025; access tokens come from the
// Keycloak realm and live about 30 minutes. Tokens are cached in Supabase.
// When credentials are absent, requests use the anonymous, rate-limited path.

import { cacheGet, cacheSet } from "./cache";
import { readServerEnv } from "./supabase/server";
import type { NormalizedAc } from "./types";

const AUTH_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const STATES_URL = "https://opensky-network.org/api/states/all";

const TOKEN_KEY = "opensky:token";
const CREDITS_KEY = "opensky:credits_remaining";

const UA = "OutOfSight/0.1";

type CachedToken = { access_token: string; expires_at: number };

/**
 * Returns a valid OpenSky access token, refreshing via client_credentials when
 * the cached one is missing or within 60s of expiry. Returns null when the env
 * has no credentials (signals: fall back to anonymous requests).
 */
export async function getOpenskyToken(): Promise<string | null> {
  const id = readServerEnv("OPENSKY_CLIENT_ID");
  const secret = readServerEnv("OPENSKY_CLIENT_SECRET");
  if (!id || !secret) return null;

  const cached = await cacheGet<CachedToken>(TOKEN_KEY);
  if (cached && cached.expires_at > Date.now() + 60_000) {
    return cached.access_token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: id,
    client_secret: secret,
  });
  const r = await fetch(AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
    },
    body,
    cache: "no-store",
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(`opensky auth ${r.status}: ${detail.slice(0, 200)}`);
  }
  const j = (await r.json()) as { access_token: string; expires_in: number };
  const expiresIn = Math.max(60, j.expires_in);
  const token: CachedToken = {
    access_token: j.access_token,
    expires_at: Date.now() + expiresIn * 1000,
  };
  // Keep the entry for 24h so health checks can use its presence as evidence
  // that authentication has worked recently. Token refresh can be slow enough
  // that re-authing on each health hit is not viable. The
  // inner `expires_at` still drives refresh when fetchOpenSky actually needs
  // a usable token.
  const cacheSeconds = 24 * 60 * 60;
  await cacheSet(TOKEN_KEY, token, cacheSeconds);
  return token.access_token;
}

/** Returns the cached token entry without triggering a refresh. */
export async function peekOpenskyToken(): Promise<CachedToken | null> {
  return await cacheGet<CachedToken>(TOKEN_KEY);
}

/**
 * Force-expires the cached token so the next caller fetches a fresh one. The
 * A short-lived sentinel keeps refresh behavior deterministic.
 */
async function clearOpenskyToken(): Promise<void> {
  await cacheSet(TOKEN_KEY, { access_token: "", expires_at: 0 }, 1);
}

type OpenSkyResp = { time: number; states: unknown[][] | null };

function normalizeStates(states: unknown[][]): NormalizedAc[] {
  // states_vector schema (positional):
  // [0]=icao24 [5]=lon [6]=lat [7]=baro_alt(m) [8]=on_ground [9]=velocity(m/s)
  // [10]=true_track [14]=squawk
  return states.map((s) => ({
    hex: String(s[0] ?? "").toLowerCase(),
    lon: typeof s[5] === "number" ? (s[5] as number) : undefined,
    lat: typeof s[6] === "number" ? (s[6] as number) : undefined,
    alt_baro:
      s[8] === true
        ? "ground"
        : typeof s[7] === "number"
          ? Math.round((s[7] as number) * 3.28084) // m → ft
          : undefined,
    gs:
      typeof s[9] === "number"
        ? Math.round((s[9] as number) * 1.94384) // m/s → kt
        : undefined,
    track: typeof s[10] === "number" ? (s[10] as number) : undefined,
    squawk: typeof s[14] === "string" ? (s[14] as string) : null,
  }));
}

/**
 * Fetch OpenSky states for the given ICAO24 hex list, normalized to the same
 * shape adsb.fi gets normalized to. Throws on rate-limit or upstream error so
 * the caller can fall through (or surface stale data).
 */
export async function fetchOpenSky(hexes: string[]): Promise<NormalizedAc[]> {
  if (hexes.length === 0) return [];
  const url = `${STATES_URL}?icao24=${hexes.join(",")}`;

  const doFetch = async (): Promise<Response> => {
    const token = await getOpenskyToken();
    const headers: Record<string, string> = { "User-Agent": UA };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { headers, cache: "no-store" });
  };

  let r = await doFetch();
  if (r.status === 401) {
    await clearOpenskyToken();
    r = await doFetch();
  }
  if (r.status === 429) {
    const remaining = r.headers.get("X-Rate-Limit-Remaining");
    const retryAfter = r.headers.get("X-Rate-Limit-Retry-After-Seconds");
    console.warn(
      `[opensky] 429 rate-limited; remaining=${remaining}, retry-after=${retryAfter}s`,
    );
    if (remaining != null) await stashCredits(remaining);
    throw new Error("opensky 429 rate-limited");
  }
  if (!r.ok) {
    throw new Error(`opensky ${r.status}`);
  }

  const remaining = r.headers.get("X-Rate-Limit-Remaining");
  if (remaining != null) await stashCredits(remaining);

  const j = (await r.json()) as OpenSkyResp;
  return normalizeStates(j.states ?? []);
}

async function stashCredits(raw: string): Promise<void> {
  const n = Number(raw);
  if (Number.isFinite(n)) {
    // 24h TTL: credits reset daily and we want the value visible to the
    // health endpoint long after the last fetch.
    await cacheSet(CREDITS_KEY, n, 24 * 60 * 60);
  }
}

export async function getOpenskyCreditsRemaining(): Promise<number | null> {
  return await cacheGet<number>(CREDITS_KEY);
}
