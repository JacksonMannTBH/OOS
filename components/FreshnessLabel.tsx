"use client";

import { useEffect, useState } from "react";
import { SS_TOKENS } from "@/lib/tokens";
import { formatTsBare } from "@/lib/time";

const STALE_MS = 90 * 1000;

type Props = {
  /** ms-since-epoch of the last successful track sample. null = unknown. */
  lastSampleMs: number | null;
  className?: string;
  style?: React.CSSProperties;
};

export function FreshnessLabel({ lastSampleMs, className, style }: Props) {
  // Re-tick every 10s so the label stays honest without requiring a
  // server round-trip. The cookie/cache layer keeps the underlying value
  // current at server-render time; this just ages it gracefully.
  const [now, setNow] = useState<number>(() => lastSampleMs ?? Date.now());
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  if (!lastSampleMs) {
    return (
      <span
        className={`ss-mono ${className ?? ""}`}
        style={{ fontSize: 10, color: SS_TOKENS.fg2, ...style }}
      >
        LAST SAMPLE — UNKNOWN
      </span>
    );
  }
  const ageMs = Math.max(0, now - lastSampleMs);
  const stale = ageMs > STALE_MS;
  const m = Math.floor(ageMs / 60_000);
  const label = m < 1 ? "JUST NOW" : `${m}m AGO`;
  const clock = formatTsBare(lastSampleMs, "hour-min");
  return (
    <span
      className={`ss-mono ${className ?? ""}`}
      style={{
        fontSize: 10,
        color: stale ? SS_TOKENS.alert : SS_TOKENS.fg2,
        letterSpacing: ".06em",
        ...style,
      }}
      title={
        stale
          ? "Live ingestion may be down — last sample is older than 90 seconds."
          : undefined
      }
    >
      LAST SAMPLE — {label} · {clock} PT
    </span>
  );
}
