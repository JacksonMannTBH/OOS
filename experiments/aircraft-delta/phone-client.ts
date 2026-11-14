/** Replaces lib/live-data-client.ts only inside the isolated OOS Test build. */
import backend from "../../mobile/backend.json";
import type { StateCode } from "../../lib/app-states";
import type { LiveState } from "../../lib/live-data-protocol";
import { AircraftDeltaStream } from "./stream";
import { scenarios } from "./scenarios";

const streams = new Map<StateCode, AircraftDeltaStream>();
const status = { connection: "Connecting to your Mac…", updates: 0, downloads: 0, bytes: 0, tests: 0, dropped: 0, resumes: 0, recovered: 0 };
let paused = false, skip = false, recoveryPending = false, checked = false;
const changed = () => window.dispatchEvent(new CustomEvent("oos-test-status", { detail: { ...status } }));
const report = (event: string, extra: object = {}) => {
  void fetch("/api/test/telemetry", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, ...status, ...extra }) }).catch(() => {});
};
export const testStatus = () => ({ ...status });
export function testRecovery() { skip = true; status.connection = "Testing recovery…"; changed(); }
function refresh() {
  for (const s of streams.values()) {
    if (paused || document.visibilityState === "hidden" || !navigator.onLine) s.suspend();
    else { s.resume(); s.checkHealth(); }
  }
}
document.addEventListener("pause", () => { paused = true; report("background"); refresh(); });
document.addEventListener("resume", () => { paused = false; status.resumes++; report("foreground"); refresh(); });
document.addEventListener("visibilitychange", refresh);
window.addEventListener("online", refresh); window.addEventListener("offline", refresh);
setInterval(refresh, 5_000);

export function subscribeLiveState(state: StateCode, listener: (data: LiveState, delivery: { fromCache: boolean }) => void) {
  if (!checked) {
    checked = true;
    try { for (const s of scenarios) { s.run(); status.tests++; } report("phone-checks-passed"); }
    catch (error) { report("phone-check-failed", { error: String(error) }); }
  }
  let stream = streams.get(state);
  if (!stream) {
    stream = new AircraftDeltaStream(state, (receive, joined) => {
      const url = new URL(backend.url.replace(/^http/, "ws") + "/test/stream");
      url.searchParams.set("state", state); url.searchParams.set("key", backend.publishableKey);
      const ws = new WebSocket(url);
      ws.onopen = () => { status.connection = "Connected · recorded flights"; changed(); report("connected", { state }); joined(); };
      ws.onmessage = event => {
        const frames: unknown[] = JSON.parse(String(event.data));
        status.bytes += new TextEncoder().encode(String(event.data)).length;
        if (skip) { skip = false; recoveryPending = true; status.dropped++; report("dropped-update", { state }); return; }
        for (const frame of frames) receive(frame);
      };
      ws.onerror = () => { status.connection = "Connect to the same Wi-Fi as your Mac"; changed(); };
      return () => { ws.onmessage = null; ws.onopen = null; ws.onerror = null; ws.close(); };
    }, async signal => {
      status.downloads++; changed();
      const response = await fetch(`/api/test/baseline?state=${state}`, { signal, cache: "no-store" });
      if (!response.ok) throw new Error("Local test feed unavailable");
      const baseline = await response.json();
      if (recoveryPending) { recoveryPending = false; status.recovered++; report("recovered", { state }); }
      return baseline;
    });
    streams.set(state, stream);
  }
  let subscribing = true;
  const stop = stream.subscribe(data => {
    if (!subscribing) { status.updates++; status.connection = "Connected · recorded flights"; changed();
      if (status.updates === 1 || status.updates % 12 === 0) report("received", { state, aircraft: data.snapshot.aircraft.length, revision: data.revision }); }
    listener(data, { fromCache: subscribing });
  });
  subscribing = false; refresh(); return stop;
}
