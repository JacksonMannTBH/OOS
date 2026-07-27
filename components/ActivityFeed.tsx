"use client";

import Link from "next/link";
import { SS_TOKENS } from "@/lib/tokens";
import type { ActivityEntry, ActivityKind } from "@/lib/activity";
import { fmtAgoTs, formatTsBare } from "@/lib/time";

export function ActivityEventsSection({
  entries,
  id,
  frameless = false,
}: {
  entries: ActivityEntry[];
  id?: string;
  frameless?: boolean;
}) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        scrollMarginTop: "calc(env(safe-area-inset-top, 0px) + 24px)",
      }}
    >
      <h2
        id={headingId}
        style={{
          margin: "6px 4px 0",
          fontSize: 20,
          lineHeight: 1.15,
          fontWeight: 750,
          letterSpacing: 0,
          color: SS_TOKENS.fg0,
        }}
      >
        Recent events
      </h2>
      <ActivityEventsList entries={entries} frameless={frameless} />
    </section>
  );
}

export function ActivityEventsList({
  entries,
  frameless = false,
}: {
  entries: ActivityEntry[];
  frameless?: boolean;
}) {
  return entries.length === 0 ? (
    <Empty frameless={frameless} />
  ) : (
    <List entries={entries} frameless={frameless} />
  );
}

function Empty({ frameless }: { frameless: boolean }) {
  return (
    <div
      style={{
        marginTop: frameless ? 10 : 24,
        padding: frameless ? "20px 4px" : "32px 16px",
        background: frameless ? "transparent" : SS_TOKENS.bg1,
        border: frameless ? 0 : `.5px solid ${SS_TOKENS.hairline}`,
        borderRadius: frameless ? 0 : 24,
        boxShadow: frameless ? "none" : SS_TOKENS.shadowSm,
        backdropFilter: frameless ? undefined : "blur(18px)",
        WebkitBackdropFilter: frameless ? undefined : "blur(18px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        color: SS_TOKENS.fg1,
      }}
    >
      <RadarPulse />
      <div style={{ fontSize: 13.5, textAlign: "center", lineHeight: 1.5 }}>
        Watching the sky.
        <br />
        Events appear here as planes takeoff, land, or signal.
      </div>
    </div>
  );
}

function List({
  entries,
  frameless,
}: {
  entries: ActivityEntry[];
  frameless: boolean;
}) {
  return (
    <div
      style={{
        background: frameless ? "transparent" : SS_TOKENS.bg1,
        border: frameless ? 0 : `.5px solid ${SS_TOKENS.hairline}`,
        borderRadius: frameless ? 0 : 24,
        boxShadow: frameless ? "none" : SS_TOKENS.shadowSm,
        backdropFilter: frameless ? undefined : "blur(18px)",
        WebkitBackdropFilter: frameless ? undefined : "blur(18px)",
        overflow: "hidden",
      }}
    >
      {entries.map((e, i) => (
        <Row
          key={`${e.tail}-${e.ts}-${i}`}
          entry={e}
          first={i === 0}
          frameless={frameless}
        />
      ))}
    </div>
  );
}

function Row({
  entry,
  first,
  frameless,
}: {
  entry: ActivityEntry;
  first: boolean;
  frameless: boolean;
}) {
  const isEmergency = entry.kind === "squawk_emergency";
  return (
    <Link
      href={`/plane/${entry.tail}`}
      prefetch={false}
      style={{
        display: "flex",
        gap: 12,
        padding: "12px 14px",
        alignItems: "center",
        textDecoration: "none",
        color: "inherit",
        background: isEmergency
          ? "rgba(220,38,38,0.06)"
          : "transparent",
        borderTop: frameless || first ? 0 : `.5px solid ${SS_TOKENS.hairline}`,
      }}
    >
      <KindIcon kind={entry.kind} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            color: isEmergency ? SS_TOKENS.danger : SS_TOKENS.fg0,
            lineHeight: 1.4,
          }}
        >
          {entry.description}
        </div>
        <div
          className="ss-mono"
          style={{ fontSize: 11, color: SS_TOKENS.fg2, marginTop: 2 }}
        >
          {fmtAgoTs(entry.ts)} · {formatTsBare(entry.ts, "hour-min")} PT
        </div>
      </div>
      <span
        style={{
          fontSize: 18,
          // fg2 not fg3 — chevron is a navigation affordance and needs
          // visible contrast on the row background.
          color: SS_TOKENS.fg2,
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        ›
      </span>
    </Link>
  );
}

function KindIcon({ kind }: { kind: ActivityKind }) {
  const baseStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontFamily: "var(--font-mono)",
    fontSize: 14,
    fontWeight: 700,
  };
  if (kind === "takeoff") {
    return (
      <span
        style={{
          ...baseStyle,
          background: "rgba(95,207,138,0.14)",
          color: SS_TOKENS.clear,
        }}
      >
        ↗
      </span>
    );
  }
  if (kind === "landing") {
    return (
      <span
        style={{
          ...baseStyle,
          background: "rgba(168,173,182,0.10)",
          color: SS_TOKENS.fg1,
        }}
      >
        ↘
      </span>
    );
  }
  if (kind === "first_seen") {
    return (
      <span
        style={{
          ...baseStyle,
          background: "rgba(125,211,252,0.14)",
          color: SS_TOKENS.sky,
        }}
      >
        ✦
      </span>
    );
  }
  if (kind === "squawk_emergency") {
    return (
      <span
        style={{
          ...baseStyle,
          background: "rgba(220,38,38,0.18)",
          color: SS_TOKENS.danger,
        }}
      >
        ⚠
      </span>
    );
  }
  return (
    <span
      style={{
        ...baseStyle,
        background: SS_TOKENS.bg2,
        color: SS_TOKENS.fg2,
      }}
    >
      ·
    </span>
  );
}

function RadarPulse() {
  return (
    <svg width="36" height="36" viewBox="0 0 32 32" aria-hidden>
      <circle
        cx="16"
        cy="16"
        r="14"
        fill="none"
        stroke={SS_TOKENS.alert}
        strokeOpacity="0.4"
        strokeWidth=".75"
      />
      <circle
        cx="16"
        cy="16"
        r="9"
        fill="none"
        stroke={SS_TOKENS.alert}
        strokeOpacity="0.6"
        strokeWidth=".75"
      />
      <circle cx="16" cy="16" r="3" fill={SS_TOKENS.alert}>
        <animate
          attributeName="opacity"
          values="1;0.3;1"
          dur="1.6s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}

