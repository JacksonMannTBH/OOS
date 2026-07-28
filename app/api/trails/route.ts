// /api/trails — recent track-history slice for currently-airborne tails.
// Powers the polyline trail layer on /map (components/AircraftTrailLayer).
//
// Query: GET /api/trails?tails=N305DK,N2446X
// Response: { trails: { [tail]: [{ lat, lon, ts }] } }
//   - Coordinates only (no alt/speed) — the trail layer doesn't need them
//     and dropping fields keeps the payload small.
//   - Sorted ascending by ts so a polyline reads from oldest → newest.

import { NextResponse } from "next/server";
import { liveDataHeaders } from "@/lib/http-cache";
import { getCurrentFlightTrack, getLiveTrackWindow } from "@/lib/tracks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TAILS = 32;

function parseTails(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z0-9]{2,12}$/.test(s))
    .slice(0, MAX_TAILS);
}

type TrailPoint = { lat: number; lon: number; ts: number };

async function trailFor(
  tail: string,
  nowMs: number,
): Promise<TrailPoint[]> {
  const live = await getLiveTrackWindow(tail, nowMs);
  if (live.length > 0) {
    return live.map((p) => ({ lat: p.lat, lon: p.lon, ts: p.ts }));
  }

  const track = await getCurrentFlightTrack(tail, nowMs);
  return (track?.points ?? []).map((p) => ({ lat: p.lat, lon: p.lon, ts: p.ts }));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tails = parseTails(url.searchParams.get("tails"));
  if (tails.length === 0) {
    return NextResponse.json({ trails: {} });
  }

  const nowMs = Date.now();
  const entries = await Promise.all(
    tails.map(
      async (t) => [t, await trailFor(t, nowMs)] as const,
    ),
  );
  const trails: Record<string, TrailPoint[]> = {};
  for (const [tail, points] of entries) {
    if (points.length > 0) trails[tail] = points;
  }
  return NextResponse.json(
    { trails },
    {
      headers: liveDataHeaders("query=tails"),
    },
  );
}
