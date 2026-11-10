"use client";

import { Capacitor } from "@capacitor/core";
import { Geolocation, type GeolocationPlugin, type Position } from "@capacitor/geolocation";
import { sharedNativeLocation } from "./shared-native-location";

export type DeviceLocationError = { code: number; message: string };
export type DevicePosition = {
  timestamp: number;
  coords: Pick<Position["coords"], "latitude" | "longitude" | "accuracy" | "altitudeAccuracy" | "altitude" | "speed" | "heading">;
};
type OnPosition = (position: DevicePosition) => void;
type OnError = (error: DeviceLocationError) => void;
type LocationVisibility = Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;

// UI subscribers are foreground-only; recording and Live Tracking subscribe
// to the same iOS service with their own background leases.
export function watchWhileVisible(start: () => () => void, page?: LocationVisibility): () => void {
  if (!page) return start();
  let stopped = false;
  let paused = false;
  let stopWatch: (() => void) | undefined;
  const sync = () => {
    if (stopped || paused || page.visibilityState !== "visible") {
      const stop = stopWatch;
      stopWatch = undefined;
      stop?.();
    } else if (!stopWatch) {
      stopWatch = start();
    }
  };
  const pause = () => { paused = true; sync(); };
  const resume = () => { paused = false; sync(); };
  page.addEventListener("visibilitychange", sync);
  // Capacitor emits these native scene lifecycle events on document, including
  // when WebKit's visibility event is delayed during an app switch or lock.
  page.addEventListener("pause", pause);
  page.addEventListener("resume", resume);
  sync();
  return () => {
    stopped = true;
    sync();
    page.removeEventListener("visibilitychange", sync);
    page.removeEventListener("pause", pause);
    page.removeEventListener("resume", resume);
  };
}

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
  page?: LocationVisibility,
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
      return watchWhileVisible(() => {
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
      }, page);
    },
  };
}

function deviceLocation() {
  return createDeviceLocation(
    Capacitor.isNativePlatform()
      ? Capacitor.getPlatform() === "ios" && Capacitor.isPluginAvailable("OOSLocation")
        ? sharedNativeLocation : Geolocation
      : null,
    typeof navigator === "undefined" ? undefined : navigator.geolocation,
    typeof document === "undefined" ? undefined : document,
  );
}

export function getCurrentDevicePosition(options?: PositionOptions): Promise<DevicePosition> {
  return deviceLocation().current(options);
}

export function watchDevicePosition(onPosition: OnPosition, onError: OnError, options?: PositionOptions): () => void {
  return deviceLocation().watch(onPosition, onError, options);
}
