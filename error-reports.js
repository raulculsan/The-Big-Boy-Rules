/* Error reports: unexpected script errors and unhandled promise failures are
   sent as one short, scrubbed line (type, message without links, emails or
   tokens, file:line of our own scripts, screen, app version, device), so a
   failure on someone's phone is visible without them having to report it.
   Each distinct error is sent once per app session; the server groups repeats.
   Network drops, aborted requests and browser noise are ignored. */
(() => {
  'use strict';
  const DAY_KEY = 'bb-error-reports-day', DAY_LIMIT = 40, SESSION_LIMIT = 15, QUEUE_LIMIT = 20;
  const sent = new Set(), queue = [];
  let client = null, sessionCount = 0, flushing = false, webBuild = null, nativeInfo = null;

  const NOISE = [
    /^Script error\.?$/i, /ResizeObserver loop/i, /Failed to fetch/i, /Load failed/i, /NetworkError/i,
    /network (connection|request)/i, /The (operation|request) (was|is) (aborted|cancelled)/i, /cancelado|cancelled/i,
    /AbortError/i, /The play\(\) request was interrupted/i, /play\(\) failed because the user didn't interact/i,
    /NotAllowedError/i, /Non-Error promise rejection captured/i, /JWT expired/i, /Sin conexión/i,
  ];
  // Only frames from this app's own origin count (never extensions or vendor CDNs).
  const OWN_SCRIPT = /([a-z][a-z0-9+.-]*:\/\/[^\s()@]*?\/)([a-z][a-z0-9-]*\.js)(?:\?[^:\s)]*)?:(\d+)(?::(\d+))?/gi;
  const own = base => { try { return new URL(base).origin === location.origin; } catch { return false; } };

  function scrub(text) {
    return String(text ?? '')
      .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, '<url>')
      .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '<email>')
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<id>')
      .replace(/\b(?:eyJ[\w-]+\.[\w-]+\.[\w-]+|[A-Za-z0-9_-]{32,})\b/g, '<token>')
      .replace(/\s+/g, ' ').trim().slice(0, 180);
  }
  function frames(stack, filename, line, column) {
    const list = [];
    for (const match of String(stack || '').matchAll(OWN_SCRIPT)) {
      if (!own(match[1])) continue;
      list.push(`${match[2]}:${match[3]}${match[4] ? `:${match[4]}` : ''}`);
      if (list.length >= 4) break;
    }
    if (!list.length && filename) {
      const match = String(filename).match(/^(.*\/)([a-z][a-z0-9-]*\.js)(?:\?.*)?$/i);
      if (match && own(match[1])) list.push(`${match[2]}:${Number(line) || 0}:${Number(column) || 0}`);
    }
    return list;
  }
  const area = () => document.querySelector('.page-section.active')?.id?.slice(0, 40) || 'otra';
  const platform = () => window.Capacitor?.getPlatform?.() || 'web';
  function build() {
    if (webBuild === null) webBuild = document.querySelector('script[src^="app.js?v="]')?.getAttribute('src')?.split('v=')[1]?.slice(0, 60) || '';
    return webBuild;
  }
  function dayAllows() {
    try {
      const today = new Date().toISOString().slice(0, 10), saved = JSON.parse(localStorage.getItem(DAY_KEY) || 'null');
      const count = saved?.day === today ? saved.count : 0;
      if (count >= DAY_LIMIT) return false;
      localStorage.setItem(DAY_KEY, JSON.stringify({day: today, count: count + 1}));
      return true;
    } catch { return true; }
  }

  function capture(kind, error, extra = {}) {
    try {
      if (navigator.onLine === false) return;
      const name = typeof error?.name === 'string' ? error.name.slice(0, 40) : (typeof error === 'object' && error ? 'Object' : typeof error);
      const message = scrub(error?.message ?? extra.message ?? (typeof error === 'string' ? error : ''));
      if (name === 'AbortError' || NOISE.some(pattern => pattern.test(message) || pattern.test(name))) return;
      const where = frames(error?.stack, extra.filename, extra.line, extra.column);
      // Errors that never touch our own scripts come from extensions or the browser itself.
      if (kind === 'script' && !where.length) return;
      const signature = `${kind}|${name}|${message.replace(/\d+/g, '#').slice(0, 100)}|${where[0] || '-'}`.slice(0, 200);
      if (sent.has(signature) || sessionCount >= SESSION_LIMIT) return;
      sent.add(signature);
      sessionCount++;
      if (queue.length < QUEUE_LIMIT) queue.push({
        signature, kind, name, message, frames: where, area: area(), platform: platform(), build: build(),
        native: nativeInfo, ua: String(navigator.userAgent || '').slice(0, 200), at: new Date().toISOString(),
      });
      void flush();
    } catch { /* Reporting must never cause another error. */ }
  }

  async function flush() {
    if (flushing || !client || !queue.length) return;
    flushing = true;
    try {
      const {data} = await client.auth.getSession();
      if (!data?.session) return;
      while (queue.length) {
        const payload = queue.shift();
        if (!dayAllows()) { queue.length = 0; break; }
        try { await client.rpc('record_client_error', {payload}); } catch { /* best effort */ }
      }
    } catch { /* best effort */ }
    finally { flushing = false; }
  }

  window.addEventListener('error', event => {
    if (event.target && event.target !== window) return; // failed images or scripts are resource errors
    capture('script', event.error, {message: event.message, filename: event.filename, line: event.lineno, column: event.colno});
  });
  window.addEventListener('unhandledrejection', event => capture('promise', event.reason));

  globalThis.ClubErrorReports = Object.freeze({
    start({client: next} = {}) {
      if (!next?.rpc || !next?.auth) return;
      client = next;
      try {
        const plugin = window.Capacitor?.registerPlugin?.('ClubAppUpdate');
        if (platform() === 'android' && plugin?.getInfo) plugin.getInfo().then(info => {
          nativeInfo = {version: String(info?.version || '').slice(0, 32), build: Number(info?.build) || null};
        }).catch(() => {});
      } catch {}
      client.auth.onAuthStateChange?.((_event, session) => { if (session) setTimeout(() => void flush(), 0); });
      void flush();
    },
    capture: (error, context) => capture('manual', error, {message: scrub(context)}),
  });
})();
