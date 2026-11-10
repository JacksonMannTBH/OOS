import { getAircraftCatalogEntries } from "@/lib/aircraft-data";
import { getRegistry } from "@/lib/registry";
import { getFlightById, getMostRecentFlightForTail, parseFlightId } from "@/lib/flights";
import { getSpeedWarningEnabled } from "@/lib/flags";
import { parseMobileDataRequest } from "@/lib/mobile-data-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = parseMobileDataRequest(request.url);
  if (!query) return Response.json({ error: "invalid_request" }, { status: 400 });
  const reply = (data: unknown) => Response.json(data, { headers: { "Cache-Control": "no-store" } });
  try {
    switch (query.kind) {
      case "catalog": return reply(await getAircraftCatalogEntries());
      case "settings": return reply({ speedWarningEnabled: await getSpeedWarningEnabled() });
      default: {
        const entry = (await getRegistry()).find(item => item.tail === query.tail);
        if (!entry) return Response.json({ error: "not_found" }, { status: 404 });
        if (query.kind === "recent-flight") return reply(await getMostRecentFlightForTail(query.tail, entry.nickname));
        if (!parseFlightId(query.flightId)) return Response.json({ error: "invalid_flight" }, { status: 400 });
        return reply(await getFlightById(query.tail, entry.nickname, query.flightId));
      }
    }
  } catch {
    return Response.json({ error: "data_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
