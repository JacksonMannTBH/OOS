"use client";

import { useEffect, useState } from "react";
import { watchDevicePosition } from "@/lib/device-location";
import { setAutomaticallyDetectedCaliforniaRegion } from "@/lib/california-regions";

export type RiderPos = {
  lat: number;
  lon: number;
  /** Speed over ground in m/s, when the device reports it. */
  speedMps: number | null;
  /** Heading in degrees, when reported. */
  heading: number | null;
};

export type RiderState = {
  pos: RiderPos | null;
  /** True after a permission failure or unsupported environment. */
  unavailable: boolean;
};

const WATCH_OPTS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5000,
  timeout: 15000,
};

/**
 * Subscribes to foreground location for aircraft distances and the map.
 * The shared location boundary suspends this watch when the app is hidden.
 * On iOS, recording and Live Tracking share its native location source.
 */
export function useRiderPos(): RiderState {
  const [pos, setPos] = useState<RiderPos | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    return watchDevicePosition(
      (p) => {
        void setAutomaticallyDetectedCaliforniaRegion(p.coords.latitude, p.coords.longitude)
          .catch(() => { /* Retry on the next location fix if saving is unavailable. */ });
        setPos({
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          speedMps: p.coords.speed,
          heading: p.coords.heading,
        });
        setUnavailable(false);
      },
      () => setUnavailable(true),
      WATCH_OPTS,
    );
  }, []);

  return { pos, unavailable };
}
