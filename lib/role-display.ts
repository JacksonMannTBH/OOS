// Shared role-badge display helpers. Used by /about and /plane/[tail] so the
// role taxonomy reads consistently across the app.
//
// Keep the public labels aligned with the underlying role taxonomy so aircraft
// detail pages do not require riders to interpret internal shorthand.

import type { FleetRole } from "./types";
import { SS_TOKENS } from "./tokens";

export function roleBadgeText(role: FleetRole): string {
  switch (role) {
    case "fixed_wing":
      return "FIXED WING";
    case "patrol":
      return "PATROL";
    case "unknown":
      return "ROLE UNKNOWN";
    case "sar":
      return "SEARCH & RESCUE";
    case "transport":
      return "TRANSPORT";
  }
}

export function roleTooltip(role: FleetRole): string {
  switch (role) {
    case "fixed_wing":
      return "Fixed-wing speed enforcement aircraft.";
    case "patrol":
      return "Multi-role patrol helicopter.";
    case "sar":
      return "Search and rescue helicopter.";
    case "transport":
      return "State transport or photography aircraft.";
    case "unknown":
      return "Aircraft role has not been confirmed.";
  }
}

/**
 * Inline style for the role badge pill. Every tracked role gets the same alert
 * tint because any airborne tracked aircraft affects status.
 */
export function roleBadgeStyle(_role: FleetRole): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 9.5,
    letterSpacing: ".06em",
    background: SS_TOKENS.alertDim,
    color: SS_TOKENS.alert,
    border: `.5px solid color-mix(in srgb, ${SS_TOKENS.alert} 34%, transparent)`,
    cursor: "help",
    whiteSpace: "nowrap",
  };
}
