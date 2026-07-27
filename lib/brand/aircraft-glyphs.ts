// aircraft-glyphs.ts — top-down map icons for the Out Of Sight map.
//
// Vendored 1:1 from design/brand/aircraft-glyphs.js. Geometry is byte-
// identical to the source — every test render in
// design/brand/aircraft-glyphs-*.png was generated from those paths.
//
// FOUR ROLE VARIANTS, TWO FAMILIES:
//   Family A — PLANE      → fixed_wing, transport
//   Family B — HELICOPTER → patrol, sar
//
// COLOR STRATEGY (rationale doc, design/brand/aircraft-glyphs.md):
//   alert     (fixed_wing, patrol)    fill #F2F4F7, stroke #f4c430 1.0px
//   non-alert (sar, transport)    fill #6B7380, stroke none
//
// White fill + amber stroke borrows ATC display convention so alert
// glyphs survive the amber heat layer (the moment they matter most);
// muted gray glyphs visually deprioritize without disappearing.
//
// VIEWBOX: 24×24, icon centered to ~80% of the box.
// HEADING: glyphs face NORTH (up). Consumer applies
//   transform: rotate(${track}deg)
// Do NOT bake rotation into path data.
//
// PULSE RING (departure from rationale doc): the doc speccs an
// HTML-marker wrapper that pulses opacity around the icon. Our radar
// uses a MapLibre symbol layer, not HTML markers, so we keep the
// existing layer-level opacity pulse (RadarMap.tsx startPulse). The
// alert glyphs already include their own amber nose-blip "alive" cue
// via planeBlip()/heliBlip(); the layer pulse adds breath on top.
// If we ever switch RadarMap to HTML markers, port the wrapper
// approach from the rationale doc verbatim.

import type { FleetRole } from "@/lib/types";

export const AIRCRAFT_COLORS = {
  ALERT_FILL: "#F2F4F7",
  ALERT_STROKE: "#f4c430",
  MUTED_FILL: "#6B7380",
  RADAR_FILL: "#f4c430",
  RADAR_STROKE: "#050505",
  RADAR_BLIP: "#050505",
} as const;

const ALERT_FILL = AIRCRAFT_COLORS.ALERT_FILL;
const ALERT_STROKE = AIRCRAFT_COLORS.ALERT_STROKE;
const MUTED_FILL = AIRCRAFT_COLORS.MUTED_FILL;
const RADAR_FILL = AIRCRAFT_COLORS.RADAR_FILL;
const RADAR_STROKE = AIRCRAFT_COLORS.RADAR_STROKE;
const RADAR_BLIP = AIRCRAFT_COLORS.RADAR_BLIP;

type GlyphFamily = "plane" | "heli";

const ROLES: Record<
  "fixed_wing" | "patrol" | "sar" | "transport",
  { family: GlyphFamily; alert: boolean }
> = {
  fixed_wing: { family: "plane", alert: true },
  transport: { family: "plane", alert: false },
  patrol: { family: "heli", alert: true },
  sar: { family: "heli", alert: false },
};

// ── PLANE ────────────────────────────────────────────────────────────────
// Top-down fixed-wing. Brim-bulge at cockpit shoulders (y≈7-9) for the
// subtle hat tie at large sizes; invisible at 16px.
function planeBody(fillColor: string, strokeColor: string | null): string {
  const stroke = strokeColor
    ? `stroke="${strokeColor}" stroke-width="1.0" stroke-linejoin="round" stroke-linecap="round"`
    : "";
  return `
    <g ${stroke} fill="${fillColor}">
      <path d="
        M 12 2.6
        C 12.9 2.6 13.4 3.6 13.4 5.0
        C 13.4 6.2 13.2 7.2 12.9 7.8
        C 13.2 8.6 13.4 9.6 13.4 10.6
        L 22.0 13.4
        C 22.4 13.5 22.7 13.7 22.7 14.0
        C 22.7 14.4 22.4 14.5 22.0 14.6
        L 13.4 15.4
        L 13.4 19.0
        L 16.2 19.7
        C 16.5 19.8 16.7 20.0 16.7 20.3
        C 16.7 20.6 16.5 20.7 16.2 20.7
        L 13.0 20.7
        L 12.5 22.4
        C 12.4 22.7 12.2 22.9 12.0 22.9
        C 11.8 22.9 11.6 22.7 11.5 22.4
        L 11.0 20.7
        L 7.8 20.7
        C 7.5 20.7 7.3 20.6 7.3 20.3
        C 7.3 20.0 7.5 19.8 7.8 19.7
        L 10.6 19.0
        L 10.6 15.4
        L 2.0 14.6
        C 1.6 14.5 1.3 14.4 1.3 14.0
        C 1.3 13.7 1.6 13.5 2.0 13.4
        L 10.6 10.6
        C 10.6 9.6 10.8 8.6 11.1 7.8
        C 10.8 7.2 10.6 6.2 10.6 5.0
        C 10.6 3.6 11.1 2.6 12 2.6 Z"/>
    </g>
  `;
}

function planeBlip(fillColor: string = ALERT_STROKE): string {
  return `<circle cx="12" cy="1.6" r="0.8" fill="${fillColor}"/>`;
}

// ── HELICOPTER ────────────────────────────────────────────────────────────
// Body is dominant; rotor is a thin "X" cross drawn under the body so the
// silhouette stays clean. Off-axis (25°/115°) so it doesn't read as "+".
function heliBody(fillColor: string, strokeColor: string | null): string {
  const stroke = strokeColor
    ? `stroke="${strokeColor}" stroke-width="1.0" stroke-linejoin="round" stroke-linecap="round"`
    : "";
  return `
    <g ${stroke} fill="${fillColor}">
      <!-- Rotor blades (drawn FIRST so body sits on top of the hub) -->
      <rect x="3.5" y="10.55" width="17" height="0.9" rx="0.45"
            transform="rotate(25 12 11)"/>
      <rect x="3.5" y="10.55" width="17" height="0.9" rx="0.45"
            transform="rotate(115 12 11)"/>
      <!-- Body: fat teardrop, cockpit forward (top), tapering aft. -->
      <path d="
        M 12 5.4
        C 14.4 5.4 15.6 7.0 15.6 8.8
        C 15.6 9.6 15.4 10.2 15.1 10.6
        C 15.4 11.2 15.6 11.9 15.6 12.6
        C 15.6 14.2 14.4 15.4 12 15.4
        C 9.6 15.4 8.4 14.2 8.4 12.6
        C 8.4 11.9 8.6 11.2 8.9 10.6
        C 8.6 10.2 8.4 9.6 8.4 8.8
        C 8.4 7.0 9.6 5.4 12 5.4 Z"/>
      <!-- Tail boom -->
      <rect x="11.3" y="15.2" width="1.4" height="5.4" rx="0.5"/>
      <!-- Tail rotor stub -->
      <rect x="9.6" y="20.0" width="4.8" height="1.2" rx="0.5"/>
      <!-- Rotor hub on top of body center -->
      <circle cx="12" cy="11" r="1.0"/>
    </g>
  `;
}

function heliBlip(fillColor: string = ALERT_STROKE): string {
  return `<circle cx="12" cy="1.4" r="0.8" fill="${fillColor}"/>`;
}

export function pathPlaneAlert(): string {
  return planeBody(ALERT_FILL, ALERT_STROKE) + planeBlip();
}
export function pathPlaneMuted(): string {
  return planeBody(MUTED_FILL, null);
}
export function pathHeliAlert(): string {
  return heliBody(ALERT_FILL, ALERT_STROKE) + heliBlip();
}
export function pathHeliMuted(): string {
  return heliBody(MUTED_FILL, null);
}

/**
 * The aircraft-glyphs file recognizes four roles. The fifth FleetRole
 * value, `unknown`, has no glyph of its own — we render it as `fixed_wing`,
 * matching computeStatus()'s alert-on-unknown stance. A new tail with
 * unconfirmed classification should err toward visible alert until the
 * admin classifies it.
 */
export type GlyphRole = "fixed_wing" | "patrol" | "sar" | "transport";

export function glyphRoleFor(role: FleetRole | undefined | null): GlyphRole {
  if (role === "fixed_wing" || role === "patrol" || role === "sar" || role === "transport") {
    return role;
  }
  // 'unknown' or missing → conservative alert.
  return "fixed_wing";
}

export type AircraftSvgOpts = {
  size?: number;
  tone?: "default" | "radar";
  color?: string;
  strokeColor?: string;
  blipColor?: string;
};

/** SVG markup for the role's glyph at the requested pixel size (default 24). */
export function aircraftSvg(
  role: FleetRole | "unknown",
  opts: AircraftSvgOpts = {},
): string {
  const r = ROLES[glyphRoleFor(role)];
  const size = opts.size ?? 24;
  if (opts.tone === "radar") {
    const fill = opts.color ?? RADAR_FILL;
    const stroke = opts.strokeColor ?? RADAR_STROKE;
    const blip = opts.blipColor ?? RADAR_BLIP;
    const inner =
      r.family === "plane"
        ? planeBody(fill, stroke) + planeBlip(blip)
        : heliBody(fill, stroke) + heliBlip(blip);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" data-role="${role}"><filter id="ss-radar-aircraft-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.2" stdDeviation="1.1" flood-color="#050908" flood-opacity="0.72"/></filter><g filter="url(#ss-radar-aircraft-shadow)">${inner}</g></svg>`;
  }
  const inner =
    r.family === "plane"
      ? r.alert
        ? pathPlaneAlert()
        : pathPlaneMuted()
      : r.alert
        ? pathHeliAlert()
        : pathHeliMuted();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" data-role="${role}">${inner}</svg>`;
}

/**
 * Conservative legacy fallback when a call site has only a model string and
 * no role. Used by surfaces that haven't been migrated to role-aware data
 * yet. Picks 'fixed_wing' for fixed-wing, 'patrol' for rotors — both alert
 * variants. Once every consumer passes role this can go away.
 */
export function roleFromModel(model: string | null | undefined): GlyphRole {
  if (!model) return "fixed_wing";
  return /Bell|UH-1|Hughes|407|206|505|MD/i.test(model) ? "patrol" : "fixed_wing";
}
