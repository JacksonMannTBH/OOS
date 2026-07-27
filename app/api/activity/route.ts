import { NextResponse } from "next/server";
import { getRecentActivity } from "@/lib/activity";
import { getAppState } from "@/lib/app-states";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(500, Math.floor(limitRaw)))
    : 50;
  const stateParam = url.searchParams.get("state_id");
  const stateId = stateParam ? getAppState(stateParam).id : undefined;
  const entries = await getRecentActivity(limit, stateId);
  return NextResponse.json(
    { entries, fetched_at: Date.now() },
    {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=8, stale-while-revalidate=30",
      },
    },
  );
}
