"use client";

import { useEffect, useState } from "react";
import { ageAircraftSnapshot, retainAircraftSnapshot } from "../aircraft-freshness";
import { parseNationwideMapSnapshot } from "../nationwide-map";
import type { Aircraft, Snapshot } from "../types";

const REFRESH_MS = 15_000;
const EMPTY_AIRCRAFT: Aircraft[] = [];

/** One map-only read, only while this screen and preference are active. */
export function useNationwideMapAircraft(enabled: boolean) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setSnapshot(null);
    setError(null);
    if (!enabled) return;
    let disposed = false;
    let paused = false;
    let request: AbortController | null = null;
    let generation = 0;
    const cancel = () => { generation++; request?.abort(); request = null; };
    const refresh = async () => {
      if (disposed || paused || document.visibilityState === "hidden" || !navigator.onLine || request) return;
      const controller = new AbortController();
      const current = ++generation;
      request = controller;
      const timeout = window.setTimeout(() => controller.abort(), 12_000);
      try {
        const response = await fetch("/api/map-aircraft", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Nationwide map unavailable");
        const incoming = parseNationwideMapSnapshot(await response.json());
        if (!disposed && !paused && !controller.signal.aborted && current === generation) {
          setSnapshot(previous => ageAircraftSnapshot(retainAircraftSnapshot(previous, incoming), Date.now()));
          setError(null);
        }
      } catch {
        if (!disposed && !paused && current === generation) setError("Nationwide aircraft updates unavailable.");
      } finally {
        window.clearTimeout(timeout);
        if (request === controller) request = null;
      }
    };
    const pause = () => { paused = true; cancel(); };
    const resume = () => { paused = false; void refresh(); };
    const visibility = () => document.visibilityState === "hidden" ? pause() : resume();
    const timer = window.setInterval(() => {
      if (paused || document.visibilityState === "hidden") return;
      setSnapshot(previous => previous ? ageAircraftSnapshot(previous, Date.now()) : null);
      void refresh();
    }, REFRESH_MS);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("pause", pause);
    document.addEventListener("resume", resume);
    window.addEventListener("online", resume);
    window.addEventListener("offline", pause);
    void refresh();
    return () => {
      disposed = true;
      cancel();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("pause", pause);
      document.removeEventListener("resume", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", pause);
    };
  }, [enabled]);
  return { aircraft: enabled ? snapshot?.aircraft ?? EMPTY_AIRCRAFT : EMPTY_AIRCRAFT, error: enabled ? error : null };
}
