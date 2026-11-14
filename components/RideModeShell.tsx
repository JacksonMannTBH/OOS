"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type MouseEvent, type TouchEvent } from "react";
import nextDynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ScreenAwake } from "./ScreenAwake";
import { calibrateRideMotion, configureRideMotion, finishRideRecording, getRideRecorderStatus, resetRideGForcePeaks, resetRideMotionPeaks } from "@/lib/ride-recording";
import { useRideRecorder } from "@/lib/hooks/useRideRecorder";
import { useSpeedometerVisible } from "@/lib/hooks/useSpeedometerVisible";
import { useRideAnglesEnabled } from "@/lib/hooks/useRideAnglesEnabled";
import { useAircraft } from "@/lib/hooks/useAircraft";
import { useRiderPos } from "@/lib/hooks/useRiderPos";
import { useDeviceHeading } from "@/lib/hooks/useDeviceHeading";
import { useRideStatusThresholds } from "@/lib/hooks/useRideStatusThresholds";
import {
  classifyRideStatus,
  cardinalFromDeg,
  getRideDisplayContacts,
  rideStatusLabel,
  RIDE_STATUS_COLORS,
  type RideContact,
} from "@/lib/ride-mode";
import { formatAircraftAltitude } from "@/lib/aircraft-altitude";
import type { Snapshot } from "@/lib/types";
import { aircraftVehicleType } from "@/lib/aircraft-type";
import { usePoliceSightings } from "@/lib/hooks/usePoliceSightings";
import { hasNearbyPolice } from "@/lib/police-sightings";
import { PoliceReportButton } from "./PoliceReportButton";
import { RideStatistics } from "./RideStatistics";
import { RideGForceView } from "./RideGForce";
import { RideCalibrationIcon } from "./RideCalibrationIcon";
import { HelicopterIcon } from "./HelicopterIcon";
import { PlaneIcon } from "./PlaneIcon";

const RideMap = nextDynamic(() => import("./RideMap"), { ssr: false });

type Props = {
  initial: Snapshot;
  mockOn?: boolean;
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
  const showRideAngles = useRideAnglesEnabled();
  const policeSightings = usePoliceSightings(!mockOn);
  const policeNearby = hasNearbyPolice(policeSightings, riderPos);
  const recording = useRideRecorder();
  const [showStats, setShowStats] = useState(false);
  const [showGForce, setShowGForce] = useState(false);
  const rideViewId = useId();
  const [ending, setEnding] = useState(false);
  const switchRideView = () => {
    setShowGForce(current => showStats || !current);
    setShowStats(false);
  };
  const rideViewSwipe = useRideViewSwipe(switchRideView, ending);
  const finishing = useRef(false);
  const [endError, setEndError] = useState("");
  const [resettingAngles, setResettingAngles] = useState(false);
  const [resetAnglesError, setResetAnglesError] = useState("");
  const resetAnglesPending = useRef(false);
  const [resettingGForce, setResettingGForce] = useState(false);
  const [resetGForceError, setResetGForceError] = useState("");
  const resetGForcePending = useRef(false);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationError, setCalibrationError] = useState("");
  const calibrationAbort = useRef<AbortController | null>(null);
  const cancelCalibration = useCallback(() => {
    const pending = calibrationAbort.current;
    calibrationAbort.current = null;
    pending?.abort();
    setCalibrating(false);
  }, []);
  useEffect(() => {
    const hidden = () => { if (document.visibilityState !== "visible") cancelCalibration(); };
    document.addEventListener("pause", cancelCalibration);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      cancelCalibration();
      document.removeEventListener("pause", cancelCalibration);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [cancelCalibration]);
  useEffect(() => {
    cancelCalibration();
    setCalibrationError("");
    // Keep setup quiet; retry and report errors only on a calibration attempt.
    void configureRideMotion(showRideAngles).catch(() => {});
  }, [showRideAngles, cancelCalibration]);
  const calibrate = async () => {
    if (calibrationAbort.current || resetAnglesPending.current || resetGForcePending.current || ending || !recording.status?.active) return;
    const controller = new AbortController();
    calibrationAbort.current = controller;
    setCalibrating(true);
    setCalibrationError("");
    try {
      await configureRideMotion(showRideAngles);
      await calibrateRideMotion({ rideId: recording.status.active.id, signal: controller.signal });
    }
    catch (cause) {
      if (calibrationAbort.current === controller && !controller.signal.aborted) {
        setCalibrationError(cause instanceof Error ? cause.message : "Could not calibrate. Please try again.");
      }
    } finally {
      if (calibrationAbort.current === controller) {
        calibrationAbort.current = null;
        setCalibrating(false);
      }
    }
  };
  const resetAngles = async () => {
    if (resetAnglesPending.current || resetGForcePending.current || calibrationAbort.current || ending || !recording.status?.active) return;
    resetAnglesPending.current = true;
    setResettingAngles(true);
    setResetAnglesError("");
    try { await resetRideMotionPeaks(recording.status.active.id); }
    catch (cause) {
      setResetAnglesError(cause instanceof Error ? cause.message : "Could not reset peak angles. Please try again.");
    } finally {
      resetAnglesPending.current = false;
      setResettingAngles(false);
    }
  };
  const resetGForce = async () => {
    if (resetGForcePending.current || resetAnglesPending.current || calibrationAbort.current || ending || !recording.status?.active) return;
    resetGForcePending.current = true;
    setResettingGForce(true);
    setResetGForceError("");
    try { await resetRideGForcePeaks(recording.status.active.id); }
    catch (cause) {
      setResetGForceError(cause instanceof Error ? cause.message : "Could not reset peak G-force. Please try again.");
    } finally {
      resetGForcePending.current = false;
      setResettingGForce(false);
    }
  };
  useEffect(() => {
    if (recording.status?.supported && !recording.status.active && !finishing.current) {
      router.replace("/home");
    }
  }, [recording.status, router]);
  const endRide = async () => {
    if (ending) return;
    cancelCalibration();
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
  const statusColor = RIDE_STATUS_COLORS[status];

  const nearestSummary = formatNearestAircraftSummary(nearest);
  const locationCopy = !riderPos
    ? unavailable
      ? "Location unavailable"
      : "Waiting for rider location"
    : null;

  return (
    <main
      className="ss-ride-screen"
      data-aircraft-present={nearest ? "true" : undefined}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        boxSizing: "border-box",
        height: "100dvh",
        minHeight: "100dvh",
        padding:
          "calc(env(safe-area-inset-top, 0px) + var(--ss-ride-top-space, 32px)) 18px calc(env(safe-area-inset-bottom, 0px) + 16px)",
        background: "#020202",
        color: "#f5f2e8",
        display: "grid",
        gridTemplateRows: "auto auto minmax(max-content, 1fr) auto",
        gap: "var(--ss-ride-row-gap, 12px)",
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
          gap: "var(--ss-ride-heading-gap, 8px)",
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
            fontSize: policeNearby
              ? "clamp(20px, 5.5vw, 26px)"
              : status === "warning"
                ? "clamp(56px, 18.5vw, 104px)"
                : "clamp(60px, 19.5vw, 108px)",
            lineHeight: policeNearby ? 1.12 : 0.92,
            fontWeight: 950,
            letterSpacing: 0,
            textShadow: "none",
          }}
        >
          {policeNearby && "Aircraft · "}{statusLabel.toUpperCase()}
        </div>
        {nearest && <div
          style={{
            width: "min(100%, 460px)",
            marginTop: "var(--ss-ride-aircraft-gap, clamp(12px, 4dvh, 36px))",
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
            className="ss-ride-aircraft-readings"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, max-content) minmax(0, max-content)",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div className="ss-ride-aircraft-type" role="img" aria-label={nearestSummary.aircraftType}>
              <span aria-hidden="true">
                {nearestSummary.aircraftType === "Helicopter"
                  ? <HelicopterIcon size={36} />
                  : <PlaneIcon size={36} />}
              </span>
            </div>
            <RideSummaryMetric
              label="Direction"
              value={nearestSummary.direction}
            />
            <RideSummaryMetric label="GS" value={nearestSummary.groundSpeed} />
            <div aria-live="polite" style={{ minWidth: 0 }}>
              <RideSummaryMetric label="Altitude" value={formatAircraftAltitude(nearest.plane.altitude_ft)} />
            </div>
          </div>
        </div>}
        {!policeNearby && locationCopy && <div
          style={{
            color: "#f5f2e8",
            fontSize: "clamp(15px, 4.5vw, 18px)",
            lineHeight: 1.12,
            fontWeight: 850,
            maxWidth: 420,
          }}
        >
          {locationCopy}
        </div>}
      </header>

      <div className="ss-ride-instruments">
        {showSpeedometer ? <RiderSpeedBadge speedMps={riderPos?.speedMps ?? null} /> : <span />}
        {nearest ? <div className="ss-ride-distance" aria-live="polite" aria-label={`Distance to nearest aircraft: ${nearestSummary.distance}`}>
          <span className="ss-ride-distance__unit">Nm</span>
          <span className="ss-ride-distance__value ss-mono" style={{ color: statusColor }}>{nearest.distanceNm.toFixed(1)}</span>
        </div> : <span aria-hidden="true" />}
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
          alignSelf: nearest ? "start" : "center",
          justifySelf: "center",
          minHeight: 0,
        }}
      >
        <div id={rideViewId} className="ss-ride-view" {...rideViewSwipe}
          role="group" tabIndex={0} aria-label="Ride views. Swipe or use arrow keys for map and G-force."
          onKeyDown={event => {
            if (!ending && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
              event.preventDefault();
              switchRideView();
            }
          }}>
          <div className="ss-ride-view__map" aria-hidden={showStats || showGForce}>
            <Link
              href={mockOn ? "/map?mock=1" : "/map"}
              prefetch={false}
              className="ss-ride-map-link"
              aria-label="Open map, keep ride active"
              tabIndex={showStats || showGForce ? -1 : undefined}
              style={{
                display: "block",
                position: "relative",
                width: "var(--ss-ride-circle-size)",
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
            </Link>
          </div>
          {showGForce && !showStats && <RideGForceView
            onReset={() => void resetGForce()} resetting={resettingGForce}
            resetDisabled={ending || calibrating || resettingAngles || !recording.status?.active}
            resetError={resetGForceError} />}
          {showStats && <section className="ss-ride-live-stats" aria-label="Current ride stats">
            <RideStatistics ride={recording.status?.active ?? null} showAngles={showRideAngles} live
              calibrated={recording.status?.motion?.calibrated ?? false}
              onResetAngles={() => void resetAngles()} resettingAngles={resettingAngles}
              resetAnglesDisabled={ending || calibrating || resettingGForce || !recording.status?.motion?.calibrated || !recording.status?.active?.motion?.sampleCount}
              resetAnglesError={resetAnglesError} />
          </section>}
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
        {calibrationError && <p className="ss-ride-error" role="alert" style={{ margin: 0, maxWidth: 420, textAlign: "center", fontSize: 12 }}>
          {calibrationError}
        </p>}
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
          <div className="ss-ride-navigation__controls">
            <button type="button"
              className="ss-ride-navigation__calibrate"
              aria-label="Calibrate phone"
              aria-busy={calibrating}
              aria-pressed={recording.status?.motion?.gForceCalibrated ?? false}
              disabled={calibrating || resettingAngles || resettingGForce || ending || !recording.status?.active || !recording.status.motion?.supported}
              onClick={() => void calibrate()}
            >
              <RideCalibrationIcon />
            </button>
            <button type="button"
              className="ss-ride-navigation__view"
              aria-label={showStats ? "Show ride map" : "Show ride stats"}
              aria-controls={rideViewId}
              disabled={ending}
              onClick={() => {
                if (showStats) setShowGForce(false);
                setShowStats(current => !current);
              }}
            >
              {showStats ? <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M1.2 7.65 6.85 9v13.25L1.45 20.9A1.25 1.25 0 0 1 .5 19.68V8.62c0-.64.34-1.1.7-.97ZM8.05 9.08l.7-.16c1.2 3.05 3.62 5.74 4.48 6.28.48.3 1.06.3 1.54 0 .08-.05.17-.11.26-.19v5.75l-6.98 1.5V9.08ZM16.25 13.74c1.07-1.28 2.18-3 2.73-4.92l3.58.9c.56.14.94.65.94 1.22v10.12c0 .81-.75 1.4-1.53 1.22l-5.72-1.33v-7.21Z" />
                <path fillRule="evenodd" clipRule="evenodd" d="M13.95 1.15a5.45 5.45 0 0 0-5.45 5.45c0 3.8 4.18 7.75 5.05 8.52.23.2.57.2.8 0 .87-.77 5.05-4.72 5.05-8.52a5.45 5.45 0 0 0-5.45-5.45Zm0 7.68a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z" />
              </svg> : <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="4" y="12" width="4" height="8" rx="1" />
                <rect x="10" y="4" width="4" height="16" rx="1" />
                <rect x="16" y="8" width="4" height="12" rx="1" />
              </svg>}
            </button>
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

function useRideViewSwipe(onSwipe: () => void, disabled: boolean) {
  const gesture = useRef<{ id: number; x: number; y: number; vertical: boolean } | null>(null);
  const suppressClick = useRef(false);
  return {
    onTouchStart(event: TouchEvent<HTMLDivElement>) {
      suppressClick.current = event.touches.length > 1;
      const touch = event.touches[0];
      gesture.current = !disabled && event.touches.length === 1 && touch
        ? { id: touch.identifier, x: touch.clientX, y: touch.clientY, vertical: false } : null;
    },
    onTouchMove(event: TouchEvent<HTMLDivElement>) {
      const start = gesture.current;
      const touch = event.touches[0];
      if (!start || event.touches.length !== 1 || touch?.identifier !== start.id) {
        gesture.current = null;
        return;
      }
      const dx = Math.abs(touch.clientX - start.x);
      const dy = Math.abs(touch.clientY - start.y);
      if (Math.max(dx, dy) > 12) suppressClick.current = true;
      if (dy > 12 && dy >= dx) start.vertical = true;
    },
    onTouchEnd(event: TouchEvent<HTMLDivElement>) {
      const start = gesture.current;
      gesture.current = null;
      if (!start || disabled || event.touches.length > 0) return;
      const touch = Array.from(event.changedTouches).find(touch => touch.identifier === start.id);
      if (!touch) return;
      const dx = Math.abs(touch.clientX - start.x);
      const dy = Math.abs(touch.clientY - start.y);
      if (Math.max(dx, dy) > 12) suppressClick.current = true;
      if (!start.vertical && dx >= 48 && dx > dy * 1.5) onSwipe();
    },
    onTouchCancel() { gesture.current = null; },
    onClickCapture(event: MouseEvent<HTMLDivElement>) {
      // A swipe must not also open the map or activate a stats control.
      if (!suppressClick.current || event.detail === 0) return;
      suppressClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
  };
}

function useRideChrome() {
  useEffect(() => {
    document.body.dataset.rideMode = "true";
    return () => {
      delete document.body.dataset.rideMode;
    };
  }, []);
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
        ? cardinalFromDeg(contact.plane.heading)
        : "--",
    groundSpeed: formatGroundSpeed(contact.plane.ground_speed_kt) ?? "--",
  };
}

function RideSummaryMetric({
  label,
  value,
  suffix,
  wrap = false,
}: {
  label: string;
  value: string;
  suffix?: string;
  wrap?: boolean;
}) {
  return (
    <div
      style={{
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
      aria-label={`${label}: ${value}${suffix ? ` ${suffix}` : ""}`}
    >
      <div
        style={{
          color: "#f5f2e8",
          fontSize: "clamp(15px, 4.4vw, 22px)",
          fontWeight: 950,
          letterSpacing: 0,
          lineHeight: 1.25,
          whiteSpace: wrap ? "normal" : "nowrap",
          maxWidth: "100%",
        }}
      >
        {value}
        {suffix && <> <small style={{ fontSize: "0.75em", whiteSpace: "nowrap" }}>{suffix}</small></>}
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
