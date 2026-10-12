import { NextResponse } from "next/server";
import { DEFAULT_STATE_CODE, isStateCode, type StateCode } from "@/lib/app-states";
import { liveDataHeaders } from "@/lib/http-cache";
import { getSnapshotForRender } from "@/lib/snapshot";
import { applyMockState, getMockStateFromRequest } from "@/lib/mock-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requested = new URL(req.url).searchParams.get("state");
  const stateCode = isStateCode(requested)
    ? requested.toUpperCase() as StateCode
    : DEFAULT_STATE_CODE;
  const snapshot = await getSnapshotForRender(stateCode);
  return NextResponse.json(
    applyMockState(snapshot, getMockStateFromRequest(req)),
    {
      headers: liveDataHeaders("query=state|mock"),
    },
  );
}
