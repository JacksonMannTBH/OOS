"use client";

// Diagnostic badge that surfaces the /api/trails layer's data state in
// plain English at the bottom-left of /map. Lets a non-technical
// rider confirm the trail data path is healthy without opening dev
// tools — pairs with the [trail] console.debug logs in
// AircraftTrailLayer.tsx during the PROMPT_19C strip-back diagnostic.
//
// Polls the same endpoint as AircraftTrailLayer at the same cadence
// (independent fetch — small price for a focused state machine the
// badge can render without coupling to the layer's internals).

import { useEffect, useState } from "react";
import { SS_TOKENS } from "@/lib/tokens";
import type { Aircraft } from "@/lib/types";

const POLL_MS = 10_000;

type Status =
  | { kind: "idle" }
  | { kind: "no-airborne" }
  | { kind: "fetching" }
  | { kind: "ok"; tails: number; points: number }
  | { kind: "error"; message: string };

export function TrailStatusBadge({ airborne }: { airborne: Aircraft[] }) {
  const tailsKey = airborne
    .map((a) => a.tail)
    .filter(Boolean)
    .sort()
    .join(",");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    if (!tailsKey) {
      setStatus({ kind: "no-airborne" });
      return;
    }
    const tick = async () => {
      if (cancelled) return;
      setStatus({ kind: "fetching" });
      try {
        const r = await fetch(
          `/api/trails?tails=${tailsKey}`,
          { cache: "no-store" },
        );
        if (!r.ok) {
          if (!cancelled) setStatus({ kind: "error", message: `${r.status}` });
          return;
        }
        const d = (await r.json()) as {
          trails: Record<string, unknown[]>;
        };
        if (cancelled) return;
        const trails = d.trails ?? {};
        const tails = Object.keys(trails).length;
        const points = Object.values(trails).reduce(
          (acc, pts) => acc + pts.length,
          0,
        );
        setStatus({ kind: "ok", tails, points });
      } catch (e) {
        if (!cancelled) {
          setStatus({
            kind: "error",
            message: e instanceof Error ? e.message : "unknown",
          });
        }
      }
    };
    void tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [tailsKey]);

  const label =
    status.kind === "idle"
      ? "TRAIL · IDLE"
      : status.kind === "no-airborne"
        ? "TRAIL · NO AIRBORNE TAILS"
        : status.kind === "fetching"
          ? "TRAIL · FETCHING"
          : status.kind === "ok"
            ? `TRAIL · ${status.tails} TAILS · ${status.points} POINTS`
            : `TRAIL · ERR ${status.message}`;

  const color =
    status.kind === "ok" && status.points > 0
      ? SS_TOKENS.clear
      : status.kind === "error"
        ? SS_TOKENS.alert
        : SS_TOKENS.fg2;

  return (
    <div
      className="ss-mono"
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.88)",
        border: `.5px solid ${SS_TOKENS.hairline2}`,
        boxShadow: SS_TOKENS.shadowSm,
        color,
        fontSize: 9.5,
        letterSpacing: 0,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
}
