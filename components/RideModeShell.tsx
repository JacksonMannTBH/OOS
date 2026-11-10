"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import nextDynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ScreenAwake } from "./ScreenAwake";
import { finishRideRecording, getRideRecorderStatus } from "@/lib/ride-recording";
import { useRideRecorder } from "@/lib/hooks/useRideRecorder";
import { useSpeedometerVisible } from "@/lib/hooks/useSpeedometerVisible";
import { useAircraft } from "@/lib/hooks/useAircraft";
import { useRiderPos } from "@/lib/hooks/useRiderPos";
import { useDeviceHeading } from "@/lib/hooks/useDeviceHeading";
import { useRideStatusThresholds } from "@/lib/hooks/useRideStatusThresholds";
import {
  classifyRideStatus,
  cardinalWordFromDeg,
  getRideDisplayContacts,
  rideStatusLabel,
  type RideContact,
  type RideStatus,
} from "@/lib/ride-mode";
import {
  estimateFuelRemaining,
} from "@/lib/fuel-estimate";
import type { Snapshot } from "@/lib/types";
import { aircraftVehicleType } from "@/lib/aircraft-type";
import { usePoliceSightings } from "@/lib/hooks/usePoliceSightings";
import { hasNearbyPolice } from "@/lib/police-sightings";
import { PoliceReportButton } from "./PoliceReportButton";

const RideMap = nextDynamic(() => import("./RideMap"), { ssr: false });

type Props = {
  initial: Snapshot;
  mockOn?: boolean;
};

const STATUS_COLORS: Record<RideStatus, string> = {
  clear: "#39d98a",
  watch: "#60a5fa",
  warning: "#f6c431",
  danger: "#ff4d4f",
};

const MPS_TO_MPH = 2.236936;
const MOCK_RIDER_POS = {
  lat: 47.5,
  lon: -122.2612,
  speedMps: 10,
  heading: 0,
} as const;

export function RideModeShell({ initial, mockOn = false }: Props) {
  const router = useRouter();
  const snap = useAircraft(initial, mockOn);
  const { pos, unavailable } = useRiderPos();
  const riderPos = pos ?? (mockOn ? MOCK_RIDER_POS : null);
  const heading = useDeviceHeading(riderPos?.heading);
  const rideThresholds = useRideStatusThresholds();
  const showSpeedometer = useSpeedometerVisible();
  const policeSightings = usePoliceSightings(!mockOn);
  const policeNearby = hasNearbyPolice(policeSightings, riderPos);
  const recording = useRideRecorder();
  const [ending, setEnding] = useState(false);
  const finishing = useRef(false);
  const [endError, setEndError] = useState("");
  useEffect(() => {
    if (recording.status?.supported && !recording.status.active && !finishing.current) {
      router.replace("/home");
    }
  }, [recording.status, router]);
  const endRide = async () => {
    if (ending) return;
    setEnding(true);
    finishing.current = true;
    setEndError("");
    try {
      const current = await getRideRecorderStatus();
      if (current.active) {
        const ride = await finishRideRecording(current.active.id);
        router.replace(`/home?rideSummary=${encodeURIComponent(ride.id)}`);
      } else { router.replace("/home"); }
    } catch (cause) {
      finishing.current = false;
      setEndError(cause instanceof Error ? cause.message : "Could not save this ride. Please try again.");
    } finally { setEnding(false); }
  };

  useRideChrome();

  const contacts = useMemo(() => riderPos
    ? getRideDisplayContacts(snap.aircraft, riderPos, heading.headingDeg)
    : [], [snap.aircraft, riderPos, heading.headingDeg]);

  const nearest = contacts[0] ?? null;
  const status = classifyRideStatus(nearest?.distanceNm ?? null, rideThresholds);
  const statusLabel = rideStatusLabel(status);
  const statusColor = STATUS_COLORS[status];

  const nearestSummary = formatNearestAircraftSummary(nearest);
  const withinRideRange =
    nearest != null && nearest.distanceNm <= rideThresholds.watchNm;
  const watchRangeText = formatNm(rideThresholds.watchNm);
  const primaryCopy = !riderPos
    ? unavailable
      ? "Location unavailable"
      : "Waiting for rider location"
    : withinRideRange
      ? null
      : `No tracked aircraft within ${watchRangeText} nm`;
  const nearestFuelText = useMemo(() => {
    if (!nearest) return null;
    const estimate = estimateFuelRemaining(nearest.plane);
    return estimate ? `${estimate.label.replace(/^Est\. /, "")} est fuel remaining` : null;
  }, [nearest]);
  const lastUpdatedAt = nearest?.plane.observed_at
    ? Date.parse(nearest.plane.observed_at)
    : snap.fetched_at;

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
          "calc(env(safe-area-inset-top, 0px) + 48px) 18px calc(env(safe-area-inset-bottom, 0px) + 16px)",
        background:
          status === "danger"
            ? "radial-gradient(circle at 50% 20%, rgba(255,77,79,.10), transparent 32%), #020202"
            : status === "clear"
              ? "#020202"
            : "radial-gradient(circle at 50% 18%, rgba(244,196,48,.10), transparent 34%), #020202",
        color: "#f5f2e8",
        display: "grid",
        gridTemplateRows: "auto auto minmax(max-content, 1fr) auto",
        gap: 12,
        overflowY: "auto",
        overscrollBehavior: "contain",
      }}
    >
      <ScreenAwake />
      <header
        style={{
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          width: "min(100%, 500px)",
          justifySelf: "center",
        }}
      >
        {(recording.error || recording.status?.message || endError) && <p className="ss-ride-error" role="alert">{endError || recording.error || recording.status?.message}</p>}
        {policeNearby && <div
          className="ss-police-nearby"
          aria-live="polite"
          style={{
            fontSize: "clamp(28px, 8.5vw, 42px)",
            lineHeight: 1.05,
            fontWeight: 950,
            maxWidth: 440,
            textWrap: "balance",
          }}
        >
          POLICE NEARBY
        </div>}
        <div
          className="ss-ride-aircraft-status"
          aria-live="polite"
          style={{
            color: statusColor,
            fontSize: policeNearby ? "clamp(18px, 5vw, 24px)" : "clamp(56px, 18vw, 100px)",
            lineHeight: policeNearby ? 1.12 : 0.92,
            fontWeight: 950,
            letterSpacing: 0,
            textShadow:
              policeNearby ? "none" : status === "danger"
                ? "0 0 12px rgba(255,77,79,.22)"
                : status === "clear"
                  ? "none"
                : `0 0 18px color-mix(in srgb, ${statusColor} 24%, transparent)`,
          }}
        >
          {policeNearby && "Aircraft · "}{statusLabel.toUpperCase()}
        </div>
        <RideLastUpdated timestamp={lastUpdatedAt} />
        {!policeNearby && primaryCopy && <div
          style={{
            color: "#f5f2e8",
            fontSize: "clamp(15px, 4.5vw, 18px)",
            lineHeight: 1.12,
            fontWeight: 850,
            maxWidth: 420,
          }}
        >
          {primaryCopy}
        </div>}
      </header>

      <div style={{ width: "min(100%, 500px)", justifySelf: "center", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        {showSpeedometer ? <RiderSpeedBadge speedMps={riderPos?.speedMps ?? null} /> : <span />}
        <PoliceReportButton alerting={policeNearby} disabled={mockOn || unavailable || !riderPos} />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          width: "min(100%, 500px)",
          alignSelf: "start",
          justifySelf: "center",
          minHeight: 0,
        }}
      >
        <div
          style={{
            position: "relative",
            width: "min(100%, 310px, 38dvh)",
            aspectRatio: "1",
            flex: "0 0 auto",
          }}
        >
          <RideMap
            policeSightings={policeSightings}
            status={status}
            rider={riderPos}
            contacts={contacts}
            distanceBands={rideThresholds}
          />
        </div>
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
        <div className="ss-ride-navigation">
          <Link
            href="/home"
            prefetch={false}
            aria-label="Home, keep ride active"
            className="ss-ride-navigation__home"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M3.2 11.2 12 3.6l8.8 7.6v8.3c0 .8-.7 1.5-1.5 1.5h-4.5v-6.2H9.2V21H4.7c-.8 0-1.5-.7-1.5-1.5v-8.3Z" />
            </svg>
          </Link>
          {nearestFuelText && (
            <div className="ss-ride-navigation__estimate" aria-live="polite">
              {nearestFuelText}
            </div>
          )}
        </div>
        <div
          style={{
            width: "min(100%, 460px)",
            minHeight: 54,
            boxSizing: "border-box",
            padding: "8px 12px",
            display: "grid",
            alignItems: "center",
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
              gridTemplateColumns: "repeat(4, max-content)",
              justifyContent: "space-between",
              alignItems: "center",
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
          onClick={() => void endRide()}
          disabled={ending}
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
          {ending ? "Saving Ride…" : "End Ride"}
        </button>
      </footer>
    </main>
  );
}

function RideLastUpdated({ timestamp }: { timestamp: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const seconds = Math.max(0, Math.floor((now - timestamp) / 1_000));
  const age = seconds < 60 ? seconds : Math.floor(seconds / 60);
  const unit = seconds < 60 ? "second" : "minute";
  const text = Number.isFinite(timestamp) && timestamp > 0
    ? `${age} ${unit}${age === 1 ? "" : "s"} ago`
    : "—";

  return (
    <div className="ss-mono" style={{ color: "#a9a28a", fontSize: 11, lineHeight: 1.3 }}>
      Updated {text}
    </div>
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

function formatNm(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
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
    aircraftType: aircraftVehicleType(contact.plane.model),
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
          fontSize: accent ? "clamp(21px, 6vw, 32px)" : "clamp(13px, 3.5vw, 18px)",
          fontWeight: 950,
          letterSpacing: accent ? "-0.03em" : 0,
          lineHeight: 1.25,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function formatGroundSpeed(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return `${Math.round(value)} kt`;
}

function RiderSpeedBadge({ speedMps }: { speedMps: number | null }) {
  const mph =
    speedMps != null && Number.isFinite(speedMps) && speedMps >= 0
      ? Math.round(speedMps * MPS_TO_MPH)
      : null;

  return (
    <div
      aria-live="polite"
      aria-label={`Your speed: ${mph == null ? "unavailable" : `${mph} miles per hour`}`}
      style={{
        position: "relative",
        zIndex: 2,
        alignSelf: "flex-start",
        width: 104,
        minHeight: 76,
        boxSizing: "border-box",
        padding: "4px 8px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        border: "1px solid rgba(255,255,255,0.2)",
        borderRadius: 14,
        background: "rgba(0,0,0,0.72)",
        color: "#fff",
        boxShadow: "0 12px 30px rgba(0,0,0,0.32)",
        textAlign: "center",
      }}
    >
      <span
        style={{
          color: "#a9a28a",
          fontSize: 11,
          fontWeight: 900,
          lineHeight: 1,
        }}
      >
        Mph
      </span>
      <span
        className="ss-mono"
        style={{
          color: "#f6c431",
          fontSize: 54,
          fontWeight: 950,
          lineHeight: 1,
        }}
      >
        {mph == null ? "—" : mph}
      </span>
    </div>
  );
}
