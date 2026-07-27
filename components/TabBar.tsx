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
    href: "/dash",
    activePaths: ["/", "/dash"],
    icon: <HomeIcon />,
  },
  {
    id: "map",
    label: "Map",
    href: "/map",
    activePaths: ["/map"],
    icon: <RadarIcon />,
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
      <div
        aria-hidden
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          height: "calc(96px + env(safe-area-inset-bottom, 0px))",
          background:
            "linear-gradient(180deg, rgba(5,6,7,0), rgba(5,6,7,0.94) 34%, #050607 100%)",
          pointerEvents: "none",
          zIndex: 49,
        }}
      />
      <nav
        aria-label="Main"
        style={{
          position: "fixed",
          left: "max(12px, env(safe-area-inset-left))",
          right: "max(12px, env(safe-area-inset-right))",
          bottom: "max(8px, env(safe-area-inset-bottom))",
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
                aria-hidden
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: active ? SS_TOKENS.alert : "transparent",
                  boxShadow: active
                    ? "0 0 3px rgba(246, 196, 49, 0.42)"
                    : undefined,
                }}
              />
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

function RadarIcon() {
  return (
    <svg
      width="25"
      height="25"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" opacity="0.55" />
      <circle cx="12" cy="12" r="5.2" opacity="0.75" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
      <path d="M12 12 19.2 5.6" />
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
