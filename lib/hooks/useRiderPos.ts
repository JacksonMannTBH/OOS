"use client";

import { useEffect, useRef, useState } from "react";

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
 * Subscribes to navigator.geolocation.watchPosition. Mounting this hook is
 * what triggers the permission prompt — only do that on rider-facing pages
 * (/map, /dash), never on the home glanceable.
 */
export function useRiderPos(): RiderState {
  const [pos, setPos] = useState<RiderPos | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setUnavailable(true);
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
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
    watchIdRef.current = id;
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { pos, unavailable };
}
