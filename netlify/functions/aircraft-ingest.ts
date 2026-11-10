// Retired: Supabase Cron owns aircraft ingestion and notification delivery.
// Keep this unscheduled tombstone so a later website build cannot restart it.
export default async function aircraftIngest(): Promise<Response> {
  return Response.json({ error: "worker_moved_to_supabase" }, { status: 410 });
}
