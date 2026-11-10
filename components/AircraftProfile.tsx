"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AircraftCatalogEntry } from "@/lib/aircraft-data";
import type { Snapshot } from "@/lib/types";
import type { RecentFlightForTail } from "@/lib/flights";
import type { StateCode } from "@/lib/app-states";
import { getAppState } from "@/lib/app-states";
import { AircraftDisplay } from "@/lib/aircraft-display";
import { subscribeLiveState } from "@/lib/live-data-client";
import { estimateFuelRemaining } from "@/lib/fuel-estimate";
import { averageGroundSpeedKt, flightIdFromTs } from "@/lib/flight-utils";
import { fmtAgoTs, formatTs } from "@/lib/time";
import { fleetHex } from "@/lib/seed";
import { roleBadgeText } from "@/lib/role-display";
import { SS_TOKENS } from "@/lib/tokens";
import { SettingsBackLink } from "./SettingsBackLink";
import { DetailMetricList, DetailTechnicalDetails, type DetailMetric } from "./AircraftDetailUI";

function useProfileSnapshot(initial: Snapshot, stateCode: StateCode, mock?: string) {
  const [snapshot, setSnapshot] = useState(initial);
  useEffect(() => {
    const display = new AircraftDisplay(initial);
    let paused = document.visibilityState === "hidden";
    const publish = () => { if (display.snapshot) setSnapshot(display.snapshot); };
    const pause = () => { paused = true; display.hold(); };
    const resume = () => { paused = false; display.hold(); };
    const visibility = () => document.visibilityState === "hidden" ? pause() : resume();
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("pause", pause);
    document.addEventListener("resume", resume);
    const unsubscribe = mock ? () => {} : subscribeLiveState(stateCode, (update, delivery) => {
      display.receive(update.snapshot, !delivery.fromCache && !paused, Date.now());
      publish();
    });
    const timer = window.setInterval(() => {
      if (paused) return;
      display.tick(Date.now());
      publish();
    }, 5_000);
    publish();
    return () => {
      unsubscribe();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("pause", pause);
      document.removeEventListener("resume", resume);
    };
  }, [initial, stateCode, mock]);
  return snapshot;
}

function useRecentFlight(initial: RecentFlightForTail | null, tail: string) {
  const [flight, setFlight] = useState(initial);
  useEffect(() => {
    setFlight(initial);
    let disposed = false;
    let paused = false;
    let controller: AbortController | null = null;
    const refresh = async () => {
      if (disposed || paused || document.visibilityState === "hidden" || controller) return;
      const current = new AbortController();
      controller = current;
      const timeout = window.setTimeout(() => current.abort(), 10_000);
      try {
        const response = await fetch(`/api/mobile?kind=recent-flight&tail=${encodeURIComponent(tail)}`, { cache: "no-store", signal: current.signal });
        if (!response.ok) return;
        const next = await response.json() as RecentFlightForTail | null;
        if (!disposed && !current.signal.aborted) setFlight(next);
      } catch { /* Preserve the last received flight until a successful refresh. */ }
      finally { window.clearTimeout(timeout); if (controller === current) controller = null; }
    };
    const pause = () => { paused = true; controller?.abort(); };
    const resume = () => { paused = false; void refresh(); };
    const visibility = () => document.visibilityState === "hidden" ? pause() : resume();
    const timer = window.setInterval(() => void refresh(), 30_000);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("pause", pause);
    document.addEventListener("resume", resume);
    window.addEventListener("focus", resume);
    return () => {
      disposed = true;
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("pause", pause);
      document.removeEventListener("resume", resume);
      window.removeEventListener("focus", resume);
    };
  }, [initial, tail]);
  return flight;
}

export function AircraftProfile({ catalogEntry, initialSnapshot, initialFlight, stateCode, mock, hour12 }: {
  catalogEntry: AircraftCatalogEntry;
  initialSnapshot: Snapshot;
  initialFlight: RecentFlightForTail | null;
  stateCode: StateCode;
  mock?: string;
  hour12: boolean;
}) {
  const entry = catalogEntry.aircraft;
  const snapshot = useProfileSnapshot(initialSnapshot, stateCode, mock);
  const recentFlight = useRecentFlight(initialFlight, entry.tail);
  const live = snapshot.aircraft.find(aircraft => aircraft.tail === entry.tail);
  const airborne = Boolean(live?.airborne);
  const lastKnown = !airborne && Boolean(live?.last_known_airborne);
  const grounded = !airborne && !lastKnown && live?.observation_status === "grounded";
  const status = airborne ? "Airborne" : lastKnown ? "Last known" : grounded ? "Grounded" : "Unknown";
  const observedAt = live?.observed_at ? Date.parse(live.observed_at) : null;
  const flightHref = recentFlight ? `/flight/${entry.tail}/${flightIdFromTs(recentFlight.session.start_ts)}` : null;
  const mapHref = `/map?tail=${encodeURIComponent(entry.tail)}&state=${stateCode}${mock ? `&mock=${encodeURIComponent(mock)}` : ""}`;
  const showReadings = Boolean(live && (airborne || lastKnown));
  const fuel = airborne && live ? estimateFuelRemaining(live) : null;
  const action = airborne || lastKnown
    ? { href: mapHref, label: lastKnown ? "View last known position" : "View on map" }
    : flightHref ? { href: flightHref, label: "View latest flight" } : { href: mapHref, label: "Open map" };

  return <main className="ss-settings-page ss-aircraft-profile">
    <header className="ss-settings-page__header">
      <SettingsBackLink href="/aircraft" label="Aircraft" />
      <div className="ss-settings-page__intro">
        <h1>{entry.tail}</h1>
        <p className="ss-aircraft-profile__operator">{entry.operator}</p>
        <div className="ss-aircraft-profile__status" data-status={status} role="status" aria-live="polite">{status}</div>
        <p className="ss-aircraft-profile__freshness">
          {observedAt != null && Number.isFinite(observedAt)
            ? `Last observed ${formatTs(observedAt, "datetime", { hour12 })}`
            : "No recent aircraft observation"}
        </p>
        {snapshot.source_ok === false && <p className="ss-aircraft-profile__freshness">Connection interrupted. Showing the last received data.</p>}
      </div>
    </header>

    <Link href={action.href} prefetch={false} className="ss-aircraft-profile__action">{action.label}</Link>

    {showReadings && live && <section aria-labelledby="aircraft-flight-heading" className="ss-aircraft-profile__section">
      <h2 id="aircraft-flight-heading">{lastKnown ? "Last known flight" : "Current flight"}</h2>
      <dl className="ss-aircraft-profile__readings">
        {[
          { label: "Time airborne", value: live.time_aloft_min != null ? formatDuration(Math.round(live.time_aloft_min * 60)) : "Not reported" },
          { label: "Altitude", value: live.altitude_ft != null ? `${live.altitude_ft.toLocaleString()} ft` : "Not reported" },
          { label: "Ground speed", value: live.ground_speed_kt != null ? `${Math.round(live.ground_speed_kt)} kt` : "Not reported" },
          { label: "Estimated time remaining", value: fuel?.label.replace(/^Est\. /, "") ?? "Unavailable" },
        ].map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}
      </dl>
      {fuel && <p className="ss-aircraft-profile__note">Time remaining is a catalog estimate, not measured fuel.</p>}
      <DetailTechnicalDetails summary="Flight details">
        <DetailMetricList items={[
          { label: "Heading", value: live.heading != null ? `${Math.round(live.heading)}°` : "Not reported" },
          squawkMetric(live.squawk),
          ...(live.tracking_started_at ? [{ label: "Tracking started", value: formatTs(Date.parse(live.tracking_started_at), "datetime", { hour12 }) }] : []),
        ]} />
      </DetailTechnicalDetails>
    </section>}

    {!showReadings && recentFlight && <section aria-labelledby="aircraft-flight-heading" className="ss-aircraft-profile__section">
      <h2 id="aircraft-flight-heading">Latest flight</h2>
      <p className="ss-aircraft-profile__note">{recentFlight.inProgress ? "Latest retained flight observations; current aircraft status is shown above." : `Last flew ${fmtAgoTs(recentFlight.session.end_ts)}`}</p>
      <DetailMetricList items={flightMetrics(recentFlight, hour12)} />
    </section>}

    {!showReadings && !recentFlight && <section className="ss-aircraft-profile__section">
      <h2>No retained flight yet</h2>
      <p className="ss-aircraft-profile__note">Flight details will appear after the next observed flight begins.</p>
    </section>}

    <DetailTechnicalDetails summary="Aircraft details">
      <DetailMetricList items={[
        { label: "Operator", value: entry.operator },
        { label: "Model", value: entry.model },
        { label: "Home base", value: entry.base },
        { label: "Home state", value: getAppState(catalogEntry.homeStateCode).label },
        { label: "Role", value: roleBadgeText(entry.role), detail: entry.roleDescription },
        { label: "Estimated endurance", value: formatEndurance(catalogEntry.nominalEnduranceMin), detail: "Catalog estimate, not onboard fuel telemetry." },
        { label: "ICAO24", value: fleetHex(entry).toUpperCase() },
      ]} />
      <a className="ss-aircraft-profile__registry" href={`https://registry.faa.gov/aircraftinquiry/Search/NNumberResult?nNumberTxt=${entry.tail}`} target="_blank" rel="noopener noreferrer">Open FAA registry ↗</a>
    </DetailTechnicalDetails>
  </main>;
}
function squawkMetric(squawk: string | null | undefined): DetailMetric {
  const emergency =
    squawk === "7700"
      ? { color: SS_TOKENS.danger, detail: "General emergency code." }
      : squawk === "7600"
        ? { color: SS_TOKENS.warn, detail: "Radio communications failure code." }
        : squawk === "7500"
          ? { color: SS_TOKENS.danger, detail: "Hijack code." }
          : null;
  return {
    label: "Squawk",
    value: (
      <span className="ss-mono" style={{ color: emergency?.color }}>
        {squawk ?? "Not reported"}
      </span>
    ),
    detail: emergency?.detail,
  };
}

function flightMetrics(
  flight: RecentFlightForTail,
  hour12: boolean,
): DetailMetric[] {
  const { session, inProgress } = flight;
  const avgGroundSpeed = averageGroundSpeedKt(flight.points);
  return [
    {
      label: "Started",
      value: formatTs(session.start_ts, "datetime", { hour12 }),
    },
    {
      label: inProgress ? "Latest observation" : "Ended",
      value: formatTs(session.end_ts, "datetime", { hour12 }),
    },
    { label: "Duration", value: formatDuration(session.duration_s) },
    {
      label: "Average ground speed",
      value:
        avgGroundSpeed != null ? `${Math.round(avgGroundSpeed)} kt` : "Not reported",
    },
    {
      label: "Maximum altitude",
      value:
        session.max_alt_ft > 0
          ? `${session.max_alt_ft.toLocaleString()}′`
          : "Not reported",
    },
    { label: "Status", value: inProgress ? "In progress" : "Completed" },
  ];
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatEndurance(minutes: number | null): string {
  if (!minutes) return "Unverified";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `About ${hours}h ${remainder}m` : `About ${hours}h`;
}
