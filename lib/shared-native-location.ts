import { registerPlugin } from "@capacitor/core";
import type { GeolocationPlugin, Position } from "@capacitor/geolocation";

type LocationEvent = { position?: Position; error?: { code: number; message: string } };
type SharedLocationBridge = {
  watchPosition(options: PositionOptions, callback: (event: LocationEvent, error?: unknown) => void): Promise<string>;
  clearWatch(options: { id: string }): Promise<void>;
};
const bridge = registerPlugin<SharedLocationBridge>("OOSLocation");

export function createSharedNativeLocation(native: SharedLocationBridge): Pick<GeolocationPlugin, "getCurrentPosition" | "watchPosition" | "clearWatch"> {
  const watchPosition: GeolocationPlugin["watchPosition"] = (options, callback) =>
    native.watchPosition(options, (event, error) => {
      if (error || event?.error) callback(null, error ?? event.error);
      else if (event?.position) callback(event.position);
    });
  return {
    watchPosition,
    clearWatch: options => native.clearWatch(options),
    getCurrentPosition: (options = {}) => new Promise<Position>((resolve, reject) => {
      let id: string | undefined;
      let finished = false;
      const clear = () => { if (id) void native.clearWatch({ id }).catch(() => undefined); };
      const finish = (position: Position | null, error?: unknown) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        clear();
        if (error) reject(error); else if (position) resolve(position);
      };
      const timer = setTimeout(() => finish(null, { code: 3, message: "Location request timed out" }), options.timeout ?? 15_000);
      void watchPosition(options, (position, error) => finish(position, error)).then(watchId => {
        id = watchId;
        if (finished) clear();
      }).catch(error => finish(null, error));
    }),
  };
}

export const sharedNativeLocation = createSharedNativeLocation(bridge);
