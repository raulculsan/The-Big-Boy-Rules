const CACHE_NAME = "big-boy-rules-v110";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=20260822-110",
  "./app.js?v=20260822-110",
  "./config.js?v=20260805-59",
  "./manifest.webmanifest?v=20260822-110",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok && ["script", "style", "image", "manifest"].includes(request.destination)) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }))
  );
});

self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { payload = {body: event.data?.text() || "Tienes una notificación nueva."}; }
  event.waitUntil(self.registration.showNotification(payload.title || "The Big Boy Rules", {
    body: payload.body || "Tienes una notificación nueva.",
    icon: payload.icon || "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    tag: payload.tag || "big-boy-notification",
    renotify: true,
    data: {url: payload.url || "./"}
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "./", self.registration.scope).href;
  event.waitUntil(clients.matchAll({type: "window", includeUncontrolled: true}).then(openClients => {
    const existing = openClients.find(client => new URL(client.url).origin === new URL(targetUrl).origin);
    if (existing) return existing.navigate(targetUrl).then(client => client?.focus());
    return clients.openWindow(targetUrl);
  }));
});
