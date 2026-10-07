/* Wallet, inventory and purchases are authoritative server RPC results. */
(() => {
  let options, state = null, busy = false, loading = false, failure = '', notice = '', generation = 0, request = null, profileTarget = null;
  const memberBanners = new Map();
  let reveal = null, swipe = null, suppressRevealClickUntil = 0;
  const revealDialog = document.createElement('dialog');
  revealDialog.className = 'pack-reveal-dialog';
  revealDialog.setAttribute('aria-label', 'Abrir sobre: revelar cartas');
  document.body.append(revealDialog);
  const extraCopies = () => (state?.cards || []).reduce((sum, item) => sum + Math.max(0, Number(item.quantity) - 1), 0);
  function renderReveal() {
    if (!reveal || !revealDialog.open) return;
    const item = reveal.cards[reveal.index], design = card(item.card_id);
    const duplicate = !reveal.discarded.has(reveal.index) && Number(item.quantity) > 1 && Number(state?.cards?.find(owned => owned.card_id === item.card_id)?.quantity) > 1;
    const reward = state?.discard_rewards?.[item.edition] || 1;
    // Keep the turning card intact during wallet refreshes and discards.
    if (revealDialog.dataset.cardIndex !== String(reveal.index)) {
      revealDialog.dataset.cardIndex = String(reveal.index);
      revealDialog.innerHTML = `<header class="pack-reveal-header"><span>Carta ${reveal.index + 1} de ${reveal.cards.length}</span><button type="button" data-reveal-close aria-label="Cerrar: todas las cartas ya están guardadas">✕</button></header><div class="pack-reveal-stage"><button type="button" class="pack-reveal-card" data-reveal-flip aria-label="Girar carta" aria-pressed="false"><span class="pack-reveal-face pack-reveal-back"><img src="${escape(design?.back || 'icons/cards/reverso-comun-unificado-v1.png')}" alt="Reverso de carta"></span><span class="pack-reveal-face pack-reveal-front" aria-hidden="true"></span></button></div><div class="pack-reveal-info" aria-live="polite"></div><div class="pack-reveal-actions"></div><p class="pack-reveal-status" role="status"></p>`;
      revealDialog.querySelector('[data-reveal-flip]').focus({preventScroll:true});
    }
    const turn = revealDialog.querySelector('[data-reveal-flip]');
    if (reveal.flipped && !turn.classList.contains('is-flipped')) {
      const front = turn.querySelector('.pack-reveal-front');
      front.innerHTML = design ? `<img src="${escape(design.front)}" alt="${escape(design.name)}">` : '<span>Carta guardada</span>';
      front.setAttribute('aria-hidden','false');
      turn.querySelector('.pack-reveal-back').setAttribute('aria-hidden','true');
      turn.classList.add('is-flipped'); turn.setAttribute('aria-pressed','true'); turn.setAttribute('aria-label',design?.name || item.card_id);
    }
    revealDialog.querySelector('.pack-reveal-info').innerHTML = reveal.flipped ? `<h3>${escape(design?.name || item.card_id)}</h3><p>${escape(rarityNames[item.edition] || item.edition)} · ${reveal.discarded.has(reveal.index) ? 'Repetida descartada' : Number(item.quantity) > 1 ? 'Repetida' : 'Nueva'}</p>` : '<p>Pulsa la carta para descubrirla</p>';
    revealDialog.querySelector('.pack-reveal-actions').innerHTML = reveal.flipped ? `${duplicate ? `<button type="button" class="packs-sync" data-reveal-discard ${busy || loading || !online() ? 'disabled' : ''}>Descartar repetida · +${escape(reward)} monedas</button>` : ''}<p class="pack-reveal-swipe-hint">${reveal.index + 1 < reveal.cards.length ? 'Desliza hacia la izquierda para pasar a la siguiente carta' : 'Desliza hacia la izquierda para terminar'}</p>` : '';
    revealDialog.querySelector('.pack-reveal-status').textContent = failure || notice;
  }
  function startReveal(cards) {
    if (!cards.length) return;
    reveal = {cards,index:0,flipped:false,discarded:new Set()};
    delete revealDialog.dataset.cardIndex;
    revealDialog.showModal(); renderReveal();
  }
  revealDialog.addEventListener('click', event => {
    if (event.target.closest('[data-reveal-close]')) revealDialog.close();
    if (Date.now() < suppressRevealClickUntil) return;
    if (event.target.closest('[data-reveal-flip]') && reveal && !reveal.flipped) {reveal.flipped = true; renderReveal();}
    if (event.target.closest('[data-reveal-discard]') && reveal?.flipped) void mutate('discard_duplicate_card', {target_card_id:reveal.cards[reveal.index].card_id,copies:1}, 'Repetida descartada. Monedas añadidas.', reveal.index);
  });
  function advanceReveal(stage) {
    if (!reveal?.flipped || reveal.advancing || busy || loading) return;
    const current = reveal;
    current.advancing = true;
    stage.classList.add('is-leaving');
    stage.style.removeProperty('transform');
    stage.style.removeProperty('opacity');
    setTimeout(() => {
      if (reveal !== current || !revealDialog.open) return;
      if (current.index + 1 === current.cards.length) revealDialog.close();
      else {current.index++; current.flipped = false; current.advancing = false; renderReveal();}
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220);
  }
  revealDialog.addEventListener('pointerdown', event => {
    const stage = event.target.closest('.pack-reveal-stage');
    if (!stage || !reveal?.flipped || reveal.advancing || busy || loading || !event.isPrimary || event.button !== 0) return;
    swipe = {id:event.pointerId,x:event.clientX,y:event.clientY,stage,dx:0,horizontal:false};
    stage.setPointerCapture(event.pointerId);
  });
  revealDialog.addEventListener('pointermove', event => {
    if (!swipe || swipe.id !== event.pointerId) return;
    swipe.dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    if (!swipe.horizontal && Math.abs(swipe.dx) > 12 && Math.abs(swipe.dx) > Math.abs(dy) * 1.3) swipe.horizontal = true;
    if (!swipe.horizontal) return;
    swipe.stage.classList.add('is-dragging');
    swipe.stage.style.transform = `translateX(${Math.min(0, swipe.dx)}px)`;
    swipe.stage.style.opacity = String(Math.max(.35, 1 + Math.min(0, swipe.dx) / 400));
  });
  function finishSwipe(event) {
    if (!swipe || swipe.id !== event.pointerId) return;
    const gesture = swipe; swipe = null;
    gesture.stage.classList.remove('is-dragging');
    gesture.stage.style.removeProperty('transform');
    gesture.stage.style.removeProperty('opacity');
    if (gesture.horizontal) suppressRevealClickUntil = Date.now() + 400;
    if (event.type === 'pointerup' && gesture.horizontal && gesture.dx < -Math.min(70, gesture.stage.clientWidth * .25)) advanceReveal(gesture.stage);
  }
  revealDialog.addEventListener('pointerup', finishSwipe);
  revealDialog.addEventListener('pointercancel', finishSwipe);
  revealDialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' && reveal?.flipped && !event.target.closest('[data-reveal-discard], [data-reveal-close]')) {
      event.preventDefault(); advanceReveal(revealDialog.querySelector('.pack-reveal-stage'));
    }
  });
  revealDialog.addEventListener('close', () => {reveal = null; swipe = null; el('ownedPackOpen')?.focus({preventScroll:true});});
  const el = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const card = id => globalThis.CardCollection?.catalog.find(item => item.id === id);
  const online = () => navigator.onLine !== false && !!options?.session();
  const rarityNames = {common:'Común',retro:'Retro',special:'Especial',epic:'Épica',legendary:'Legendaria'};
  const coins = () => state ? `${state.balance} monedas` : '— monedas';
  function errorMessage(error) {
    if (navigator.onLine === false) return 'Sin conexión. Conéctate para actualizar tu colección y tus monedas.';
    if (['PGRST202','42883','42P01'].includes(error?.code)) return 'La tienda está en preparación. Prueba de nuevo cuando esté activada.';
    return error?.message || 'No se pudo conectar con la tienda. Vuelve a intentarlo.';
  }
  async function rpc(name, args = {}) {
    if (!online()) throw new Error('Conéctate e inicia sesión para usar tu colección y la tienda.');
    const response = await options.rpc(name, args);
    if (response.error) throw response.error;
    return response.data;
  }
  function artwork(banner, extra = '') {
    // Only known artwork keys become styles; future Krita exports are added here.
    const style = banner?.art_key === 'banner-de-prueba' ? 'banner-trial' : 'banner-neutral';
    return `<div class="banner-art ${style} ${extra}" role="img" aria-label="${escape(banner?.name || 'Banner de perfil')}"><span>BB</span></div>`;
  }
  function paintProfile() {
    if (!profileTarget?.node.isConnected) return;
    const {node, userId, own} = profileTarget;
    const banner = own ? state?.banners?.find(item => item.id === state.equipped_banner_id) : memberBanners.get(userId);
    const identity = node.querySelector('.club-profile-identity');
    const avatar = identity?.querySelector('.club-profile-avatar');
    let hero = identity?.querySelector('.profile-banner-hero');
    if (banner && identity && avatar) {
      if (!hero) {
        hero = document.createElement('div');
        hero.className = 'profile-banner-hero';
        avatar.before(hero);
        hero.append(avatar);
      }
      // Keep the decoded, circular avatar intact while the artwork changes.
      if (hero.dataset.bannerId !== String(banner.id) || !hero.querySelector('.profile-banner')) {
        hero.querySelector('.profile-banner')?.remove();
        hero.insertAdjacentHTML('afterbegin', artwork(banner, 'profile-banner'));
        hero.dataset.bannerId = String(banner.id);
      }
    } else if (hero) {
      if (avatar) hero.before(avatar);
      hero.remove();
    }
    if (own) {
      const balance = node.querySelector('[data-wallet-balance]');
      if (balance) balance.textContent = coins();
      node.querySelector('[data-banner-shop]')?.setAttribute('aria-label', `Abrir tienda de banners. ${coins()}`);
    }
  }
  function render() {
    paintProfile();
    renderReveal();
    document.querySelectorAll('[data-duplicates-count]').forEach(node => {node.textContent = state ? extraCopies() : '—'; node.closest('button')?.setAttribute('aria-label', `Gestionar ${state ? extraCopies() : ''} cartas repetidas`);});
    if (el('discardAllDuplicates')) el('discardAllDuplicates').disabled = busy || loading || !extraCopies() || !online();
    if (el('duplicatesStatus')) el('duplicatesStatus').textContent = failure || notice || (loading ? 'Actualizando repetidas…' : state ? `${extraCopies()} copias repetidas. Conservas una de cada carta.` : 'Actualiza la colección para consultar las repetidas.');
    globalThis.CardAlbum?.update({cards:state?.cards || null, loading, failure});
    const status = el('bannerShopStatus');
    if (status) { status.textContent = failure || (loading ? 'Actualizando colección…' : notice); status.classList.toggle('is-error', !!failure); }
    if (el('bannerShopBalance')) el('bannerShopBalance').textContent = coins();
    if (el('bannerShopRefresh')) el('bannerShopRefresh').disabled = busy || loading;
    if (el('ownedPackOpen')) el('ownedPackOpen').disabled = busy || loading || !state?.available_packs?.length || !online();
    if (el('packsOpenHint')) el('packsOpenHint').textContent = busy || loading ? 'Preparando tu colección…' : state?.available_packs?.length ? 'Toca el sobre para abrirlo.' : 'Vuestras historias, por descubrir.';
    if (el('ownedPacksCount')) el('ownedPacksCount').textContent = state ? `${state.available_packs.length} sobres disponibles` : 'Colección pendiente de sincronización';
    if (el('packRarityOdds')) el('packRarityOdds').textContent = state?.rarity_probabilities ? Object.keys(rarityNames).filter(rarity => state.rarity_probabilities[rarity] != null).map(rarity => `${rarityNames[rarity]}: ${state.rarity_probabilities[rarity]}%`).join(' · ') : 'Actualiza para consultar las probabilidades.';
    const container = el('bannerShopItems');
    if (container) container.innerHTML = state ? (state.banners || []).map(banner => `<article class="banner-shop-item">${artwork(banner)}<h3>${escape(banner.name)}</h3><p>${escape(banner.description)}</p><span>${banner.owned ? 'En tu colección' : `${escape(banner.price)} ${Number(banner.price) === 1 ? 'moneda' : 'monedas'}`}</span><button class="packs-sync" type="button" data-banner-action="${banner.owned ? 'equip' : 'buy'}" data-banner-id="${escape(banner.id)}" ${busy || loading || banner.equipped || (!banner.owned && Number(state.balance) < Number(banner.price)) || !online() ? 'disabled' : ''}>${banner.equipped ? 'Equipado' : banner.owned ? 'Equipar' : 'Comprar'}</button></article>`).join('') : '<p>Actualiza para consultar los banners disponibles.</p>';
    if (el('bannerUnequip')) el('bannerUnequip').disabled = busy || loading || !state?.equipped_banner_id || !online();
    const inventory = el('ownedCardInventory');
    if (inventory) inventory.innerHTML = state ? (extraCopies() ? state.cards.filter(item => Number(item.quantity) > 1).map(item => {
      const design = card(item.card_id), reward = state.discard_rewards?.[item.edition] || 1;
      return `<article class="owned-card">${design ? `<img src="${escape(design.front)}" alt="${escape(design.name)}" loading="lazy" decoding="async">` : ''}<h4>${escape(design?.name || item.card_id)}</h4><p>${escape(design?.edition || item.edition)} · ${escape(item.quantity)} ${Number(item.quantity) === 1 ? 'copia' : 'copias'}</p>${Number(item.quantity) > 1 ? `<button type="button" class="packs-sync" data-discard-card="${escape(item.card_id)}" ${busy || loading || !online() ? 'disabled' : ''}>Descartar 1 repetida · +${escape(reward)} monedas</button>` : '<small>Única copia</small>'}</article>`;
    }).join('') : '<p>No tienes cartas repetidas.</p>') : '<p>Tu inventario se mostrará al sincronizar la colección.</p>';
  }
  function refresh(forceDaily = false) {
    if (request) return request;
    const token = generation, user = options?.session();
    if (!user) state = null;
    loading = true; failure = ''; render();
    request = (async () => {
      try {
        // The daily claim must finish before reading available packs. This also
        // covers profile mounting and reconnect, not just packs navigation.
        await options?.synchronizePacks?.(forceDaily);
        if (token !== generation || user !== options.session()) return;
        const data = await rpc('get_banner_shop_state'); if (token === generation && user === options.session()) {state = data; failure = ''; render();} }
      catch (error) { if (token === generation) {failure = errorMessage(error); render();} }
      finally {if (token === generation) {loading = false; request = null; render();}}
    })();
    return request;
  }
  async function mutate(name, args, message, discardedIndex = null) {
    if (busy || loading) return;
    const token = generation, user = options.session();
    const focus = document.activeElement;
    const revealAtStart = reveal;
    const focusCard = focus?.dataset?.discardCard;
    const focusBanner = focus?.dataset?.bannerId;
    busy = true; failure = ''; notice = ''; render();
    try {
      const data = await rpc(name, args);
      if (token !== generation || user !== options.session()) return;
      if (discardedIndex != null && reveal === revealAtStart) reveal.discarded.add(discardedIndex);
      // A successful spend invalidates the old wallet until the server refreshes it.
      state = null;
      if (name === 'open_owned_card_pack') {
        const draws = data.cards || (data.card ? [data.card] : []);
        el('ownedPackResult').textContent = `${draws.length} cartas guardadas en tu colección.`;
        startReveal(draws);
        await options.synchronizePacks?.(true);
        if (token !== generation || user !== options.session()) return;
      }
      if (name === 'discard_duplicate_card' || name === 'discard_all_duplicate_cards') {
        const earned = Number(data.coins_earned) || 0;
        const copies = name === 'discard_all_duplicate_cards' ? Number(data.copies_discarded) || 0 : 1;
        message = `${copies} ${copies === 1 ? 'carta repetida descartada' : 'cartas repetidas descartadas'} · +${earned} ${earned === 1 ? 'moneda' : 'monedas'}.`;
      }
      notice = message;
      await refresh();
    } catch (error) { if (token === generation) {state = null; const message = errorMessage(error); await refresh(); if (token === generation) failure = `${message} Comprueba el saldo actualizado antes de repetir la acción.`;} }
    finally {if (token === generation) {busy = false; render();
      const destination = [...document.querySelectorAll('[data-discard-card], [data-banner-id]')].find(button => !button.disabled && ((focusCard && button.dataset.discardCard === focusCard) || (focusBanner && button.dataset.bannerId === focusBanner)));
      if (revealDialog.open) revealDialog.querySelector('[data-reveal-flip]')?.focus({preventScroll:true});
      else if (el('duplicatesDialog').open && focusCard) (destination || el('discardAllDuplicates')).focus({preventScroll:true});
      else if (destination) destination.focus({preventScroll:true});
      else if (focusCard) el('duplicatesTitle')?.focus({preventScroll:true});
    }}
  }
  function mountProfile(node, userId, own) {
    profileTarget = {node, userId, own};
    if (own) {
      const topline = node.querySelector('.club-profile-topline');
      if (topline && !topline.querySelector('[data-banner-shop]')) topline.insertAdjacentHTML('beforeend', '<button type="button" class="banner-shop-trigger" data-banner-shop aria-haspopup="dialog"><span data-wallet-balance>— monedas</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h18l-2-6H5L3 9Zm1 0v12h16V9M9 21v-7h6v7M3 9c0 3 4 3 4 0 0 3 5 3 5 0 0 3 5 3 5 0 0 3 4 3 4 0"/></svg></button>');
      if (topline && !topline.querySelector('[data-card-album]')) topline.insertAdjacentHTML('beforeend', `<button type="button" class="card-album-trigger" data-card-album aria-label="Abrir mi álbum de cartas" aria-haspopup="dialog">${globalThis.CardAlbum?.icon || ''}</button>`);
      paintProfile();
      if (!state && !request) void refresh();
    } else if (userId) {
      paintProfile();
      const token = generation;
      void rpc('get_member_profile_banner', {target_user_id:userId}).then(data => {if (token === generation) {memberBanners.set(userId, data); paintProfile();}}).catch(() => {});
    }
  }
  function initialize(config) {
    options = config;
    globalThis.CardAlbum?.configure({refresh:() => refresh()});
    document.addEventListener('click', event => {
      if (event.target.closest('[data-banner-shop]')) {el('bannerShopDialog').showModal(); void refresh();}
      const banner = event.target.closest('[data-banner-action]');
      if (banner) void mutate(banner.dataset.bannerAction === 'buy' ? 'buy_profile_banner' : 'equip_profile_banner', {target_banner_id:banner.dataset.bannerId}, banner.dataset.bannerAction === 'buy' ? 'Banner comprado. Ya puedes equiparlo.' : 'Banner equipado en la cabecera de tu perfil.');
      if (event.target.closest('[data-duplicates-open]')) {el('duplicatesDialog').showModal(); void refresh();}
      if (event.target.closest('[data-duplicates-close]')) el('duplicatesDialog').close();
      const discard = event.target.closest('[data-discard-card]');
      if (discard) void mutate('discard_duplicate_card', {target_card_id:discard.dataset.discardCard,copies:1}, 'Carta repetida descartada. Monedas añadidas a tu cuenta.');
    });
    el('discardAllDuplicates').addEventListener('click', () => void mutate('discard_all_duplicate_cards', {}, 'Todas las repetidas descartadas. Monedas añadidas a tu cuenta.'));
    el('bannerShopClose').addEventListener('click', () => el('bannerShopDialog').close());
    el('bannerShopRefresh').addEventListener('click', () => void refresh());
    el('bannerUnequip').addEventListener('click', () => void mutate('equip_profile_banner', {target_banner_id:null}, 'Banner retirado de tu perfil.'));
    el('ownedPackOpen').addEventListener('click', () => void mutate('open_owned_card_pack', {}, 'Sobre abierto. Todas las cartas se han guardado en tu colección.'));
    el('bannerShopInventory').addEventListener('click', () => {el('bannerShopDialog').close(); if (globalThis.CardAlbum) globalThis.CardAlbum.open(el('bannerShopInventory')); else {options.openInventory(); el('packsTitle')?.focus();}});
    window.addEventListener('online', () => {if (options.session()) void refresh();});
    window.addEventListener('offline', render);
    render();
  }
  function reset() {
    generation++; state = null; busy = false; loading = false; request = null; failure = ''; notice = ''; profileTarget = null; memberBanners.clear();
    globalThis.CardAlbum?.reset();
    revealDialog.close(); el('duplicatesDialog')?.close();
    el('bannerShopDialog')?.close(); if (el('ownedPackResult')) el('ownedPackResult').replaceChildren(); render();
  }
  globalThis.BannerShop = Object.freeze({initialize, refresh, mountProfile, reset});
})();
