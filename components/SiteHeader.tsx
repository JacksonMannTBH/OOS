"use client";

import { LogoMark } from "@/components/brand/Logo";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  EMPTY_AIRCRAFT_SNAPSHOT,
  useAircraft,
} from "@/lib/hooks/useAircraft";

export function SiteHeader() {
  const pathname = usePathname();
  const hidden =
    pathname === "/map" ||
    pathname === "/ride" ||
    pathname.startsWith("/map/") ||
    pathname.startsWith("/admin");

  if (hidden) return null;

  return (
    <header
      style={{
        width: "100%",
        position: "sticky",
        top: 0,
        zIndex: 48,
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
          <Link
            href="/home"
            prefetch={false}
            aria-label="Home"
            style={{
              justifySelf: "start",
              color: "inherit",
              textDecoration: "none",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <Suspense fallback={<HeaderLogoMark variant="open" />}>
              <HeaderAircraftLogo />
            </Suspense>
          </Link>
          <Link
            href="/home"
            prefetch={false}
            aria-label="Out Of Sight home"
            style={{
              fontFamily: "var(--font-header-brand)",
              fontSize: "clamp(28px, 6.4vw, 38px)",
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: 0,
              paddingTop: 12,
              whiteSpace: "nowrap",
              textAlign: "center",
              color: "inherit",
              textDecoration: "none",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            Out Of Sight
          </Link>
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

function HeaderAircraftLogo() {
  const mockState = useSearchParams().get("mock");
  const mockHasAirborneAircraft =
    mockState === "down"
      ? false
      : mockState === "up" ||
          mockState === "fixed_wing" ||
          mockState === "eyes-up" ||
          mockState === "mixed" ||
          mockState === "multiple"
        ? true
        : null;
  if (mockHasAirborneAircraft != null) {
    return (
      <HeaderLogoMark
        variant={mockHasAirborneAircraft ? "open" : "closed"}
      />
    );
  }

  return <LiveHeaderAircraftLogo />;
}

function LiveHeaderAircraftLogo() {
  const snapshot = useAircraft(EMPTY_AIRCRAFT_SNAPSHOT);
  const hasLoaded = snapshot.fetched_at > 0;
  const hasAirborneAircraft = hasLoaded
    ? snapshot.aircraft.some((aircraft) => aircraft.airborne)
    : null;

  return (
    <HeaderLogoMark
      variant={hasAirborneAircraft === false ? "closed" : "open"}
    />
  );
}

function HeaderLogoMark({ variant }: { variant: "open" | "closed" }) {
  return (
    <LogoMark
      height="clamp(30px, 7.6vw, 42px)"
      width="clamp(45px, 11.4vw, 63px)"
      variant={variant}
      style={{
        justifySelf: "start",
      }}
    />
  );
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
