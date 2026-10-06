/* Own-account unlocks only; persistent deduplication, sequential celebrations. */
(() => {
  function createQueue({storage, now = Date.now} = {}) {
    let user, seen = new Set(), pending = [], initialized = false;
    const startedAt = now();
    const key = () => `bigboys.trophy-unlocks.v1.${user}`;
    const persist = () => { try { storage?.setItem(key(), JSON.stringify([...seen])); } catch {} };
    function reset() { user = null; seen = new Set(); pending = []; initialized = false; }
    function observe(userId, definitions, awards) {
      if (!userId) { reset(); return; }
      if (user !== userId) {
        reset(); user = userId;
        try {
          const stored = JSON.parse(storage?.getItem(key()) || 'null');
          if (Array.isArray(stored)) { seen = new Set(stored.map(String)); initialized = true; }
        } catch {}
      }
      const own = awards.filter(a => a.userId === userId);
      const active = new Set(own.map(a => String(a.id)));
      pending = pending.filter(a => active.has(a.awardId));
      for (const award of [...own].reverse()) {
        const id = String(award.id);
        // First use must not replay the trophy cabinet. A genuinely new daily
        // award issued during this launch still deserves its celebration.
        if (!initialized && !(Date.parse(award.awardedAt) >= startedAt)) { seen.add(id); continue; }
        if (seen.has(id) || pending.some(a => a.awardId === id)) continue;
        const achievement = definitions.find(a => String(a.id) === String(award.achievementId));
        if (achievement) pending.push({...achievement, awardId:id});
      }
      initialized = true;
      persist();
    }
    return {observe, reset, get size() {return pending.length;}, take() {
      const item = pending.shift();
      if (item) { seen.add(item.awardId); persist(); }
      return item;
    }};
  }

  let ui;
  function initialize({canShow, openDetail}) {
    if (ui) return;
    let storage;
    try { storage = localStorage; } catch {}
    const queue = createQueue({storage});
    const motion = TrophyMotion.createController({unlock:true});
    const dialog = document.createElement('dialog');
    dialog.className = 'trophy-unlock-dialog';
    dialog.setAttribute('aria-labelledby','trophyUnlockName');
    dialog.setAttribute('aria-describedby','trophyUnlockDescription');
    dialog.innerHTML = `<button type="button" class="trophy-unlock-close" aria-label="Cerrar celebración">×</button>
      <span class="trophy-unlock-eyebrow">LOGRO DESBLOQUEADO</span>
      <div class="achievement-detail-art" data-motion-state="static" aria-hidden="true">
        <span class="achievement-trophy"><img alt="" width="512" height="512"></span><div class="trophy-lottie"></div>
      </div><span class="trophy-unlock-rank"></span><h2 id="trophyUnlockName"></h2>
      <p id="trophyUnlockDescription"></p><button type="button" class="trophy-unlock-view">Ver mi logro</button>
      <button type="button" class="trophy-unlock-continue">Continuar</button>`;
    document.body.append(dialog);
    let timer, active, returnFocus, owner;
    const ranks = {bronze:['Bronce','El primer paso deja huella.'],silver:['Plata','Tu constancia tiene recompensa.'],
      gold:['Oro','Un logro para brillar.'],platinum:['Platino','Has llegado a otro nivel.']};
    function schedule() {
      clearTimeout(timer);
      if (queue.size && !dialog.open && !document.hidden) timer = setTimeout(pump, 700);
    }
    function pump() {
      if (!queue.size || dialog.open) return;
      if (document.hidden || !canShow() || document.querySelector('dialog[open]') ||
          document.activeElement?.matches('input, textarea, [contenteditable="true"]')) { schedule(); return; }
      active = queue.take();
      const tier = Object.hasOwn(ranks, active.tier) ? active.tier : 'bronze';
      dialog.dataset.tier = tier;
      dialog.querySelector('h2').textContent = active.name;
      dialog.querySelector('p').textContent = active.description || ranks[tier][1];
      dialog.querySelector('.trophy-unlock-rank').textContent = ranks[tier][0];
      const host = dialog.querySelector('.achievement-detail-art');
      host.className = `achievement-detail-art tier-${tier}`;
      host.querySelector('img').src = `icons/trophies/${tier}.svg?v=20260903-132`;
      returnFocus = document.activeElement;
      dialog.showModal();
      document.body.classList.add('trophy-unlock-open');
      dialog.querySelector('.trophy-unlock-continue').focus({preventScroll:true});
      motion.mount(host,tier);
    }
    function dismiss(restore = true) {
      motion.destroy();
      dialog.close();
      document.body.classList.remove('trophy-unlock-open');
      if (restore && returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
      returnFocus = null;
      active = null;
      schedule();
    }
    dialog.querySelector('.trophy-unlock-close').onclick = () => dismiss();
    dialog.querySelector('.trophy-unlock-continue').onclick = () => dismiss();
    dialog.querySelector('.trophy-unlock-view').onclick = () => { const id=active?.id; dismiss(); if(id != null) openDetail(id); };
    dialog.addEventListener('cancel', event => {event.preventDefault();dismiss();});
    document.addEventListener('visibilitychange', () => {if(!document.hidden) schedule();});
    ui = {observe(userId, definitions, awards) {
      if (owner !== userId) { queue.reset(); dismiss(false); owner = userId; }
      queue.observe(userId,definitions,awards);schedule();
    }, reset() {owner = null;queue.reset();clearTimeout(timer);dismiss(false);}};
  }
  globalThis.TrophyUnlock = Object.freeze({createQueue, initialize,
    observe(...args) {ui?.observe(...args);}, reset() {ui?.reset();}});
})();
