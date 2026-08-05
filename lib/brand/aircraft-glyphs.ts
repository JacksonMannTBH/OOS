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
// COLOR STRATEGY:
//   tracked aircraft fill #F2F4F7, stroke #f4c430 1.0px
//
// White fill + amber stroke borrows ATC display convention so every airborne
// tracked glyph survives the amber heat layer.
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
  transport: { family: "plane", alert: true },
  patrol: { family: "heli", alert: true },
  sar: { family: "heli", alert: true },
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
        M 12 0.15
        C 13.58 0.15 14.58 4.1 14.64 9.55
        L 22.72 10.02
        C 23.28 10.05 23.72 10.52 23.72 11.08
        L 23.72 12.38
        C 23.72 12.84 23.42 13.24 22.98 13.37
        L 14.2 15.62
        L 13.32 15.62
        L 12.92 20.76
        L 15.42 21.52
        C 15.82 21.64 16.08 22.0 16.08 22.42
        L 16.08 23.05
        C 16.08 23.28 15.9 23.48 15.66 23.48
        L 12.84 23.48
        C 12.78 23.86 12.52 24.0 12 24.0
        C 11.48 24.0 11.22 23.86 11.16 23.48
        L 8.34 23.48
        C 8.1 23.48 7.92 23.28 7.92 23.05
        L 7.92 22.42
        C 7.92 22.0 8.18 21.64 8.58 21.52
        L 11.08 20.76
        L 10.68 15.62
        L 9.8 15.62
        L 1.02 13.37
        C 0.58 13.24 0.28 12.84 0.28 12.38
        L 0.28 11.08
        C 0.28 10.52 0.72 10.05 1.28 10.02
        L 9.36 9.55
        C 9.42 4.1 10.42 0.15 12 0.15 Z"/>
    </g>
  `;
}

function planeBlip(fillColor: string = ALERT_STROKE): string {
  return `<circle cx="12" cy="1.6" r="0.8" fill="${fillColor}"/>`;
}

// ── HELICOPTER ────────────────────────────────────────────────────────────
// Body is dominant; rotor is a thin "X" cross drawn under the body so the
// silhouette stays clean. Off-axis (25°/115°) so it doesn't read as "+".
function heliBody(
  fillColor: string,
  strokeColor: string | null,
  rotor: "static" | "omit" = "static",
): string {
  const stroke = strokeColor
    ? `stroke="${strokeColor}" stroke-width="1.0" stroke-linejoin="round" stroke-linecap="round"`
    : "";
  const rotorMarkup =
    rotor === "static"
      ? `
      <!-- Rotor blades (drawn FIRST so body sits on top of the hub) -->
      <rect x="2.6" y="9.55" width="18.8" height="1.25" rx="0.62"
            transform="rotate(45 12 10.2)"/>
      <rect x="2.6" y="9.55" width="18.8" height="1.25" rx="0.62"
            transform="rotate(135 12 10.2)"/>`
      : "";
  return `
    <g ${stroke} fill="${fillColor}">
      ${rotorMarkup}
      <!-- Body: long cockpit, broad shoulders, tapered tailplane. -->
      <path d="
        M 12 0.35
        C 13.75 0.35 14.95 3.85 15.45 7.9
        L 15.78 10.1
        C 16.48 10.96 18.18 11.42 21.08 12.24
        C 21.55 13.35 21.55 14.52 21.08 15.72
        C 18.56 15.8 16.42 16.3 14.62 17.12
        L 13.16 20.28
        L 16.52 20.88
        L 17.13 19.45
        C 17.6 21.32 17.4 22.55 16.34 23.5
        L 15.5 22.06
        L 12.98 21.64
        C 12.88 22.82 12.55 23.48 12 23.48
        C 11.45 23.48 11.12 22.82 11.02 21.64
        L 8.5 22.06
        L 7.66 23.5
        C 6.6 22.55 6.4 21.32 6.87 19.45
        L 7.48 20.88
        L 10.84 20.28
        L 9.38 17.12
        C 7.58 16.3 5.44 15.8 2.92 15.72
        C 2.45 14.52 2.45 13.35 2.92 12.24
        C 5.82 11.42 7.52 10.96 8.22 10.1
        L 8.55 7.9
        C 9.05 3.85 10.25 0.35 12 0.35 Z"/>
      <circle cx="12" cy="10.25" r="0.92"/>
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
 * value, `unknown`, has no glyph of its own, so we render it as `fixed_wing`.
 */
export type GlyphRole = "fixed_wing" | "patrol" | "sar" | "transport";

export function glyphRoleFor(role: FleetRole | undefined | null): GlyphRole {
  if (role === "fixed_wing" || role === "patrol" || role === "sar" || role === "transport") {
    return role;
  }
  // 'unknown' or missing -> conservative fixed-wing glyph.
  return "fixed_wing";
}

export type AircraftSvgOpts = {
  size?: number;
  tone?: "default" | "radar";
  color?: string;
  strokeColor?: string;
  blipColor?: string;
  heliRotor?: "static" | "omit";
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
        : heliBody(fill, stroke, opts.heliRotor ?? "static") + heliBlip(blip);
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

export function helicopterRotorSvg(opts: AircraftSvgOpts = {}): string {
  const size = opts.size ?? 24;
  const fill = opts.color ?? "#F8FBFF";
  const stroke = opts.strokeColor ?? RADAR_STROKE;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" data-role="heli-rotor"><filter id="ss-radar-rotor-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="0.8" stdDeviation="0.8" flood-color="#050908" flood-opacity="0.55"/></filter><g filter="url(#ss-radar-rotor-shadow)" fill="${fill}" stroke="${stroke}" stroke-width="0.55" stroke-linejoin="round" stroke-linecap="round"><rect x="2.6" y="9.55" width="18.8" height="1.25" rx="0.62" transform="rotate(45 12 10.2)"/><rect x="2.6" y="9.55" width="18.8" height="1.25" rx="0.62" transform="rotate(135 12 10.2)"/><circle cx="12" cy="10.25" r="1.12"/></g></svg>`;
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
