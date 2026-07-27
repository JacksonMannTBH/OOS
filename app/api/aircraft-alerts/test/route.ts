import { NextResponse } from "next/server";
import {
  deleteAircraftAlertSubscriber,
  getAircraftAlertSubscriber,
} from "@/lib/aircraft-alerts/store";
import { sendAircraftAlertPush } from "@/lib/aircraft-alerts/web-push";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as { userId?: unknown } | null;
  const userId = typeof body?.userId === "string" ? body.userId : null;
  if (!userId || !/^[a-f0-9-]{20,80}$/i.test(userId)) {
    return NextResponse.json({ error: "invalid_user" }, { status: 400 });
  }
  const subscriber = await getAircraftAlertSubscriber(userId);
  if (!subscriber?.enabled) {
    return NextResponse.json({ error: "not_subscribed" }, { status: 404 });
  }

  const result = await sendAircraftAlertPush(subscriber.subscription, {
    title: "Aircraft alerts ready",
    body: `Notification test. ${subscriber.stateCode} takeoff alerts are enabled.`,
    url: "/map",
    tag: "aircraft-alert-test",
  });

  if (!result.ok) {
    if (result.reason === "expired") {
      await deleteAircraftAlertSubscriber(userId);
    }
    return NextResponse.json(
      { error: result.reason, statusCode: result.statusCode },
      { status: result.reason === "not_configured" ? 503 : 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
