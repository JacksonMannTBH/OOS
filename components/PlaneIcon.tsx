// Inline SVG aircraft icon for non-map surfaces (lists, cards, eyebrows).
// Wraps lib/brand/aircraft-glyphs.aircraftSvg so list icons stay
// pixel-identical to the radar map glyphs.
//
// Migration note: the legacy `kind: "plane" | "helo"` prop was a model-
// string heuristic. It's been replaced by `role: FleetRole`, which is
// authoritative. Callers that only have a model string can use
// roleFromModel() from lib/brand/aircraft-glyphs as a conservative
// fallback.

import {
  aircraftSvg,
  roleFromModel,
  type GlyphRole,
} from "@/lib/brand/aircraft-glyphs";
import type { FleetRole } from "@/lib/types";

type Props = {
  size?: number;
  role?: FleetRole | "unknown";
  /** Bearing in degrees clockwise from north. */
  heading?: number;
  tone?: "default" | "radar";
  color?: string;
};

export function PlaneIcon({
  size = 16,
  role = "fixed_wing",
  heading = 0,
  tone = "default",
  color,
}: Props) {
  return (
    <span
      role="img"
      aria-label="aircraft"
      style={{
        display: "inline-flex",
        width: size,
        height: size,
        // Glyphs face north in path data; rotate the wrapper, not the SVG.
        transform: `rotate(${heading}deg)`,
        lineHeight: 0,
      }}
      dangerouslySetInnerHTML={{
        __html: aircraftSvg(role, { size, tone, color }),
      }}
    />
  );
}

/**
 * Conservative fallback for callers that have a model string but no role.
 * Re-exported under the legacy name so the one consumer (Glanceable's
 * "Also up" list) doesn't have to change its import shape.
 */
export function planeKindFor(
  model: string | null | undefined,
): GlyphRole {
  return roleFromModel(model);
}
