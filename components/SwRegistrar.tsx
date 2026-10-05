"use client";

// Registers the static /sw.js service worker on every page load. This remains
// for PWA install/update behavior only.

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

export function SwRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
      const listener = PushNotifications.addListener(
        "pushNotificationActionPerformed",
        ({ notification }) => {
          const url = notification.data?.url;
          if (typeof url === "string" && url.startsWith("/")) {
            window.location.assign(url);
          }
        },
      );
      return () => {
        void listener.then((handle) => handle.remove());
      };
    }
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* silent: PWA registration should fail gracefully */
    });
  }, []);
  return null;
}
