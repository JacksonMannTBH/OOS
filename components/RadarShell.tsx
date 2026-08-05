"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import nextDynamic from "next/dynamic";
import Link from "next/link";
import type { Map as MaplibreMap } from "maplibre-gl";
import { useAircraft } from "@/lib/hooks/useAircraft";
import { SS_TOKENS } from "@/lib/tokens";
import {
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  readStoredDarkTheme,
} from "@/lib/theme";
import { computeStatus } from "@/lib/status";
import { RadarLayerControls } from "./RadarLayerControls";
import { AircraftTrailLayer } from "./AircraftTrailLayer";
import { aircraftColorForTail } from "@/lib/aircraft-colors";
import { LogoMark } from "./brand/Logo";
import {
  FLIGHT_PATHS_VISIBLE_KEY,
  LAYER_VISIBILITY_CHANGE_EVENT,
} from "@/lib/radar-layer-events";
import { Tooltip } from "./Tooltip";
import {
  STATE_CHANGE_EVENT,
  getAppState,
  getSelectedStateCode,
  type StateCode,
} from "@/lib/app-states";
import { PlaneIcon } from "./PlaneIcon";
import type { Aircraft, FleetEntry, Snapshot } from "@/lib/types";

export type RiderPos = { lat: number; lon: number };

const RadarMap = nextDynamic(() => import("./RadarMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: SS_TOKENS.bg0,
      }}
    />
  ),
});

const TABBAR_HEIGHT = 66;
const GLASS_BG_STRONG = SS_TOKENS.surface;
const MAP_HEADER_ICON_LIMIT = 10;

type Props = {
  initial: Snapshot;
  mockOn?: boolean;
  initialFocusTail?: string;
};

export function RadarShell({
  initial,
  mockOn = false,
  initialFocusTail,
}: Props) {
  const snap = useAircraft(initial, mockOn);
  const fleetMap = useMemo(
    () => new Map<string, FleetEntry>(snap.aircraft.map((a) => [a.tail, a])),
    [snap.aircraft],
  );
  const status = useMemo(() => computeStatus(snap, fleetMap), [snap, fleetMap]);
  const airborne = useMemo(
    () => snap.aircraft.filter((a) => a.airborne),
    [snap.aircraft],
  );

  const [rider, setRider] = useState<RiderPos | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [map, setMap] = useState<MaplibreMap | null>(null);
  const [showRings, setShowRings] = useState(false);
  const [showFlightPaths, setShowFlightPaths] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [stateCode, setStateCode] = useState<StateCode>(
    () => getSelectedStateCode(),
  );
  const [focusRequest, setFocusRequest] = useState<{
    tail: string;
    seq: number;
  } | null>(
    initialFocusTail
      ? { tail: initialFocusTail, seq: 1 }
      : null,
  );
  const [riderFocusRequest, setRiderFocusRequest] = useState(0);
  const focusSeqRef = useRef(initialFocusTail ? 1 : 0);
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.dataset.radarMode = "true";
    return () => {
      delete document.body.dataset.radarMode;
    };
  }, []);
  // Hydrate the rings preference and selected state on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setShowRings(window.localStorage.getItem("oos_distance_rings_visible") === "1");
    setShowFlightPaths(
      window.localStorage.getItem(FLIGHT_PATHS_VISIBLE_KEY) === "1",
    );
    setDarkMode(readStoredDarkTheme());
    setStateCode(getSelectedStateCode());
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ code?: StateCode }>).detail;
      setStateCode(detail?.code ?? getSelectedStateCode());
    };
    const onThemeChange = (e: Event) => {
      const detail = (e as CustomEvent<{ dark?: boolean }>).detail;
      setDarkMode(detail?.dark ?? readStoredDarkTheme());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY) {
        setDarkMode(readStoredDarkTheme());
      } else if (e.key === FLIGHT_PATHS_VISIBLE_KEY) {
        setShowFlightPaths(e.newValue === "1");
      }
    };
    window.addEventListener(STATE_CHANGE_EVENT, onChange);
    window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(STATE_CHANGE_EVENT, onChange);
      window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "oos_distance_rings_visible",
      showRings ? "1" : "0",
    );
  }, [showRings]);
  // Geolocation only kicks in when this component mounts â€” i.e. when the user
  // actually visits /map. The home page never asks.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      flashToast(setToast, "Location off · map still works");
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setRider({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => {
        flashToast(setToast, "Location off · map still works");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        paddingBottom: TABBAR_HEIGHT + 18,
        background: SS_TOKENS.bg0,
      }}
    >
      <RadarMap
        aircraft={airborne}
        rider={rider}
        showDistanceRings={showRings}
        showFuelEstimate
        darkMode={darkMode}
        stateCode={stateCode}
        focusRequest={focusRequest}
        riderFocusRequest={riderFocusRequest}
        onMapReady={setMap}
      />
      <RadarLayerControls
        ringsActive={showRings}
        onToggleRings={() => setShowRings((v) => !v)}
        ringsDisabled={!rider}
        flightPathsEnabled={showFlightPaths}
        onToggleFlightPaths={() => {
          const next = !showFlightPaths;
          setShowFlightPaths(next);
          window.localStorage.setItem(
            FLIGHT_PATHS_VISIBLE_KEY,
            next ? "1" : "0",
          );
          window.dispatchEvent(
            new CustomEvent(LAYER_VISIBILITY_CHANGE_EVENT, {
              detail: { key: FLIGHT_PATHS_VISIBLE_KEY, enabled: next },
            }),
          );
        }}
        onReturnToLocation={() => setRiderFocusRequest((seq) => seq + 1)}
        locationDisabled={!rider || !map}
      />
      <AircraftTrailLayer
        map={map}
        airborne={airborne}
        enabled={showFlightPaths}
      />

      <MapHeader
        airborne={airborne}
        kind={status.kind}
        onSelect={(tail) => {
          focusSeqRef.current += 1;
          setFocusRequest({ tail, seq: focusSeqRef.current });
        }}
      />

      {toast && <Toast message={toast} bottomBoost={0} />}
    </main>
  );
}

function MapHeader({
  airborne,
  kind,
  onSelect,
}: {
  airborne: Aircraft[];
  kind: "alert" | "clear";
  onSelect: (tail: string) => void;
}) {
  const isAlert = kind === "alert";
  const visibleAircraft = airborne.slice(0, MAP_HEADER_ICON_LIMIT);
  const overflowCount = Math.max(0, airborne.length - visibleAircraft.length);

  return (
    <header
      role="status"
      aria-live="polite"
      aria-label={
        airborne.length === 0
          ? "No active flights"
          : `${airborne.length} active flight${airborne.length === 1 ? "" : "s"}`
      }
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 16,
        background: "rgba(0, 0, 0, 0.94)",
        color: "#ffffff",
        borderBottom: "0.5px solid rgba(244, 196, 48, 0.34)",
        boxShadow: "0 12px 30px rgba(0, 0, 0, 0.28)",
        backdropFilter: "blur(18px) saturate(1.08)",
        WebkitBackdropFilter: "blur(18px) saturate(1.08)",
        fontFamily: "var(--font-header-ui)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          margin: "0 auto",
          height: "calc(env(safe-area-inset-top, 0px) + clamp(58px, 15vw, 72px))",
          padding: "env(safe-area-inset-top, 0px) clamp(14px, 4vw, 18px) 0",
          display: "grid",
          gridTemplateColumns:
            visibleAircraft.length > 0 ? "auto minmax(0, 1fr)" : "1fr auto 1fr",
          alignItems: "center",
          gap: "clamp(12px, 3.8vw, 18px)",
        }}
      >
        <LogoMark
          height="clamp(27px, 6.8vw, 36px)"
          width="clamp(40px, 10.2vw, 54px)"
          variant={isAlert ? "open" : "closed"}
          style={{
            justifySelf: "start",
          }}
        />
        {visibleAircraft.length > 0 && (
          <nav
            aria-label="Active aircraft"
            className="ss-scroll"
            style={{
              minHeight: 36,
              display: "flex",
              alignItems: "center",
              gap: 7,
              overflowX: "auto",
              paddingBottom: 2,
              WebkitOverflowScrolling: "touch",
            }}
          >
            {visibleAircraft.map((aircraft) => (
              <MapHeaderAircraftButton
                key={aircraft.tail}
                aircraft={aircraft}
                onSelect={onSelect}
              />
            ))}
            {overflowCount > 0 && (
              <span
                className="ss-mono"
                aria-label={`${overflowCount} more active aircraft`}
                style={{
                  flex: "0 0 auto",
                  height: 32,
                  minWidth: 34,
                  padding: "0 8px",
                  borderRadius: 8,
                  border: "1px solid rgba(255, 255, 255, 0.16)",
                  background: "rgba(255, 255, 255, 0.08)",
                  color: SS_TOKENS.fg2,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10.5,
                  fontWeight: 800,
                  lineHeight: 1,
                }}
              >
                +{overflowCount}
              </span>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}

function MapHeaderAircraftButton({
  aircraft,
  onSelect,
}: {
  aircraft: Aircraft;
  onSelect: (tail: string) => void;
}) {
  const color = aircraftColorForTail(aircraft.tail);
  const displayName = aircraft.nickname ?? aircraft.tail;
  const ariaLabel = `Center ${displayName} on the map`;

  return (
    <Tooltip content={displayName}>
      <button
        type="button"
        onClick={() => onSelect(aircraft.tail)}
        aria-label={ariaLabel}
        style={{
          flex: "0 0 auto",
          width: 36,
          height: 32,
          padding: 0,
          borderRadius: 8,
          border: `1.5px solid ${color}`,
          background: "rgba(255, 255, 255, 0.08)",
          color,
          boxShadow: `0 0 0 3px ${color}1f, 0 10px 22px rgba(0, 0, 0, 0.28)`,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <PlaneIcon
          size={23}
          role={aircraft.role}
          heading={aircraft.heading ?? 0}
          tone="radar"
          color={color}
        />
      </button>
    </Tooltip>
  );
}

function flashToast(
  setter: (msg: string | null) => void,
  message: string,
  durationMs = 4000,
) {
  setter(message);
  setTimeout(() => setter(null), durationMs);
}

function Toast({
  message,
  bottomBoost,
}: {
  message: string;
  bottomBoost: number;
}) {
  // Sit just above whatever's currently anchored to the bottom â€” carousel
  // when present, tab bar otherwise.
  const bottomOffset = TABBAR_HEIGHT + 16 + bottomBoost;
  return (
    <div
      role="status"
      style={{
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: bottomOffset,
        padding: "8px 14px",
        borderRadius: 999,
        background: GLASS_BG_STRONG,
        border: `.5px solid ${SS_TOKENS.hairline}`,
        boxShadow: SS_TOKENS.shadowMd,
        color: SS_TOKENS.fg2,
        fontFamily: "inherit",
        fontSize: 11,
        zIndex: 20,
        whiteSpace: "nowrap",
      }}
    >
      {message}
    </div>
  );
}

function AirborneBubbles({
  airborne,
  onSelect,
}: {
  airborne: Aircraft[];
  onSelect: (tail: string) => void;
}) {
  return (
    <nav
      aria-label="Airborne aircraft"
      className="ss-scroll"
      style={{
        position: "absolute",
        left: 10,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 14,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 8,
        maxHeight: "calc(100dvh - 220px)",
        overflowY: "auto",
        padding: "4px 2px",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {airborne.map((p) => {
        const color = aircraftColorForTail(p.tail);
        return (
          <Tooltip
            key={p.tail}
            side="right"
            content={`Center ${p.nickname ?? p.tail} on the map`}
          >
            <button
              type="button"
              onClick={() => onSelect(p.tail)}
              aria-label={`Center ${p.nickname ?? p.tail} on the map`}
              className="ss-mono"
              style={{
                flex: "0 0 auto",
                width: 62,
                height: 62,
                borderRadius: "50%",
                background: SS_TOKENS.surface,
                border: `1.5px solid ${color}`,
                boxShadow: SS_TOKENS.shadowMd,
                color: SS_TOKENS.fg0,
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                fontSize: 9.5,
                fontWeight: 800,
                lineHeight: 1,
                cursor: "pointer",
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: color,
                  boxShadow: `0 0 0 4px ${color}22`,
                  animation: "ss-blink 1.6s infinite",
                }}
              />
              <span>{p.tail}</span>
              {p.ground_speed_kt != null && (
                <span style={{ color: SS_TOKENS.fg2, fontSize: 8.5 }}>
                  {p.ground_speed_kt}kt
                </span>
              )}
            </button>
          </Tooltip>
        );
      })}
    </nav>
  );
}

function Carousel({
  airborne,
  collapsed,
  onToggleCollapsed,
}: {
  airborne: Aircraft[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  if (collapsed) {
    return (
      <Tooltip side="top" align="start" content="Show airborne aircraft cards">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={false}
          aria-label="Show airborne aircraft cards"
          className="ss-mono"
          style={{
            position: "absolute",
            left: 12,
            bottom: `calc(${TABBAR_HEIGHT + 16}px + var(--ss-install-prompt-h, 0px))`,
            zIndex: 14,
            width: 56,
            height: 56,
            borderRadius: "50%",
            border: `.5px solid ${SS_TOKENS.hairline2}`,
            background: "rgba(255,255,255,0.92)",
            color: SS_TOKENS.alert,
            boxShadow: SS_TOKENS.shadowMd,
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            cursor: "pointer",
            display: "inline-flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 800, lineHeight: 1 }}>
            {airborne.length}
          </span>
          <span style={{ fontSize: 9, fontWeight: 800, lineHeight: 1 }}>
            UP
          </span>
        </button>
      </Tooltip>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: TABBAR_HEIGHT,
        padding: collapsed ? "10px 14px 12px" : "14px 14px 18px",
        background: "rgba(255,255,255,0.88)",
        borderTop: `.5px solid ${SS_TOKENS.hairline}`,
        borderRadius: "18px 18px 0 0",
        boxShadow: SS_TOKENS.shadowLg,
        backdropFilter: "blur(24px) saturate(1.12)",
        WebkitBackdropFilter: "blur(24px) saturate(1.12)",
        zIndex: 10,
      }}
    >
      <div
        className="ss-eyebrow"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: collapsed ? 0 : 10,
          paddingLeft: 2,
          color: SS_TOKENS.fg1,
        }}
      >
        Airborne
        <Tooltip
          side="top"
          align="end"
          content={collapsed ? "Show airborne cards" : "Collapse airborne cards"}
        >
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={
              collapsed
                ? "Show airborne aircraft cards"
                : "Collapse airborne aircraft cards"
            }
            className="ss-mono"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: `.5px solid ${SS_TOKENS.hairline2}`,
              background: "rgba(255,255,255,0.92)",
              color: SS_TOKENS.fg1,
              boxShadow: SS_TOKENS.shadowSm,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 0,
              fontWeight: 800,
              lineHeight: 1,
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <span style={{ fontSize: 16 }}>v</span>
            {collapsed ? "âŒƒ" : "âŒ„"}
          </button>
        </Tooltip>
      </div>
      {!collapsed && (
        <div
          className="ss-scroll"
          style={{
            display: "flex",
            gap: 10,
            overflowX: "auto",
            // Allow cards to bleed into right edge; iOS smooth scroll.
            WebkitOverflowScrolling: "touch",
          }}
        >
          {airborne.map((p) => (
            <PlaneCard key={p.tail} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlaneCard({ p }: { p: Aircraft }) {
  return (
    <Link
      href={`/plane/${p.tail}`}
      prefetch={false}
      style={{
        flex: "0 0 auto",
        minWidth: 200,
        padding: 14,
        borderRadius: 20,
        background: "rgba(255,255,255,0.94)",
        border: `.5px solid ${SS_TOKENS.hairline}`,
        boxShadow: SS_TOKENS.shadowSm,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: SS_TOKENS.alert,
            animation: "ss-blink 1.6s infinite",
          }}
        />
        <span
          className="ss-mono"
          style={{ fontSize: 13, fontWeight: 600, color: SS_TOKENS.fg0 }}
        >
          {p.tail}
        </span>
        {p.nickname && (
          <span style={{ fontSize: 11, color: SS_TOKENS.fg1 }}>
            &ldquo;{p.nickname}&rdquo;
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: SS_TOKENS.fg2, marginTop: 5 }}>
        {p.operator}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <Stat
          label="ALT"
          value={
            p.altitude_ft != null
              ? `${p.altitude_ft.toLocaleString()}â€²`
              : "â€”"
          }
        />
        <Stat
          label="GS"
          value={p.ground_speed_kt != null ? `${p.ground_speed_kt}kt` : "â€”"}
        />
        <Stat
          label="TIME"
          value={p.time_aloft_min != null ? `${p.time_aloft_min}m` : "â€”"}
        />
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="ss-mono"
        style={{
          fontSize: 9.5,
          color: SS_TOKENS.fg2,
          letterSpacing: ".08em",
        }}
      >
        {label}
      </div>
      <div
        className="ss-mono"
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: SS_TOKENS.fg0,
          marginTop: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

