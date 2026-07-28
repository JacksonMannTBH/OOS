import { NextResponse } from "next/server";
import { DEFAULT_STATE_CODE, isStateCode, type StateCode } from "@/lib/app-states";
import { getCatalog } from "@/lib/aircraft-data";
import { liveDataHeaders } from "@/lib/http-cache";
import { getLiveTrackWindow } from "@/lib/tracks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LineFeature = GeoJSON.Feature<
  GeoJSON.LineString,
  { tail: string; count: number }
>;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const requestedState = url.searchParams.get("state");
  const stateCode = isStateCode(requestedState)
    ? requestedState.toUpperCase() as StateCode
    : DEFAULT_STATE_CODE;
  const requestedTails = parseTails(url.searchParams.get("tails"));
  const catalog = await getCatalog(stateCode);
  const allowed = requestedTails.length
    ? catalog.filter((entry) => requestedTails.includes(entry.tail))
    : catalog;

  const features = (
    await Promise.all(
      allowed.map(async (entry): Promise<LineFeature | null> => {
        const points = await getLiveTrackWindow(entry.tail);
        if (points.length < 2) return null;
        return {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: points.map((point) => [point.lon, point.lat]),
          },
          properties: { tail: entry.tail, count: points.length },
        };
      }),
    )
  ).filter((feature): feature is LineFeature => feature !== null);

  return NextResponse.json(
    {
      type: "FeatureCollection",
      features,
      state: stateCode,
      window_minutes: 60,
    },
    {
      headers: liveDataHeaders("query=state|tails"),
    },
  );
}

function parseTails(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((tail) => tail.trim().toUpperCase())
    .filter((tail) => /^[A-Z0-9]{2,12}$/.test(tail))
    .slice(0, 100);
}
