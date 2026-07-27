"use client";

import { useEffect, useMemo, useState } from "react";
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
import { AlertsOptInCard } from "./AlertsOptInCard";
import { ProximityFlash } from "./ProximityFlash";
import { TakeOffButton } from "./TakeOffButton";
import { ActivityEventsSection } from "./ActivityFeed";
import { StatusHero } from "./StatusHero";
import type { Aircraft, FleetEntry, Snapshot } from "@/lib/types";
import type { ActivityEntry } from "@/lib/activity";

const TABBAR_HEIGHT = 66;
const NEAR_NM = 5;
const HOME_BACKGROUND_IMAGE = "/images/home-map-background.png";
// Top-N airborne planes to surface in the watcher list. Three is enough
// to convey crowdedness without dominating the screen.
const NEAREST_LIST_LIMIT = 3;
type WatcherEntry = { plane: Aircraft; distanceNm: number | null };

type Props = {
  initial: Snapshot;
  initialActivity: ActivityEntry[];
  mockOn?: boolean;
};

export function DashShell({ initial, initialActivity, mockOn = false }: Props) {
  const snap = useAircraft(initial, mockOn);
  const stateId = useSelectedStateId();
  const { pos } = useRiderPos();
  const [activity, setActivity] = useState<ActivityEntry[]>(initialActivity);
  const stateActivity = useMemo(
    () => filterOpsAircraftByState(activity, stateId),
    [activity, stateId],
  );

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

  // Top-N airborne planes by Haversine distance — sorted ascending so
  // nearestList[0] is the single closest. Drives both the watcher list
  // and the proximity-flash trigger.
  const watcherList = useMemo<WatcherEntry[]>(() => {
    if (!pos) {
      return airborne.slice(0, NEAREST_LIST_LIMIT).map((plane) => ({
        plane,
        distanceNm: null,
      }));
    }
    const ranked: Array<{ plane: Aircraft; distanceNm: number }> = [];
    for (const a of airborne) {
      if (a.lat == null || a.lon == null) continue;
      ranked.push({
        plane: a,
        distanceNm: haversineNm(pos.lat, pos.lon, a.lat, a.lon),
      });
    }
    ranked.sort((x, y) => x.distanceNm - y.distanceNm);
    return ranked.slice(0, NEAREST_LIST_LIMIT);
  }, [pos, airborne]);
  const nearest = watcherList.find((entry) => entry.distanceNm != null) ?? null;
  const nearestBand = nearest?.distanceNm != null
    ? proximityBandForDistance(nearest.distanceNm)
    : null;

  // Poll /api/activity every 10s.
  useEffect(() => {
    let cancelled = false;
    const fetchActivity = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const r = await fetch(
          `/api/activity?limit=5&state_id=${encodeURIComponent(stateId)}`,
          { cache: "no-store" },
        );
        if (!r.ok) return;
        const data = (await r.json()) as { entries: ActivityEntry[] };
        if (!cancelled) setActivity(data.entries);
      } catch {
        // transient — try again next tick
      }
    };
    const id = setInterval(fetchActivity, 10_000);
    void fetchActivity();
    const onVis = () => {
      if (document.visibilityState === "visible") void fetchActivity();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [stateId]);

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
        />

        {airborne.length > 0 && (
          <ContextLine
            airborneCount={airborne.length}
            nearest={nearest}
          />
        )}

        <AlertsOptInCard frameless />

        <ActivityEventsSection
          entries={stateActivity}
          id="recent-events"
          frameless
        />

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
}: {
  watcherList: WatcherEntry[];
  riderHasFix: boolean;
  featuredAircraftUp: boolean;
  airborneCount: number;
}) {
  return (
    <section>
      <div style={{ padding: "12px 14px 8px" }}>
        <span className="ss-eyebrow">
          {riderHasFix ? "Nearest watchers" : "Airborne now"}
        </span>
      </div>
      {watcherList.length > 0 ? (
        watcherList.map((entry, i) => (
          <NearestRow key={entry.plane.tail} entry={entry} primary={i === 0} />
        ))
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

function NearestRow({
  entry,
  primary,
}: {
  entry: WatcherEntry;
  primary: boolean;
}) {
  const inRange = entry.distanceNm != null && entry.distanceNm <= NEAR_NM;
  const distanceNm = entry.distanceNm;
  const isLiveOnly = distanceNm == null;
  return (
    <Link
      href={`/plane/${entry.plane.tail}`}
      prefetch={false}
      style={{
        display: "flex",
        gap: 12,
        alignItems: "baseline",
        justifyContent: "space-between",
        padding: "10px 14px",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            className="ss-mono"
            style={{
              fontSize: primary ? 15 : 13,
              fontWeight: 700,
              color: SS_TOKENS.fg0,
            }}
          >
            {entry.plane.tail}
          </span>
          {entry.plane.nickname && (
            <span
              style={{
                fontSize: 11.5,
                color: SS_TOKENS.fg2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {entry.plane.nickname}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: SS_TOKENS.fg2, marginTop: 1 }}>
          {entry.plane.operator} · {entry.plane.model}
        </div>
      </div>
      <span
        className="ss-mono"
        style={{
          fontSize: primary && !isLiveOnly ? 18 : 14,
          fontWeight: 700,
          color: inRange ? SS_TOKENS.alert : SS_TOKENS.fg1,
        }}
      >
        {isLiveOnly ? "LIVE" : `${distanceNm.toFixed(1)} nm`}
      </span>
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

function ContextLine({
  airborneCount,
  nearest,
}: {
  airborneCount: number;
  nearest: WatcherEntry | null;
}) {
  let text: string;
  let color: string;
  if (nearest?.distanceNm != null && nearest.distanceNm <= NEAR_NM) {
    const display = nearest.plane.nickname || nearest.plane.tail;
    text = `Heads up · ${display} ${nearest.distanceNm.toFixed(1)}nm away`;
    color = SS_TOKENS.warn;
  } else if (airborneCount > 0) {
    text = "Watchers aloft, not nearby";
    color = SS_TOKENS.fg1;
  } else {
    text = "Clear skies";
    color = SS_TOKENS.clear;
  }
  return (
    <div
      style={{
        padding: "10px 14px",
        fontSize: 13,
        color,
        textAlign: "center",
      }}
    >
      {text}
    </div>
  );
}

