"use client";

import type {
  RideContact,
  RideStatus,
  RideStatusThresholds,
} from "@/lib/ride-mode";

const STATUS_COLORS: Record<RideStatus, string> = {
  clear: "#39d98a",
  watch: "#60a5fa",
  warning: "#f6c431",
  danger: "#ff4d4f",
};

type Props = {
  status: RideStatus;
  contact: RideContact | null;
  displayBearingDeg: number | null;
  clearDistanceNm: number;
  distanceBands: RideStatusThresholds;
  highlightTrackingArrow?: boolean;
};

export function RideCompass({
  status,
  contact,
  displayBearingDeg,
  clearDistanceNm,
  distanceBands,
  highlightTrackingArrow = false,
}: Props) {
  const color = STATUS_COLORS[status];
  const arrowColor = highlightTrackingArrow ? "#ff1f2d" : "#050505";
  const hasMarker = contact != null && displayBearingDeg != null;
  const marker = hasMarker ? markerPosition(displayBearingDeg) : null;
  const name = contact
    ? contact.plane.nickname
      ? `${contact.plane.tail} - ${contact.plane.nickname}`
      : contact.plane.tail
    : null;
  const ariaLabel = contact
    ? `Compass. ${name} is ${contact.cardinal}, ${contact.distanceNm.toFixed(1)} nautical miles away.`
    : `Compass. No tracked aircraft within ${formatNm(clearDistanceNm)} nautical miles.`;

  return (
    <section
      role="img"
      aria-label={ariaLabel}
      style={{
        width: "min(70vw, 320px, 42dvh)",
        aspectRatio: "1",
        position: "relative",
        borderRadius: "50%",
        border: `2px solid color-mix(in srgb, ${color} 56%, #25251e)`,
        background:
          "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.08) 0 3px, transparent 4px 100%), radial-gradient(circle, #171712 0%, #080808 58%, #020202 100%)",
        boxShadow:
          status === "danger"
            ? `0 0 0 6px rgba(255,77,79,0.18), 0 0 44px rgba(255,77,79,0.42)`
            : `0 0 0 1px rgba(255,255,255,0.06), 0 24px 70px rgba(0,0,0,0.64)`,
        overflow: "hidden",
      }}
    >
      <CompassRing color={color} distanceBands={distanceBands} />

      {hasMarker && marker && (
        <>
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: "35%",
              height: 4,
              borderRadius: 999,
              background: `linear-gradient(90deg, ${color}, transparent)`,
              transformOrigin: "left center",
              transform: `rotate(${displayBearingDeg - 90}deg)`,
              opacity: 0.7,
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: `${marker.x}%`,
              top: `${marker.y}%`,
              width: status === "danger" ? 70 : 60,
              height: status === "danger" ? 70 : 60,
              borderRadius: "50%",
              background: highlightTrackingArrow ? "#050505" : color,
              transform: "translate(-50%, -50%)",
              boxShadow: highlightTrackingArrow
                ? "0 0 0 8px rgba(255,31,45,0.22), 0 0 34px rgba(255,31,45,0.82), 0 0 72px rgba(255,31,45,0.42)"
                : `0 0 0 8px color-mix(in srgb, ${color} 18%, transparent), 0 0 28px color-mix(in srgb, ${color} 56%, transparent)`,
              border: highlightTrackingArrow
                ? "2px solid rgba(255,31,45,0.92)"
                : undefined,
              display: "grid",
              placeItems: "center",
            }}
          >
            <span
              aria-hidden
              style={{
                transform: `rotate(${displayBearingDeg}deg)`,
                display: "grid",
                placeItems: "center",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: "11px solid transparent",
                  borderRight: "11px solid transparent",
                  borderBottom: `25px solid ${arrowColor}`,
                  transformOrigin: "50% 62%",
                }}
              />
            </span>
          </div>
        </>
      )}

      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 88,
          height: 88,
          borderRadius: "50%",
          background: "#f5f2e8",
          color: "#050505",
          border: "6px solid #050505",
          display: "grid",
          placeItems: "center",
          fontSize: 16,
          fontWeight: 900,
          boxShadow: "0 0 0 1px rgba(255,255,255,.18)",
        }}
      >
        YOU
      </div>
    </section>
  );
}

function formatNm(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function markerPosition(degrees: number): { x: number; y: number } {
  const radians = ((degrees - 90) * Math.PI) / 180;
  const radius = 34;
  return {
    x: 50 + Math.cos(radians) * radius,
    y: 50 + Math.sin(radians) * radius,
  };
}

function CompassRing({
  color,
  distanceBands,
}: {
  color: string;
  distanceBands: RideStatusThresholds;
}) {
  const maxDistanceNm = distanceBands.watchNm;
  return (
    <>
      <DistanceBandRing
        color={color}
        distanceNm={distanceBands.watchNm}
        maxDistanceNm={maxDistanceNm}
        opacity={34}
        boxShadow="inset 0 0 0 1px rgba(255,255,255,0.04)"
      />
      <DistanceBandRing
        color={color}
        distanceNm={distanceBands.warningNm}
        maxDistanceNm={maxDistanceNm}
        opacity={40}
      />
      <DistanceBandRing
        color={color}
        distanceNm={distanceBands.stopNm}
        maxDistanceNm={maxDistanceNm}
        opacity={52}
      />
    </>
  );
}

function DistanceBandRing({
  color,
  distanceNm,
  maxDistanceNm,
  opacity,
  boxShadow,
}: {
  color: string;
  distanceNm: number;
  maxDistanceNm: number;
  opacity: number;
  boxShadow?: string;
}) {
  const ratio = Math.min(1, Math.max(0, distanceNm / maxDistanceNm));
  const inset = `${(1 - ratio) * 50}%`;
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset,
        borderRadius: "50%",
        border: `1px solid color-mix(in srgb, ${color} ${opacity}%, rgba(255,255,255,0.16))`,
        boxShadow,
      }}
    />
  );
}
