const CACHE_NAME = "big-boy-rules-v348";
const APP_SHELL = [
  "./",
  "./index.html",
  "./account-security.js?v=20261018-security-336",
  "./account-security.css?v=20261018-security-336",
  "./account-requests.js?v=20261018-requests-342",
  "./account-requests.css?v=20261018-requests-342",
  "./app-health.js?v=20261017-startup-logs-331",
  "./app-health.css?v=20261016-improvements-319",
  "./styles.css?v=20261016-improvements-319",
  "./visual-system.css?v=20261019-home-preview-347",
  "./notifications.css?v=20261015-notifications-polls-307",
  "./club.css?v=20261019-members-startup-348",
  "./icons/mascot/chota-v2/chota-poses.png",
  "./icons/mascot/chota-v2/chota-talk.png",
  "./news.css?v=20261014-home-scroll-291",
  "./achievement-admin.css?v=20261011-256",
  "./achievement-progress.js?v=20261010-244",
  "./achievement-admin.js?v=20261010-244",
  "./chat.css?v=20261016-push-prepared-318",
  "./chat-themes.css?v=20261012-277",
  "./chat-themes.js?v=20261010-241",
  "./chat-theme-catalog.json?v=20261010-241",
  "./icons/chat-backgrounds/big-boy.svg",
  "./icons/chat-backgrounds/carbono.svg",
  "./icons/chat-backgrounds/papel.svg",
  "./icons/chat-backgrounds/oceano.svg",
  "./icons/chat-backgrounds/bosque.svg",
  "./icons/chat-backgrounds/arena.svg",
  "./icons/chat-backgrounds/aurora.svg",
  "./icons/chat-backgrounds/vice-city.svg",
  "./icons/chat-backgrounds/orbita.svg",
  "./chat-keyboard.js?v=20261016-improvements-319",
  "./vendor/capacitor.js?v=8.5.0",
  "./chat-motion.js?v=20260902-128",
  "./club-model.js?v=20260902-126",
  "./tab-navigation.js?v=20260903-130",
  "./admin-console.js?v=20261018-control-342",
  "./admin-console.css?v=20261018-control-337",
  "./app.js?v=20261019-members-startup-348",
  "./spotify-player.js?v=20261017-bounded-reconnect-331",
  "./spotify-player.css?v=20261014-balanced",
  "./album.js?v=20261016-release-323",
  "./album.css?v=20261016-release-323",
  "./onboarding.js?v=20261016-improvements-319",
  "./onboarding.css?v=20261016-improvements-319",
  "./admin-grants.js?v=20261018-password-335",
  "./admin-grants.css?v=20261009-213",
  "./banner-shop.js?v=20261019-members-startup-348",
  "./banner-shop.css?v=20261019-pack-summary-345",
  "./collection-social.js?v=20261016-release-322",
  "./collection-social.css?v=20261015-mutual-trades-305",
  "./pending-actions.js?v=20261016-release-322",
  "./pending-actions.css?v=20261016-release-322",
  "./group-interactions.js?v=20261016-release-322",
  "./group-interactions.css?v=20261015-poll-focus-315",
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
  "./daily-packs.js?v=20261010-251",
  "./packs.css?v=20261016-improvements-319",
  "./card-thumbnails.js?v=20261016-juan-manuel-321",
  "./card-media.js?v=20261016-release-322",
  "./card-collection.js?v=20261016-release-322",
  "./icons/cards/raul-culsan-gonzalez-full-art-92-playa-v5.jpg",
  "./icons/cards/ruben-king-vice-city-96-v2.jpg",
  "./icons/cards/cristobal-fabrik-vice-city-91-v2.jpg",
  "./icons/cards/cristobal-fabrik-comun-75-v1.jpg",
  "./icons/cards/juan-carlos-vega-quevedo-comun-78-v1.jpg",
  "./icons/cards/fufi-comun-77-v1.jpg",
  "./icons/cards/fufi-vice-city-89-v3.jpg",
  "./icons/cards/azul-comun-77-v1.jpg",
  "./icons/cards/francisco-trigo-vice-city-90-v2.jpg",
  "./icons/cards/miguel-angel-jimenez-sanchez-full-art-92-v1.jpg",
  "./icons/cards/reverso-vice-city-unificado-v1.jpg",
  "./icons/cards/peru-comun-v1.jpg",
  "./icons/cards/hospital-12-de-octubre-comun-v1.jpg",
  "./icons/cards/caonabo-alberto-full-art-88-v1.jpg",
  "./icons/cards/felipe-hp-full-art-87-v4.jpg",
  "./icons/cards/carlos-gonzalez-motos-full-art-89-v3.jpg",
  "./icons/cards/almudena-de-diego-matilla-full-art-91-v4.jpg",
  "./icons/cards/mario-salvatierra-medina-full-art-88-v2.jpg",
  "./icons/cards/daniel-gonzalez-motos-full-art-87-v1.jpg",
  "./icons/cards/justificante-medico-comun-v1.jpg",
  "./icons/cards/jeringuilla-comun-v1.jpg",
  "./icons/cards/alberto-velasco-full-art-84-v2.jpg",
  "./collection-motion.js?v=20261016-performance-320",
  "./icons/cards/card-touch.json?v=20260905-153",
  "./icons/cards/card-touch-epic.json?v=20261007-168",
  "./icons/cards/card-touch-special.json?v=20261012-272",
  "./icons/cards/card-touch-legendary.json?v=20260905-153",
  "./icons/cards/card-touch-retro.json?v=20261007-163",
  "./icons/cards/pack-opening.json?v=20260904-150",
  "./icons/cards/pack-seal-flare-v2.png",
  "./icons/cards/jose-enrique-fernandez-cruz-comun-86-v4.jpg",
  "./icons/cards/jose-enrique-fernandez-cruz-full-art-93-v3.jpg",
  "./icons/cards/reverso-full-art-unificado-v1.jpg",
  "./icons/cards/jose-enrique-fernandez-cruz-normal-86-reverso-v1.jpg",
  "./icons/cards/miguel-angel-jimenez-sanchez-comun-83-v4.jpg",
  "./icons/cards/miguel-angel-jimenez-sanchez-normal-83-reverso-v1.jpg",
  "./icons/cards/lizzy-machado-yong-comun-81-v1.jpg",
  "./icons/cards/lizzy-machado-yong-full-art-85-v1.jpg",
  "./icons/cards/lizzy-machado-yong-comun-81-reverso-v1.jpg",
  "./icons/cards/raul-culsan-gonzalez-comun-83-v4.jpg",
  "./icons/cards/raul-culsan-gonzalez-normal-83-reverso-v2.jpg",
  "./icons/cards/mario-salvatierra-medina-comun-81-v1.jpg",
  "./icons/cards/mario-salvatierra-medina-comun-81-reverso-v1.jpg",
  "./icons/cards/almudena-de-diego-matilla-comun-84-v1.jpg",
  "./icons/cards/almudena-de-diego-matilla-comun-84-reverso-v1.jpg",
  "./icons/cards/caonabo-alberto-comun-82-v4.jpg",
  "./icons/cards/caonabo-alberto-normal-82-reverso-v1.jpg",
  "./icons/cards/alberto-velasco-comun-79-v4.jpg",
  "./icons/cards/alberto-velasco-normal-79-reverso-v1.jpg",
  "./icons/cards/carlos-gonzalez-motos-comun-82-v4.jpg",
  "./icons/cards/carlos-gonzalez-motos-normal-82-reverso-v3.jpg",
  "./icons/cards/felipe-hp-comun-80-v4.jpg",
  "./icons/cards/felipe-hp-normal-80-reverso-v1.jpg",
  "./icons/cards/daniel-gonzalez-motos-comun-80-v4.jpg",
  "./icons/cards/daniel-gonzalez-motos-normal-80-reverso-v1.jpg",
  "./icons/cards/borox-legendaria-v3.jpg",
  "./icons/cards/borox-legendaria-reverso-v3.jpg",
  "./icons/cards/luca-de-tena-especial-v2.jpg",
  "./icons/cards/luca-de-tena-especial-reverso-v1.jpg",
  "./icons/cards/abelias-comun-v1.jpg",
  "./icons/cards/abelias-comun-reverso-v1.jpg",
  "./icons/cards/castellana-legendaria-v1.jpg",
  "./icons/cards/castellana-legendaria-reverso-v1.jpg",
  "./icons/cards/borox-legendaria-v4.jpg",
  "./icons/cards/borox-legendaria-v5.jpg",
  "./icons/cards/castellana-legendaria-v2.jpg",
  "./icons/cards/carabanchel-legendaria-v1.jpg",
  "./icons/cards/galicia-legendaria-v1.jpg",
  "./icons/cards/josefa-valcarcel-epica-v1.jpg",
  "./icons/cards/stussy-madrid-epica-v2.jpg",
  "./icons/cards/abrantes-metro-comun-v1.jpg",
  "./icons/cards/plaza-eliptica-metro-comun-v1.jpg",
  "./icons/cards/fabrik-comun-v1.jpg",
  "./icons/cards/cuba-epica-v1.jpg",
  "./icons/cards/juan-manuel-perez-saldana-retro-90-v1.jpg",
  "./icons/cards/juan-carlos-vega-quevedo-retro-87-v1.jpg",
  "./icons/cards/carlos-sanchez-rodriguez-retro-88-v2.jpg",
  "./icons/cards/mesena-retro-v1.jpg",
  "./icons/cards/estadio-vicente-calderon-retro-v1.jpg",
  "./icons/cards/estadio-santiago-bernabeu-retro-v1.jpg",
  "./icons/cards/contrato-de-trabajo-comun-v1.jpg",
  "./icons/cards/titulacion-comun-v2.jpg",
  "./icons/cards/lata-de-red-bull-comun-v1.jpg",
  "./icons/cards/cafe-del-santander-comun-v1.jpg",
  "./icons/cards/test-de-embarazo-positivo-comun-v1.jpg",
  "./icons/cards/vater-comun-v1.jpg",
  "./icons/cards/satisfyer-comun-v1.jpg",
  "./icons/cards/la-biblia-epica-v1.jpg",
  "./icons/cards/sombrero-militar-epico-v1.jpg",
  "./icons/cards/gafas-vision-nocturna-epicas-v1.jpg",
  "./icons/cards/bote-de-nutella-epico-v1.jpg",
  "./icons/cards/ceviche-epico-v1.jpg",
  "./icons/cards/locker-luca-de-tena-legendario-v1.jpg",
  "./icons/cards/cruz-anticristo-legendaria-v1.jpg",
  "./icons/cards/big-mac-legendario-v1.jpg",
  "./icons/cards/cubo-de-alitas-kfc-legendario-v1.jpg",
  "./icons/cards/trofeo-champions-legendario-v1.jpg",
  "./icons/cards/ticket-de-viaje-a-roma-legendario-v1.jpg",
  "./icons/cards/reverso-retro-unificado-v1.jpg",
  "./icons/cards/reverso-comun-unificado-v1.jpg",
  "./icons/cards/reverso-especial-unificado-v1.jpg",
  "./icons/cards/reverso-especial-unificado-v2.jpg",
  "./icons/cards/el-retiro-especial-v1.jpg",
  "./icons/cards/bajos-de-arguelles-especial-v1.jpg",
  "./icons/cards/ikea-la-gavia-especial-v1.jpg",
  "./icons/cards/pistola-de-balines-especial-v1.jpg",
  "./icons/cards/mochila-carhartt-especial-v1.jpg",
  "./icons/cards/reverso-legendario-unificado-v1.jpg",
  "./icons/cards/sobre-los-nuestros-v1.jpg?v=20260903-139",
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
  "./config.js?v=20261008-210",
  "./manifest.webmanifest?v=20260901-125",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

// Card illustrations, banner sprites and trophy renders are downloaded only
// when viewed. They must never delay installing/updating the executable shell.
const CORE_SHELL = APP_SHELL.filter(asset => !asset.startsWith("./icons/cards/") && !asset.startsWith("./icons/banners/") && !asset.startsWith("./icons/trophies/") && !asset.startsWith("./icons/mascot/"));

// Reuse exact versioned executable URLs across releases. HTML and unversioned
// configuration always come from the network so a release cannot inherit old entrypoints.
async function installShell() {
  const cache = await caches.open(CACHE_NAME);
  const previousNames = (await caches.keys()).filter(key => /^big-boy-rules-v\d+$/.test(key) && key !== CACHE_NAME)
    .sort((a,b) => Number(b.split('-v').at(-1)) - Number(a.split('-v').at(-1)));
  const previousCaches = await Promise.all(previousNames.map(name => caches.open(name)));
  let cursor = 0;
  // Keep update traffic below the foreground app's own requests.
  await Promise.all(Array.from({length:2}, async () => {
    while (cursor < CORE_SHELL.length) {
      const asset = CORE_SHELL[cursor++], url = new URL(asset, self.registration.scope);
      let response;
      if (url.searchParams.has('v')) {
        for (const oldCache of previousCaches) {
          response = await oldCache.match(url.href);
          if (response?.ok) break;
        }
      }
      if (!response?.ok) response = await fetch(new Request(url.href, {cache:'reload'}));
      if (!response.ok) throw new Error(`Shell unavailable: ${url.pathname}`);
      await cache.put(url.href, response);
    }
  }));
  // Make this release available on the next navigation, even if another tab
  // stays open. Do not claim existing documents or reload an active session.
  await self.skipWaiting();
}
self.addEventListener("install", event => event.waitUntil(installShell().catch(async error => {
  // A failed update leaves the previous complete release available offline.
  await caches.delete(CACHE_NAME);
  throw error;
})));

// Public illustrations are independent of executable release caches. Exact
// URLs include the artwork version; user uploads/API responses never enter it.
const MEDIA_CACHE_NAME = "big-boy-rules-public-media-v1";
const MEDIA_MAX_ENTRIES = 120, MEDIA_MAX_BYTES = 48 * 1024 * 1024;
const MEDIA_MAX_FILE_BYTES = 6 * 1024 * 1024, MEDIA_FRESH_MS = 24 * 60 * 60 * 1000;
const workerScope = () => new URL(self.registration?.scope || "./", self.location?.href || self.location.origin);
const mediaPath = request => {
  const scopeUrl = workerScope();
  const url = new URL(request.url || request, scopeUrl);
  if (url.origin !== scopeUrl.origin || !url.pathname.startsWith(scopeUrl.pathname)) return false;
  const path = url.pathname.slice(scopeUrl.pathname.length);
  return /^icons\/(?:cards|banners|trophies|chat-backgrounds|mascot)\/[^?]+\.(?:png|webp|jpg|jpeg|svg|json)$/i.test(path);
};
let shellUrls;
let mediaWrite = Promise.resolve();
let mediaEntries = new Map();
// Reconcile keys cheaply on writes, but read response metadata only for entries
// this worker has not seen. Worker restarts rebuild this index lazily once.
async function reconcileMediaEntries(cache) {
  const keys = await cache.keys(), entries = new Map(), duplicates = new Set(), uniqueKeys = [];
  for (const key of keys) {
    if (entries.has(key.url)) { duplicates.add(key.url); continue; }
    entries.set(key.url, mediaEntries.get(key.url) || null);
    uniqueKeys.push(key);
  }
  await Promise.all(uniqueKeys.map(async key => {
    if (duplicates.has(key.url) || entries.get(key.url)) return;
    const cached = await cache.match(key);
    if (!cached) { entries.delete(key.url); return; }
    const recorded = cached.headers.get("x-big-boy-cache-bytes");
    let bytes = Number(recorded);
    // Older or malformed entries must not silently count as zero bytes.
    if (recorded === null || !Number.isSafeInteger(bytes) || bytes < 0) bytes = (await cached.blob()).size;
    if (!mediaPath(key) || /(?:private|no-store)/i.test(cached.headers.get("cache-control") || "") || bytes > MEDIA_MAX_FILE_BYTES) {
      await cache.delete(key);
      entries.delete(key.url);
      return;
    }
    entries.set(key.url, {request:key, bytes});
  }));
  // Static artwork needs one version per exact URL; remove legacy Vary
  // duplicates rather than undercounting multiple responses for one URL.
  for (const url of duplicates) {
    await cache.delete(url,{ignoreVary:true});
    entries.delete(url);
  }
  for (const [url, entry] of entries) {
    if (!entry) entries.delete(url);
  }
  mediaEntries = entries;
}
function savePublicMedia(request, response) {
  const copy = response.clone();
  mediaWrite = mediaWrite.catch(() => {}).then(async () => {
    if (!response.ok || !mediaPath(request) || /(?:private|no-store)/i.test(response.headers.get("cache-control") || "")) return;
    const blob = await copy.blob();
    if (blob.size > MEDIA_MAX_FILE_BYTES) return;
    const headers = new Headers(copy.headers);
    headers.set("x-big-boy-cache-bytes", String(blob.size));
    headers.set("x-big-boy-cache-time", String(Date.now()));
    const cache = await caches.open(MEDIA_CACHE_NAME);
    await reconcileMediaEntries(cache);
    // Reinsertion refreshes FIFO order without a costly write on each hit.
    const mediaUrl = new URL(request.url || request, workerScope()).href;
    const mediaRequest = typeof Request === "function" ? new Request(mediaUrl) : {url:mediaUrl};
    await cache.delete(mediaRequest,{ignoreVary:true});
    mediaEntries.delete(mediaRequest.url);
    let bytes = Array.from(mediaEntries.values()).reduce((sum,entry) => sum + entry.bytes, 0);
    // Make room before put: a quota/write failure cannot leave us over budget.
    for (const [url,entry] of mediaEntries) {
      if (bytes + blob.size <= MEDIA_MAX_BYTES && mediaEntries.size < MEDIA_MAX_ENTRIES) break;
      await cache.delete(entry.request,{ignoreVary:true});
      bytes -= entry.bytes;
      mediaEntries.delete(url);
    }
    await cache.put(mediaRequest, new Response(blob, {status:copy.status,statusText:copy.statusText,headers}));
    mediaEntries.set(mediaRequest.url,{request:mediaRequest,bytes:blob.size});
  }).catch(error => {
    // A partial Cache API failure may invalidate the index. Rebuild next time.
    mediaEntries = new Map();
    throw error;
  });
  // Cache failures must not break rendering or prevent an update activating.
  return mediaWrite.catch(() => {});
}
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    // An open document can still use its previous controller. Keep that
    // release's exact dependencies until the following update.
    const previousKeys = (await caches.keys()).filter(key => /^big-boy-rules-v\d+$/.test(key) && key !== CACHE_NAME)
      .sort((a,b) => Number(b.split('-v').at(-1)) - Number(a.split('-v').at(-1)));
    const oldKeys = previousKeys.slice(1);
    const mediaCache = oldKeys.length ? await caches.open(MEDIA_CACHE_NAME) : null;
    for (const cacheKey of oldKeys) {
      const oldCache = await caches.open(cacheKey);
      const requests = await oldCache.keys();
      for (const req of requests) {
        if (!mediaPath(req) || await mediaCache.match(req)) continue;
        const res = await oldCache.match(req);
        if (res) await savePublicMedia(req, res);
      }
    }
    await Promise.all(oldKeys.map(key => caches.delete(key)));
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // A refresh must not revert a network-loaded page to an older installed
    // release. Versioned scripts remain exact; the installed HTML is reserved
    // for offline use and is not overwritten by a partly downloaded release.
    event.respondWith((async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      try {
        const response = await fetch(request, {cache:"no-store", signal:controller.signal});
        if (response.ok) return response;
      } catch { /* Use the complete installed release when offline. */ }
      finally { clearTimeout(timeout); }
      const cache = await caches.open(CACHE_NAME);
      return await cache.match(new URL("./index.html", self.registration.scope).href) || fetch(request);
    })());
    return;
  }
  if (mediaPath(request)) {
    event.respondWith((async () => {
      const cache = await caches.open(MEDIA_CACHE_NAME), cached = await cache.match(request);
      const fresh = cached && Date.now() - Number(cached.headers.get("x-big-boy-cache-time")) < MEDIA_FRESH_MS;
      if (cached) {
        if (!fresh) event.waitUntil(fetch(request).then(response => savePublicMedia(request,response)).catch(() => {}));
        return cached;
      }
      const response = await fetch(request);
      if (response.ok) event.waitUntil(savePublicMedia(request,response));
      return response;
    })());
    return;
  }
  // Never retain arbitrary same-origin images or media: these may be private
  // attachments. Only the explicit executable/static shell is cacheable here.
  shellUrls ||= new Set(CORE_SHELL.map(asset => new URL(asset, workerScope()).href));
  if (!shellUrls.has(url.href)) return;
  event.respondWith(caches.open(CACHE_NAME).then(async cache => {
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) event.waitUntil(cache.put(request,response.clone()).catch(() => {}));
    return response;
  }));
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
