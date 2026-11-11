/* Pack opening diagnostics: while a pack is being opened, measure how smoothly
   each phase draws (tear, cards, summary) and save one small summary per
   opening, with the device's basic capabilities. No content, no images, no
   identifiers beyond the member's own session; at most a few per day. */
(() => {
  'use strict';
  const DAY_KEY = 'bb-pack-diag-day', LIMIT = 6;
  let session = null;
  function allowed() {
    try {
      const today = new Date().toISOString().slice(0, 10), saved = JSON.parse(localStorage.getItem(DAY_KEY) || 'null');
      const count = saved?.day === today ? saved.count : 0;
      if (count >= LIMIT) return false;
      localStorage.setItem(DAY_KEY, JSON.stringify({day: today, count: count + 1}));
      return true;
    } catch { return true; }
  }
  const phaseOf = dialog => dialog.classList.contains('is-opening-pack') ? 'tear' : dialog.classList.contains('is-pack-summary') ? 'summary' : 'cards';
  function summarise(gaps) {
    if (!gaps.length) return null;
    const sorted = [...gaps].sort((a, b) => a - b), at = q => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
    return {frames: gaps.length, ms: Math.round(gaps.reduce((a, b) => a + b, 0)), median: +at(.5).toFixed(1), p95: +at(.95).toFixed(1),
      max: Math.round(sorted.at(-1)), over34: gaps.filter(gap => gap > 34).length, over100: gaps.filter(gap => gap > 100).length};
  }
  function start(dialog, {cards = 0, theme = null, send} = {}) {
    stop();
    if (!dialog || typeof send !== 'function' || !allowed()) return;
    const started = performance.now(), gaps = {tear: [], cards: [], summary: []}, firsts = {};
    let last = 0, frame = 0, longTasks = 0, observer = null;
    try { observer = new PerformanceObserver(list => { longTasks += list.getEntries().length; }); observer.observe({type: 'longtask', buffered: false}); } catch { observer = null; }
    const tick = now => {
      const phase = phaseOf(dialog);
      if (!(phase in firsts)) firsts[phase] = Math.max(0, Math.round(now - started));
      if (last && !document.hidden) gaps[phase].push(now - last);
      last = now;
      if (now - started < 60000) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    session = {finish() {
      cancelAnimationFrame(frame); observer?.disconnect();
      const root = document.documentElement;
      const payload = {
        cards, theme, total_ms: Math.round(performance.now() - started), first_ms: firsts, long_tasks: observer ? longTasks : null,
        phases: Object.fromEntries(Object.entries(gaps).map(([key, list]) => [key, summarise(list)]).filter(([, value]) => value)),
        device: {ua: String(navigator.userAgent || '').slice(0, 260), memory: navigator.deviceMemory ?? null, cores: navigator.hardwareConcurrency ?? null,
          dpr: devicePixelRatio, width: innerWidth, height: innerHeight, motion: root.dataset.motionQuality || null, glass: root.dataset.glassQuality || null,
          native: root.classList.contains('native-ios') || document.body.classList.contains('native-ios') ? 'ios' : /Android/.test(navigator.userAgent) ? 'android' : 'web'},
      };
      Promise.resolve().then(() => send(payload)).catch(() => {});
    }};
  }
  function stop() { const current = session; session = null; current?.finish(); }
  globalThis.PackDiagnostics = Object.freeze({start, stop});
})();
