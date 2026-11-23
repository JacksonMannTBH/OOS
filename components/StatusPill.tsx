"use client";

import { SS_TOKENS } from "@/lib/tokens";
import { Tooltip } from "./Tooltip";

type Props = {
  kind?: "alert" | "clear";
  label: string;
  sub?: string;
  big?: boolean;
  tooltip?: React.ReactNode;
  style?: React.CSSProperties;
};

export function StatusPill({
  kind = "clear",
  label,
  sub,
  big,
  tooltip,
  style,
}: Props) {
  const isAlert = kind === "alert";
  const c = isAlert ? SS_TOKENS.statusAlert : SS_TOKENS.clear;
  const bg = isAlert ? SS_TOKENS.statusAlertDim : SS_TOKENS.clearDim;
  const pill = (
    <span
      role="status"
      aria-live="polite"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: big ? "8px 13px" : "5px 10px",
        borderRadius: 999,
        background: bg,
        border: `.5px solid ${
          isAlert
            ? "color-mix(in srgb, var(--ss-status-alert) 42%, transparent)"
            : SS_TOKENS.hairline2
        }`,
        boxShadow: big ? SS_TOKENS.shadowSm : "none",
        fontSize: big ? 12 : 11,
        fontWeight: 700,
        color: c,
        letterSpacing: 0,
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        ...style,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: c,
          animation: isAlert ? "ss-blink 1.4s ease-in-out infinite" : "none",
          boxShadow: `0 0 0 4px ${isAlert ? SS_TOKENS.statusAlertDim : SS_TOKENS.clearDim}`,
        }}
      />
      <span>{label}</span>
      {sub && (
        <span style={{ color: c, opacity: 0.65, fontWeight: 400 }}>· {sub}</span>
      )}
    </span>
  );
  if (!tooltip) return pill;
  return <Tooltip content={tooltip}>{pill}</Tooltip>;
}
