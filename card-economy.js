/* Fusion and market for duplicates. Every copy, coin and price check happens in
   the server RPCs; this module only lets the member choose and shows results. */
(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = value => new Intl.NumberFormat('es-ES').format(Number(value) || 0);
  // Mirrors card_fusion_tier and the recipes in fuse_duplicate_cards.
  const tiers = [
    {key:'common', label:'Comunes', editions:['common'], needs:5, gives:'Especial o Retro'},
    {key:'special', label:'Especiales y Retro', editions:['special','retro'], needs:4, gives:'Épica'},
    {key:'epic', label:'Épicas', editions:['epic'], needs:4, gives:'Legendaria'},
    {key:'legendary', label:'Legendarias', editions:['legendary'], needs:3, gives:'Full Art'},
  ];
  const fallbackRewards = {common:2, retro:4, special:4, epic:6, legendary:10, full_art:16, vice_city:20, halloween:20};
  let config, inventory = [], rewards = fallbackRewards, epoch = 0;
  const forge = {tier:'common', picks:new Map(), busy:false, notice:'', result:null};
  const market = {tab:'buy', data:null, loading:false, busy:false, notice:'', selling:'', price:0};

  const forgeDialog = document.createElement('dialog');
  forgeDialog.className = 'collection-social-dialog economy-dialog'; forgeDialog.setAttribute('aria-labelledby','forgeTitle');
  const marketDialog = document.createElement('dialog');
  marketDialog.className = 'collection-social-dialog economy-dialog'; marketDialog.setAttribute('aria-labelledby','marketTitle');
  document.body.append(forgeDialog, marketDialog);

  const design = id => globalThis.CardCollection?.catalog.find(card => card.id === id);
  const editionOf = item => item.edition || design(item.card_id)?.rarity;
  const spare = item => Math.max(0, Number(item.quantity) - 1);
  const session = () => config?.session?.();
  function failure(error) {
    if (navigator.onLine === false) return 'Sin conexión. Vuelve a intentarlo cuando tengas internet.';
    if (['PGRST202','42883','42P01'].includes(error?.code)) return 'Esta función todavía no está activada en el servidor.';
    return error?.message || 'No se pudo completar. Vuelve a intentarlo.';
  }
  async function rpc(name, args = {}) {
    if (!session()) throw new Error('Inicia sesión para usar tu colección.');
    const response = await config.rpc(name, args);
    if (response.error) throw response.error;
    return response.data;
  }
  function art(card, eager = false) {
    if (!card) return '<div class="social-trade-placeholder">?</div>';
    return `<img data-card-original="${esc(card.front)}" src="${esc(globalThis.CardCollection.thumbnail(card))}" alt="${esc(card.name)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async" width="${Number(card.width) || 948}" height="${Number(card.height) || 1660}">`;
  }
  const header = (id, kicker, title) => `<header class="social-header"><div><span class="eyebrow">${kicker}</span><h2 id="${id}" tabindex="-1">${title}</h2></div><button type="button" class="social-close" data-economy-close aria-label="Cerrar">✕</button></header>`;
  const status = text => `<div class="social-feedback" role="status" aria-live="polite" ${text ? '' : 'hidden'}>${esc(text)}</div>`;

  // Fusion ------------------------------------------------------------------
  const tier = () => tiers.find(item => item.key === forge.tier) || tiers[0];
  const picked = () => [...forge.picks.values()].reduce((sum, copies) => sum + copies, 0);
  function forgeCards() {
    return inventory.filter(item => spare(item) > 0 && tier().editions.includes(editionOf(item)) && design(item.card_id))
      .sort((a, b) => spare(b) - spare(a) || (design(a.card_id).score || 0) - (design(b.card_id).score || 0));
  }
  function renderForge() {
    if (!forgeDialog.open) return;
    const t = tier(), cards = forgeCards(), total = picked();
    const result = forge.result ? design(forge.result.card_id) : null;
    forgeDialog.innerHTML = `${header('forgeTitle','LOS NUESTROS · REPETIDAS','Fusionar')}
      <p class="social-intro">Junta repetidas de una rareza y consigue una carta de la siguiente. Si te falta alguna de esa rareza, sale una que no tienes. Siempre conservas una copia de cada carta.</p>
      <nav class="social-tabs economy-tabs" aria-label="Rareza para fusionar">${tiers.map(item => `<button type="button" data-forge-tier="${item.key}" aria-pressed="${item.key === t.key}"><span>${item.label}</span><b>${item.needs}→1</b></button>`).join('')}</nav>
      ${status(forge.notice)}
      ${result ? `<section class="economy-result"><span class="eyebrow">${forge.result.is_new ? 'NUEVA EN TU ÁLBUM' : 'HAS CONSEGUIDO'}</span><button type="button" class="social-card-art" data-economy-view="${esc(result.id)}" aria-label="Ver ${esc(result.name)}">${art(result, true)}</button><strong>${esc(result.name)}</strong><small>${esc(result.edition)}</small><button type="button" class="social-primary" data-forge-again>Seguir fusionando</button></section>` : `
      <div class="economy-recipe"><strong>${t.needs} ${t.label.toLowerCase()} → 1 ${t.gives}</strong><span>${total}/${t.needs} elegidas</span><progress max="${t.needs}" value="${Math.min(total, t.needs)}"></progress></div>
      <div class="economy-grid">${cards.map(item => {
        const card = design(item.card_id), count = forge.picks.get(item.card_id) || 0;
        return `<article class="economy-card ${count ? 'is-picked' : ''}"><div class="economy-card-art">${art(card)}</div><strong>${esc(card.name)}</strong><small>${esc(card.edition)} · ${spare(item)} repetida${spare(item) === 1 ? '' : 's'}</small><div class="economy-stepper"><button type="button" data-forge-step="-1" data-card="${esc(item.card_id)}" aria-label="Quitar una copia de ${esc(card.name)}" ${count ? '' : 'disabled'}>−</button><output aria-live="polite">${count}</output><button type="button" data-forge-step="1" data-card="${esc(item.card_id)}" aria-label="Añadir una copia de ${esc(card.name)}" ${count >= spare(item) || total >= t.needs ? 'disabled' : ''}>+</button></div></article>`;
      }).join('') || `<p class="social-empty">No tienes ${t.label.toLowerCase()} repetidas.</p>`}</div>
      <div class="economy-dock"><button type="button" data-forge-auto ${cards.length ? '' : 'disabled'}>Elegir automáticamente</button><button type="button" class="social-primary" data-forge-go ${total === t.needs && !forge.busy ? '' : 'disabled'}>${forge.busy ? 'Fusionando…' : `Fusionar ${t.needs} cartas`}</button></div>`}`;
  }
  function autoPick() {
    const t = tier(); forge.picks.clear(); let left = t.needs;
    for (const item of forgeCards()) { if (!left) break; const take = Math.min(spare(item), left); forge.picks.set(item.card_id, take); left -= take; }
    if (left) { forge.picks.clear(); forge.notice = `Necesitas ${t.needs} ${t.label.toLowerCase()} repetidas; tienes menos.`; }
  }
  async function fuse() {
    if (forge.busy) return;
    const items = [...forge.picks].filter(([, copies]) => copies > 0).map(([card_id, copies]) => ({card_id, copies}));
    forge.busy = true; forge.notice = ''; renderForge(); const token = epoch;
    try {
      const result = await rpc('fuse_duplicate_cards', {p_items: items});
      if (token !== epoch) return;
      forge.result = result; forge.picks.clear();
      await config.refreshInventory?.();
    } catch (error) { if (token === epoch) forge.notice = failure(error); }
    finally { if (token === epoch) { forge.busy = false; renderForge(); } }
  }

  // Market ------------------------------------------------------------------
  const minimum = id => rewards[design(id)?.rarity] || fallbackRewards[design(id)?.rarity] || 1;
  async function loadMarket() {
    market.loading = true; renderMarket(); const token = epoch;
    try { const data = await rpc('get_card_market'); if (token === epoch) market.data = data; }
    catch (error) { if (token === epoch) market.notice = failure(error); }
    finally { if (token === epoch) { market.loading = false; renderMarket(); } }
  }
  function listingTile(listing, owned) {
    const card = design(listing.card_id); if (!card) return '';
    const action = owned
      ? `<button type="button" data-market-cancel="${esc(listing.id)}" ${market.busy ? 'disabled' : ''}>Retirar</button>`
      : `<button type="button" class="social-primary" data-market-buy="${esc(listing.id)}" data-price="${esc(listing.price)}" ${market.busy ? 'disabled' : ''}>Comprar · ${number(listing.price)}</button>`;
    return `<article class="economy-card"><button type="button" class="economy-card-art" data-economy-view="${esc(card.id)}" aria-label="Ver ${esc(card.name)}">${art(card)}</button><strong>${esc(card.name)}</strong><small>${esc(card.edition)}${owned ? '' : ` · ${esc(listing.seller_name)}`}</small><span class="economy-price">${number(listing.price)} monedas</span>${action}</article>`;
  }
  function sellPanel() {
    const card = design(market.selling);
    if (card) {
      const min = minimum(card.id);
      return `<section class="economy-sell"><div class="economy-card-art">${art(card, true)}</div><div><strong>${esc(card.name)}</strong><small>${esc(card.edition)}</small>
        <label class="social-field"><span>Precio en monedas (mínimo ${min}, lo que da al descartarla)</span><input type="number" inputmode="numeric" min="${min}" max="1000" step="1" value="${market.price || min * 3}" data-market-price></label>
        <p class="social-help">La copia queda reservada mientras esté a la venta. Puedes retirarla cuando quieras y vuelve a tu álbum.</p>
        <div class="economy-dock"><button type="button" data-market-sell-cancel>Cancelar</button><button type="button" class="social-primary" data-market-publish ${market.busy ? 'disabled' : ''}>Poner a la venta</button></div></div></section>`;
    }
    const mine = (market.data?.listings || []).filter(item => item.mine);
    const duplicates = inventory.filter(item => spare(item) > 0 && design(item.card_id)).sort((a, b) => (design(b.card_id).score || 0) - (design(a.card_id).score || 0));
    return `${mine.length ? `<div class="social-section-title"><span>A LA VENTA · ${mine.length}/8</span><h3>Tus cartas en el mercado</h3></div><div class="economy-grid">${mine.map(item => listingTile(item, true)).join('')}</div>` : ''}
      <div class="social-section-title"><span>TUS REPETIDAS</span><h3>¿Qué quieres vender?</h3></div>
      <div class="economy-grid">${duplicates.map(item => { const c = design(item.card_id); return `<article class="economy-card"><div class="economy-card-art">${art(c)}</div><strong>${esc(c.name)}</strong><small>${esc(c.edition)} · ${spare(item)} repetida${spare(item) === 1 ? '' : 's'}</small><button type="button" data-market-sell="${esc(item.card_id)}" ${mine.length >= 8 ? 'disabled' : ''}>Vender</button></article>`; }).join('') || '<p class="social-empty">No tienes repetidas para vender.</p>'}</div>`;
  }
  function renderMarket() {
    if (!marketDialog.open) return;
    const scroll = marketDialog.scrollTop;
    const listings = (market.data?.listings || []).filter(item => !item.mine);
    const history = market.data?.history || [];
    marketDialog.innerHTML = `${header('marketTitle','LOS NUESTROS · ENTRE MIEMBROS','Mercado')}
      <p class="social-intro">Compra repetidas de otros miembros con monedas o vende las tuyas. Saldo: <strong>${market.data ? number(market.data.balance) : '—'} monedas</strong>.</p>
      <nav class="social-tabs economy-tabs" aria-label="Mercado">${[['buy','Comprar',listings.length],['sell','Vender',(market.data?.listings || []).filter(item => item.mine).length],['history','Historial',history.length]].map(([key, label, count]) => `<button type="button" data-market-tab="${key}" aria-pressed="${market.tab === key}"><span>${label}</span><b>${count}</b></button>`).join('')}</nav>
      ${status(market.notice || (market.loading ? 'Cargando el mercado…' : ''))}
      ${market.tab === 'buy' ? `<div class="economy-grid">${listings.map(item => listingTile(item, false)).join('') || `<p class="social-empty">${market.loading ? '' : 'No hay cartas a la venta ahora mismo.'}</p>`}</div>` : ''}
      ${market.tab === 'sell' ? sellPanel() : ''}
      ${market.tab === 'history' ? `<ol class="economy-history">${history.map(item => { const c = design(item.card_id); return `<li><strong>${esc(c?.name || item.card_id)}</strong><span>${item.status === 'cancelled' ? 'Retirada' : item.role === 'seller' ? `Vendida por ${number(item.price)}` : `Comprada por ${number(item.price)}`}</span><time>${esc(new Date(item.closed_at).toLocaleDateString('es-ES', {day:'numeric', month:'short'}))}</time></li>`; }).join('') || '<p class="social-empty">Todavía no has comprado ni vendido.</p>'}</ol>` : ''}`;
    marketDialog.scrollTop = scroll;
  }
  async function marketAction(name, args, success) {
    if (market.busy) return;
    market.busy = true; market.notice = ''; renderMarket(); const token = epoch;
    try {
      await rpc(name, args);
      if (token !== epoch) return;
      market.notice = success; market.selling = ''; market.price = 0;
      await Promise.all([config.refreshInventory?.(), loadMarket()]);
      globalThis.ClubCoinMissions?.activity?.({refreshWallet:true});
    } catch (error) { if (token === epoch) market.notice = failure(error); }
    finally { if (token === epoch) { market.busy = false; renderMarket(); } }
  }

  // Shared wiring -----------------------------------------------------------
  function open(dialog, render, opener) {
    dialog._opener = opener || document.activeElement;
    if (!dialog.open) dialog.showModal();
    render(); dialog.querySelector('h2')?.focus({preventScroll:true});
  }
  function openForge(opener) { forge.result = null; forge.notice = ''; forge.picks.clear(); open(forgeDialog, renderForge, opener); }
  function openMarket(opener) { market.notice = ''; market.selling = ''; open(marketDialog, renderMarket, opener); void loadMarket(); }
  for (const dialog of [forgeDialog, marketDialog]) {
    dialog.addEventListener('close', () => { const opener = dialog._opener; if (opener?.isConnected) opener.focus({preventScroll:true}); });
  }
  forgeDialog.addEventListener('click', event => {
    if (event.target.closest('[data-economy-close]')) forgeDialog.close();
    const view = event.target.closest('[data-economy-view]'); if (view) globalThis.CardCollection?.open(view.dataset.economyView, view);
    const tab = event.target.closest('[data-forge-tier]'); if (tab) { forge.tier = tab.dataset.forgeTier; forge.picks.clear(); forge.notice = ''; renderForge(); }
    const step = event.target.closest('[data-forge-step]');
    if (step) { const id = step.dataset.card, next = Math.max(0, (forge.picks.get(id) || 0) + Number(step.dataset.forgeStep)); if (next) forge.picks.set(id, next); else forge.picks.delete(id); forge.notice = ''; renderForge(); forgeDialog.querySelector(`[data-forge-step="${step.dataset.forgeStep}"][data-card="${CSS.escape(id)}"]`)?.focus({preventScroll:true}); }
    if (event.target.closest('[data-forge-auto]')) { forge.notice = ''; autoPick(); renderForge(); }
    if (event.target.closest('[data-forge-go]')) void fuse();
    if (event.target.closest('[data-forge-again]')) { forge.result = null; renderForge(); }
  });
  marketDialog.addEventListener('click', event => {
    if (event.target.closest('[data-economy-close]')) marketDialog.close();
    const view = event.target.closest('[data-economy-view]'); if (view) globalThis.CardCollection?.open(view.dataset.economyView, view);
    const tab = event.target.closest('[data-market-tab]'); if (tab) { market.tab = tab.dataset.marketTab; market.notice = ''; market.selling = ''; renderMarket(); }
    const sell = event.target.closest('[data-market-sell]'); if (sell) { market.selling = sell.dataset.marketSell; market.price = minimum(market.selling) * 3; renderMarket(); marketDialog.scrollTop = 0; }
    if (event.target.closest('[data-market-sell-cancel]')) { market.selling = ''; renderMarket(); }
    if (event.target.closest('[data-market-publish]')) {
      const price = Math.round(Number(marketDialog.querySelector('[data-market-price]')?.value));
      void marketAction('list_card_for_sale', {target_card_id: market.selling, asking_price: price}, 'Carta puesta a la venta.');
    }
    const cancel = event.target.closest('[data-market-cancel]'); if (cancel) void marketAction('cancel_card_listing', {target_listing_id: Number(cancel.dataset.marketCancel)}, 'Carta retirada. Vuelve a estar en tu álbum.');
    const buy = event.target.closest('[data-market-buy]'); if (buy) void marketAction('buy_card_listing', {target_listing_id: Number(buy.dataset.marketBuy), expected_price: Number(buy.dataset.price)}, 'Compra hecha. La carta ya está en tu álbum.');
  });
  marketDialog.addEventListener('input', event => { if (event.target.matches('[data-market-price]')) market.price = Number(event.target.value); });
  document.addEventListener('click', event => {
    const forgeOpener = event.target.closest('[data-forge-open]'); if (forgeOpener) openForge(forgeOpener);
    const marketOpener = event.target.closest('[data-market-open]'); if (marketOpener) openMarket(marketOpener);
  });
  document.addEventListener('bb:card-catalog-updated', () => { renderForge(); renderMarket(); });

  globalThis.CardEconomy = Object.freeze({
    initialize(options) { config = options; },
    update(cards, discardRewards) {
      inventory = cards || [];
      if (discardRewards && typeof discardRewards === 'object') rewards = {...fallbackRewards, ...discardRewards};
      if (!forge.busy) renderForge();
      if (!market.busy && !market.selling) renderMarket();
    },
    openForge, openMarket,
    reset() { epoch++; inventory = []; forge.picks.clear(); forge.result = null; forge.busy = false; market.data = null; market.busy = false; market.selling = ''; forgeDialog.close(); marketDialog.close(); },
  });
})();
