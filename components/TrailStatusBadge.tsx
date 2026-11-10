"use client";

// Summarizes the same pushed trail data used by the map.

import { useEffect, useState } from "react";
import { subscribeLiveState } from "@/lib/live-data-client";
import { useSelectedStateId } from "@/lib/hooks/useSelectedStateId";
import { stateCodeForId } from "@/lib/app-states";
import { SS_TOKENS } from "@/lib/tokens";
import type { Aircraft } from "@/lib/types";


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

  const stateCode = stateCodeForId(useSelectedStateId());
  useEffect(() => {
    if (!tailsKey) { setStatus({ kind: "no-airborne" }); return; }
    setStatus({ kind: "fetching" });
    const allowed = new Set(tailsKey.split(","));
    return subscribeLiveState(stateCode, update => {
      const trails = Object.entries(update.trails).filter(([tail]) => allowed.has(tail));
      setStatus({ kind: "ok", tails: trails.length, points: trails.reduce((sum, [, points]) => sum + points.length, 0) });
    });
  }, [tailsKey, stateCode]);

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
