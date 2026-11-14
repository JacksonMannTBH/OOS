"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import nextDynamic from "next/dynamic";
import { LogoMark } from "./brand/Logo";
import { EMPTY_AIRCRAFT_SNAPSHOT, useAircraft } from "@/lib/hooks/useAircraft";
import { useSelectedStateId } from "@/lib/hooks/useSelectedStateId";
import { useRiderPos } from "@/lib/hooks/useRiderPos";
import { useRideStatusThresholds } from "@/lib/hooks/useRideStatusThresholds";
import { SS_TOKENS } from "@/lib/tokens";
import { haversineNm } from "@/lib/geo";
import { classifyRideStatus, RIDE_STATUS_COLORS } from "@/lib/ride-mode";
import { aircraftVehicleType } from "@/lib/aircraft-type";
import { AlertsOptInCard } from "./AlertsOptInCard";
import { SettingsButton } from "./SettingsButton";
import { TakeOffButton } from "./TakeOffButton";
import { HomeActiveAircraft } from "./HomeActiveAircraft";
import { isVisibleFlight } from "@/lib/aircraft-freshness";
import { DataLoadingScreen } from "./DataLoadingScreen";
import { LiveTrackingButton } from "./LiveTrackingButton";
import { HomeBackground } from "./HomeBackground";
import { RideHistory } from "./RideHistory";
import { SubscriptionAnnouncement } from "./SubscriptionAnnouncement";
import type { Aircraft, Snapshot } from "@/lib/types";

const HomeMapPreview = nextDynamic(() => import("./HomeMapPreview"), { ssr: false });

type WatcherEntry = { plane: Aircraft; distanceNm: number | null };

type Props = {
  initial?: Snapshot;
  mockOn?: boolean;
  mockParam?: string;
};

export function DashShell({ initial = EMPTY_AIRCRAFT_SNAPSHOT, mockOn = false, mockParam }: Props) {
  const snap = useAircraft(initial, mockOn);
  const stateId = useSelectedStateId();
  const { pos } = useRiderPos();
  const rideThresholds = useRideStatusThresholds();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [initialLoadExpired, setInitialLoadExpired] = useState(false);
  const hasSnapshot = snap.fetched_at > 0;
  useEffect(() => {
    setInitialLoadExpired(false);
    if (hasSnapshot) return;
    const timer = window.setTimeout(() => setInitialLoadExpired(true), 10_000);
    return () => window.clearTimeout(timer);
  }, [stateId, hasSnapshot]);

  // useAircraft already scopes the live feed to the selected state and tracking
  // preferences. A second catalog lookup can discard newly tracked aircraft.
  const visibleFlights = useMemo(
    () => snap.aircraft.filter(isVisibleFlight),
    [snap.aircraft],
  );
  const airborne = useMemo(
    () => snap.aircraft.filter((a) => a.airborne),
    [snap.aircraft],
  );

  // All airborne planes, sorted by Haversine distance when rider location is
  // available.
  const watcherList = useMemo<WatcherEntry[]>(() => {
    if (!pos) {
      return airborne.map((plane) => ({
        plane,
        distanceNm: null,
      }));
    }
    const ranked: Array<{ plane: Aircraft; distanceNm: number }> = [];
    const unpositioned: WatcherEntry[] = [];
    for (const a of airborne) {
      if (a.lat == null || a.lon == null) {
        unpositioned.push({ plane: a, distanceNm: null });
        continue;
      }
      ranked.push({
        plane: a,
        distanceNm: haversineNm(pos.lat, pos.lon, a.lat, a.lon),
      });
    }
    ranked.sort((x, y) => x.distanceNm - y.distanceNm);
    return [...ranked, ...unpositioned];
  }, [pos, airborne]);
  const nearest = watcherList.find((entry) => entry.distanceNm != null) ?? null;
  const nearestVisible = watcherList.find((entry) => entry.distanceNm != null
    && Number.isFinite(entry.distanceNm) && isVisibleFlight(entry.plane)) ?? null;
  const statusColor = RIDE_STATUS_COLORS[
    classifyRideStatus(nearestVisible?.distanceNm ?? null, rideThresholds)
  ];
  const eyeTarget = nearest?.plane ?? airborne[0] ?? null;
  const eyeHref = eyeTarget
    ? {
        pathname: "/map",
        query: {
          ...(mockParam ? { mock: mockParam } : {}),
          tail: eyeTarget.tail,
        },
      }
    : mockParam
      ? { pathname: "/map", query: { mock: mockParam } }
      : "/map";


  // Open the app using its most recent saved state.
  if (!hasSnapshot && !initialLoadExpired) return <DataLoadingScreen />;

  return (
    <>
      <HomeBackground />
      <main
        className="ss-home"
        style={{
          height: "100dvh",
          boxSizing: "border-box",
          width: "100%",
          maxWidth: 430,
          margin: "0 auto",
          position: "relative",
          zIndex: 1,
          display: "grid",
          gridTemplateRows: "minmax(0, 1fr) auto",
        }}
      >
        <div className="ss-home-scroll">
        <SubscriptionAnnouncement />
        <LiveTrackingButton mockOn={mockOn} style={{
          position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 12px)",
          left: "clamp(14px, 5vw, 20px)", zIndex: 3,
        }} />
        <SettingsButton
          label=""
          variant="plain"
          style={{
            position: "absolute",
            top: "calc(env(safe-area-inset-top, 0px) + 12px)",
            right: "clamp(14px, 5vw, 20px)",
            width: 44,
            minHeight: 44,
            padding: 0,
            marginTop: 0,
            alignSelf: "auto",
            zIndex: 2,
          }}
        />
        <Link
          href={eyeHref}
          prefetch={false}
          className="ss-home-eye"
          aria-label={
            eyeTarget
              ? `View nearest active aircraft ${eyeTarget.tail}`
              : "View map"
          }
          style={{
            alignSelf: "center",
            display: "block",
            width: "min(100%, 225px, 22.5dvh)",
            aspectRatio: "3 / 2",
            flexShrink: 0,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <LogoMark
            height="100%"
            width="100%"
            variant={
              visibleFlights.length > 0
                ? "open"
                : "closed"
            }
          />
        </Link>
        <HomeActiveAircraft aircraft={visibleFlights} nearest={nearestVisible} statusColor={statusColor} mockParam={mockParam} />

        <div className="ss-home-map-preview" style={{ position: "relative", width: "100%", height: 276.5, marginTop: "auto", boxSizing: "border-box", borderRadius: 18, overflow: "hidden" }}>
          <HomeMapPreview rider={pos} aircraft={visibleFlights} />
          <Link
            href={mockParam ? { pathname: "/map", query: { mock: mockParam } } : "/map"}
            prefetch={false}
            aria-label="View Map"
            title="Open full map"
            style={{ position: "absolute", top: 10, right: 10, zIndex: 2, width: 60, height: 60, borderRadius: 16, display: "grid", placeItems: "center", background: "rgba(5,5,5,.82)", color: "#f5f1e6", textDecoration: "none" }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6" />
            </svg>
          </Link>
        </div>
        </div>

        <div
          className="ss-home-actions"
          style={{
            width: "100%",
            maxWidth: 460,
            alignSelf: "center",
            padding: "12px clamp(14px, 5vw, 20px) calc(env(safe-area-inset-bottom, 0px) + 16px)",
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            aria-haspopup="dialog"
            style={{ width: "100%", minWidth: 0, height: 64, padding: "0 10px", boxSizing: "border-box", borderRadius: 18, border: "1px solid rgba(255,255,255,.24)", background: "#151613", color: "#f5f1e6", font: "inherit", fontSize: 18, fontWeight: 800, cursor: "pointer" }}
          >
            Recent Rides
          </button>
          <div style={{ display: "grid", minWidth: 0 }}><TakeOffButton style={{ width: "100%", height: 64, padding: "0 10px" }} /></div>
        </div>
      </main>
        <RideHistory open={historyOpen} onClose={() => setHistoryOpen(false)} />
        <AlertsOptInCard />
    </>
  );
}

function NearestCard({
  watcherList,
  riderHasFix,
  airborneCount,
  mockParam,
}: {
  watcherList: WatcherEntry[];
  riderHasFix: boolean;
  airborneCount: number;
  mockParam?: string;
}) {
  const planeEntries = watcherList.filter(
    (entry) => aircraftVehicleType(entry.plane.model) !== "Helicopter",
  );
  const heliEntries = watcherList.filter(
    (entry) => aircraftVehicleType(entry.plane.model) === "Helicopter",
  );

  const hasWatchers = watcherList.length > 0;

  return (
    <section
      aria-labelledby={hasWatchers ? "active-air-support-heading" : undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        marginTop: 8,
        width: "100%",
        maxWidth: 360,
        alignSelf: "center",
      }}
    >
      {hasWatchers ? (
        <>
          <h2
            id="active-air-support-heading"
            style={{
              margin: 0,
              padding: "17px 0",
              color: SS_TOKENS.fg0,
              fontSize: 18,
              fontWeight: 800,
              lineHeight: 1.05,
              textAlign: "center",
            }}
          >
            Active Air Support
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 26,
              alignItems: "start",
            }}
          >
            <AircraftColumn
              title="Heli"
              entries={heliEntries}
              mockParam={mockParam}
            />
            <AircraftColumn
              title="Plane"
              entries={planeEntries}
              mockParam={mockParam}
            />
          </div>
        </>
      ) : (
        <NearestEmpty
          riderHasFix={riderHasFix}
          airborneCount={airborneCount}
        />
      )}
    </section>
  );
}

function AircraftColumn({
  title,
  entries,
  mockParam,
}: {
  title: string;
  entries: WatcherEntry[];
  mockParam?: string;
}) {
  return (
    <div style={{ minWidth: 0, textAlign: "center" }}>
      <div
        className="ss-mono"
        style={{
          color: SS_TOKENS.alert,
          fontSize: 10.5,
          fontWeight: 800,
          letterSpacing: ".08em",
          marginBottom: 5,
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      {entries.length > 0 ? (
        entries.map((entry) => (
          <NearestRow
            key={entry.plane.tail}
            entry={entry}
            showKind={false}
            compact
            mockParam={mockParam}
          />
        ))
      ) : (
        <div
          style={{
            color: SS_TOKENS.fg3,
            fontSize: 12,
            lineHeight: 1.35,
            padding: "8px 0",
            textAlign: "center",
          }}
        >
          None active
        </div>
      )}
    </div>
  );
}

function NearestRow({
  entry,
  showKind = true,
  compact = false,
  mockParam,
}: {
  entry: WatcherEntry;
  showKind?: boolean;
  compact?: boolean;
  mockParam?: string;
}) {
  const distanceNm = entry.distanceNm;
  const isLiveOnly = distanceNm == null;
  const kindLabel =
    aircraftVehicleType(entry.plane.model) === "Helicopter" ? "Heli" : "Plane";
  return (
    <Link
      href={{
        pathname: "/map",
        query: mockParam
          ? { tail: entry.plane.tail, mock: mockParam }
          : { tail: entry.plane.tail },
      }}
      prefetch={false}
      style={{
        display: "flex",
        gap: compact ? 7 : 12,
        alignItems: "baseline",
        justifyContent: compact && isLiveOnly ? "center" : "space-between",
        width: compact ? "100%" : undefined,
        maxWidth: compact ? 148 : undefined,
        minHeight: compact ? 25 : undefined,
        margin: compact ? "0 auto" : undefined,
        padding: compact ? "5px 2px" : "10px 14px",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ minWidth: 0, textAlign: compact && isLiveOnly ? "center" : "left" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: compact ? 5 : 8,
            justifyContent: compact && isLiveOnly ? "center" : "flex-start",
          }}
        >
          <span
            className="ss-mono"
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: SS_TOKENS.fg0,
            }}
          >
            {entry.plane.tail}
          </span>
          {showKind && (
            <span
              className="ss-mono"
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: SS_TOKENS.fg2,
              }}
            >
              {kindLabel}
            </span>
          )}
        </div>
      </div>
      {!isLiveOnly && (
        <span
          className="ss-mono"
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: SS_TOKENS.fg1,
          }}
        >
          {distanceNm.toFixed(1)} nm
        </span>
      )}
    </Link>
  );
}

function NearestEmpty({
  riderHasFix,
  airborneCount,
}: {
  riderHasFix: boolean;
  airborneCount: number;
}) {
  const baseStyle: React.CSSProperties = {
    padding: "12px 14px 16px",
  };
  if (!riderHasFix && airborneCount > 0) {
    return (
      <div style={{ ...baseStyle, fontSize: 13, color: SS_TOKENS.fg2 }}>
        Aircraft are live. Grant location to sort them by distance.
      </div>
    );
  }
  if (!riderHasFix) {
    return (
      <div style={{ ...baseStyle, fontSize: 13, color: SS_TOKENS.fg2 }}>
        Need your location to compute distance — accept the prompt above to enable.
      </div>
    );
  }
  return null;
}

