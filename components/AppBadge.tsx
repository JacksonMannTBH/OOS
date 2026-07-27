"use client";

// Sets the PWA app icon badge to the count of currently-airborne
// alert-class fleet members (fixed_wing + patrol + unknown). SAR /
// transport are explicitly NOT counted — riders care about
// enforcement, not rescues. Pure browser API, no server changes.
// Fails silently on browsers that don't support the Badging API
// (Safari, most desktop installs).

import { useEffect } from "react";

type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void> | void;
  clearAppBadge?: () => Promise<void> | void;
};

const POLL_INTERVAL_MS = 30_000;
const ALERT_ROLES: ReadonlySet<string> = new Set(["fixed_wing", "patrol", "unknown"]);

export function AppBadge() {
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const nav = navigator as BadgeNavigator;
    if (typeof nav.setAppBadge !== "function") return;

    let cancelled = false;

    const refresh = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const r = await fetch("/api/aircraft", { cache: "no-store" });
        if (!r.ok) return;
        const data = (await r.json()) as {
          aircraft: { airborne: boolean; role?: string }[];
        };
        if (cancelled) return;
        const count = data.aircraft.filter(
          (a) => a.airborne && ALERT_ROLES.has(a.role ?? "unknown"),
        ).length;
        try {
          if (count > 0) await nav.setAppBadge?.(count);
          else await nav.clearAppBadge?.();
        } catch {
          /* badge writes can throw on locked / focused-mode contexts */
        }
      } catch {
        /* transient — try again next tick */
      }
    };

    void refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
      try {
        void nav.clearAppBadge?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return null;
}
