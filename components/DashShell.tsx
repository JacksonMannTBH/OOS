"use client";

import { useMemo } from "react";
import Link from "next/link";
import { filterOpsAircraftByState } from "@/lib/aircraft-directory";
import { useAircraft } from "@/lib/hooks/useAircraft";
import { useSelectedStateId } from "@/lib/hooks/useSelectedStateId";
import { useRiderPos } from "@/lib/hooks/useRiderPos";
import { SS_TOKENS } from "@/lib/tokens";
import { FEATURED_TAIL } from "@/lib/seed";
import { haversineNm } from "@/lib/geo";
import { proximityBandForDistance } from "@/lib/proximity-display";
import { computeStatus } from "@/lib/status";
import { aircraftVehicleType } from "@/lib/aircraft-type";
import { AlertsOptInCard } from "./AlertsOptInCard";
import { ProximityFlash } from "./ProximityFlash";
import { TakeOffButton } from "./TakeOffButton";
import { StatusHero } from "./StatusHero";
import type { Aircraft, FleetEntry, Snapshot } from "@/lib/types";

const TABBAR_HEIGHT = 66;
const NEAR_NM = 5;
const HOME_BACKGROUND_IMAGE = "/images/home-map-background.png";
type WatcherEntry = { plane: Aircraft; distanceNm: number | null };

type Props = {
  initial: Snapshot;
  mockOn?: boolean;
  mockParam?: string;
};

export function DashShell({ initial, mockOn = false, mockParam }: Props) {
  const snap = useAircraft(initial, mockOn);
  const stateId = useSelectedStateId();
  const { pos } = useRiderPos();

  const stateAircraft = useMemo(
    () => filterOpsAircraftByState(snap.aircraft, stateId),
    [snap.aircraft, stateId],
  );
  const stateSnap = useMemo(
    () => ({ ...snap, aircraft: stateAircraft }),
    [snap, stateAircraft],
  );
  const airborne = useMemo(
    () => stateAircraft.filter((a) => a.airborne),
    [stateAircraft],
  );
  const fleetMap = useMemo(
    () => new Map<string, FleetEntry>(stateAircraft.map((a) => [a.tail, a])),
    [stateAircraft],
  );
  const status = useMemo(
    () => computeStatus(stateSnap, fleetMap),
    [stateSnap, fleetMap],
  );
  const featuredAircraft = stateAircraft.find((a) => a.tail === FEATURED_TAIL);
  const featuredAircraftUp = Boolean(featuredAircraft?.airborne);

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
    ? proximityBandForDistance(nearest.distanceNm)
    : null;


  return (
    <>
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          backgroundColor: "#050607",
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.72), rgba(0, 0, 0, 0.84)), url(${HOME_BACKGROUND_IMAGE})`,
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
        }}
      />
      <main
        style={{
          minHeight: "100dvh",
          // Bottom padding = tab bar (66) + iOS install prompt overlay
          // (~80) + breathing room. Without this the last dash card
          // hides behind the fixed-position prompt on iOS Safari.
          boxSizing: "border-box",
          width: "100%",
          padding: `clamp(16px, 4vw, 22px) clamp(14px, 5vw, 20px) ${TABBAR_HEIGHT + 136}px`,
          maxWidth: 430,
          margin: "0 auto",
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "clamp(14px, 4vw, 18px)",
        }}
      >
        <StatusHero
          status={status}
          lastSampleMs={snap.fetched_at}
          showPill={false}
          frameless
        />

        <TakeOffButton />

        <NearestCard
          watcherList={watcherList}
          riderHasFix={Boolean(pos)}
          featuredAircraftUp={featuredAircraftUp}
          airborneCount={airborne.length}
          mockParam={mockParam}
        />

        <AlertsOptInCard frameless />

        <ProximityFlash
          active={
            nearest != null &&
            nearest.distanceNm != null &&
            nearest.distanceNm <= NEAR_NM &&
            (nearest.plane.role === "fixed_wing" || nearest.plane.role === "patrol")
          }
          color={nearestBand?.color}
        />
      </main>
    </>
  );
}

function NearestCard({
  watcherList,
  riderHasFix,
  featuredAircraftUp,
  airborneCount,
  mockParam,
}: {
  watcherList: WatcherEntry[];
  riderHasFix: boolean;
  featuredAircraftUp: boolean;
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
          featuredAircraftUp={featuredAircraftUp}
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
  featuredAircraftUp,
  airborneCount,
}: {
  riderHasFix: boolean;
  featuredAircraftUp: boolean;
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
  if (!featuredAircraftUp) {
    return (
      <div
        style={{ ...baseStyle, display: "flex", alignItems: "center", gap: 10 }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: SS_TOKENS.clear,
            boxShadow: `0 0 8px ${SS_TOKENS.clear}`,
          }}
        />
        <span style={{ fontSize: 14, color: SS_TOKENS.fg1 }}>
          No watchers aloft
        </span>
      </div>
    );
  }
  return (
    <div style={{ ...baseStyle, fontSize: 13, color: SS_TOKENS.fg2 }}>
      A plane is up but we don&rsquo;t have its position yet.
    </div>
  );
}

