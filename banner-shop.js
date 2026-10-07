/* Wallet, inventory and purchases are authoritative server RPC results. */
(() => {
  let options, state = null, busy = false, loading = false, failure = '', notice = '', generation = 0, request = null, profileTarget = null;
  const memberBanners = new Map();
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
    globalThis.CardAlbum?.update({cards:state?.cards || null, loading, failure});
    const status = el('bannerShopStatus');
    if (status) { status.textContent = failure || (loading ? 'Actualizando colección…' : notice); status.classList.toggle('is-error', !!failure); }
    if (el('bannerShopBalance')) el('bannerShopBalance').textContent = coins();
    if (el('bannerShopRefresh')) el('bannerShopRefresh').disabled = busy || loading;
    if (el('ownedInventoryRefresh')) el('ownedInventoryRefresh').disabled = busy || loading;
    if (el('ownedPackOpen')) el('ownedPackOpen').disabled = busy || loading || !state?.available_packs?.length || !online();
    if (el('ownedPacksCount')) el('ownedPacksCount').textContent = state ? `${state.available_packs.length} sobres disponibles` : 'Colección pendiente de sincronización';
    if (el('inventoryStatus')) el('inventoryStatus').textContent = failure || notice || (loading ? 'Actualizando colección…' : 'Conservas una copia de cada carta. Puedes descartar las repetidas para conseguir monedas.');
    if (el('packRarityOdds')) el('packRarityOdds').textContent = state?.rarity_probabilities ? Object.keys(rarityNames).filter(rarity => state.rarity_probabilities[rarity] != null).map(rarity => `${rarityNames[rarity]}: ${state.rarity_probabilities[rarity]}%`).join(' · ') : 'Actualiza para consultar las probabilidades.';
    const container = el('bannerShopItems');
    if (container) container.innerHTML = state ? (state.banners || []).map(banner => `<article class="banner-shop-item">${artwork(banner)}<h3>${escape(banner.name)}</h3><p>${escape(banner.description)}</p><span>${banner.owned ? 'En tu colección' : `${escape(banner.price)} ${Number(banner.price) === 1 ? 'moneda' : 'monedas'}`}</span><button class="packs-sync" type="button" data-banner-action="${banner.owned ? 'equip' : 'buy'}" data-banner-id="${escape(banner.id)}" ${busy || loading || banner.equipped || (!banner.owned && Number(state.balance) < Number(banner.price)) || !online() ? 'disabled' : ''}>${banner.equipped ? 'Equipado' : banner.owned ? 'Equipar' : 'Comprar'}</button></article>`).join('') : '<p>Actualiza para consultar los banners disponibles.</p>';
    if (el('bannerUnequip')) el('bannerUnequip').disabled = busy || loading || !state?.equipped_banner_id || !online();
    const inventory = el('ownedCardInventory');
    if (inventory) inventory.innerHTML = state ? (state.cards.length ? state.cards.map(item => {
      const design = card(item.card_id), reward = state.discard_rewards?.[item.edition] || 1;
      return `<article class="owned-card">${design ? `<img src="${escape(design.front)}" alt="${escape(design.name)}" loading="lazy" decoding="async">` : ''}<h4>${escape(design?.name || item.card_id)}</h4><p>${escape(design?.edition || item.edition)} · ${escape(item.quantity)} ${Number(item.quantity) === 1 ? 'copia' : 'copias'}</p>${Number(item.quantity) > 1 ? `<button type="button" class="packs-sync" data-discard-card="${escape(item.card_id)}" ${busy || loading || !online() ? 'disabled' : ''}>Descartar 1 repetida · +${escape(reward)} monedas</button>` : '<small>Única copia</small>'}</article>`;
    }).join('') : '<p>Abre un sobre guardado para conseguir tu primera carta.</p>') : '<p>Tu inventario se mostrará al sincronizar la colección.</p>';
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
  async function mutate(name, args, message) {
    if (busy || loading) return;
    const token = generation, user = options.session();
    const focus = document.activeElement;
    const focusCard = focus?.dataset?.discardCard;
    const focusBanner = focus?.dataset?.bannerId;
    busy = true; failure = ''; notice = ''; render();
    try {
      const data = await rpc(name, args);
      if (token !== generation || user !== options.session()) return;
      // A successful spend invalidates the old wallet until the server refreshes it.
      state = null;
      if (name === 'open_owned_card_pack') {
        const draws = data.cards || (data.card ? [data.card] : []);
        el('ownedPackResult').innerHTML = `<h4>${draws.length} cartas conseguidas</h4><div class="owned-pack-cards">${draws.map(item => {
          const design = card(item.card_id);
          return `<article class="owned-pack-card">${design ? `<img src="${escape(design.front)}" alt="${escape(design.name)}" loading="lazy" decoding="async">` : ''}<h5>${escape(design?.name || item.card_id)}</h5><p>${escape(rarityNames[item.edition] || item.edition)}${Number(item.quantity) > 1 ? ' · Repetida' : ' · Nueva'}</p></article>`;
        }).join('')}</div>`;
        await options.synchronizePacks?.(true);
        if (token !== generation || user !== options.session()) return;
      }
      notice = message;
      await refresh();
    } catch (error) { if (token === generation) failure = errorMessage(error); }
    finally {if (token === generation) {busy = false; render();
      const destination = [...document.querySelectorAll('[data-discard-card], [data-banner-id]')].find(button => !button.disabled && ((focusCard && button.dataset.discardCard === focusCard) || (focusBanner && button.dataset.bannerId === focusBanner)));
      if (destination) destination.focus({preventScroll:true});
      else if (focusCard) el('ownedInventoryTitle')?.focus({preventScroll:true});
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
      const discard = event.target.closest('[data-discard-card]');
      if (discard) void mutate('discard_duplicate_card', {target_card_id:discard.dataset.discardCard,copies:1}, 'Carta repetida descartada. Monedas añadidas a tu cuenta.');
    });
    el('bannerShopClose').addEventListener('click', () => el('bannerShopDialog').close());
    el('bannerShopRefresh').addEventListener('click', () => void refresh());
    el('ownedInventoryRefresh').addEventListener('click', () => void refresh());
    el('bannerUnequip').addEventListener('click', () => void mutate('equip_profile_banner', {target_banner_id:null}, 'Banner retirado de tu perfil.'));
    el('ownedPackOpen').addEventListener('click', () => void mutate('open_owned_card_pack', {}, 'Sobre abierto. Todas las cartas se han guardado en tu colección.'));
    el('bannerShopInventory').addEventListener('click', () => {el('bannerShopDialog').close(); if (globalThis.CardAlbum) globalThis.CardAlbum.open(el('bannerShopInventory')); else {options.openInventory(); el('ownedInventoryTitle')?.focus();}});
    window.addEventListener('online', () => {if (options.session()) void refresh();});
    window.addEventListener('offline', render);
    render();
  }
  function reset() {
    generation++; state = null; busy = false; loading = false; request = null; failure = ''; notice = ''; profileTarget = null; memberBanners.clear();
    globalThis.CardAlbum?.reset();
    el('bannerShopDialog')?.close(); if (el('ownedPackResult')) el('ownedPackResult').replaceChildren(); render();
  }
  globalThis.BannerShop = Object.freeze({initialize, refresh, mountProfile, reset});
})();
