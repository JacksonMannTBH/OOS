import { useEffect, useState } from "react";
import {
  STATE_CHANGE_EVENT,
  getSelectedStateCode,
  type StateCode,
} from "@/lib/app-states";
import type { Snapshot } from "@/lib/types";

const POLL_INTERVAL_MS = 30_000;

function aircraftUrl(mockOn: boolean, stateCode: StateCode): string {
  const base = `/api/aircraft?state=${encodeURIComponent(stateCode)}`;
  if (!mockOn) return base;
  const mock =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("mock")
      : null;
  return `${base}&mock=${encodeURIComponent(mock ?? "up")}`;
}

function freshAircraftUrl(mockOn: boolean, stateCode: StateCode): string {
  const url = new URL(aircraftUrl(mockOn, stateCode), window.location.origin);
  url.searchParams.set("_", String(Date.now()));
  return `${url.pathname}${url.search}`;
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
    let cancelled = false;
    const fetchSnapshot = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch(freshAircraftUrl(mockOn, stateCode), {
          cache: "no-store",
        });
        if (!response.ok) return;
        const next = (await response.json()) as Snapshot;
        if (!cancelled) setSnapshot(next);
      } catch {
        // A later poll reconciles transient network failures.
      }
    };

    void fetchSnapshot();
    const interval = window.setInterval(fetchSnapshot, POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void fetchSnapshot();
    };
    const onPageShow = () => void fetchSnapshot();
    const onFocus = () => void fetchSnapshot();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onFocus);
    };
  }, [mockOn, stateCode]);

  return snapshot;
}
