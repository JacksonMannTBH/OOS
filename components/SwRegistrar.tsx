"use client";

// Registers the static /sw.js service worker on every page load. This remains
// for PWA install/update behavior only.

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { notificationPath } from "@/lib/notification-url";

export function SwRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (Capacitor.isNativePlatform()) {
      const listener = PushNotifications.addListener(
        "pushNotificationActionPerformed",
        ({ notification }) => {
          const url = notificationPath(notification.data?.url, window.location.href);
          if (url) {
            window.location.assign(url);
          }
        },
      );
      return () => {
        void listener.then((handle) => handle.remove()).catch(() => undefined);
      };
    }
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* silent: PWA registration should fail gracefully */
    });
  }, []);
  return null;
}
