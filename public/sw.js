// Out Of Sight service worker.
// Kept only for PWA install/update behavior.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const payload = readPayload(event);
  event.waitUntil(
    self.registration.showNotification(payload.title || "Aircraft nearby", {
      body: payload.body || "Tracked aircraft active in your selected state.",
      tag: payload.tag || "aircraft-alert",
      renotify: false,
      icon: "/icons/out-of-sight-icon-192.png",
      badge: "/icons/out-of-sight-icon-192.png",
      data: {
        url: payload.url || "/map",
        aircraftTail: payload.aircraftTail || null,
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(
    event.notification.data?.url || "/map",
    self.location.origin,
  );
  event.waitUntil(openOrFocus(url.href));
});

function readPayload(event) {
  if (!event.data) return {};
  try {
    return event.data.json();
  } catch {
    return { body: event.data.text() };
  }
}

async function openOrFocus(url) {
  const windows = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  for (const client of windows) {
    const clientUrl = new URL(client.url);
    if (clientUrl.origin === self.location.origin) {
      await client.navigate(url);
      return client.focus();
    }
  }
  return self.clients.openWindow(url);
}
