"use client";

import { hasRideRecorder } from "@/lib/ride-recording";
import { useRideRecorder } from "@/lib/hooks/useRideRecorder";
import { rideDuration } from "@/lib/ride-history-format";

export function AllTimeRideStats() {
  const { status, error } = useRideRecorder();
  const stats = status?.lifetimeStats;
  if (error) return <p role="alert" className="ss-ride-error">{error}</p>;
  if (!hasRideRecorder()) return <p>Ride stats are available in the OOS iPhone app.</p>;
  if (!status) return <p role="status">Loading stats…</p>;
  if (!stats) return <p>Update OOS to see your all-time ride stats.</p>;

  return <>
    <dl className="ss-all-time-stats" aria-label="All-time ride stats">
      <div><dt>All-time top speed</dt><dd>{stats.topSpeedMps == null ? "—" : Math.round(stats.topSpeedMps * 2.236936)} <small>mph</small></dd></div>
      <div><dt>Longest distance ride</dt><dd>{stats.longestDistanceMeters == null ? "—" : (stats.longestDistanceMeters / 1609.344).toFixed(1)} <small>mi</small></dd></div>
      <div><dt>Longest ride duration</dt><dd>{stats.rideCount ? rideDuration(stats.longestDurationSeconds).split(/(hr|min)/).map((part, index) =>
        /^(hr|min)$/.test(part) ? <small key={index}>{part}</small> : part) : "—"}</dd></div>
      <div><dt>Number of rides</dt><dd>{stats.rideCount.toLocaleString("en-US")}</dd></div>
    </dl>
    {stats.rideCount === 0 && <p className="ss-all-time-stats-empty">Finish your first ride to start setting records.</p>}
  </>;
}
