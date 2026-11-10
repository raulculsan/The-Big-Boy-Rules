/* Pack extras: choice slots, themed packs, the target card, card finishes and
   shared openings. All rules live on the server; this module only asks for them
   and draws the result. Neutral tones for every state (AGENTS.md). */
(() => {
  'use strict';
  let options = null, finishes = {}, finishesOwner = null;
  const FINISH_NAMES = Object.freeze({holo: 'Holográfica', metal: 'Metalizada', ink: 'Tinta especial'});
  const FINISH_ORDER = ['ink', 'metal', 'holo'];
  const THEMES = Object.freeze({retro: 'Retro', vice_city: 'Vice City', halloween: 'Halloween', full_art: 'Full Art', objects: 'Objetos', locations: 'Ubicaciones'});
  const RARITY_NAMES = Object.freeze({common: 'Común', special: 'Especial', retro: 'Retro', epic: 'Épica', legendary: 'Legendaria', full_art: 'Full Art', vice_city: 'Vice City', halloween: 'Halloween'});
  const RARITY_RANK = ['halloween', 'vice_city', 'full_art', 'legendary', 'epic', 'special', 'retro', 'common'];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[char]);
  const design = id => (globalThis.CardCollection?.catalog || []).find(card => card.id === id) || null;
  const thumb = id => { const card = design(id); return card ? (globalThis.CardCollection?.thumbnail?.(card) || card.front || card.back) : 'icons/cards/reverso-comun-unificado-v1.jpg'; };
  const cardName = id => design(id)?.name || id;
  async function call(name, args = {}) {
    if (!options?.rpc) throw new Error('Inicia sesión para usar tus sobres.');
    const {data, error} = await options.rpc(name, args);
    if (error) throw error;
    return data;
  }
  const message = error => ['PGRST202', '42883'].includes(error?.code) ? 'Esta función llegará con la próxima actualización.' : error?.message || 'No se pudo completar. Vuelve a intentarlo.';

  // ── Finishes ──────────────────────────────────────────────────────────────
  function bestFinish(id) { const owned = finishes[id]; return owned ? FINISH_ORDER.find(finish => owned[finish] > 0) || null : null; }
  async function loadFinishes() {
    const owner = options?.session?.() || null;
    if (!owner) { finishes = {}; finishesOwner = null; return finishes; }
    try { const data = await call('get_card_finishes'); if (owner === options.session()) { finishes = data || {}; finishesOwner = owner; document.dispatchEvent(new CustomEvent('bb:card-finishes')); } }
    catch { /* Older servers have no finishes. */ }
    return finishes;
  }
  function noteFinish(id, finish) {
    if (!id || !finish) return;
    finishes[id] = {...(finishes[id] || {}), [finish]: (finishes[id]?.[finish] || 0) + 1};
  }

  // ── Choice slot ───────────────────────────────────────────────────────────
  // Three cards, keep one. Closing leaves the choice pending for later.
  function choose(choice) {
    return new Promise(resolve => {
      if (!choice?.options?.length) { resolve(null); return; }
      const dialog = document.createElement('dialog');
      dialog.className = 'pack-choice';
      dialog.setAttribute('aria-labelledby', 'packChoiceTitle');
      dialog.innerHTML = `<header class="pack-choice-header"><h2 id="packChoiceTitle">Elige una carta</h2><p>Este sobre te deja quedarte con una de estas tres.</p></header>
        <div class="pack-choice-options" role="group" aria-label="Opciones">${choice.options.map(option => `<button type="button" class="pack-choice-card" data-choice-card="${esc(option.card_id)}" data-rarity="${esc(option.edition)}"><img src="${esc(thumb(option.card_id))}" width="948" height="1660" alt="" draggable="false" decoding="async"><strong>${esc(cardName(option.card_id))}</strong><small>${esc(RARITY_NAMES[option.edition] || option.edition)}</small></button>`).join('')}</div>
        <p class="pack-choice-status" role="status"></p><button type="button" class="pack-choice-later" data-choice-later>Elegir más tarde</button>`;
      document.body.append(dialog);
      let settled = false;
      const finish = value => { if (settled) return; settled = true; resolve(value); if (dialog.open) dialog.close(); dialog.remove(); };
      dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null); });
      dialog.addEventListener('click', async event => {
        if (event.target.closest('[data-choice-later]')) { finish(null); return; }
        const button = event.target.closest('[data-choice-card]');
        if (!button || dialog.dataset.busy) return;
        dialog.dataset.busy = 'true';
        dialog.querySelectorAll('button').forEach(node => { node.disabled = true; });
        button.setAttribute('aria-pressed', 'true');
        try {
          const data = await call('choose_pack_card', {target_pack_id: choice.pack_id, chosen_card_id: button.dataset.choiceCard});
          noteFinish(data?.card?.card_id, data?.card?.finish);
          finish(data?.card || null);
        } catch (error) {
          delete dialog.dataset.busy;
          dialog.querySelectorAll('button').forEach(node => { node.disabled = false; });
          button.removeAttribute('aria-pressed');
          dialog.querySelector('.pack-choice-status').textContent = message(error);
        }
      });
      if (globalThis.ClubMotion?.openDialog) globalThis.ClubMotion.openDialog(dialog); else dialog.showModal();
    });
  }

  // ── Themed packs ──────────────────────────────────────────────────────────
  let confirming = null, confirmTimer = 0, buying = false;
  function renderThemes(state) {
    const root = document.getElementById('packThemes');
    if (!root) return;
    const price = state?.themed_price;
    root.hidden = !price;
    if (!price) return;
    const balance = Number(state?.balance ?? NaN);
    const markup = Object.entries(THEMES).map(([key, name]) => {
      const asking = confirming === key;
      return `<button type="button" class="pack-theme" data-pack-theme="${key}" ${buying || (Number.isFinite(balance) && balance < price) ? 'disabled' : ''} aria-label="${asking ? `Confirmar compra del sobre ${name} por ${price} monedas` : `Sobre ${name}, ${price} monedas`}"><span>${esc(name)}</span><small>${asking ? 'Toca para comprar' : `${price}`}</small></button>`;
    }).join('');
    const list = root.querySelector('.pack-theme-list');
    if (list && list.innerHTML !== markup) list.innerHTML = markup;
  }
  async function buyTheme(theme, price) {
    if (buying) return;
    if (confirming !== theme) { confirming = theme; clearTimeout(confirmTimer); confirmTimer = setTimeout(() => { confirming = null; options?.changed?.(); }, 4000); options?.changed?.(); return; }
    confirming = null; buying = true; options?.changed?.();
    const status = document.getElementById('packThemesStatus');
    try {
      await call('buy_themed_pack', {pack_theme: theme, expected_price: price});
      if (status) status.textContent = `Sobre ${THEMES[theme]} añadido. Ábrelo cuando quieras.`;
      await options?.refresh?.();
    } catch (error) { if (status) status.textContent = message(error); }
    finally { buying = false; options?.changed?.(); }
  }

  // ── Target card ───────────────────────────────────────────────────────────
  async function setTarget(id) {
    try { const data = await call('set_card_target', {target_card_id: id || null}); document.dispatchEvent(new CustomEvent('bb:card-target', {detail: data})); return data; }
    catch (error) { throw new Error(message(error)); }
  }

  // ── Shared openings ───────────────────────────────────────────────────────
  const TOKEN = /^\[\[sobre:(\d{1,15})\]\]$/;
  const sharedId = text => String(text || '').trim().match(TOKEN)?.[1] || null;
  const sharedCache = new Map();
  async function share(packId) {
    const data = await call('share_pack_opening', {target_pack_id: packId});
    document.dispatchEvent(new CustomEvent('bb:share-pack', {detail: {token: data.token, packId}}));
    return data;
  }
  function sharedMarkup(packId) {
    return `<button type="button" class="shared-pack" data-shared-pack="${esc(packId)}" aria-label="Ver el sobre compartido"><span class="shared-pack-title">Ha abierto un sobre</span><span class="shared-pack-strip" aria-hidden="true">${'<i></i>'.repeat(6)}</span><span class="shared-pack-meta">Cargando…</span></button>`;
  }
  function fetchShared(packId) {
    if (!sharedCache.has(packId)) sharedCache.set(packId, call('get_shared_pack', {target_pack_id: Number(packId)}).catch(error => { sharedCache.delete(packId); throw error; }));
    return sharedCache.get(packId);
  }
  function paintShared(node, data) {
    if (!data) { node.querySelector('.shared-pack-meta').textContent = 'Este sobre ya no está disponible.'; node.disabled = true; return; }
    const cards = data.cards || [], best = [...cards].sort((a, b) => RARITY_RANK.indexOf(a.edition) - RARITY_RANK.indexOf(b.edition))[0];
    node.querySelector('.shared-pack-strip').innerHTML = cards.map(item => `<i data-rarity="${esc(item.edition)}"${item.finish ? ` data-finish="${esc(item.finish)}"` : ''}${item === best ? ' data-best' : ''}><img src="${esc(thumb(item.card_id))}" alt="" draggable="false" decoding="async" loading="lazy">${item.is_new ? '<b>Nueva</b>' : ''}</i>`).join('');
    const fresh = cards.filter(item => item.is_new).length;
    node.querySelector('.shared-pack-meta').textContent = [best ? `Lo mejor: ${RARITY_NAMES[best.edition] || best.edition}` : '', fresh ? `${fresh} ${fresh === 1 ? 'nueva' : 'nuevas'}` : '', data.theme ? `Sobre ${THEMES[data.theme]}` : ''].filter(Boolean).join(' · ');
    node.setAttribute('aria-label', `Ver el sobre compartido: ${cards.map(item => cardName(item.card_id)).join(', ')}`);
  }
  function hydrate(root = document) {
    for (const node of root.querySelectorAll('[data-shared-pack]:not([data-hydrated])')) {
      node.dataset.hydrated = 'true';
      const id = node.dataset.sharedPack;
      void fetchShared(id).then(data => { if (node.isConnected) paintShared(node, data); }).catch(error => { if (node.isConnected) node.querySelector('.shared-pack-meta').textContent = message(error); });
    }
  }
  async function viewShared(packId) {
    const data = await fetchShared(packId).catch(() => null);
    if (!data) return;
    const dialog = document.createElement('dialog');
    dialog.className = 'shared-pack-viewer';
    dialog.setAttribute('aria-label', 'Sobre compartido');
    dialog.innerHTML = `<header><h2>Sobre compartido</h2><button type="button" data-shared-close aria-label="Cerrar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><div class="shared-pack-grid">${(data.cards || []).map(item => `<figure data-rarity="${esc(item.edition)}"${item.finish ? ` data-finish="${esc(item.finish)}"` : ''}><span class="shared-pack-art"><img src="${esc(design(item.card_id)?.front || thumb(item.card_id))}" width="948" height="1660" alt="" draggable="false" decoding="async"></span><figcaption><strong>${esc(cardName(item.card_id))}</strong><small>${esc([RARITY_NAMES[item.edition] || item.edition, item.finish ? FINISH_NAMES[item.finish] : '', item.is_new ? 'Nueva' : ''].filter(Boolean).join(' · '))}</small></figcaption></figure>`).join('')}</div>`;
    document.body.append(dialog);
    const close = () => { if (dialog.open) dialog.close(); dialog.remove(); };
    dialog.addEventListener('close', () => dialog.remove());
    dialog.addEventListener('click', event => { if (event.target.closest('[data-shared-close]') || event.target === dialog) close(); });
    if (globalThis.ClubMotion?.openDialog) globalThis.ClubMotion.openDialog(dialog); else dialog.showModal();
  }
  document.addEventListener('click', event => {
    const shared = event.target.closest?.('[data-shared-pack]');
    if (shared) { event.preventDefault(); event.stopPropagation(); void viewShared(shared.dataset.sharedPack); return; }
    const theme = event.target.closest?.('[data-pack-theme]');
    if (theme && !theme.disabled) void buyTheme(theme.dataset.packTheme, options?.state?.()?.themed_price);
  }, true);

  function reset() { finishes = {}; finishesOwner = null; sharedCache.clear(); confirming = null; buying = false; }
  globalThis.PackExtras = Object.freeze({
    initialize(config) { options = config; },
    FINISH_NAMES, THEMES, bestFinish, loadFinishes, noteFinish, choose, renderThemes, setTarget, share, sharedId, sharedMarkup, hydrate, reset,
    finishOwner: () => finishesOwner,
  });
})();
