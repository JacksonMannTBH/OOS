"use client";

import type { RecordedRide } from "@/lib/ride-recording";
import { rideDateRange, rideDateTime, rideTimeRange } from "@/lib/ride-history-format";
import { RideRouteMap } from "./RideRouteMap";
import { RideDialog } from "./RideDialog";
import { useRideAnglesEnabled } from "@/lib/hooks/useRideAnglesEnabled";
import { RideStatistics } from "./RideStatistics";

export function RideSummary({ ride, onClose }: { ride: RecordedRide; onClose: () => void }) {
  const showRideAngles = useRideAnglesEnabled();
  return <RideDialog title="Ride summary" className="ss-ride-summary" onClose={onClose}>
    <p className="ss-ride-summary-meta" aria-label={rideDateTime(ride)}>
      <span>{rideTimeRange(ride)}</span>
      <span>{rideDateRange(ride)}</span>
    </p>
    <RideRouteMap route={ride.route} />
    <RideStatistics ride={ride} showAngles={showRideAngles} />
    <button className="ss-ride-primary" onClick={onClose}>Done</button>
  </RideDialog>;
}
