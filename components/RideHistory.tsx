"use client";

import { useEffect, useState } from "react";
import { useRideRecorder } from "@/lib/hooks/useRideRecorder";
import type { RecordedRide } from "@/lib/ride-recording";
import { rideDateTime, rideDistance, rideDuration, rideSpeed } from "@/lib/ride-history-format";
import { useRouter, useSearchParams } from "next/navigation";
import { RideSummary } from "./RideSummary";

export function RideHistory() {
  const { status, error } = useRideRecorder();
  const [selected, setSelected] = useState<RecordedRide | null>(null);
  const router = useRouter();
  const params = useSearchParams();
  const summaryId = params.get("rideSummary");
  useEffect(() => {
    if (!summaryId || !status) return;
    const ride = status.rides.find(ride => ride.id === summaryId) ?? null;
    // Completed rides are immutable. Keep their object stable across status polls
    // so an open summary does not tear down a map that is still loading.
    setSelected(current => current?.id === ride?.id ? current : ride);
  }, [summaryId, status]);
  function close() {
    setSelected(null);
    if (summaryId) router.replace("/home", { scroll: false });
  }
  if (error) return <p role="alert" className="ss-ride-error">{error}</p>;
  if (!status?.supported) return null;
  return <>
    {status.rides.length > 0 && <ul className="ss-ride-history" aria-label="Saved rides">
      {status.rides.slice(0, 3).map(ride => <li key={ride.id}>
        <button type="button" onClick={() => setSelected(ride)}>
          <span><span className="ss-ride-date">{rideDateTime(ride)}</span>
            <span className="ss-ride-row-stats">{rideDistance(ride)} · {rideDuration(ride.durationSeconds)} · Top {rideSpeed(ride)}</span>
          </span>
          <span aria-hidden="true">›</span>
        </button>
      </li>)}
    </ul>}
    {selected && <RideSummary key={selected.id} ride={selected} onClose={close} />}
  </>;
}
