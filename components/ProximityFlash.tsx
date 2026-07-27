"use client";

// Ambient amber flash overlay rendered on /dash when a fixed_wing or patrol
// aircraft is within PROXIMITY_NM nautical miles of the rider. Pulses
// gently via CSS keyframes so it's noticeable in peripheral vision
// without strobing — sits as a fixed-position overlay above the page
// content but below the tab bar (z-index: 49 vs TabBar's 50).
//
// Renders nothing when inactive so React can skip it cleanly.

import { SS_TOKENS } from "@/lib/tokens";

const KEYFRAME_ID = "ss-proximity-flash-keyframes";
// One-time global keyframe injection — guarded so multiple mounts of
// ProximityFlash (e.g. fast nav back to /dash) don't pile up <style>
// tags. The rule itself is idempotent.
function ensureKeyframes() {
  if (typeof document === "undefined") return;
  if (document.getElementById(KEYFRAME_ID)) return;
  const style = document.createElement("style");
  style.id = KEYFRAME_ID;
  style.textContent = `@keyframes ss-proximity-flash {
    0%, 100% { opacity: 0.10; }
    50% { opacity: 0.28; }
  }`;
  document.head.appendChild(style);
}

export function ProximityFlash({
  active,
  color = SS_TOKENS.alert,
}: {
  active: boolean;
  color?: string;
}) {
  if (!active) return null;
  ensureKeyframes();
  return (
    <div
      aria-hidden
      data-testid="proximity-flash"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        background: `radial-gradient(circle at 50% 50%, transparent 30%, ${color} 130%)`,
        animation: "ss-proximity-flash 1.8s ease-in-out infinite",
        zIndex: 49,
      }}
    />
  );
}
