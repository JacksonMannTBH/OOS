"use client";

import { Capacitor } from "@capacitor/core";
import { Geolocation, type GeolocationPlugin, type Position } from "@capacitor/geolocation";

export type DeviceLocationError = { code: number; message: string };
export type DevicePosition = {
  timestamp: number;
  coords: Pick<Position["coords"], "latitude" | "longitude" | "accuracy" | "altitudeAccuracy" | "altitude" | "speed" | "heading">;
};
type OnPosition = (position: DevicePosition) => void;
type OnError = (error: DeviceLocationError) => void;

function locationError(error: unknown): DeviceLocationError {
  const detail = error as { code?: unknown; message?: unknown } | null;
  const code = detail?.code;
  return {
    code: code === 1 || code === "OS-PLUG-GLOC-0003" ? 1
      : code === 3 || code === "OS-PLUG-GLOC-0010" ? 3 : 2,
    message: typeof detail?.message === "string" ? detail.message : "Location unavailable",
  };
}

// A small injectable boundary keeps the browser and native permission paths
// consistent and lets us verify cleanup when a native watch starts asynchronously.
export function createDeviceLocation(
  native: Pick<GeolocationPlugin, "getCurrentPosition" | "watchPosition" | "clearWatch"> | null,
  browser?: globalThis.Geolocation,
) {
  return {
    async current(options: PositionOptions = {}): Promise<DevicePosition> {
      try {
        if (native) return await native.getCurrentPosition(options);
        if (!browser) throw new Error("Location unavailable");
        return await new Promise<DevicePosition>((resolve, reject) => {
          browser.getCurrentPosition(resolve, reject, options);
        });
      } catch (error) {
        throw locationError(error);
      }
    },
    watch(onPosition: OnPosition, onError: OnError, options: PositionOptions = {}): () => void {
      let stopped = false;
      let nativeId: string | undefined;
      const fail = (error: unknown) => { if (!stopped) onError(locationError(error)); };
      if (native) {
        void native.watchPosition(options, (position, error) => {
          if (stopped) return;
          if (error) fail(error);
          else if (position) onPosition(position);
        }).then((id) => {
          if (stopped) void native.clearWatch({ id }).catch(() => undefined);
          else nativeId = id;
        }).catch(fail);
        return () => {
          stopped = true;
          if (nativeId !== undefined) {
            void native.clearWatch({ id: nativeId }).catch(() => undefined);
            nativeId = undefined;
          }
        };
      }
      if (!browser) {
        fail(new Error("Location unavailable"));
        return () => { stopped = true; };
      }
      const id = browser.watchPosition(
        (position) => { if (!stopped) onPosition(position); }, fail, options,
      );
      return () => {
        if (stopped) return;
        stopped = true;
        browser.clearWatch(id);
      };
    },
  };
}

function deviceLocation() {
  return createDeviceLocation(
    Capacitor.isNativePlatform() ? Geolocation : null,
    typeof navigator === "undefined" ? undefined : navigator.geolocation,
  );
}

export function getCurrentDevicePosition(options?: PositionOptions): Promise<DevicePosition> {
  return deviceLocation().current(options);
}

export function watchDevicePosition(onPosition: OnPosition, onError: OnError, options?: PositionOptions): () => void {
  return deviceLocation().watch(onPosition, onError, options);
}
