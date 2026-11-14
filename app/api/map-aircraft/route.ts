import { getNationalMapSnapshot } from "@/lib/aircraft-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try { return Response.json(await getNationalMapSnapshot(), { headers }); }
  catch { return Response.json({ error: "map_aircraft_unavailable" }, { status: 503, headers }); }
}
