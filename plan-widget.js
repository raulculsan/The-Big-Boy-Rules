/* Native home-screen widget bridge. No account tokens or private event descriptions leave the app. */
(() => {
  let signature = '', pending = null, listener = null, ready = false, lastOpen = '', lastOpenAt = 0;
  const plugin = () => window.Capacitor?.Plugins?.ClubPlanWidget;
  async function sync(plan) {
    if (!plan) return clear();
    const startAt = new Date(plan.startAt).getTime();
    const endAt = new Date(plan.endAt || startAt + 4 * 3600000).getTime();
    if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) return;
    const data = { id: String(plan.id || ''), title: String(plan.title || 'Próximo plan').slice(0, 100), startAt, endAt };
    const key = JSON.stringify(data);
    if (signature === key || !plugin()) return;
    try { await plugin().sync(data); signature = key; } catch (_) { /* optional native surface */ }
  }
  async function clear() {
    signature = '';
    try { await plugin()?.clear(); } catch (_) {}
  }
  async function onOpen(callback) {
    listener = callback;
    if (pending) { const id = pending; pending = null; callback(id); }
    if (ready || !plugin()) return;
    ready = true;
    const receive = data => {
      const id = String(data?.id || '');
      if (id === lastOpen && Date.now() - lastOpenAt < 1000) return;
      lastOpen = id; lastOpenAt = Date.now();
      if (listener) listener(id); else pending = id;
    };
    try {
      await plugin().addListener('open', receive);
      const launch = await plugin().consume();
      if (launch?.opened) receive(launch);
    } catch (_) {}
  }
  window.PlanWidget = Object.freeze({ sync, clear, onOpen });
})();
