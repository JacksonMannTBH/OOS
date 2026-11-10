"use client";

import { useEffect, useMemo, useState } from "react";
import { ageAircraftSnapshot, retainAircraftSnapshot } from "../aircraft-freshness";
import { readAircraftCache, saveAircraftCache, readAircraftDisplayCache, saveAircraftDisplayCache } from "../aircraft-cache";
import { AircraftDisplay } from "../aircraft-display";
import { filterTrackedAircraft } from "../aircraft-tracking";
import { useAircraftTracking } from "./useAircraftTracking";
import { useCaliforniaRegion } from "./useCaliforniaRegion";
import { filterAircraftByCaliforniaRegion } from "../california-regions";
import { useSelectedStateId } from "./useSelectedStateId";
import { subscribeLiveState } from "../live-data-client";
import {
  stateCodeForId,
  type StateCode,
} from "@/lib/app-states";
import type { Snapshot } from "@/lib/types";

export const AIRCRAFT_POLL_INTERVAL_MS = 5_000;

export const EMPTY_AIRCRAFT_SNAPSHOT: Snapshot = {
  fetched_at: 0,
  source: "adsbfi",
  aircraft: [],
  live_seen_count: 0,
};

type SnapshotListener = (snapshot: Snapshot) => void;

type AircraftStream = {
  requestPath: string;
  snapshot: Snapshot | null;
  listeners: Set<SnapshotListener>;
  intervalId: number | null;
  inFlight: Promise<void> | null;
};

const streams = new Map<string, AircraftStream>();
const activeStreams = new Set<AircraftStream>();
let globalListenersAttached = false;

function aircraftUrl(mockOn: boolean, stateCode: StateCode): string {
  const base = `/api/aircraft?state=${encodeURIComponent(stateCode)}`;
  if (!mockOn) return base;
  const mock = new URLSearchParams(window.location.search).get("mock");
  return `${base}&mock=${encodeURIComponent(mock ?? "up")}`;
}

function freshAircraftUrl(requestPath: string): string {
  const url = new URL(requestPath, window.location.href);
  url.searchParams.set("_", String(Date.now()));
  return `${url.pathname}${url.search}`;
}

function getAircraftStream(requestPath: string): AircraftStream {
  const existing = streams.get(requestPath);
  if (existing) return existing;
  const stream: AircraftStream = {
    requestPath,
    snapshot: readAircraftCache(requestPath),
    listeners: new Set(),
    intervalId: null,
    inFlight: null,
  };
  streams.set(requestPath, stream);
  return stream;
}

function notifyStream(stream: AircraftStream): void {
  if (!stream.snapshot) return;
  for (const listener of stream.listeners) listener(stream.snapshot);
}

async function fetchStream(stream: AircraftStream): Promise<void> {
  if (document.visibilityState === "hidden" || stream.inFlight) return;

  const request = (async () => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const incoming = await Promise.race([
        fetch(freshAircraftUrl(stream.requestPath), {
          cache: "no-store", signal: controller.signal,
        }).then(async response => {
          if (!response.ok) throw new Error("Aircraft request failed");
          return await response.json() as Snapshot;
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error("Aircraft request timed out"));
          }, 15_000);
        }),
      ]);
      stream.snapshot = retainAircraftSnapshot(stream.snapshot, incoming);
      saveAircraftCache(stream.requestPath, stream.snapshot);
      notifyStream(stream);
    } catch {
      if (stream.snapshot) {
        stream.snapshot = { ...stream.snapshot, source_ok: false };
        notifyStream(stream);
      }
      // A later poll, focus, or visibility event reconciles transient failures.
    } finally {
      clearTimeout(timer);
    }
  })();

  stream.inFlight = request;
  try {
    await request;
  } finally {
    if (stream.inFlight === request) stream.inFlight = null;
  }
}

function refreshActiveStreams(): void {
  if (document.visibilityState === "hidden") return;
  for (const stream of activeStreams) void fetchStream(stream);
}

function onVisibilityChange(): void {
  if (document.visibilityState === "visible") refreshActiveStreams();
}

function attachGlobalListeners(): void {
  if (globalListenersAttached) return;
  globalListenersAttached = true;
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pageshow", refreshActiveStreams);
  window.addEventListener("focus", refreshActiveStreams);
}

function detachGlobalListeners(): void {
  if (!globalListenersAttached || activeStreams.size > 0) return;
  globalListenersAttached = false;
  document.removeEventListener("visibilitychange", onVisibilityChange);
  window.removeEventListener("pageshow", refreshActiveStreams);
  window.removeEventListener("focus", refreshActiveStreams);
}

function startStream(stream: AircraftStream): void {
  if (stream.intervalId != null) return;
  activeStreams.add(stream);
  attachGlobalListeners();
  void fetchStream(stream);
  stream.intervalId = window.setInterval(
    () => void fetchStream(stream),
    AIRCRAFT_POLL_INTERVAL_MS,
  );
}

function stopStream(stream: AircraftStream): void {
  if (stream.intervalId != null) {
    window.clearInterval(stream.intervalId);
    stream.intervalId = null;
  }
  activeStreams.delete(stream);
  detachGlobalListeners();
}

function subscribeToAircraft(
  requestPath: string,
  listener: SnapshotListener,
  seed: Snapshot | null,
): () => void {
  const stream = getAircraftStream(requestPath);
  stream.listeners.add(listener);

  if (
    seed &&
    (!stream.snapshot || seed.fetched_at > stream.snapshot.fetched_at)
  ) {
    stream.snapshot = retainAircraftSnapshot(stream.snapshot, seed);
    notifyStream(stream);
  } else if (stream.snapshot) {
    listener(stream.snapshot);
  }

  if (stream.listeners.size === 1) startStream(stream);

  return () => {
    stream.listeners.delete(listener);
    if (stream.listeners.size === 0) stopStream(stream);
  };
}

function snapshotMatchesState(
  snapshot: Snapshot,
  stateCode: StateCode,
): boolean {
  const stateCodes = snapshot.aircraft
    .map((aircraft) => aircraft.home_state_code)
    .filter((code): code is string => Boolean(code));
  return (
    stateCodes.length === 0 ||
    stateCodes.every((code) => code.toUpperCase() === stateCode)
  );
}

export function useAircraft(initial: Snapshot, mockOn = false): Snapshot {
  const region = useCaliforniaRegion();
  const preferences = useAircraftTracking();
  const [snapshot, setSnapshot] = useState(initial);
  const [now, setNow] = useState(initial.fetched_at);
  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), AIRCRAFT_POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);
  const stateCode = stateCodeForId(useSelectedStateId());

  useEffect(() => {
    const requestPath = aircraftUrl(mockOn, stateCode);
    const seed = snapshotMatchesState(initial, stateCode) ? initial : null;
    if (!mockOn) {
      const cached = readAircraftCache(requestPath);
      const raw = cached && (!seed || cached.fetched_at > seed.fetched_at) ? cached : seed;
      const display = new AircraftDisplay(raw, readAircraftDisplayCache(requestPath));
      let paused = document.visibilityState === "hidden";
      const publish = (persist = false) => {
        if (!display.snapshot) return;
        setSnapshot(display.snapshot);
        if (persist) saveAircraftDisplayCache(requestPath, display.snapshot);
      };
      const pause = () => { paused = true; display.hold(); publish(true); };
      const resume = () => { paused = false; display.hold(); };
      const visibility = () => document.visibilityState === "hidden" ? pause() : resume();
      document.addEventListener("pause", pause);
      document.addEventListener("resume", resume);
      document.addEventListener("visibilitychange", visibility);
      publish();
      const timer = window.setInterval(() => { display.tick(Date.now()); publish(); }, AIRCRAFT_POLL_INTERVAL_MS);
      const unsubscribe = subscribeLiveState(stateCode, (update, delivery) => {
        display.receive(update.snapshot, !delivery.fromCache && !paused, Date.now());
        if (display.rawSnapshot) saveAircraftCache(requestPath, display.rawSnapshot);
        publish(true);
      });
      return () => {
        if (display.snapshot) saveAircraftDisplayCache(requestPath, display.snapshot);
        window.clearInterval(timer);
        document.removeEventListener("pause", pause);
        document.removeEventListener("resume", resume);
        document.removeEventListener("visibilitychange", visibility);
        unsubscribe();
      };
    }
    return subscribeToAircraft(requestPath, setSnapshot, seed);
  }, [initial, mockOn, stateCode]);

  return useMemo(() => {
    if (!snapshotMatchesState(snapshot, stateCode)) return EMPTY_AIRCRAFT_SNAPSHOT;
    const shown = mockOn ? ageAircraftSnapshot(snapshot, now) : snapshot;
    return { ...shown, aircraft: filterAircraftByCaliforniaRegion(filterTrackedAircraft(shown.aircraft, preferences, stateCode), stateCode, region) };
  }, [snapshot, preferences, stateCode, now, mockOn, region]);
}
