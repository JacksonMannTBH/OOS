import { DEFAULT_STATE_CODE, isSupportedStateCode, type StateCode } from "@/lib/app-states";
import { getLiveState } from "@/lib/live-data-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Initial connection / recovery only. Updates arrive over the live channel.
export async function GET(request: Request) {
  const state = new URL(request.url).searchParams.get("state") ?? DEFAULT_STATE_CODE;
  if (!isSupportedStateCode(state)) return Response.json({ error: "invalid_state" }, { status: 400 });
  return Response.json(await getLiveState(state.toUpperCase() as StateCode), {
    headers: { "Cache-Control": "no-store" },
  });
}
