"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Aircraft, FleetEntry, Snapshot } from "@/lib/types";
import type { ActivityEntry } from "@/lib/activity";
import type { LearningState } from "@/lib/learning";
import { SS_TOKENS } from "@/lib/tokens";
import { fmtAgoTs } from "@/lib/time";
import { filterOpsAircraftByState } from "@/lib/aircraft-directory";
import { useAircraft } from "@/lib/hooks/useAircraft";
import { useSelectedStateId } from "@/lib/hooks/useSelectedStateId";
import { computeStatus } from "@/lib/status";
import { Card } from "./Card";
import { PlaneIcon } from "./PlaneIcon";
import { PredictionCard } from "./PredictionCard";
import { FreshnessLabel } from "./FreshnessLabel";
import { ArmAlertsCallout } from "./ArmAlertsCallout";
import { TakeOffButton } from "./TakeOffButton";
import { StatusHero } from "./StatusHero";
import { SettingsButton } from "./SettingsButton";

// Hide the activity strip when the most recent event is older than this —
// a stale "Guardian One up · 8 hours ago" looks more like a bug than a
// feature on the home screen.
const ACTIVITY_STRIP_MAX_AGE_MS = 6 * 60 * 60 * 1000;

type Props = {
  initial: Snapshot;
  mockOn?: boolean;
  initialActivity?: ActivityEntry[];
  learning?: LearningState;
  hour12?: boolean;
  /** Optional historical-context phrase rendered under the Hero
   *  ("usually up at this hour. 67% of weeks."). Server computes,
   *  passes the string in. null = hide. */
  contextLine?: string | null;
  /** Milliseconds since epoch for the most recent database observation. */
  lastSampleMs?: number | null;
};

export function Glanceable({
  initial,
  mockOn = false,
  initialActivity = [],
  learning,
  hour12 = false,
  contextLine = null,
  lastSampleMs = null,
}: Props) {
  const snap = useAircraft(initial, mockOn);
  const stateId = useSelectedStateId();
  const [activity, setActivity] = useState<ActivityEntry[]>(initialActivity);
  const stateActivity = useMemo(
    () => filterOpsAircraftByState(activity, stateId),
    [activity, stateId],
  );

  // Poll /api/activity every 30s so the strip stays current without
  // forcing a full snapshot regen.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const r = await fetch(
          `/api/activity?limit=1&state_id=${encodeURIComponent(stateId)}`,
          { cache: "no-store" },
        );
        if (!r.ok) return;
        const d = (await r.json()) as { entries: ActivityEntry[] };
        if (!cancelled) setActivity(d.entries);
      } catch {
        /* transient */
      }
    };
    const id = setInterval(tick, 30_000);
    void tick();
    const onVis = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [stateId]);

  const stateAircraft = useMemo(
    () => filterOpsAircraftByState(snap.aircraft, stateId),
    [snap.aircraft, stateId],
  );
  const stateSnap = useMemo(
    () => ({ ...snap, aircraft: stateAircraft }),
    [snap, stateAircraft],
  );
  const fleetMap = useMemo(
    () => new Map<string, FleetEntry>(stateAircraft.map((a) => [a.tail, a])),
    [stateAircraft],
  );
  const status = useMemo(
    () => computeStatus(stateSnap, fleetMap),
    [stateSnap, fleetMap],
  );
  // Drop the headline plane from the also-up list. Without this filter
  // the lead appears twice — once as the hero, once at the top of the
  // also-up card — and the count in the also-up header disagrees with
  // the "X other watchers up." footnote in lib/status.ts which already
  // excludes the lead.
  const leadTail = status.lead?.aircraft.tail ?? null;
  const others = stateAircraft.filter(
    (a) => a.airborne && a.tail !== leadTail,
  );
  const latestActivity =
    stateActivity.length > 0 &&
    Date.now() - stateActivity[0]!.ts < ACTIVITY_STRIP_MAX_AGE_MS
      ? stateActivity[0]!
      : null;

  return (
    <main
      className="ss-hero-bg ss-page-narrow"
      style={{
        minHeight: "100dvh",
        // 180 px bottom padding clears the tab bar (66) + the iOS
        // install prompt overlay (~80) + breathing room. Without this
        // the LearningPanel and last activity row hid behind the
        // fixed-position prompt on /.
        padding: "22px 20px 170px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        maxWidth: 430,
      }}
    >
      <StatusHero status={status} lastSampleMs={lastSampleMs ?? snap.fetched_at} />

      <TakeOffButton />

      <SettingsButton />

      {contextLine && (
        <p
          className="ss-mono"
          style={{
            fontSize: 12,
            color: SS_TOKENS.fg2,
            margin: "-4px 4px 0",
            letterSpacing: ".02em",
            lineHeight: 1.4,
          }}
        >
          {contextLine}
        </p>
      )}

      {latestActivity && <ActivityStrip latest={latestActivity} />}

      <ArmAlertsCallout />

      {others.length > 0 && <Others others={others} />}

      <PredictionCard learning={learning} hour12={hour12} />

      <div style={{ marginTop: 4, paddingLeft: 4 }}>
        <FreshnessLabel lastSampleMs={lastSampleMs ?? snap.fetched_at} />
      </div>

    </main>
  );
}

function Footer() {
  return (
    <footer
      className="ss-mono"
      style={{
        marginTop: 8,
        padding: "16px 4px 0",
        fontSize: 10.5,
        color: SS_TOKENS.fg2,
        letterSpacing: ".04em",
        lineHeight: 1.5,
      }}
    >
      Aircraft data from{" "}
      <a
        href="https://adsb.fi"
        target="_blank"
        rel="noopener noreferrer"
        style={FOOTER_LINK}
      >
        adsb.fi
      </a>{" "}
      ·{" "}
      <a
        href="https://opensky-network.org"
        target="_blank"
        rel="noopener noreferrer"
        style={FOOTER_LINK}
      >
        OpenSky Network
      </a>
      <br />
      <Link href="/about" style={FOOTER_LINK}>
        About
      </Link>
      {" · "}
      <Link href="/legal" style={FOOTER_LINK}>
        Legal
      </Link>
    </footer>
  );
}

// Footer link style — inline-block + vertical padding so the tap area
// reaches WCAG-AA's 44 px minimum without changing visible layout.
// Negative vertical margin keeps the line-height of the surrounding
// flow text unchanged.
const FOOTER_LINK: React.CSSProperties = {
  color: SS_TOKENS.fg1,
  textDecoration: "underline",
  display: "inline-block",
  padding: "12px 4px",
  margin: "-12px -4px",
  lineHeight: 1,
}

function ActivityStrip({ latest }: { latest: ActivityEntry }) {
  return (
    <Link
      href="/home"
      prefetch={false}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        borderRadius: 10,
        background: SS_TOKENS.bg1,
        border: `.5px solid ${SS_TOKENS.hairline}`,
        textDecoration: "none",
        color: SS_TOKENS.fg1,
        fontSize: 14,
        lineHeight: 1.4,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: SS_TOKENS.alert,
          boxShadow: `0 0 8px ${SS_TOKENS.alert}`,
          flexShrink: 0,
          animation: "ss-blink 1.6s infinite",
        }}
      />
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {latest.description}
      </span>
      <span
        className="ss-mono"
        style={{ fontSize: 11, color: SS_TOKENS.fg2, flexShrink: 0 }}
      >
        {fmtAgoTs(latest.ts)}
      </span>
    </Link>
  );
}

function LeadIdentity({
  tail,
  nickname,
  operator,
}: {
  tail: string;
  nickname: string | null;
  operator: string;
}) {
  // Lead-identity line under the stat chips so a rider knows which tracked
  // aircraft is currently active. Tappable — drills into /plane/[tail].
  const middle = nickname ? ` · "${nickname}" · ` : " · ";
  return (
    <Link
      href={`/plane/${tail}`}
      prefetch={false}
      aria-label={`View ${nickname ?? tail} details`}
      className="ss-mono"
      style={{
        display: "inline-block",
        marginTop: 6,
        fontSize: 11.5,
        color: "#edfbed",
        letterSpacing: ".04em",
        textDecoration: "none",
      }}
    >
      {tail}
      {middle}
      {operator}
    </Link>
  );
}

function Others({ others }: { others: Aircraft[] }) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "0 4px 8px",
        }}
      >
        <span className="ss-eyebrow">Also up</span>
        <span
          className="ss-mono"
          style={{ fontSize: 10.5, color: SS_TOKENS.fg2 }}
        >
          {others.length} UP
        </span>
      </div>
      <Card padded={false}>
        {others.map((p, i) => (
          <Link
            key={p.tail}
            href={`/plane/${p.tail}`}
            prefetch={false}
            aria-label={`View ${p.nickname ?? p.tail} details`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              borderBottom:
                i === others.length - 1
                  ? 0
                  : `.5px solid ${SS_TOKENS.hairline}`,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <PlaneIcon size={18} role={p.role} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="ss-mono"
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                {p.tail}
                {p.nickname && (
                  <span
                    style={{
                      color: SS_TOKENS.fg1,
                      fontWeight: 400,
                      marginLeft: 6,
                    }}
                  >
                    &ldquo;{p.nickname}&rdquo;
                  </span>
                )}
              </div>
              <div
                style={{ fontSize: 11, color: SS_TOKENS.fg2, marginTop: 1 }}
              >
                {p.operator} · {p.model}
              </div>
            </div>
            <div
              className="ss-mono"
              style={{ fontSize: 12, color: SS_TOKENS.fg1 }}
            >
              {p.altitude_ft != null
                ? `${p.altitude_ft.toLocaleString()}′`
                : "—"}
            </div>
            <ChevronRight />
          </Link>
        ))}
      </Card>
    </div>
  );
}

// Right-pointing chevron icon used as the visual "tappable" affordance
// on Also-up rows. Inline SVG so it ships in the initial HTML.
function ChevronRight() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={SS_TOKENS.fg2}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
