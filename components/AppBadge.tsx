"use client";

// Sets the PWA app icon badge from the same shared aircraft stream used by
// the visible UI. Unsupported browser contexts fail silently.

import { useEffect } from "react";
import {
  EMPTY_AIRCRAFT_SNAPSHOT,
  useAircraft,
} from "@/lib/hooks/useAircraft";

type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void> | void;
  clearAppBadge?: () => Promise<void> | void;
};

export function AppBadge() {
  const snapshot = useAircraft(EMPTY_AIRCRAFT_SNAPSHOT);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const nav = navigator as BadgeNavigator;
    if (typeof nav.setAppBadge !== "function") return;

    let cancelled = false;
    const count = snapshot.aircraft.filter((aircraft) => aircraft.airborne).length;
    const updateBadge = async () => {
      if (cancelled) return;
      try {
        if (count > 0) await nav.setAppBadge?.(count);
        else await nav.clearAppBadge?.();
      } catch {
        // Badge writes can throw on locked or focused-mode contexts.
      }
    };
    void updateBadge();

    return () => {
      cancelled = true;
    };
  }, [snapshot]);

  useEffect(
    () => () => {
      const nav = navigator as BadgeNavigator;
      try {
        void nav.clearAppBadge?.();
      } catch {
        // Ignore cleanup errors from unsupported browser contexts.
      }
    },
    [],
  );

  return null;
}
