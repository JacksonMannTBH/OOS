"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAircraft } from "@/lib/hooks/useAircraft";
import { useRiderPos } from "@/lib/hooks/useRiderPos";
import { useDeviceHeading } from "@/lib/hooks/useDeviceHeading";
import {
  classifyRideStatus,
  cardinalWordFromDeg,
  DEFAULT_RIDE_STATUS_THRESHOLDS,
  getRideContacts,
  isSameCardinalTrack,
  rideStatusLabel,
  type RideContact,
  type RideStatus,
  type RideStatusThresholds,
} from "@/lib/ride-mode";
import {
  getRideStatusThresholds,
  RIDE_STATUS_THRESHOLDS_KEY,
} from "@/lib/ride-settings";
import {
  estimateFuelRemaining,
} from "@/lib/fuel-estimate";
import type { Snapshot } from "@/lib/types";
import { RideCompass } from "./RideCompass";

type Props = {
  initial: Snapshot;
  mockOn?: boolean;
};

type WakeLockSentinel = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: string, listener: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
};

const STATUS_COLORS: Record<RideStatus, string> = {
  clear: "#39d98a",
  watch: "#60a5fa",
  warning: "#f6c431",
  danger: "#ff4d4f",
};

const STALE_WARN_MS = 45_000;
const STALE_DANGER_MS = 90_000;

export function RideModeShell({ initial, mockOn = false }: Props) {
  const router = useRouter();
  const snap = useAircraft(initial, mockOn);
  const { pos, unavailable } = useRiderPos();
  const heading = useDeviceHeading(pos?.heading);
  const [now, setNow] = useState(initial.fetched_at);
  const [rideThresholds, setRideThresholds] = useState<RideStatusThresholds>(
    DEFAULT_RIDE_STATUS_THRESHOLDS,
  );

  useRideChrome();
  useRideWakeLock();

  useEffect(() => {
    setRideThresholds(getRideStatusThresholds());

    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === RIDE_STATUS_THRESHOLDS_KEY) {
        setRideThresholds(getRideStatusThresholds());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const contacts = useMemo<RideContact[]>(() => {
    if (!pos) return [];
    return getRideContacts(snap.aircraft, pos, heading.headingDeg, true);
  }, [snap.aircraft, pos, heading.headingDeg]);

  const nearest = contacts[0] ?? null;
  const status = classifyRideStatus(nearest?.distanceNm ?? null, rideThresholds);
  const statusLabel = rideStatusLabel(status);
  const statusColor = STATUS_COLORS[status];
  const shouldHighlightTrackingArrow =
    status === "danger" &&
    isSameCardinalTrack(nearest?.plane.heading, heading.headingDeg);
  const displayBearing =
    nearest == null
      ? null
      : nearest.relativeBearingDeg == null
        ? nearest.bearingDeg
        : nearest.relativeBearingDeg;
  const lastUpdateAgeMs = Math.max(0, now - snap.fetched_at);
  const staleLevel =
    lastUpdateAgeMs >= STALE_DANGER_MS
      ? "stale"
      : lastUpdateAgeMs >= STALE_WARN_MS
        ? "lagging"
        : "fresh";

  const aircraftLabel = nearest ? formatAircraftLabel(nearest.plane) : null;
  const nearestSpeedText = nearest
    ? formatGroundSpeed(nearest.plane.ground_speed_kt)
    : null;
  const nearestSummary = formatNearestAircraftSummary(nearest);
  const withinRideRange =
    nearest != null && nearest.distanceNm <= rideThresholds.watchNm;
  const watchRangeText = formatNm(rideThresholds.watchNm);
  const primaryCopy = !pos
    ? unavailable
      ? "Location unavailable"
      : "Waiting for rider location"
    : withinRideRange && nearest
      ? `${aircraftLabel}: ${nearest.distanceNm.toFixed(1)} nm ${cardinalWordFromDeg(nearest.bearingDeg)}${nearestSpeedText ? ` - GS ${nearestSpeedText}` : ""}`
      : `No tracked aircraft within ${watchRangeText} nm`;
  const nearestFuelText = useMemo(() => {
    if (!nearest) return null;
    return estimateFuelRemaining(nearest.plane)?.label ?? null;
  }, [nearest]);

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        boxSizing: "border-box",
        height: "100dvh",
        minHeight: "100dvh",
        padding:
          "calc(env(safe-area-inset-top, 0px) + clamp(10px, 2.8dvh, 22px)) 18px calc(env(safe-area-inset-bottom, 0px) + clamp(16px, 3.2dvh, 30px))",
        background:
          status === "danger"
            ? "radial-gradient(circle at 50% 20%, rgba(255,77,79,.24), transparent 32%), #020202"
            : "radial-gradient(circle at 50% 18%, rgba(244,196,48,.10), transparent 34%), #020202",
        color: "#f5f2e8",
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr) auto",
        overflowY: "auto",
        overscrollBehavior: "contain",
      }}
    >
      <header
        style={{
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          paddingTop: "clamp(18px, 5.8dvh, 54px)",
        }}
      >
        <div
          aria-live="polite"
          style={{
            color: statusColor,
            fontSize: "clamp(48px, 16vw, 96px)",
            lineHeight: 0.92,
            fontWeight: 950,
            letterSpacing: 0,
            textShadow:
              status === "danger"
                ? "0 0 26px rgba(255,77,79,.48)"
                : `0 0 18px color-mix(in srgb, ${statusColor} 24%, transparent)`,
          }}
        >
          {statusLabel.toUpperCase()}
        </div>
        <div
          style={{
            color: "#f5f2e8",
            fontSize: "clamp(15px, 4.5vw, 18px)",
            lineHeight: 1.12,
            fontWeight: 850,
            maxWidth: 420,
          }}
        >
          {primaryCopy}
        </div>
        <div
          style={{
            color: staleLevel === "fresh" ? "#a9a28a" : "#f6c431",
            fontSize: "clamp(13px, 3.8vw, 16px)",
            fontWeight: 800,
          }}
        >
          Last update: {formatAge(lastUpdateAgeMs)}
          {staleLevel === "stale" ? " - DATA STALE" : ""}
        </div>
      </header>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          width: "min(100%, 500px)",
          height: "min(430px, 42dvh)",
          alignSelf: "center",
          justifySelf: "center",
          minHeight: 0,
        }}
      >
        <RideCompass
          status={status}
          contact={nearest}
          displayBearingDeg={displayBearing}
          clearDistanceNm={rideThresholds.watchNm}
          distanceBands={rideThresholds}
          highlightTrackingArrow={shouldHighlightTrackingArrow}
        />
        {nearestFuelText && (
          <div
            aria-live="polite"
            style={{
              width: "min(100%, 420px)",
              minHeight: 34,
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(0,0,0,0.38)",
              color: "#f5f2e8",
              textAlign: "center",
              fontSize: 13,
              fontWeight: 850,
              lineHeight: 1.25,
              boxShadow: "0 10px 34px rgba(0,0,0,0.24)",
            }}
          >
            {nearestFuelText}
          </div>
        )}
      </div>

      <footer
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          paddingBottom: 0,
        }}
      >
        <div
          style={{
            width: "min(100%, 460px)",
            padding: "14px 12px 16px",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            textAlign: "center",
            boxShadow: "0 16px 50px rgba(0,0,0,0.28)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.1fr 1.5fr 0.9fr 1fr",
              alignItems: "end",
              gap: 8,
            }}
          >
            <RideSummaryMetric label="Type" value={nearestSummary.aircraftType} />
            <RideSummaryMetric
              label="Distance"
              value={nearestSummary.distance}
              accent
            />
            <RideSummaryMetric
              label="Direction"
              value={nearestSummary.direction}
            />
            <RideSummaryMetric label="GS" value={nearestSummary.groundSpeed} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push("/")}
          aria-label="End Ride and return to the main app"
          style={{
            width: "min(100%, 460px)",
            minHeight: 54,
            borderRadius: 18,
            border: "1px solid #f6c431",
            background: "#050505",
            color: "#f6c431",
            fontFamily: "inherit",
            fontSize: 18,
            fontWeight: 900,
            cursor: "pointer",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          End Ride
        </button>
      </footer>
    </main>
  );
}

function useRideChrome() {
  useEffect(() => {
    document.body.dataset.rideMode = "true";
    return () => {
      delete document.body.dataset.rideMode;
    };
  }, []);
}

function useRideWakeLock() {
  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const nav = navigator as WakeLockNavigator;

    const release = async () => {
      const current = sentinel;
      sentinel = null;
      if (current && !current.released) {
        try {
          await current.release();
        } catch {
          /* already released */
        }
      }
    };

    const acquire = async () => {
      if (!nav.wakeLock || document.visibilityState !== "visible") return;
      try {
        sentinel = await nav.wakeLock.request("screen");
        sentinel.addEventListener?.("release", () => {
          sentinel = null;
        });
      } catch {
        sentinel = null;
      }
    };

    void acquire();
    const onVisibility = () => {
      if (document.visibilityState === "visible" && !sentinel && !cancelled) {
        void acquire();
      } else if (document.visibilityState === "hidden") {
        void release();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void release();
    };
  }, []);
}

function formatNm(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatAircraftLabel(plane: { tail: string; nickname?: string | null }): string {
  return plane.nickname ? `${plane.tail} - ${plane.nickname}` : plane.tail;
}

type RideSummary = {
  aircraftType: string;
  distance: string;
  direction: string;
  groundSpeed: string;
};

function formatNearestAircraftSummary(contact: RideContact | null): RideSummary {
  if (!contact) {
    return {
      aircraftType: "--",
      distance: "-- nm",
      direction: "--",
      groundSpeed: "--",
    };
  }

  return {
    aircraftType: aircraftTypeLabel(contact.plane.model),
    distance: `${contact.distanceNm.toFixed(1)} nm`,
    direction:
      typeof contact.plane.heading === "number"
        ? cardinalWordFromDeg(contact.plane.heading)
        : "--",
    groundSpeed: formatGroundSpeed(contact.plane.ground_speed_kt) ?? "--",
  };
}

function RideSummaryMetric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
      aria-label={`${label}: ${value}`}
    >
      <div
        style={{
          color: accent ? "#f6c431" : "#f5f2e8",
          fontSize: accent ? "clamp(24px, 7vw, 34px)" : "clamp(14px, 3.8vw, 18px)",
          fontWeight: 950,
          letterSpacing: accent ? "-0.03em" : 0,
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function aircraftTypeLabel(model: string | null | undefined): "Helicopter" | "Plane" {
  if (!model) return "Plane";
  return /\b(Bell|UH-|Hughes|Eurocopter|Airbus AS|AS350|H125|H135|H145|MD|JetRanger|Iroquois|Dolphin)\b/i.test(
    model,
  )
    ? "Helicopter"
    : "Plane";
}

function formatAge(ageMs: number): string {
  const seconds = Math.max(0, Math.floor(ageMs / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function formatGroundSpeed(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return `${Math.round(value)} kt`;
}
