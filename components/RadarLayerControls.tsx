"use client";

import Link from "next/link";
import { SS_TOKENS } from "@/lib/tokens";
import { Tooltip } from "./Tooltip";

const PATH_ICON = "/icons/radar-path.svg";
const RINGS_ICON = "/icons/radar-rings.svg";
const LOCATION_ICON = "/icons/radar-location.svg";

type Props = {
  /** Extra px above the lower map controls; pass when the airborne carousel is on. */
  bottomBoost?: number;
  ringsActive: boolean;
  onToggleRings: () => void;
  ringsDisabled?: boolean;
  flightPathsEnabled: boolean;
  onToggleFlightPaths: () => void;
  onReturnToLocation: () => void;
  locationDisabled?: boolean;
};

export function RadarLayerControls({
  bottomBoost = 0,
  ringsActive,
  onToggleRings,
  ringsDisabled = false,
  flightPathsEnabled,
  onToggleFlightPaths,
  onReturnToLocation,
  locationDisabled = false,
}: Props) {
  const bottom = 14 + bottomBoost;
  const offsetCss = (extra: number) =>
    `calc(${bottom + extra}px + var(--ss-install-prompt-h, 0px))`;

  return (
    <div
      style={{
        position: "absolute",
        left: 12,
        bottom: offsetCss(0),
        zIndex: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <Link
        href="/home"
        aria-label="Home"
        style={iconButtonStyle(false)}
      >
        <HomeIcon />
      </Link>
      <Tooltip
        side="right"
        align="start"
        content={
          ringsDisabled
            ? "Distance rings need your location. Allow location access on /map."
            : "1 / 3 / 5 nm rings around your position. Tap to toggle."
        }
      >
        <button
          type="button"
          onClick={() => {
            if (!ringsDisabled) onToggleRings();
          }}
          aria-label="Toggle distance rings"
          aria-pressed={ringsActive}
          aria-disabled={ringsDisabled}
          style={iconButtonStyle(ringsActive, ringsDisabled)}
        >
          <IconGlyph
            src={RINGS_ICON}
            active={ringsActive}
            disabled={ringsDisabled}
          />
        </button>
      </Tooltip>
      <Tooltip
        side="right"
        align="start"
        content="Current flight paths for aircraft actively in the air."
      >
        <button
          type="button"
          onClick={onToggleFlightPaths}
          aria-label="Toggle flight paths"
          aria-pressed={flightPathsEnabled}
          style={iconButtonStyle(flightPathsEnabled)}
        >
          <IconGlyph src={PATH_ICON} active={flightPathsEnabled} />
        </button>
      </Tooltip>
      <Tooltip
        side="right"
        align="start"
        content={
          locationDisabled
            ? "Waiting for your location. Allow location access on /map."
            : "Return the map to your current location."
        }
      >
        <button
          type="button"
          onClick={() => {
            if (!locationDisabled) onReturnToLocation();
          }}
          aria-label="Return to my location"
          aria-disabled={locationDisabled}
          style={iconButtonStyle(false, locationDisabled)}
        >
          <IconGlyph
            src={LOCATION_ICON}
            active={false}
            disabled={locationDisabled}
          />
        </button>
      </Tooltip>
    </div>
  );
}

function iconButtonStyle(
  active: boolean,
  disabled = false,
): React.CSSProperties {
  return {
    width: 44,
    height: 44,
    padding: 0,
    borderRadius: 14,
    background: active
      ? "rgba(246, 196, 49, 0.18)"
      : "rgba(15, 15, 15, 0.72)",
    border: active
      ? "1px solid rgba(246, 196, 49, 0.70)"
      : `1px solid ${SS_TOKENS.hairline}`,
    color: disabled
      ? SS_TOKENS.fg3
      : active
        ? SS_TOKENS.alert
        : SS_TOKENS.fg1,
    boxShadow: active
      ? "0 0 22px rgba(246, 196, 49, 0.24), 0 14px 34px rgba(0, 0, 0, 0.34)"
      : "0 14px 34px rgba(0, 0, 0, 0.34)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    cursor: disabled ? "not-allowed" : "pointer",
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
    opacity: disabled ? 0.58 : 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

function IconGlyph({
  src,
  active,
  disabled = false,
}: {
  src: string;
  active: boolean;
  disabled?: boolean;
}) {
  return (
    <span
      aria-hidden
      style={{
        width: 23,
        height: 23,
        display: "block",
        background: disabled
          ? SS_TOKENS.fg3
          : active
            ? SS_TOKENS.alert
            : SS_TOKENS.fg1,
        WebkitMask: `url(${src}) center / contain no-repeat`,
        mask: `url(${src}) center / contain no-repeat`,
      }}
    />
  );
}

function HomeIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M3.2 11.2 12 3.6l8.8 7.6v8.3c0 .8-.7 1.5-1.5 1.5h-4.5v-6.2H9.2V21H4.7c-.8 0-1.5-.7-1.5-1.5v-8.3Z" />
    </svg>
  );
}
