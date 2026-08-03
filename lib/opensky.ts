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

export function normalizeOpenSkyStates(
  states: unknown[][],
  responseTimeSeconds: number,
): NormalizedAc[] {
  // states_vector schema (positional):
  // [0]=icao24 [3]=position time [4]=last contact [5]=lon [6]=lat
  // [7]=baro_alt(m) [8]=on_ground [9]=velocity(m/s)
  // [10]=true_track [14]=squawk
  const referenceTimeSeconds = Number.isFinite(responseTimeSeconds)
    ? responseTimeSeconds
    : Date.now() / 1_000;
  const responseTimeMs = referenceTimeSeconds * 1_000;
  const normalized: NormalizedAc[] = [];

  for (const state of states) {
    const lastContactSeconds = finiteNumber(state[4]);
    if (
      lastContactSeconds != null &&
      referenceTimeSeconds - lastContactSeconds > 60
    ) {
      continue;
    }
    const positionSeconds = finiteNumber(state[3]);
    const positionIsCurrent =
      positionSeconds == null || referenceTimeSeconds - positionSeconds <= 60;
    const observedAtMs = lastContactSeconds != null
      ? lastContactSeconds * 1_000
      : responseTimeMs;

    normalized.push({
      hex: String(state[0] ?? "").toLowerCase(),
      lon: positionIsCurrent ? finiteNumber(state[5]) : undefined,
      lat: positionIsCurrent ? finiteNumber(state[6]) : undefined,
      alt_baro:
        state[8] === true
          ? "ground"
          : typeof state[7] === "number"
            ? Math.round((state[7] as number) * 3.28084)
            : undefined,
      gs:
        typeof state[9] === "number"
          ? Math.round((state[9] as number) * 1.94384)
          : undefined,
      track:
        typeof state[10] === "number" ? (state[10] as number) : undefined,
      squawk: typeof state[14] === "string" ? (state[14] as string) : null,
      observed_at_ms: observedAtMs,
      position_observed_at_ms:
        positionIsCurrent &&
        finiteNumber(state[5]) != null &&
        finiteNumber(state[6]) != null
          ? (positionSeconds ?? lastContactSeconds ?? referenceTimeSeconds) * 1_000
          : undefined,
    });
  }

  return normalized;
}

/**
 * Fetch OpenSky states for the given ICAO24 hex list, normalized to the same
 * shape adsb.fi gets normalized to. Throws on rate-limit or upstream error so
 * the caller can fall through (or surface stale data).
 */
export async function fetchOpenSky(hexes: string[]): Promise<NormalizedAc[]> {
  if (hexes.length === 0) return [];
  const url = buildOpenSkyStatesUrl(hexes);

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
  return normalizeOpenSkyStates(j.states ?? [], j.time);
}

export function buildOpenSkyStatesUrl(hexes: string[]): string {
  const url = new URL(STATES_URL);
  for (const hex of hexes) {
    url.searchParams.append("icao24", hex.toLowerCase());
  }
  return url.toString();
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

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}
