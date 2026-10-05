import type { GlyphRole } from "./aircraft-glyphs";

const HELICOPTER_ASSET_ROOT = "/icons/helicopter/custom-no-tail-rotor";
const HELICOPTER_ASSET_VERSION = "no-tail-rotor-v1";

export const HELICOPTER_ICON_SIZE = 56;
export const HELICOPTER_ICON_FRAMES = 12;
export const HELICOPTER_ANIMATION_MS = 480;

export function helicopterFrameSrc(frame: number): string {
  return `${HELICOPTER_ASSET_ROOT}/frame-${frame}.png?v=${HELICOPTER_ASSET_VERSION}`;
}

export function helicopterIconKeyFor(frame: number): string {
  return `aircraft-helicopter-${frame}`;
}

export function helicopterFrameAt(elapsedMs: number): number {
  return Math.floor(
    (elapsedMs % HELICOPTER_ANIMATION_MS) /
      (HELICOPTER_ANIMATION_MS / HELICOPTER_ICON_FRAMES),
  );
}

export function isHelicopterRole(role: GlyphRole): boolean {
  return role === "patrol" || role === "sar";
}
