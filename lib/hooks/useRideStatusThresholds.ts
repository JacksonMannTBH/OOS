"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_RIDE_STATUS_THRESHOLDS,
  type RideStatusThresholds,
} from "../ride-mode";
import {
  getRideStatusThresholds,
  RIDE_STATUS_THRESHOLDS_EVENT,
  RIDE_STATUS_THRESHOLDS_KEY,
} from "../ride-settings";

export function useRideStatusThresholds(): RideStatusThresholds {
  const [thresholds, setThresholds] = useState<RideStatusThresholds>(
    DEFAULT_RIDE_STATUS_THRESHOLDS,
  );

  useEffect(() => {
    const refresh = () => setThresholds(getRideStatusThresholds());
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === RIDE_STATUS_THRESHOLDS_KEY) refresh();
    };

    refresh();
    window.addEventListener(RIDE_STATUS_THRESHOLDS_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(RIDE_STATUS_THRESHOLDS_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return thresholds;
}
