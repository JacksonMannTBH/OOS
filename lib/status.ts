// Single source of truth for "what's the fleet doing right now." Both the
// home hero, radar status pill, PWA app-icon badge, and embeddable badge use
// the same rule: any airborne tracked aircraft is BIRD UP.

import type { Aircraft, Snapshot, FleetEntry, FleetRole } from "./types";

export type StatusKind = "alert" | "clear";

export type StatusState = {
  kind: StatusKind;
  /** Top-line label inside the pill: BIRD UP / ALL CLEAR. */
  pill: string;
  /** Optional sub-label inside the pill, e.g. "2 up". */
  pillSub?: string;
  /** Big home-page hero h1. */
  headline: string;
  /** Optional small footnote line under body. */
  footnote?: string;
  /** Lead aircraft + fleet entry, for callers that need raw context. */
  lead: { aircraft: Aircraft; entry: FleetEntry } | null;
  /** Count of airborne tracked aircraft. */
  alertCount: number;
  /** Total airborne tracked aircraft in the snapshot. */
  totalAirborne: number;
};

export function computeStatus(
  snapshot: Snapshot,
  fleet: Map<string, FleetEntry>,
): StatusState {
  const airborne = snapshot.aircraft.filter((a) => a.airborne);
  const up: Array<{ aircraft: Aircraft; entry: FleetEntry }> = [];

  for (const aircraft of airborne) {
    const entry = fleet.get(aircraft.tail);
    if (entry) up.push({ aircraft, entry });
  }

  if (up.length > 0) {
    const lead = up[0]!;
    return {
      kind: "alert",
      pill: "BIRD UP",
      pillSub: up.length > 1 ? `${up.length} up` : undefined,
      headline: "Active Air Support",
      lead,
      alertCount: up.length,
      totalAirborne: airborne.length,
    };
  }

  return {
    kind: "clear",
    pill: "ALL CLEAR",
    headline: "No Eyes",
    lead: null,
    alertCount: 0,
    totalAirborne: 0,
  };
}

/** Convenience for callers that only have an array, not a Map. */
export function makeFleetMap(fleet: FleetEntry[]): Map<string, FleetEntry> {
  return new Map(fleet.map((f) => [f.tail, f]));
}

export function isAlertRole(role: FleetRole): boolean {
  return Boolean(role);
}
