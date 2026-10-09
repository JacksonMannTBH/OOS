"use client";

import { useCallback } from "react";
import { useDeviceHeading } from "./useDeviceHeading";
import { getCurrentDevicePosition } from "@/lib/device-location";

function requestLocationOnce(): Promise<boolean> {
  return getCurrentDevicePosition({ enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 })
    .then(() => true, () => false);
}

export function useRideLaunchPreflight(): () => Promise<void> {
  const heading = useDeviceHeading();

  return useCallback(async () => {
    await Promise.allSettled([
      requestLocationOnce(),
      heading.requestPermission(),
    ]);
  }, [heading]);
}
