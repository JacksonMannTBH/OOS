"use client";

import { LogoMark } from "@/components/brand/Logo";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  STATE_CHANGE_EVENT,
  getSelectedStateCode,
} from "@/lib/app-states";
import type { Snapshot } from "@/lib/types";

const AIRCRAFT_POLL_INTERVAL_MS = 30_000;

export function SiteHeader() {
  const pathname = usePathname();
  const hidden =
    pathname === "/map" ||
    pathname === "/ride" ||
    pathname.startsWith("/map/") ||
    pathname.startsWith("/admin");
  const hasAirborneAircraft = useHeaderAircraftStatus(!hidden);

  if (hidden) return null;

  return (
    <header
      style={{
        width: "100%",
        position: "relative",
        zIndex: 2,
        fontFamily: "var(--font-header-ui)",
        background: "#000000",
        color: "#ffffff",
        borderBottom: "0.5px solid rgba(244, 196, 48, 0.34)",
      }}
    >
      <div
        style={{
          maxWidth: 560,
          margin: "0 auto",
          height: "calc(env(safe-area-inset-top, 0px) + clamp(80px, 20vw, 104px))",
          padding: "env(safe-area-inset-top, 0px) clamp(14px, 4vw, 18px) 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            color: "inherit",
          }}
        >
          <LogoMark
            height="clamp(30px, 7.6vw, 42px)"
            width="clamp(45px, 11.4vw, 63px)"
            variant={hasAirborneAircraft === false ? "closed" : "open"}
            style={{
              justifySelf: "start",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-header-brand)",
              fontSize: "clamp(28px, 6.4vw, 38px)",
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: 0,
              paddingTop: 12,
              whiteSpace: "nowrap",
              textAlign: "center",
            }}
          >
            Out Of Sight
          </span>
          <div
            style={{
              justifySelf: "end",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Link
              href="/settings"
              prefetch={false}
              aria-label="Settings"
              style={{
                width: 44,
                height: 44,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--ss-alert)",
                textDecoration: "none",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <SettingsIcon />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

function useHeaderAircraftStatus(enabled: boolean): boolean | null {
  const [hasAirborneAircraft, setHasAirborneAircraft] = useState<boolean | null>(
    null,
  );

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const fetchStatus = async () => {
      const params = new URLSearchParams({
        state: getSelectedStateCode(),
      });
      const mock = new URLSearchParams(window.location.search).get("mock");
      if (mock) params.set("mock", mock);

      try {
        const response = await fetch(`/api/aircraft?${params.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          if (!cancelled) setHasAirborneAircraft(null);
          return;
        }
        const snapshot = (await response.json()) as Snapshot;
        if (!cancelled) {
          setHasAirborneAircraft(
            snapshot.aircraft.some((aircraft) => aircraft.airborne),
          );
        }
      } catch {
        if (!cancelled) setHasAirborneAircraft(null);
      }
    };

    void fetchStatus();
    const interval = window.setInterval(fetchStatus, AIRCRAFT_POLL_INTERVAL_MS);
    const onStateChange = () => void fetchStatus();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void fetchStatus();
    };

    window.addEventListener(STATE_CHANGE_EVENT, onStateChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener(STATE_CHANGE_EVENT, onStateChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled]);

  return hasAirborneAircraft;
}

function SettingsIcon() {
  return (
    <svg
      aria-hidden
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7A2 2 0 1 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}
