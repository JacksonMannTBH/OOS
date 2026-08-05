"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useRiderPos } from "@/lib/hooks/useRiderPos";
import {
  EMPTY_AIRCRAFT_SNAPSHOT,
  useAircraft,
} from "@/lib/hooks/useAircraft";
import { haversineNm, DEFAULT_SPEED_LIMIT_MPH } from "@/lib/geo";
import type { Aircraft } from "@/lib/types";

const NEAR_NM = 5;
const MPS_TO_MPH = 2.236936;
const DISMISS_DELAY_MS = 3000;

// Only the rider-facing screens with location should drive this; / never
// asks for geo, so we never mount the inner hooks there.
const ELIGIBLE_PATHS = new Set(["/map", "/home", "/dash"]);

export function SpeedWarning({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const eligible = enabled && pathname != null && ELIGIBLE_PATHS.has(pathname);
  if (!eligible) return null;
  return <SpeedWarningActive />;
}

function SpeedWarningActive() {
  const { pos } = useRiderPos();
  const snap = useAircraft(EMPTY_AIRCRAFT_SNAPSHOT, false);

  const mph =
    pos?.speedMps != null && pos.speedMps >= 0
      ? pos.speedMps * MPS_TO_MPH
      : 0;
  const limit = DEFAULT_SPEED_LIMIT_MPH;
  const speeding = mph > limit;

  const nearest = useMemo<{
    plane: Aircraft;
    distanceNm: number;
  } | null>(() => {
    if (!pos) return null;
    let best: { plane: Aircraft; distanceNm: number } | null = null;
    for (const a of snap.aircraft) {
      if (!a.airborne || a.lat == null || a.lon == null) continue;
      const d = haversineNm(pos.lat, pos.lon, a.lat, a.lon);
      if (!best || d < best.distanceNm) best = { plane: a, distanceNm: d };
    }
    return best;
  }, [pos, snap.aircraft]);

  const shouldFire = Boolean(
    pos &&
      pos.speedMps != null &&
      speeding &&
      nearest &&
      nearest.distanceNm <= NEAR_NM,
  );

  const [active, setActive] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (shouldFire) {
      // Cancel any pending dismiss; keep showing.
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
      if (!active) setActive(true);
    } else if (active && dismissTimerRef.current == null) {
      dismissTimerRef.current = setTimeout(() => {
        setActive(false);
        dismissTimerRef.current = null;
      }, DISMISS_DELAY_MS);
    }
  }, [shouldFire, active]);

  // Cleanup pending timer on unmount.
  useEffect(
    () => () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    },
    [],
  );

  // Haptic on every false→true transition.
  useEffect(() => {
    if (!active) return;
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      try {
        navigator.vibrate(200);
      } catch {
        // some browsers throw on insecure contexts; ignore
      }
    }
  }, [active]);

  if (!active) return null;
  return (
    <Overlay
      mph={mph}
      limit={limit}
      nearestTail={nearest!.plane.nickname || nearest!.plane.tail}
      nearestNm={nearest!.distanceNm}
    />
  );
}

function Overlay({
  mph,
  limit,
  nearestTail,
  nearestNm,
}: {
  mph: number;
  limit: number;
  nearestTail: string;
  nearestNm: number;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "#dc2626",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: "32px 16px",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontSize: "clamp(56px, 14vw, 96px)",
          fontWeight: 900,
          letterSpacing: "-.04em",
          margin: 0,
          lineHeight: 1,
        }}
      >
        SLOW DOWN
      </h1>
      <div
        className="ss-mono"
        style={{
          fontSize: "clamp(120px, 30vw, 220px)",
          fontWeight: 900,
          lineHeight: 1,
        }}
      >
        {Math.round(mph)}
      </div>
      <div
        className="ss-mono"
        style={{ fontSize: 24, opacity: 0.85, lineHeight: 1, fontWeight: 600 }}
      >
        of {limit} mph
      </div>
      <div
        className="ss-mono"
        style={{
          marginTop: 12,
          fontSize: 18,
          opacity: 0.85,
          letterSpacing: ".02em",
        }}
      >
        {nearestTail} · {nearestNm.toFixed(1)}nm
      </div>
    </div>
  );
}
