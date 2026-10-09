import { NextResponse } from "next/server";
import { getAircraftCatalogEntries } from "@/lib/aircraft-data";
import { getRegistry } from "@/lib/registry";
import { getFlightById, getMostRecentFlightForTail, parseFlightId } from "@/lib/flights";
import { getForecastGrid } from "@/lib/predictor";
import { getLearningState } from "@/lib/learning";
import { getSpeedWarningEnabled } from "@/lib/flags";
import { parseMobileDataRequest } from "@/lib/mobile-data-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = parseMobileDataRequest(request.url);
  if (!query) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const reply = (data: unknown) => NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  try {
    switch (query.kind) {
      case "catalog": return reply(await getAircraftCatalogEntries());
      case "settings": return reply({ speedWarningEnabled: await getSpeedWarningEnabled() });
      case "forecast": {
        const [grid, learning] = await Promise.all([getForecastGrid(), getLearningState()]);
        return reply({ grid, learning });
      }
      default: {
        const entry = (await getRegistry()).find(item => item.tail === query.tail);
        if (!entry) return NextResponse.json({ error: "not_found" }, { status: 404 });
        if (query.kind === "recent-flight") return reply(await getMostRecentFlightForTail(query.tail, entry.nickname));
        if (!parseFlightId(query.flightId)) return NextResponse.json({ error: "invalid_flight" }, { status: 400 });
        return reply(await getFlightById(query.tail, entry.nickname, query.flightId));
      }
    }
  } catch {
    return NextResponse.json({ error: "data_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
