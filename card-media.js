/* Native delivery: local previews, downloaded art retained in a bounded private cache. */
(() => {
  const native = Boolean(globalThis.Capacitor?.isNativePlatform?.()) || location.protocol === 'capacitor:';
  const manifest = globalThis.CardDelivery || {};
  const base = 'https://raulculsan.github.io/The-Big-Boy-Rules/';
  const limit = 32 * 1024 * 1024;
  let database, cacheWrites = Promise.resolve();
  const inflight = new Map(), objectURLs = new Map();
  const canonical = value => value?.startsWith(base) ? value.slice(base.length) : value;
  const source = value => native && manifest[value] ? new URL(manifest[value], base).href : value;
  const originals = new Map(native ? Object.keys(manifest).map(key => [source(key), key]) : []);
  const remoteFallbacks = new Map();
  function register(url, fallback) {if (typeof url === 'string' && url.startsWith('https://')) {originals.set(url,url);if (fallback && fallback !== url) remoteFallbacks.set(url,fallback);}}
  function db() {
    if (!database) database = new Promise((resolve, reject) => {
      const request = indexedDB.open('bb-card-art-v1', 2);
      request.onupgradeneeded = event => {
        const connection = request.result, transaction = request.transaction;
        if (!connection.objectStoreNames.contains('art')) connection.createObjectStore('art', {keyPath:'url'});
        const metadata = connection.createObjectStore('metadata', {keyPath:'url'});
        // Upgrade old caches one entry at a time. Never materialise the complete
        // artwork cache as an array of blobs just to calculate its budget.
        if (event.oldVersion) transaction.objectStore('art').openCursor().onsuccess = cursorEvent => {
          const cursor = cursorEvent.target.result;
          if (!cursor) return;
          const value = cursor.value;
          metadata.put({url:value.url, bytes:value.bytes || value.blob?.size || 0, touched:value.touched || 0});
          cursor.continue();
        };
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return database;
  }
  async function read(url) {
    const connection = await db();
    return new Promise((resolve, reject) => {
      const transaction = connection.transaction('art');
      const request = transaction.objectStore('art').get(url);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  function retain(url, blob) {
    if (blob.size > limit) return Promise.resolve();
    const task = cacheWrites.catch(() => {}).then(() => writeArtwork(url, blob));
    cacheWrites = task;
    return task;
  }
  async function writeArtwork(url, blob) {
    const connection = await db();
    await new Promise((resolve, reject) => {
      const transaction = connection.transaction(['art', 'metadata'], 'readwrite');
      const store = transaction.objectStore('art'), metadata = transaction.objectStore('metadata');
      const entry = {url, bytes:blob.size, touched:Date.now()};
      store.put({...entry, blob});
      metadata.put(entry);
      const request = metadata.getAll();
      request.onsuccess = () => {
        let total = request.result.reduce((sum, entry) => sum + entry.bytes, 0);
        for (const entry of request.result.sort((a,b) => a.touched - b.touched)) {
          if (total <= limit) break;
          store.delete(entry.url); metadata.delete(entry.url); total -= entry.bytes;
        }
      };
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  }
  async function art(url) {
    if (inflight.has(url)) return inflight.get(url);
    const task = (async () => {
      let cached;
      try { cached = await read(url); } catch {}
      if (cached?.blob) return cached.blob;
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(url, {cache:'force-cache', signal:controller.signal, credentials:'omit'});
        if (!response.ok) throw new Error('Card unavailable');
        const blob = await response.blob();
        if (!blob.type.startsWith('image/')) throw new Error('Invalid card media');
        void retain(url, blob).catch(() => {});
        return blob;
      } finally { clearTimeout(timer); }
    })();
    inflight.set(url, task);
    try { return await task; } finally { inflight.delete(url); }
  }
  function releaseUnused() {
    for (const [url, entry] of objectURLs) {
      for (const image of entry.images) if (!image.isConnected || image.src !== entry.objectURL) entry.images.delete(image);
      if (entry.images.size) continue;
      URL.revokeObjectURL(entry.objectURL); objectURLs.delete(url);
    }
    // Connected images own their URL until removed/replaced. Evicting a visible
    // thirteenth image revoked its live resource and could show a broken card.
  }
  function hydrate(image) {
    const value = image.getAttribute('src');
    if (image.dataset.cardMedia && value === remoteFallbacks.get(image.dataset.cardMedia)) return;
    const original = originals.get(value);
    if (!original || (image.dataset.cardMedia === value && inflight.has(value))) return;
    image.dataset.cardMedia = value;
    const fallback = remoteFallbacks.get(value) || globalThis.CardThumbnails?.[original];
    if (fallback) image.src = fallback;
    void art(value).then(blob => {
      if (!image.isConnected || image.dataset.cardMedia !== value) return;
      let entry = objectURLs.get(value);
      if (!entry) {
        entry = {objectURL:URL.createObjectURL(blob), images:new Set()};
        objectURLs.set(value, entry);
      }
      entry.images.add(image); image.src = entry.objectURL;
      releaseUnused();
    }).catch(() => {
      if (image.dataset.cardMedia !== value) return;
      delete image.dataset.cardMedia;
      // A newly published card may have an unavailable thumbnail. Its generic
      // placeholder is not a usable preview: retry the original face once.
      const originalFace = image.dataset.cardOriginal;
      if (image.isConnected && originalFace && originalFace !== value && fallback?.endsWith('card-art-unavailable.svg')) {
        delete image.dataset.cardOriginal;
        image.src = originalFace;
      }
      /* A real packaged preview stays available offline. */
    });
  }
  globalThis.CardMedia = Object.freeze({native, source, canonical, register});
  // Remote published artwork uses the same bounded disk cache on web and native.
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') hydrate(record.target);
      else for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.tagName === 'IMG') hydrate(node);
        node.querySelectorAll('img').forEach(hydrate);
      }
    }
    releaseUnused();
  });
  observer.observe(document.documentElement, {subtree:true, childList:true, attributes:true, attributeFilter:['src']});
})();
