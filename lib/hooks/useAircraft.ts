"use client";

import { useEffect, useState } from "react";
import {
  STATE_CHANGE_EVENT,
  getSelectedStateCode,
  type StateCode,
} from "@/lib/app-states";
import type { Snapshot } from "@/lib/types";

export const AIRCRAFT_POLL_INTERVAL_MS = 10_000;

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
  const url = new URL(requestPath, window.location.origin);
  url.searchParams.set("_", String(Date.now()));
  return `${url.pathname}${url.search}`;
}

function getAircraftStream(requestPath: string): AircraftStream {
  const existing = streams.get(requestPath);
  if (existing) return existing;
  const stream: AircraftStream = {
    requestPath,
    snapshot: null,
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
    try {
      const response = await fetch(freshAircraftUrl(stream.requestPath), {
        cache: "no-store",
      });
      if (!response.ok) return;
      stream.snapshot = (await response.json()) as Snapshot;
      notifyStream(stream);
    } catch {
      // A later poll, focus, or visibility event reconciles transient failures.
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
    stream.snapshot = seed;
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
  const [snapshot, setSnapshot] = useState(initial);
  const [stateCode, setStateCode] = useState<StateCode>(
    () => getSelectedStateCode(),
  );

  useEffect(() => {
    const onStateChange = (event: Event) => {
      const detail = (event as CustomEvent<{ code?: StateCode }>).detail;
      setStateCode(detail?.code ?? getSelectedStateCode());
    };
    window.addEventListener(STATE_CHANGE_EVENT, onStateChange);
    return () => window.removeEventListener(STATE_CHANGE_EVENT, onStateChange);
  }, []);

  useEffect(() => {
    const requestPath = aircraftUrl(mockOn, stateCode);
    const seed = snapshotMatchesState(initial, stateCode) ? initial : null;
    return subscribeToAircraft(requestPath, setSnapshot, seed);
  }, [initial, mockOn, stateCode]);

  return snapshot;
}
