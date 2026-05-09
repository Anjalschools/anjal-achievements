/* PWA shell — safe no-op; extend with workbox or precache later. */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  /* network-first; offline shells can be layered without blocking SSR */
});
