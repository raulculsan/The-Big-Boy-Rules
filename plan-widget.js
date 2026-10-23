/* Native home-screen widget bridge. No account tokens or private event descriptions leave the app. */
(() => {
  let signature = '', pending = null, listener = null, ready = false, lastOpen = '', lastOpenAt = 0;
  let lastPlan = null, packCount = 0;
  const plugin = () => window.Capacitor?.Plugins?.ClubPlanWidget;
  async function sync(plan) {
    if (plan?.packCount != null) packCount = Math.max(0, Math.min(999999, Math.floor(Number(plan.packCount) || 0)));
    const startAt = plan?.startAt ? new Date(plan.startAt).getTime() : NaN;
    const endAt = plan?.endAt ? new Date(plan.endAt).getTime() : startAt + 4 * 3600000;
    const hasPlan = !!plan?.id && Number.isFinite(startAt) && Number.isFinite(endAt) && endAt > startAt;
    lastPlan = hasPlan ? plan : null;
    const data = { id: hasPlan ? String(plan.id) : '', title: hasPlan ? String(plan.title || 'Próximo plan').slice(0, 100) : 'La sede te espera', startAt: hasPlan ? startAt : 0, endAt: hasPlan ? endAt : 0, hasPlan, packCount };
    const key = JSON.stringify(data);
    if (signature === key || !plugin()) return;
    try { await plugin().sync(data); signature = key; } catch (_) { /* optional native surface */ }
  }
  function updatePacks(count) {
    packCount = Math.max(0, Math.min(999999, Math.floor(Number(count) || 0)));
    return sync({ ...lastPlan, packCount });
  }
  async function clear() {
    signature = ''; lastPlan = null; packCount = 0;
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
  window.PlanWidget = Object.freeze({ sync, clear, onOpen, updatePacks });
})();
