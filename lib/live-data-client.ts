"use client";

import { RealtimeClient } from "@supabase/realtime-js";
import backend from "../mobile/backend.json";
import { type StateCode } from "./app-states";
import { isLiveState, LiveStateAssembler, liveTopic, type LiveState } from "./live-data-protocol";
import { AircraftDeltaAssembler, aircraftDeltaTopic, isAircraftFullMessage } from "./aircraft-delta-protocol";

type Listener = (update: LiveState, delivery: { fromCache: boolean }) => void;
type OpenChannel = (receive: (frame: unknown) => void, subscribed: () => void, version: 2 | 3) => () => void;

// Nationwide ingestion currently takes about 20 seconds; allow two missed cycles.
const LIVE_SILENCE_TIMEOUT_MS = 60_000;

/** Shared by every screen/layer using a state; no recurring data requests. */
export class LiveStateStream {
  private listeners = new Set<Listener>();
  private assembler: LiveStateAssembler;
  private deltaAssembler: AircraftDeltaAssembler;
  private version: 2 | 3 = 2;
  private latest: LiveState | null = null;
  private close: (() => void) | null = null;
  private request: AbortController | null = null;
  private lastData = 0;
  private lastRecovery = -Infinity;
  private generation = 0;
  constructor(
    private readonly state: StateCode,
    private open: OpenChannel,
    private load: (signal: AbortSignal) => Promise<unknown>,
    private now = Date.now,
  ) {
    this.assembler = new LiveStateAssembler(state);
    this.deltaAssembler = new AircraftDeltaAssembler(state);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    if (this.latest) listener(this.latest, { fromCache: true });
    return () => { this.listeners.delete(listener); if (!this.listeners.size) this.suspend(); };
  }

  private deliver(update: LiveState | null): void {
    // During a protocol change the shared baseline may briefly lag the previous
    // channel. Keep the newest visible state while the new receiver catches up.
    if (!update || (this.latest && update.revision < this.latest.revision)) return;
    this.latest = update;
    this.lastData = this.now();
    for (const listener of this.listeners) listener(update, { fromCache: false });
  }

  resume(): void {
    if (this.close || !this.listeners.size) return;
    this.lastRecovery = this.now();
    const generation = ++this.generation;
    // Read after joining so an update cannot fall into the read/join gap.
    this.close = this.open(
      frame => {
        if (generation !== this.generation) return;
        const assembler = this.version === 3 ? this.deltaAssembler : this.assembler;
        this.deliver(assembler.acceptFrame(frame));
        if (assembler.needsResync) void this.bootstrap();
      },
      () => { if (generation === this.generation) void this.bootstrap(); },
      this.version,
    );
  }

  private async bootstrap(): Promise<void> {
    if (this.request) return;
    const controller = new AbortController();
    const generation = this.generation;
    this.request = controller;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const update = await this.load(controller.signal);
      if (!controller.signal.aborted && generation === this.generation && this.listeners.size) {
        const isV3 = isAircraftFullMessage(update, this.state);
        if (!isV3 && !isLiveState(update, this.state)) throw new Error("Invalid live baseline");
        const nextVersion = isV3 ? 3 : 2;
        const switching = nextVersion !== this.version;
        if (switching) {
          this.version = nextVersion;
          this.assembler = new LiveStateAssembler(this.state);
          this.deltaAssembler = new AircraftDeltaAssembler(this.state);
        }
        this.deliver(isV3 ? this.deltaAssembler.acceptFull(update) : this.assembler.acceptState(update as LiveState));
        if (switching) {
          // The existing backend ignores version=3 and returns v1. After rollout
          // a validated v3 baseline opts this app into the separate v3 topic.
          // Join, then read again to cover messages sent during the channel switch.
          // Returning v1 later also safely rolls the app back to the legacy feed.
          this.suspend();
          this.resume();
        }
      }
    } catch { /* Keep last-known data; the watchdog or reconnect recovers. */ }
    finally { clearTimeout(timeout); if (this.request === controller) this.request = null; }
  }

  suspend(): void {
    this.generation++;
    this.request?.abort();
    this.request = null;
    this.close?.();
    this.close = null;
  }

  checkHealth(): void {
    if (!this.listeners.size) return;
    // Only recover when updates stop. This timer never fetches on a healthy stream.
    if (this.now() - Math.max(this.lastData, this.lastRecovery) < LIVE_SILENCE_TIMEOUT_MS) return;
    this.suspend();
    this.resume();
    // A blocked WebSocket should still allow a bounded recovery read.
    void this.bootstrap();
  }
}

let realtime: RealtimeClient | null = null;
const streams = new Map<StateCode, LiveStateStream>();
let subscribers = 0;
let watchdog: ReturnType<typeof setInterval> | null = null;
let nativePaused = false;

function getRealtime(): RealtimeClient {
  if (!realtime) realtime = new RealtimeClient(`${new URL(backend.url).origin}/realtime/v1`, {
    params: { apikey: backend.publishableKey },
    // The gateway resolves a publishable key to the anon role; it is not a JWT.
    accessToken: async () => null,
  });
  return realtime;
}

function getStream(state: StateCode): LiveStateStream {
  let stream = streams.get(state);
  if (stream) return stream;
  stream = new LiveStateStream(state, (receive, subscribed, version) => {
    const client = getRealtime();
    const channel = client.channel(version === 3 ? aircraftDeltaTopic(state) : liveTopic(state), { config: { private: true } })
      .on("broadcast", { event: "state" }, ({ payload }) => receive(payload));
    channel.subscribe(status => { if (status === "SUBSCRIBED") subscribed(); });
    return () => { void client.removeChannel(channel); };
  }, async signal => {
    const response = await fetch(`/api/live?state=${state}&version=3`, { cache: "no-store", signal });
    if (!response.ok) throw new Error("Live data unavailable");
    return response.json();
  });
  streams.set(state, stream);
  return stream;
}

function refreshConnections(): void {
  if (nativePaused || document.visibilityState === "hidden" || !navigator.onLine) {
    for (const stream of streams.values()) stream.suspend();
    // A suspended iOS WebView can leave the old socket/channel half-closed.
    // Recreate the transport on return while retaining each stream's data.
    const previous = realtime;
    realtime = null;
    void previous?.disconnect();
    return;
  }
  for (const stream of streams.values()) { stream.resume(); stream.checkHealth(); }
}

function pauseConnections(): void { nativePaused = true; refreshConnections(); }
function resumeConnections(): void { nativePaused = false; refreshConnections(); }

export function subscribeLiveState(state: StateCode, listener: Listener): () => void {
  const stream = getStream(state);
  const unsubscribe = stream.subscribe(listener);
  if (subscribers++ === 0) {
    document.addEventListener("visibilitychange", refreshConnections);
    document.addEventListener("pause", pauseConnections);
    document.addEventListener("resume", resumeConnections);
    window.addEventListener("online", refreshConnections);
    window.addEventListener("offline", refreshConnections);
    window.addEventListener("pageshow", refreshConnections);
    watchdog = setInterval(refreshConnections, 15_000);
  }
  refreshConnections();
  return () => {
    unsubscribe();
    if (--subscribers === 0) {
      document.removeEventListener("visibilitychange", refreshConnections);
      document.removeEventListener("pause", pauseConnections);
      document.removeEventListener("resume", resumeConnections);
      window.removeEventListener("online", refreshConnections);
      window.removeEventListener("offline", refreshConnections);
      window.removeEventListener("pageshow", refreshConnections);
      if (watchdog) clearInterval(watchdog);
      watchdog = null;
      realtime?.disconnect();
      realtime = null;
      nativePaused = false;
    }
  };
}
