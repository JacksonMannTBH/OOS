import { NextResponse } from "next/server";
import {
  stateCodeFromCensusResponse,
  validCoordinates,
} from "@/lib/location-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CENSUS_COORDINATES_URL =
  "https://geocoding.geo.census.gov/geocoder/geographies/coordinates";

export async function POST(req: Request) {
  let body: { lat?: unknown; lon?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const lat = typeof body.lat === "number" ? body.lat : Number.NaN;
  const lon = typeof body.lon === "number" ? body.lon : Number.NaN;
  if (!validCoordinates(lat, lon)) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const url = new URL(CENSUS_COORDINATES_URL);
  url.searchParams.set("x", String(lon));
  url.searchParams.set("y", String(lat));
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("vintage", "Current_Current");
  url.searchParams.set("format", "json");

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Census geocoder returned ${response.status}`);
    const stateCode = stateCodeFromCensusResponse(await response.json());
    return NextResponse.json(
      { stateCode },
      { status: stateCode ? 200 : 404, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "State lookup unavailable" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
