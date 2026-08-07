"use client";

import { useMemo } from "react";
import Link from "next/link";
import { LogoMark } from "./brand/Logo";
import { filterOpsAircraftByState } from "@/lib/aircraft-directory";
import { useAircraft } from "@/lib/hooks/useAircraft";
import { useSelectedStateId } from "@/lib/hooks/useSelectedStateId";
import { useRiderPos } from "@/lib/hooks/useRiderPos";
import { SS_TOKENS } from "@/lib/tokens";
import { haversineNm } from "@/lib/geo";
import { proximityBandForDistance } from "@/lib/proximity-display";
import { computeStatus } from "@/lib/status";
import { aircraftVehicleType } from "@/lib/aircraft-type";
import { AlertsOptInCard } from "./AlertsOptInCard";
import { ProximityFlash } from "./ProximityFlash";
import { SettingsButton } from "./SettingsButton";
import { TakeOffButton } from "./TakeOffButton";
import { StatusHero } from "./StatusHero";
import type { Aircraft, FleetEntry, Snapshot } from "@/lib/types";

const NEAR_NM = 5;
const HOME_TOP_OFFSET_PX = 50;
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
  const eyeTarget = nearest?.plane ?? airborne[0] ?? null;
  const eyeHref = eyeTarget
    ? {
        pathname: "/map",
        query: {
          ...(mockParam ? { mock: mockParam } : {}),
          tail: eyeTarget.tail,
        },
      }
    : "/home";


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
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.20), rgba(0, 0, 0, 0.45)), url(${HOME_BACKGROUND_IMAGE})`,
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
          padding: `calc(clamp(52px, 13vw, 72px) + ${HOME_TOP_OFFSET_PX}px) clamp(14px, 5vw, 20px) 136px`,
          maxWidth: 430,
          margin: "0 auto",
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "clamp(14px, 4vw, 18px)",
        }}
      >
        <SettingsButton
          label=""
          variant="plain"
          style={{
            position: "absolute",
            top: `calc(max(8px, env(safe-area-inset-top)) + ${HOME_TOP_OFFSET_PX}px)`,
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
              : "Home"
          }
          style={{
            alignSelf: "center",
            display: "block",
            width: 300,
            height: 200,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <LogoMark
            height={200}
            width={300}
            variant={
              snap.fetched_at <= 0 || snap.aircraft.some((aircraft) => aircraft.airborne)
                ? "open"
                : "closed"
            }
          />
        </Link>
        <div
          style={{
            position: "relative",
            top: "clamp(16px, 4vw, 28px)",
          }}
        >
          <StatusHero
            status={status}
            showPill={false}
            frameless
          />
        </div>

        <div
          style={{
            width: "100%",
            maxWidth: 460,
            alignSelf: "center",
            marginTop: "clamp(44px, 12vw, 72px)",
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
              color: SS_TOKENS.alert,
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

