// Shared role-badge display helpers. Used by /about and /plane/[tail] so the
// role taxonomy reads consistently across the app.
//
// Rider mental model: any tracked aircraft airborne is "Bird up." The role
// taxonomy stays granular for plane-detail accuracy, but roles do not suppress
// alerts.

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
      return "Bird. Multi-role helicopter. Up = ease off.";
    case "sar":
      return "Search and rescue helicopter. Airborne tracked aircraft still count as Bird up.";
    case "transport":
      return "State transport or photography aircraft. Airborne tracked aircraft still count as Bird up.";
    case "unknown":
      return "Bird. Role not yet confirmed.";
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
