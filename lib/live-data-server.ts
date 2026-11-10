import { getDatabaseSnapshot } from "./aircraft-data";
import { getCurrentFlightTrack } from "./tracks";
import { SUPPORTED_STATE_CODES, type StateCode } from "./app-states";
import { encodeLiveState, liveTopic, type LiveState } from "./live-data-protocol";
import { readServerEnv } from "./supabase/server";

/** Build once per state, independently of the number of connected devices. */
export async function getLiveState(state: StateCode): Promise<LiveState> {
  const revision = Date.now();
  const snapshot = await getDatabaseSnapshot(state);
  const entries = await Promise.all(snapshot.aircraft.filter(a => a.airborne || a.last_known_airborne).map(async a => {
    const track = await getCurrentFlightTrack(a.tail, revision);
    return [a.tail, (track?.points ?? []).map(({ lat, lon, ts }) => ({ lat, lon, ts }))] as const;
  }));
  return { version: 1, state, revision, snapshot, trails: Object.fromEntries(entries) };
}

export async function broadcastLiveStates(sourceUnavailable = false): Promise<void> {
  const url = readServerEnv("SUPABASE_URL");
  const key = readServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Live backend is not configured");
  await Promise.all(SUPPORTED_STATE_CODES.map(async state => {
    const update = await getLiveState(state);
    if (sourceUnavailable) update.snapshot = {
      ...update.snapshot, source_ok: false, source_error: "Aircraft feed is temporarily unavailable.",
    };
    const frames = encodeLiveState(update);
    // Bounded batches keep full-flight histories below HTTP/message limits.
    for (let offset = 0; offset < frames.length; offset += 4) {
      const response = await fetch(`${url}/realtime/v1/api/broadcast`, {
        method: "POST", signal: AbortSignal.timeout(5_000),
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messages: frames.slice(offset, offset + 4).map(payload => ({
          topic: liveTopic(state), event: "state", private: true, payload,
        })) }),
      });
      if (!response.ok) throw new Error(`Live broadcast failed (${response.status})`);
    }
  }));
}
