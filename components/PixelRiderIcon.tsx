import { DINKIE_RIDER_ICONS } from "@/lib/elite-rider-icons";

export const PIXEL_RIDER_ICONS = DINKIE_RIDER_ICONS;
export type PixelRiderIconId = typeof PIXEL_RIDER_ICONS[number]["id"];

// Render bundled source paths without runtime requests to an icon service.
// The 28px default matches the police-sighting badge on the main map.
export function PixelRiderIcon({ icon, size = 28 }: { icon: PixelRiderIconId; size?: number }) {
  const sprite = PIXEL_RIDER_ICONS.find(item => item.id === icon) ?? PIXEL_RIDER_ICONS[0];
  return <svg width={size} height={size} viewBox={`0 0 ${sprite.width} ${sprite.height}`} shapeRendering="crispEdges" aria-hidden="true" focusable="false" style={{ display: "block", flexShrink: 0, color: "#fff" }}>
    <path fill="currentColor" d={sprite.path} />
  </svg>;
}
