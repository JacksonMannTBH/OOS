"use client";
import { useEffect, useState } from "react";
import { stateCodeForId } from "../app-states";
import { useSelectedStateId } from "./useSelectedStateId";
import { activePoliceSightings, type PoliceSighting } from "../police-sightings";

export const POLICE_REFRESH_EVENT = "oos-police-refresh";
export function usePoliceSightings(enabled = true) {
  const state = stateCodeForId(useSelectedStateId());
  const [stored, setStored] = useState<PoliceSighting[]>([]);
  const [now, setNow] = useState(Date.now);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const reload = () => setRefresh(n => n + 1);
    window.addEventListener(POLICE_REFRESH_EVENT, reload);
    return () => window.removeEventListener(POLICE_REFRESH_EVENT, reload);
  }, []);
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let controller: AbortController | null = null;
    let lastFetch = 0;
    let serverOffset = 0;
    const tick = async () => {
      setNow(Date.now() + serverOffset);
      if (disposed || document.visibilityState === "hidden" || !navigator.onLine || controller || Date.now() - lastFetch < 15_000) return;
      lastFetch = Date.now();
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 10_000);
      try {
        const response = await fetch(`/api/police?state=${encodeURIComponent(state)}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        if (!disposed && Array.isArray(data.sightings) && Number.isFinite(data.serverTime)) {
          serverOffset = data.serverTime - Date.now();
          setNow(data.serverTime);
          setStored(data.sightings);
        }
      } catch { /* Retained reports still expire while offline. */ }
      finally { clearTimeout(timeout); controller = null; }
    };
    const resume = () => { lastFetch = 0; void tick(); };
    void tick();
    const interval = window.setInterval(() => void tick(), 1_000);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => {
      disposed = true;
      controller?.abort();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
    };
  }, [state, enabled, refresh]);
  return enabled ? activePoliceSightings(stored, state, now) : [];
}
