"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { useRideLaunchPreflight } from "@/lib/hooks/useRideLaunchPreflight";
import { SS_TOKENS } from "@/lib/tokens";

type TabItem = {
  id: string;
  label: string;
  href: string;
  activePaths: string[];
  icon: ReactNode;
};

const TABS: TabItem[] = [
  {
    id: "home",
    label: "Home",
    href: "/home",
    activePaths: ["/", "/home", "/dash"],
    icon: <HomeIcon />,
  },
  {
    id: "map",
    label: "Map",
    href: "/map",
    activePaths: ["/map"],
    icon: <MapIcon />,
  },
  {
    id: "ride",
    label: "Ride",
    href: "/ride",
    activePaths: ["/ride"],
    icon: <RideIcon />,
  },
];

export function TabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const runRideLaunchPreflight = useRideLaunchPreflight();
  const [rideBusy, setRideBusy] = useState(false);
  const rideHref = useMemo(() => {
    const mock = searchParams.get("mock");
    return mock ? `/ride?mock=${encodeURIComponent(mock)}` : "/ride";
  }, [searchParams]);

  const onRideClick = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (rideBusy) return;
    setRideBusy(true);
    await runRideLaunchPreflight();
    router.push(rideHref);
  };

  return (
    <>
      <nav
        aria-label="Main"
        style={{
          position: "fixed",
          left: "max(12px, env(safe-area-inset-left))",
          right: "max(12px, env(safe-area-inset-right))",
          bottom: "max(8px, calc(env(safe-area-inset-bottom, 0px) - 18px))",
          boxSizing: "border-box",
          maxWidth: 390,
          margin: "0 auto",
          minHeight: "clamp(60px, 15vw, 66px)",
          padding: "6px clamp(8px, 2.8vw, 12px)",
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          alignItems: "center",
          gap: 6,
          background: "rgba(9, 10, 10, 0.96)",
          border: "1px solid rgba(255, 255, 255, 0.18)",
          borderRadius: 0,
          boxShadow: "0 6px 16px rgba(0, 0, 0, 0.34)",
          backdropFilter: "blur(18px) saturate(1.1)",
          WebkitBackdropFilter: "blur(18px) saturate(1.1)",
          zIndex: 50,
        }}
      >
        {TABS.map((tab) => {
          const href = tab.id === "ride" ? rideHref : tab.href;
          const active = tab.activePaths.some((path) =>
            path === "/"
              ? pathname === "/"
              : pathname === path || pathname.startsWith(`${path}/`),
          );
          return (
            <Link
              key={tab.id}
              href={href}
              prefetch={tab.id === "ride" ? false : undefined}
              onClick={tab.id === "ride" ? onRideClick : undefined}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
              style={{
                minHeight: "clamp(44px, 11.5vw, 48px)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                color: active ? SS_TOKENS.alert : SS_TOKENS.fg3,
                textDecoration: "none",
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent",
                opacity: tab.id === "ride" && rideBusy ? 0.72 : 1,
              }}
            >
              <span
                style={{
                  display: "flex",
                  color: "currentColor",
                  lineHeight: 1,
                }}
              >
                {tab.icon}
              </span>
              <span
                style={{
                  fontSize: "clamp(10px, 2.8vw, 11px)",
                  fontWeight: 700,
                  letterSpacing: 0,
                  lineHeight: 1,
                }}
              >
                {tab.label}
              </span>
              <span
                aria-hidden
                style={{
                  width: active ? 18 : 0,
                  height: 2,
                  borderRadius: 999,
                  background: active ? SS_TOKENS.alert : "transparent",
                }}
              />
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function HomeIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M3.2 11.2 12 3.6l8.8 7.6v8.3c0 .8-.7 1.5-1.5 1.5h-4.5v-6.2H9.2V21H4.7c-.8 0-1.5-.7-1.5-1.5v-8.3Z" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg
      width="25"
      height="25"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M1.2 7.65 6.85 9v13.25L1.45 20.9A1.25 1.25 0 0 1 .5 19.68V8.62c0-.64.34-1.1.7-.97ZM8.05 9.08l.7-.16c1.2 3.05 3.62 5.74 4.48 6.28.48.3 1.06.3 1.54 0 .08-.05.17-.11.26-.19v5.75l-6.98 1.5V9.08ZM16.25 13.74c1.07-1.28 2.18-3 2.73-4.92l3.58.9c.56.14.94.65.94 1.22v10.12c0 .81-.75 1.4-1.53 1.22l-5.72-1.33v-7.21Z" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13.95 1.15a5.45 5.45 0 0 0-5.45 5.45c0 3.8 4.18 7.75 5.05 8.52.23.2.57.2.8 0 .87-.77 5.05-4.72 5.05-8.52a5.45 5.45 0 0 0-5.45-5.45Zm0 7.68a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z"
      />
    </svg>
  );
}

function RideIcon() {
  return (
    <svg
      width="25"
      height="25"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m21 3-7.1 18-3.5-7.4L3 10.1 21 3Z" />
    </svg>
  );
}
