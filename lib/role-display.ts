// Shared role-badge display helpers. Used by /about and /plane/[tail]
// so the role taxonomy reads consistently across the app.
//
// Rider mental model: any law-enforcement aircraft is "Bird". The
// backend role taxonomy stays granular (fixed_wing vs patrol vs unknown)
// for plane-detail accuracy, but every rider-visible badge collapses
// LE-tier roles to the single "BIRD" label. Tooltip body preserves
// the airframe-specific detail for curious riders who hover.

import type { FleetRole } from "./types";
import { SS_TOKENS } from "./tokens";

export function roleBadgeText(role: FleetRole): string {
  switch (role) {
    case "fixed_wing":
    case "patrol":
    case "unknown":
      return "BIRD";
    case "sar":
      return "SEARCH & RESCUE";
    case "transport":
      return "TRANSPORT";
  }
}

export function roleTooltip(role: FleetRole): string {
  switch (role) {
    case "fixed_wing":
      return "Bird. Fixed-wing speed enforcement plane. Up = ease off.";
    case "patrol":
      return "Bird. Multi-role helicopter — traffic enforcement, pursuit, or SAR. We err on alert.";
    case "sar":
      return "Search and rescue helicopter. Almost always responding to a rescue, not enforcement.";
    case "transport":
      return "State transport or photography aircraft. Not enforcement-related.";
    case "unknown":
      return "Bird. Role not yet confirmed. Treated as alert until classified.";
  }
}

/**
 * Inline style for the role badge pill. Bird + patrol get the alert
 * amber tint; sar / transport / unknown get a neutral fg2 tint.
 */
export function roleBadgeStyle(role: FleetRole): React.CSSProperties {
  const isAlert = role === "fixed_wing" || role === "patrol" || role === "unknown";
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 9.5,
    letterSpacing: ".06em",
    background: isAlert ? SS_TOKENS.alertDim : "rgba(107,115,128,0.13)",
    color: isAlert ? SS_TOKENS.alert : SS_TOKENS.fg1,
    border: `.5px solid ${isAlert ? `color-mix(in srgb, ${SS_TOKENS.alert} 34%, transparent)` : SS_TOKENS.hairline2}`,
    cursor: "help",
    whiteSpace: "nowrap",
  };
}
