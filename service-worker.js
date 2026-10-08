const CACHE_NAME = "big-boy-rules-v200";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=20261007-193",
  "./club.css?v=20261007-187",
  "./achievement-admin.css?v=20260903-135",
  "./achievement-progress.js?v=20260908-156",
  "./achievement-admin.js?v=20260908-156",
  "./chat.css?v=20261007-192",
  "./chat-keyboard.js?v=20260902-129",
  "./vendor/capacitor.js?v=8.5.0",
  "./chat-motion.js?v=20260902-128",
  "./club-model.js?v=20260902-126",
  "./tab-navigation.js?v=20260903-130",
  "./app.js?v=20261007-193",
  "./album.js?v=20261008-200",
  "./album.css?v=20261008-200",
  "./admin-grants.js?v=20261007-176",
  "./admin-grants.css?v=20261007-176",
  "./banner-shop.js?v=20261008-200",
  "./banner-shop.css?v=20261008-200",
  "./icons/banners/miguel-basket-bano-bg-v1.png",
  "./icons/banners/miguel-basket-bano-v1.png",
  "./icons/banners/miguel-basket-miguel-00-v1.png",
  "./icons/banners/miguel-basket-miguel-00a-v1.png",
  "./icons/banners/miguel-basket-miguel-01-v1.png",
  "./icons/banners/miguel-basket-miguel-01a-v1.png",
  "./icons/banners/miguel-basket-miguel-02-v1.png",
  "./icons/banners/miguel-basket-miguel-02a-v1.png",
  "./icons/banners/miguel-basket-miguel-03-v1.png",
  "./icons/banners/miguel-moto-rider-v2.png",
  "./icons/banners/miguel-moto-city-v1.png",
  "./icons/banners/miguel-moto-clouds-v1.png",
  "./icons/banners/alberto-galicia-bg-v1.png",
  "./icons/banners/alberto-galicia-figures-v1.png",
  "./icons/banners/alberto-galicia-expression-v2.png",
  "./icons/banners/alberto-galicia-anime-preview-v1.png",
  "./icons/banners/alberto-galicia-member-v1.png",
  "./icons/banners/alberto-galicia-member-bg-v1.png",
  "./icons/banners/alberto-galicia-member-figures-v1.png",
  "./daily-packs.js?v=20261007-192",
  "./packs.css?v=20261008-200",
  "./card-collection.js?v=20261007-191",
  "./collection-motion.js?v=20261007-168",
  "./icons/cards/card-touch.json?v=20260905-153",
  "./icons/cards/card-touch-epic.json?v=20261007-168",
  "./icons/cards/card-touch-special.json?v=20260905-153",
  "./icons/cards/card-touch-legendary.json?v=20260905-153",
  "./icons/cards/card-touch-retro.json?v=20261007-163",
  "./icons/cards/pack-opening.json?v=20260904-150",
  "./icons/cards/jose-enrique-fernandez-cruz-comun-86-v4.png",
  "./icons/cards/jose-enrique-fernandez-cruz-normal-86-reverso-v1.png",
  "./icons/cards/miguel-angel-jimenez-sanchez-comun-83-v4.png",
  "./icons/cards/miguel-angel-jimenez-sanchez-normal-83-reverso-v1.png",
  "./icons/cards/lizzy-machado-yong-comun-81-v1.png",
  "./icons/cards/lizzy-machado-yong-comun-81-reverso-v1.png",
  "./icons/cards/raul-culsan-gonzalez-comun-83-v4.png",
  "./icons/cards/raul-culsan-gonzalez-normal-83-reverso-v2.png",
  "./icons/cards/mario-salvatierra-medina-comun-81-v1.png",
  "./icons/cards/mario-salvatierra-medina-comun-81-reverso-v1.png",
  "./icons/cards/almudena-de-diego-matilla-comun-84-v1.png",
  "./icons/cards/almudena-de-diego-matilla-comun-84-reverso-v1.png",
  "./icons/cards/caonabo-alberto-comun-82-v4.png",
  "./icons/cards/caonabo-alberto-normal-82-reverso-v1.png",
  "./icons/cards/alberto-velasco-comun-79-v4.png",
  "./icons/cards/alberto-velasco-normal-79-reverso-v1.png",
  "./icons/cards/carlos-gonzalez-motos-comun-82-v4.png",
  "./icons/cards/carlos-gonzalez-motos-normal-82-reverso-v3.png",
  "./icons/cards/felipe-hp-comun-80-v4.png",
  "./icons/cards/felipe-hp-normal-80-reverso-v1.png",
  "./icons/cards/daniel-gonzalez-motos-comun-80-v4.png",
  "./icons/cards/daniel-gonzalez-motos-normal-80-reverso-v1.png",
  "./icons/cards/borox-legendaria-v3.png",
  "./icons/cards/borox-legendaria-reverso-v3.png",
  "./icons/cards/luca-de-tena-especial-v1.png",
  "./icons/cards/luca-de-tena-especial-reverso-v1.png",
  "./icons/cards/abelias-comun-v1.png",
  "./icons/cards/abelias-comun-reverso-v1.png",
  "./icons/cards/castellana-legendaria-v1.png",
  "./icons/cards/castellana-legendaria-reverso-v1.png",
  "./icons/cards/borox-legendaria-v4.png",
  "./icons/cards/borox-legendaria-v5.png",
  "./icons/cards/castellana-legendaria-v2.png",
  "./icons/cards/carabanchel-legendaria-v1.png",
  "./icons/cards/galicia-legendaria-v1.png",
  "./icons/cards/josefa-valcarcel-epica-v1.png",
  "./icons/cards/juan-manuel-perez-saldana-retro-90-v1.png",
  "./icons/cards/juan-carlos-vega-quevedo-retro-87-v1.png",
  "./icons/cards/carlos-sanchez-rodriguez-retro-88-v2.png",
  "./icons/cards/mesena-retro-v1.png",
  "./icons/cards/contrato-de-trabajo-comun-v1.png",
  "./icons/cards/lata-de-red-bull-comun-v1.png",
  "./icons/cards/cafe-del-santander-comun-v1.png",
  "./icons/cards/test-de-embarazo-positivo-comun-v1.png",
  "./icons/cards/vater-comun-v1.png",
  "./icons/cards/la-biblia-epica-v1.png",
  "./icons/cards/sombrero-militar-epico-v1.png",
  "./icons/cards/bote-de-nutella-epico-v1.png",
  "./icons/cards/ceviche-epico-v1.png",
  "./icons/cards/locker-luca-de-tena-legendario-v1.png",
  "./icons/cards/big-mac-legendario-v1.png",
  "./icons/cards/cubo-de-alitas-kfc-legendario-v1.png",
  "./icons/cards/trofeo-champions-legendario-v1.png",
  "./icons/cards/ticket-de-viaje-a-roma-legendario-v1.png",
  "./icons/cards/reverso-retro-unificado-v1.png",
  "./icons/cards/reverso-comun-unificado-v1.png",
  "./icons/cards/reverso-especial-unificado-v1.png",
  "./icons/cards/reverso-legendario-unificado-v1.png",
  "./icons/cards/sobre-los-nuestros-v1.png?v=20260903-139",
  "./trophy-motion.js?v=20260904-150",
  "./trophy-unlock.js?v=20260903-138",
  "./vendor/lottie-light.min.js?v=5.13.0",
  ...["bronze", "silver", "gold", "platinum"].flatMap(tier => [
    `./icons/trophies/${tier}.svg?v=20260903-132`,
    `./icons/trophies/${tier}.json?v=20260903-132`,
    `./icons/trophies/${tier}-unlock.json?v=20260903-138`
  ]),
  "./vendor/supabase.js?v=20260901-125",
  "./vendor/fonts/anton-latin.woff2",
  "./vendor/fonts/inter-latin.woff2",
  "./config.js?v=20260805-59",
  "./manifest.webmanifest?v=20260901-125",
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

  if (["script", "style", "font", "manifest"].includes(request.destination)) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok && ["script", "style", "font", "image", "manifest"].includes(request.destination)) {
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
