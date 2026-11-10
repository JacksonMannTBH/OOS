"use client";

import type { RecordedRide } from "@/lib/ride-recording";
import { rideDateTime, rideDistance, rideDuration, rideSpeed } from "@/lib/ride-history-format";
import { RideRouteMap } from "./RideRouteMap";
import { RideDialog } from "./RideDialog";

export function RideSummary({ ride, onClose }: { ride: RecordedRide; onClose: () => void }) {
  return <RideDialog title="Ride summary" className="ss-ride-summary" onClose={onClose}>
    <p className="ss-ride-muted">{rideDateTime(ride)}</p>
    <RideRouteMap route={ride.route} />
    <dl className="ss-ride-statistics">
      <div><dt>Top speed</dt><dd>{rideSpeed(ride)}</dd></div>
      <div><dt>Distance</dt><dd>{rideDistance(ride)}</dd></div>
      <div><dt>Duration</dt><dd>{rideDuration(ride.durationSeconds)}</dd></div>
    </dl>
    <button className="ss-ride-primary" onClick={onClose}>Done</button>
  </RideDialog>;
}
