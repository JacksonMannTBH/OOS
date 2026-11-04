// Admin pages always use the network so authenticated results stay current.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => new Response(
    '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OOS Admin · Offline</title><body style="background:#020202;color:#eee;font:16px system-ui;padding:32px"><h1>You’re offline</h1><p>Connect to the internet to load current API results.</p><a style="color:#7bdcb0" href="/admin/requests">Try again</a></body></html>',
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  )));
});
