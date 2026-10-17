/* Native delivery: local previews, downloaded art retained in a bounded private cache. */
(() => {
  const native = Boolean(globalThis.Capacitor?.isNativePlatform?.()) || location.protocol === 'capacitor:';
  const manifest = globalThis.CardDelivery || {};
  const base = 'https://raulculsan.github.io/The-Big-Boy-Rules/';
  const limit = 32 * 1024 * 1024;
  let database;
  const inflight = new Map(), objectURLs = new Map();
  const canonical = value => value?.startsWith(base) ? value.slice(base.length) : value;
  const source = value => native && manifest[value] ? new URL(manifest[value], base).href : value;
  const originals = new Map(Object.keys(manifest).map(key => [source(key), key]));
  function db() {
    if (!database) database = new Promise((resolve, reject) => {
      const request = indexedDB.open('bb-card-art-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('art', {keyPath:'url'});
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
  async function retain(url, blob) {
    if (blob.size > limit) return;
    const connection = await db();
    await new Promise((resolve, reject) => {
      const transaction = connection.transaction('art', 'readwrite'), store = transaction.objectStore('art');
      store.put({url, blob, bytes:blob.size, touched:Date.now()});
      const request = store.getAll();
      request.onsuccess = () => {
        let total = request.result.reduce((sum, entry) => sum + entry.bytes, 0);
        for (const entry of request.result.sort((a,b) => a.touched - b.touched)) {
          if (total <= limit) break;
          store.delete(entry.url); total -= entry.bytes;
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
      if ([...entry.images].some(image => image.isConnected && image.src === entry.objectURL)) continue;
      URL.revokeObjectURL(entry.objectURL); objectURLs.delete(url);
    }
    while (objectURLs.size > 12) {
      const [url, entry] = objectURLs.entries().next().value;
      URL.revokeObjectURL(entry.objectURL); objectURLs.delete(url);
    }
  }
  function hydrate(image) {
    const value = image.getAttribute('src');
    const original = originals.get(value);
    if (!original || (image.dataset.cardMedia === value && inflight.has(value))) return;
    image.dataset.cardMedia = value;
    const fallback = globalThis.CardThumbnails?.[original];
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
    }).catch(() => { delete image.dataset.cardMedia; /* Packaged preview stays available offline. */ });
  }
  globalThis.CardMedia = Object.freeze({native, source, canonical});
  if (!native) return;
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
