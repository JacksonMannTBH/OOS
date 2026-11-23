"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type MouseEvent, type Ref, type TouchEvent } from "react";
import nextDynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ScreenAwake } from "./ScreenAwake";
import { RideOrientationButton } from "./RideOrientationButton";
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
import { RideLeanArcView } from "./RideLeanArc";
import { RidePitchHorizonView } from "./RidePitchHorizon";
import { useRideGauge } from "@/lib/hooks/useRideGauge";
import { RideCalibrationIcon } from "./RideCalibrationIcon";
import { HelicopterIcon } from "./HelicopterIcon";
import { PlaneIcon } from "./PlaneIcon";
import { RideSpeedTransition } from "./RideSpeedTransition";

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
  const rideGauge = useRideGauge();
  const policeSightings = usePoliceSightings(!mockOn);
  const policeNearby = hasNearbyPolice(policeSightings, riderPos);
  const recording = useRideRecorder();
  const [showStats, setShowStats] = useState(false);
  const [showGauge, setShowGauge] = useState(false);
  const [expandedSpeed, setExpandedSpeed] = useState(false);
  const speedExpanded = showSpeedometer && expandedSpeed;
  const [speedTransition, setSpeedTransition] = useState(false);
  const speedTransitionPending = useRef(false);
  const rideContent = useRef<HTMLDivElement>(null);
  const speedButton = useRef<HTMLButtonElement>(null);
  const rideViewId = useId();
  const [ending, setEnding] = useState(false);
  const revealExpandedSpeed = useCallback(() => {
    setExpandedSpeed(true);
    setShowStats(false);
    setShowGauge(false);
  }, []);
  const completeSpeedTransition = useCallback(() => {
    speedTransitionPending.current = false;
    setSpeedTransition(false);
    requestAnimationFrame(() => speedButton.current?.focus({ preventScroll: true }));
  }, []);
  const toggleSpeed = () => {
    if (ending || speedTransitionPending.current) return;
    if (speedExpanded) {
      setExpandedSpeed(false);
      completeSpeedTransition();
    } else if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      revealExpandedSpeed();
      completeSpeedTransition();
    } else {
      speedTransitionPending.current = true;
      setSpeedTransition(true);
    }
  };
  useEffect(() => {
    if (rideContent.current) rideContent.current.inert = speedTransition;
  }, [speedTransition]);
  const switchRideView = () => {
    setExpandedSpeed(false);
    setShowGauge(current => showStats || !current);
    setShowStats(false);
  };
  const rideViewSwipe = useRideViewSwipe(switchRideView, ending || speedExpanded || speedTransition);
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
  const [orientationError, setOrientationError] = useState("");
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
      data-police-nearby={policeNearby ? "true" : undefined}
      data-speed-expanded={speedExpanded ? "true" : undefined}
      data-speed-transition={speedTransition ? "true" : undefined}
      aria-busy={speedTransition || ending}
    >
      <ScreenAwake />
      <div className="ss-ride-content" ref={rideContent}>
      <header
        className="ss-ride-header"
        style={{
          textAlign: "center",
          display: "var(--ss-ride-header-display, flex)",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--ss-ride-heading-gap, 8px)",
          width: "min(100%, 500px)",
          justifySelf: "center",
        }}
      >
        <div className="ss-ride-status-group">
        {(recording.error || recording.status?.message || endError) && <p className="ss-ride-error" role="alert">{endError || recording.error || recording.status?.message}</p>}
        {policeNearby && <div
          className="ss-police-nearby"
          aria-live="polite"
          style={{
            fontSize: "var(--ss-ride-police-size, clamp(28px, 8.5vw, 42px))",
            lineHeight: 1.05,
            fontWeight: 950,
            maxWidth: 440,
            textWrap: "balance",
          }}
        >
          POLICE NEARBY
        </div>}
        <div className="ss-ride-status-row">
        <div
          className="ss-ride-aircraft-status"
          aria-live="polite"
          style={{
            color: statusColor,
            fontSize: `var(--ss-ride-status-size, ${policeNearby
              ? "clamp(20px, 5.5vw, 26px)"
              : status === "warning"
                ? "clamp(56px, 18.5vw, 104px)"
                : "clamp(60px, 19.5vw, 108px)"})`,
            lineHeight: policeNearby ? 1.12 : 0.92,
            fontWeight: 950,
            letterSpacing: 0,
            textShadow: "none",
          }}
        >
          {policeNearby && !speedExpanded && "Aircraft · "}{statusLabel.toUpperCase()}
        </div>
        {nearest && <AircraftDistance distanceNm={nearest.distanceNm} color={statusColor} placement="landscape" />}
        </div>
        {!policeNearby && locationCopy && <div
          style={{
            color: "rgb(var(--ss-ui-f5f2e8, 245, 242, 232))",
            fontSize: "clamp(15px, 4.5vw, 18px)",
            lineHeight: 1.12,
            fontWeight: 850,
            maxWidth: 420,
          }}
        >
          {locationCopy}
        </div>}
        </div>
        {nearest && <div
          className="ss-ride-aircraft-bar"
          style={{
            width: "var(--ss-ride-aircraft-width, min(100%, 460px))",
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
      </header>

      <div className="ss-ride-instruments" hidden={speedExpanded}>
        {showSpeedometer && !speedExpanded ? <RiderSpeedBadge speedMps={riderPos?.speedMps ?? null}
          buttonRef={speedButton} controls={rideViewId} onClick={toggleSpeed} disabled={ending} /> : <span aria-hidden="true" />}
        {nearest ? <AircraftDistance distanceNm={nearest.distanceNm} color={statusColor} placement="portrait" />
          : <span className="ss-ride-distance-spacer" aria-hidden="true" />}
        <PoliceReportButton alerting={policeNearby} disabled={mockOn || unavailable || !riderPos} />
      </div>

      <div
        className="ss-ride-panel"
        style={{
          display: "var(--ss-ride-panel-display, flex)",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "var(--ss-ride-panel-justify, center)",
          gap: 10,
          width: "var(--ss-ride-panel-width, min(100%, 500px))",
          alignSelf: `var(--ss-ride-panel-align, ${nearest ? "start" : "center"})`,
          justifySelf: "center",
          minHeight: 0,
        }}
      >
        <div id={rideViewId} className="ss-ride-view" {...rideViewSwipe}
          role="group" tabIndex={speedExpanded ? -1 : 0}
          aria-label={speedExpanded ? "Ride map and speedometer" : `Ride views. Swipe or use arrow keys for map and ${rideGauge === "lean" ? "Lean arc" : rideGauge === "pitch" ? "Moving horizon" : "G-force"}.`}
          onKeyDown={event => {
            if (!ending && !speedExpanded && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
              event.preventDefault();
              switchRideView();
            }
          }}>
          <div className="ss-ride-view__map" aria-hidden={showStats || showGauge}>
            <Link
              href={mockOn ? "/map?mock=1" : "/map"}
              prefetch={false}
              className="ss-ride-map-link"
              aria-label="Open map, keep ride active"
              tabIndex={showStats || showGauge ? -1 : undefined}
              style={{
                display: "block",
                position: "relative",
                width: "var(--ss-ride-map-size, var(--ss-ride-circle-size))",
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
          {speedExpanded && <div className="ss-ride-view__speed">
            <RiderSpeedBadge speedMps={riderPos?.speedMps ?? null} expanded
              buttonRef={speedButton} controls={rideViewId} color={statusColor} onClick={toggleSpeed} disabled={ending} />
          </div>}
          {showGauge && !showStats && rideGauge === "gforce" && <RideGForceView
            onReset={() => void resetGForce()} resetting={resettingGForce}
            resetDisabled={ending || calibrating || resettingAngles || !recording.status?.active}
            resetError={resetGForceError} />}
          {showGauge && !showStats && rideGauge === "lean" && <RideLeanArcView
            onReset={() => void resetAngles()} resetting={resettingAngles}
            resetDisabled={ending || calibrating || resettingGForce || !recording.status?.active}
            resetError={resetAnglesError} />}
          {showGauge && !showStats && rideGauge === "pitch" && <RidePitchHorizonView
            onReset={() => void resetAngles()} resetting={resettingAngles}
            resetDisabled={ending || calibrating || resettingGForce || !recording.status?.active}
            resetError={resetAnglesError} />}
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
        className="ss-ride-footer"
        hidden={speedExpanded}
      >
        {(calibrationError || orientationError) && <p className="ss-ride-error" role="alert" style={{ margin: 0, maxWidth: 420, textAlign: "center", fontSize: 12 }}>
          {calibrationError || orientationError}
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
          <RideOrientationButton disabled={ending || calibrating} onError={setOrientationError} />
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
                setExpandedSpeed(false);
                if (showStats) setShowGauge(false);
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
          className="ss-ride-end"
          onClick={() => void endRide()}
          disabled={ending}
          aria-label="End Ride and return to the main app"
          style={{
            width: "var(--ss-ride-end-width, min(100%, 460px))",
            minHeight: 54,
            borderRadius: 18,
            border: "1px solid var(--ss-ride-end-color)",
            background: "#050505",
            color: "var(--ss-ride-end-color)",
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
      </div>
      {speedTransition && <RideSpeedTransition onCovered={revealExpandedSpeed} onComplete={completeSpeedTransition} />}
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

function AircraftDistance({ distanceNm, color, placement }: { distanceNm: number; color: string; placement: "portrait" | "landscape" }) {
  return <div className={`ss-ride-distance ss-ride-distance--${placement}`} aria-live="polite"
    aria-label={`Distance to nearest aircraft: ${distanceNm.toFixed(1)} nm`}>
    <span className="ss-ride-distance__reading">
      <span className="ss-ride-distance__value ss-mono" style={{ color }}>{distanceNm.toFixed(1)}</span>
      <span className="ss-ride-distance__unit">nm</span>
    </span>
  </div>;
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
          color: "rgb(var(--ss-ui-f5f2e8, 245, 242, 232))",
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

function RiderSpeedBadge({ speedMps, expanded = false, onClick, buttonRef, controls, color, disabled }: {
  speedMps: number | null; expanded?: boolean; onClick: () => void;
  buttonRef: Ref<HTMLButtonElement>; controls: string; color?: string; disabled: boolean;
}) {
  const mph =
    speedMps != null && Number.isFinite(speedMps) && speedMps >= 0
      ? Math.round(speedMps * MPS_TO_MPH)
      : null;

  return (
    <button
      type="button"
      ref={buttonRef}
      className={`ss-ride-speedometer${expanded ? " ss-ride-speedometer--expanded" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-expanded={expanded}
      aria-controls={controls}
      aria-live="polite"
      aria-label={`Your speed: ${mph == null ? "unavailable" : `${mph} miles per hour`}. ${expanded ? "Restore ride controls" : "Expand speedometer"}.`}
      style={expanded && color ? { borderColor: `color-mix(in srgb, ${color} 78%, rgb(var(--ss-ui-f5f2e8, 245, 242, 232)))` } : undefined}
    >
      <span className="ss-ride-speedometer__unit">MPH</span>
      <span className="ss-mono ss-ride-speedometer__value">
        {mph == null ? "—" : mph}
      </span>
    </button>
  );
}
