"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LogoMark } from "./brand/Logo";
import { filterOpsAircraftByState } from "@/lib/aircraft-directory";
import { EMPTY_AIRCRAFT_SNAPSHOT, useAircraft } from "@/lib/hooks/useAircraft";
import { useSelectedStateId } from "@/lib/hooks/useSelectedStateId";
import { useRiderPos } from "@/lib/hooks/useRiderPos";
import { useRideStatusThresholds } from "@/lib/hooks/useRideStatusThresholds";
import { SS_TOKENS } from "@/lib/tokens";
import { haversineNm } from "@/lib/geo";
import { proximityBandForDistance } from "@/lib/proximity-display";
import { aircraftVehicleType } from "@/lib/aircraft-type";
import { AlertsOptInCard } from "./AlertsOptInCard";
import { ProximityFlash } from "./ProximityFlash";
import { SettingsButton } from "./SettingsButton";
import { TakeOffButton } from "./TakeOffButton";
import { HomeActiveAircraft } from "./HomeActiveAircraft";
import { isVisibleFlight } from "@/lib/aircraft-freshness";
import { DataLoadingScreen } from "./DataLoadingScreen";
import { LiveTrackingButton } from "./LiveTrackingButton";
import { HomeBackground } from "./HomeBackground";
import { RideHistory } from "./RideHistory";
import type { Aircraft, Snapshot } from "@/lib/types";

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
  const [initialLoadExpired, setInitialLoadExpired] = useState(false);
  const hasSnapshot = snap.fetched_at > 0;
  useEffect(() => {
    setInitialLoadExpired(false);
    if (hasSnapshot) return;
    const timer = window.setTimeout(() => setInitialLoadExpired(true), 10_000);
    return () => window.clearTimeout(timer);
  }, [stateId, hasSnapshot]);

  const stateAircraft = useMemo(
    () => filterOpsAircraftByState(snap.aircraft, stateId),
    [snap.aircraft, stateId],
  );
  const visibleFlights = useMemo(
    () => stateAircraft.filter(isVisibleFlight),
    [stateAircraft],
  );
  const airborne = useMemo(
    () => stateAircraft.filter((a) => a.airborne),
    [stateAircraft],
  );

  // All airborne planes, sorted by Haversine distance when rider location is
  // available. The first positioned entry still drives the proximity flash.
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
  const nearestBand = nearest?.distanceNm != null
    ? proximityBandForDistance(nearest.distanceNm, rideThresholds)
    : null;
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
          aria-label={
            eyeTarget
              ? `View nearest active aircraft ${eyeTarget.tail}`
              : "View map"
          }
          style={{
            alignSelf: "center",
            display: "block",
            width: "min(100%, 300px, 30dvh)",
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
        <HomeActiveAircraft aircraft={visibleFlights} mockParam={mockParam} />

        <RideHistory />
        </div>

        <div
          className="ss-home-actions"
          style={{
            width: "100%",
            maxWidth: 460,
            alignSelf: "center",
            padding: "12px clamp(14px, 5vw, 20px) calc(env(safe-area-inset-bottom, 0px) + 16px)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <TakeOffButton />
          <Link
            href={
              mockParam
                ? { pathname: "/map", query: { mock: mockParam } }
                : "/map"
            }
            prefetch={false}
            style={{
              width: "100%",
              minHeight: 56,
              boxSizing: "border-box",
              borderRadius: 18,
              border: "1px solid #fffdf8",
              background: "#fffdf8",
              color: "#050505",
              fontFamily: "inherit",
              fontSize: 18,
              fontWeight: 900,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 16px 50px rgba(0, 0, 0, 0.18)",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            View Map
          </Link>
        </div>
      </main>
        <ProximityFlash
          active={
            nearest != null &&
            nearest.distanceNm != null &&
            nearest.distanceNm <= rideThresholds.watchNm &&
            (nearest.plane.role === "fixed_wing" || nearest.plane.role === "patrol")
          }
          color={nearestBand?.color}
        />
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

