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

  // ── Pack carousel ─────────────────────────────────────────────────────────
  // Los nuestros is the first slide; each theme follows with its own artwork.
  // Swiping left and right brings the next pack up from behind; the centred
  // one is the pack the main button opens or buys.
  // Literal paths so the web build packages every themed pack's artwork.
  const THEME_ART = Object.freeze({retro: 'icons/cards/sobre-tema-retro-v1.png', vice_city: 'icons/cards/sobre-tema-vice-city-v1.png', halloween: 'icons/cards/sobre-tema-halloween-v1.png', full_art: 'icons/cards/sobre-tema-full-art-v1.png', objects: 'icons/cards/sobre-tema-objects-v1.png', locations: 'icons/cards/sobre-tema-locations-v1.png'});
  const THEME_LINES = Object.freeze({retro: 'Retro asegurada', vice_city: 'Vice City asegurada', halloween: 'Halloween asegurada', full_art: 'Full Art asegurada', objects: 'Objeto épico o mejor', locations: 'Ubicación épica o mejor'});
  const themeArt = theme => THEME_ART[theme] || null;
  let confirming = null, confirmTimer = 0, buying = false, active = 'standard', carouselBound = false, motionFrame = 0;
  const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const waitingFor = (state, slot) => Number(state?.waiting?.[slot]?.count) || 0;
  function slideMeta(state, theme) {
    const owned = waitingFor(state, theme), price = state?.themed_price;
    if (owned) return `${owned} ${owned === 1 ? 'sobre' : 'sobres'}`;
    return confirming === theme ? 'Toca otra vez para comprar' : `${price} monedas`;
  }
  function renderCarousel(state) {
    const track = document.getElementById('packCarouselTrack');
    if (!track) return;
    const price = state?.themed_price;
    for (const slide of track.querySelectorAll('[data-pack-slide]:not([data-pack-slide="standard"])')) if (!price) slide.remove();
    if (price) {
      const balance = Number(state?.balance ?? NaN);
      for (const [theme, name] of Object.entries(THEMES)) {
        let slide = track.querySelector(`[data-pack-slide="${theme}"]`);
        if (!slide) {
          slide = document.createElement('div');
          slide.className = 'pack-slide'; slide.dataset.packSlide = theme;
          slide.innerHTML = `<button type="button" class="packs-art-button pack-slide-art" data-pack-theme="${theme}"><img class="packs-art" src="${themeArt(theme)}" width="768" height="1152" loading="lazy" decoding="async" alt="" draggable="false"><span class="pack-slide-count" hidden></span></button><p class="pack-slide-label"><strong>${esc(name)}</strong><span></span></p>`;
          track.append(slide);
        }
        const owned = waitingFor(state, theme), button = slide.querySelector('button');
        const cannot = buying || (!owned && Number.isFinite(balance) && balance < price);
        button.disabled = cannot || !navigator.onLine;
        button.toggleAttribute('data-owned', owned > 0);
        button.toggleAttribute('data-confirming', confirming === theme);
        button.setAttribute('aria-label', owned ? `Abrir un sobre ${name}. Tienes ${owned}.` : confirming === theme ? `Confirmar compra del sobre ${name} por ${price} monedas` : `Comprar un sobre ${name} por ${price} monedas. ${THEME_LINES[theme]}.`);
        const count = slide.querySelector('.pack-slide-count');
        count.hidden = !owned; count.textContent = owned > 1 ? `×${owned}` : '';
        if (owned === 1) count.hidden = true;
        const meta = slide.querySelector('.pack-slide-label span'), text = confirming === theme ? slideMeta(state, theme) : `${slideMeta(state, theme)} · ${THEME_LINES[theme]}`;
        if (meta.textContent !== text) meta.textContent = text;
      }
    }
    const standardMeta = track.querySelector('[data-pack-slide="standard"] .pack-slide-label span');
    if (standardMeta) {
      const count = state?.waiting ? waitingFor(state, 'standard') : null;
      const text = count == null ? '6 cartas por sobre' : count ? `${count} ${count === 1 ? 'sobre' : 'sobres'} · 6 cartas` : 'Sin sobres · vuelve mañana';
      if (standardMeta.textContent !== text) standardMeta.textContent = text;
    }
    renderDots(track);
    bindCarousel(track);
    syncAction(state);
    paintCarousel(track);
  }
  function renderDots(track) {
    const dots = document.getElementById('packCarouselDots');
    if (!dots) return;
    const slides = [...track.querySelectorAll('[data-pack-slide]')];
    dots.hidden = slides.length < 2;
    const markup = slides.map(slide => `<i${slide.dataset.packSlide === active ? ' data-active' : ''}></i>`).join('');
    if (dots.innerHTML !== markup) dots.innerHTML = markup;
  }
  // The centred slide drives the main button; transforms follow the scroll.
  function paintCarousel(track = document.getElementById('packCarouselTrack')) {
    if (!track) return;
    const box = track.getBoundingClientRect(), centre = box.left + box.width / 2;
    let nearest = null, distance = Infinity;
    for (const slide of track.querySelectorAll('[data-pack-slide]')) {
      const rect = slide.getBoundingClientRect(), offset = (rect.left + rect.width / 2 - centre) / Math.max(1, rect.width);
      const t = Math.max(-1.6, Math.min(1.6, offset)), near = Math.abs(t);
      if (near < distance) { distance = near; nearest = slide; }
      if (reducedMotion()) { slide.style.removeProperty('--slide-scale'); slide.style.removeProperty('--slide-rise'); slide.style.removeProperty('--slide-tilt'); slide.style.setProperty('--slide-fade', String(1 - Math.min(1, near) * .45)); continue; }
      slide.style.setProperty('--slide-scale', (1 - Math.min(1, near) * .2).toFixed(3));
      slide.style.setProperty('--slide-rise', `${(Math.min(1, near) * 34).toFixed(1)}px`);
      slide.style.setProperty('--slide-tilt', `${(t * 7).toFixed(2)}deg`);
      slide.style.setProperty('--slide-fade', (1 - Math.min(1, near) * .5).toFixed(3));
    }
    const next = nearest?.dataset.packSlide || 'standard';
    track.querySelectorAll('[data-pack-slide]').forEach(slide => slide.classList.toggle('is-active', slide === nearest));
    if (next !== active) {
      active = next;
      if (confirming && confirming !== active) { confirming = null; clearTimeout(confirmTimer); }
      renderDots(track); syncAction(options?.state?.()); options?.slideChanged?.(active);
    }
  }
  function bindCarousel(track) {
    if (carouselBound) return;
    carouselBound = true;
    track.addEventListener('scroll', () => { cancelAnimationFrame(motionFrame); motionFrame = requestAnimationFrame(() => paintCarousel(track)); }, {passive: true});
    globalThis.addEventListener('resize', () => paintCarousel(track), {passive: true});
    // Tapping a pack beside the centred one brings it to the centre first.
    track.addEventListener('click', event => {
      const slide = event.target.closest('[data-pack-slide]');
      if (!slide || slide.classList.contains('is-active')) return;
      event.preventDefault(); event.stopPropagation();
      slide.scrollIntoView({behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest', inline: 'center'});
    }, true);
    track.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const slides = [...track.querySelectorAll('[data-pack-slide]')], index = slides.findIndex(slide => slide.dataset.packSlide === active);
      const target = slides[Math.max(0, Math.min(slides.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)))];
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest', inline: 'center'});
      target.querySelector('button')?.focus({preventScroll: true});
    });
  }
  // The main button speaks for the centred pack: open it, or buy it.
  function syncAction(state = options?.state?.()) {
    const buttons = document.querySelectorAll('[data-pack-open]');
    const edition = document.querySelector('#sobres .col-edition'), heading = THEMES[active] ? `Sobre temático · ${THEMES[active]}` : 'Los nuestros · 6 cartas por sobre';
    if (edition && edition.textContent !== heading) edition.textContent = heading;
    if (active === 'standard' || !THEMES[active]) return false;
    const owned = waitingFor(state, active), price = state?.themed_price;
    const button = document.querySelector(`[data-pack-slide="${active}"] button`);
    const text = owned ? 'Abrir sobre' : confirming === active ? `Confirmar · ${price} monedas` : `Comprar · ${price} monedas`;
    buttons.forEach(node => { node.disabled = !button || button.disabled; if (node.textContent !== text) node.textContent = text; });
    return true;
  }
  function activeSlide() { return active; }
  async function buyTheme(theme, price) {
    if (buying || !price) return;
    const status = document.getElementById('packThemesStatus');
    if (confirming !== theme) {
      confirming = theme; clearTimeout(confirmTimer);
      confirmTimer = setTimeout(() => { confirming = null; options?.changed?.(); }, 4000);
      if (status) status.textContent = '';
      options?.changed?.(); return;
    }
    clearTimeout(confirmTimer); confirming = null; buying = true; options?.changed?.();
    try {
      await call('buy_themed_pack', {pack_theme: theme, expected_price: price});
      if (status) status.textContent = `Sobre ${THEMES[theme]} comprado. Ya puedes abrirlo.`;
      await options?.refresh?.();
    } catch (error) { if (status) status.textContent = message(error); }
    finally { buying = false; options?.changed?.(); }
  }
  // A themed slide opens its oldest pack when one is waiting, otherwise buys.
  function pressTheme(theme) {
    const state = options?.state?.(), next = state?.waiting?.[theme]?.next_id;
    if (next && waitingFor(state, theme)) { options?.open?.(next); return; }
    void buyTheme(theme, state?.themed_price);
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
  const shareTargets = () => globalThis.ChatShare?.targets?.() || {groups: [], people: []};
  async function share(packId, target) {
    if (!globalThis.ChatShare) throw new Error('El chat no está disponible ahora mismo.');
    const data = await call('share_pack_opening', {target_pack_id: packId});
    const sent = await globalThis.ChatShare.send(data.token, target);
    return {...data, label: sent?.label || ''};
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
    if (theme && !theme.disabled && theme.closest('[data-pack-slide]')?.classList.contains('is-active')) { pressTheme(theme.dataset.packTheme); return; }
    const main = event.target.closest?.('[data-pack-open]');
    if (main && THEMES[active]) { event.preventDefault(); event.stopPropagation(); if (!main.disabled) pressTheme(active); }
  }, true);

  function reset() { finishes = {}; finishesOwner = null; sharedCache.clear(); confirming = null; buying = false; clearTimeout(confirmTimer); }
  globalThis.PackExtras = Object.freeze({
    initialize(config) { options = config; },
    FINISH_NAMES, THEMES, bestFinish, loadFinishes, noteFinish, choose, renderCarousel, paintCarousel, syncAction, activeSlide, themeArt, setTarget, share, shareTargets, sharedId, sharedMarkup, hydrate, reset,
    finishOwner: () => finishesOwner,
  });
})();
