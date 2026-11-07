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
  forgeDialog.className = 'economy-dialog'; forgeDialog.setAttribute('aria-labelledby','forgeTitle');
  const marketDialog = document.createElement('dialog');
  marketDialog.className = 'economy-dialog'; marketDialog.setAttribute('aria-labelledby','marketTitle');
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
  // Same look as Repetidas: a big heading, the Chota with a line, pill chips,
  // a light card grid and a floating bar for the main action.
  const header = (id, kicker, title) => `<header class="eco-head"><div><span class="eco-kicker">${kicker}</span><h2 id="${id}" tabindex="-1">${title}</h2></div><button type="button" class="eco-close" data-economy-close aria-label="Cerrar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>`;
  const status = text => `<p class="eco-status" role="status" aria-live="polite" ${text ? '' : 'hidden'}>${esc(text)}</p>`;
  const chota = (line, mood = 'wave') => `<div class="dup-chota eco-chota" data-mood="${mood}"><i class="dup-chota-sprite" aria-hidden="true"></i><p>${esc(line)}</p></div>`;
  const rarityTone = {common:'#a39d92', retro:'#d0804f', special:'#34c0d9', epic:'#bf5af2', legendary:'#ffae2a', full_art:'#f5d06b', vice_city:'#ff5fb4', halloween:'#ff8a2b'};
  const tone = card => rarityTone[card?.rarity] || rarityTone.common;
  const chip = (attr, value, label, pressed, count, color) => `<button type="button" ${attr}="${value}" aria-pressed="${pressed}">${color ? `<i style="--rarity:${color}"></i>` : ''}<span>${esc(label)}</span>${count == null ? '' : `<b>${esc(count)}</b>`}</button>`;

  // Fusion ------------------------------------------------------------------
  const tier = () => tiers.find(item => item.key === forge.tier) || tiers[0];
  const picked = () => [...forge.picks.values()].reduce((sum, copies) => sum + copies, 0);
  function forgeCards() {
    return inventory.filter(item => spare(item) > 0 && tier().editions.includes(editionOf(item)) && design(item.card_id))
      .sort((a, b) => spare(b) - spare(a) || (design(a.card_id).score || 0) - (design(b.card_id).score || 0));
  }
  const tierTone = {common:rarityTone.common, special:rarityTone.special, epic:rarityTone.epic, legendary:rarityTone.legendary};
  function forgeLine(t, cards, total) {
    if (forge.busy) return ['calm', 'Fusionando… no mires, que es secreto.'];
    if (forge.result) return ['cheer', forge.result.is_new ? '¡Sale nueva para tu álbum! Así da gusto.' : '¡Hecho! Mira lo que ha salido del horno.'];
    if (forge.notice) return ['calm', forge.notice];
    const available = cards.reduce((sum, item) => sum + spare(item), 0);
    if (available < t.needs) return ['calm', available ? `Tienes ${available} de ${t.needs}. Abre más sobres y vuelve, que aquí te espero.` : `No tienes ${t.label.toLowerCase()} repetidas. Abre sobres y vuelve.`];
    if (total === t.needs) return ['cheer', '¡Listo! Pulsa fusionar y que salten chispas.'];
    if (total) return ['wave', `Llevas ${total} de ${t.needs}. ¡Dale, que ya casi!`];
    return ['wave', `Dame ${t.needs} ${t.label.toLowerCase()} repetidas y te saco una ${t.gives}. Yo pongo el martillo.`];
  }
  function renderForge() {
    if (!forgeDialog.open) return;
    const t = tier(), cards = forgeCards(), total = picked();
    const result = forge.result ? design(forge.result.card_id) : null;
    const [mood, line] = forgeLine(t, cards, total);
    forgeDialog.innerHTML = `${header('forgeTitle','LOS NUESTROS · REPETIDAS','Fusionar')}
      ${chota(line, mood)}
      <nav class="eco-chips" aria-label="Rareza para fusionar">${tiers.map(item => chip('data-forge-tier', item.key, item.label, item.key === t.key, `${item.needs}→1`, tierTone[item.key])).join('')}</nav>
      ${result ? `<section class="economy-result"><span class="eco-kicker">${forge.result.is_new ? 'NUEVA EN TU ÁLBUM' : 'HAS CONSEGUIDO'}</span><button type="button" class="social-card-art" data-economy-view="${esc(result.id)}" aria-label="Ver ${esc(result.name)}">${art(result, true)}</button><strong>${esc(result.name)}</strong><small style="color:${tone(result)}">${esc(result.edition)}</small><button type="button" class="eco-primary" data-forge-again>Seguir fusionando</button></section>` : `
      <div class="eco-toolbar"><p class="eco-recipe"><strong>${t.needs} ${t.label.toLowerCase()} → 1 ${t.gives}</strong><span>Siempre conservas una copia de cada carta. Si te falta alguna de la siguiente rareza, sale una que no tienes.</span></p><button type="button" class="eco-primary" data-forge-auto ${cards.length ? '' : 'disabled'}>Elegir solas</button></div>
      <div class="eco-grid">${cards.map(item => {
        const card = design(item.card_id), count = forge.picks.get(item.card_id) || 0;
        return `<article class="eco-card${count ? ' is-picked' : ''}" style="--rarity:${tone(card)}"><div class="eco-art">${art(card)}<span class="eco-count">×${spare(item)}</span>${count ? `<span class="eco-check" aria-hidden="true">${count}</span>` : ''}</div><h4>${esc(card.name)}</h4><p>${esc(card.edition)}</p><div class="eco-stepper"><button type="button" data-forge-step="-1" data-card="${esc(item.card_id)}" aria-label="Quitar una copia de ${esc(card.name)}" ${count ? '' : 'disabled'}>−</button><output aria-live="polite">${count}</output><button type="button" data-forge-step="1" data-card="${esc(item.card_id)}" aria-label="Añadir una copia de ${esc(card.name)}" ${count >= spare(item) || total >= t.needs ? 'disabled' : ''}>+</button></div></article>`;
      }).join('') || `<p class="eco-empty">No tienes ${t.label.toLowerCase()} repetidas.</p>`}</div>
      <div class="eco-bar"><span><span><b>${total}/${t.needs}</b> elegidas</span><i class="eco-progress" style="--done:${Math.min(1, total / t.needs)}"></i></span><button type="button" data-forge-go ${total === t.needs && !forge.busy ? '' : 'disabled'}>${forge.busy ? 'Fusionando…' : 'Fusionar'}</button></div>`}`;
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
      ? `<button type="button" class="eco-quiet" data-market-cancel="${esc(listing.id)}" ${market.busy ? 'disabled' : ''}>Retirar</button>`
      : `<button type="button" class="eco-buy" data-market-buy="${esc(listing.id)}" data-price="${esc(listing.price)}" ${market.busy ? 'disabled' : ''}>Comprar · ${number(listing.price)}</button>`;
    return `<article class="eco-card" style="--rarity:${tone(card)}"><button type="button" class="eco-art" data-economy-view="${esc(card.id)}" aria-label="Ver ${esc(card.name)}">${art(card)}<span class="eco-count eco-price">${number(listing.price)}</span></button><h4>${esc(card.name)}</h4><p>${esc(card.edition)}${owned ? '' : ` · ${esc(listing.seller_name)}`}</p>${action}</article>`;
  }
  function sellPanel() {
    const card = design(market.selling);
    if (card) {
      const min = minimum(card.id);
      return `<section class="eco-sell"><div class="eco-art">${art(card, true)}</div><div><h4>${esc(card.name)}</h4><p style="color:${tone(card)}">${esc(card.edition)}</p>
        <label class="eco-field"><span>Precio en monedas (mínimo ${min}, lo que da al descartarla)</span><input type="number" inputmode="numeric" min="${min}" max="1000" step="1" value="${market.price || min * 3}" data-market-price></label>
        <p class="eco-help">La copia queda reservada mientras esté a la venta. Puedes retirarla cuando quieras y vuelve a tu álbum.</p></div></section>
        <div class="eco-bar"><button type="button" class="eco-bar-quiet" data-market-sell-cancel>Cancelar</button><button type="button" data-market-publish ${market.busy ? 'disabled' : ''}>Poner a la venta</button></div>`;
    }
    const mine = (market.data?.listings || []).filter(item => item.mine);
    const duplicates = inventory.filter(item => spare(item) > 0 && design(item.card_id)).sort((a, b) => (design(b.card_id).score || 0) - (design(a.card_id).score || 0));
    return `${mine.length ? `<h3 class="eco-section">A la venta · ${mine.length}/8</h3><div class="eco-grid">${mine.map(item => listingTile(item, true)).join('')}</div>` : ''}
      <h3 class="eco-section">Tus repetidas</h3>
      <div class="eco-grid">${duplicates.map(item => { const c = design(item.card_id); return `<article class="eco-card" style="--rarity:${tone(c)}"><div class="eco-art">${art(c)}<span class="eco-count">×${spare(item)}</span></div><h4>${esc(c.name)}</h4><p>${esc(c.edition)}</p><button type="button" class="eco-quiet" data-market-sell="${esc(item.card_id)}" ${mine.length >= 8 ? 'disabled' : ''}>Vender</button></article>`; }).join('') || '<p class="eco-empty">No tienes repetidas para vender.</p>'}</div>`;
  }
  function marketLine(listings, mine) {
    if (market.busy) return ['calm', 'Un momento, que estoy contando monedas…'];
    if (market.notice) return [/vendid|hecha|venta\.|retirada/i.test(market.notice) ? 'cheer' : 'calm', market.notice];
    if (market.loading && !market.data) return ['wave', 'Abriendo el mercado, que aquí se madruga.'];
    if (market.tab === 'sell') {
      const card = design(market.selling);
      if (card) { const min = minimum(card.id); return ['wave', `Mínimo ${min} monedas. Yo pediría ${min * 3}, pero tú mandas.`]; }
      return ['wave', mine ? `Tienes ${mine} a la venta. Paciencia, que ya picará alguien.` : '¿Vendes alguna repetida? Pon buen precio, que aquí se regatea.'];
    }
    if (market.tab === 'history') return ['calm', 'Aquí queda todo lo que has comprado y vendido. Yo no olvido nada.'];
    const balance = market.data ? number(market.data.balance) : '—';
    return listings ? ['wave', `Hay ${listings} ${listings === 1 ? 'carta' : 'cartas'} a la venta y tienes ${balance} monedas. Gástalas con cabeza.`] : ['calm', 'Hoy el mercado está vacío. Vuelve luego, que esto se mueve.'];
  }
  function renderMarket() {
    if (!marketDialog.open) return;
    const scroll = marketDialog.scrollTop;
    const listings = (market.data?.listings || []).filter(item => !item.mine);
    const mine = (market.data?.listings || []).filter(item => item.mine).length;
    const history = market.data?.history || [];
    const [mood, line] = marketLine(listings.length, mine);
    marketDialog.innerHTML = `${header('marketTitle','LOS NUESTROS · ENTRE MIEMBROS','Mercado')}
      ${chota(line, mood)}
      <div class="eco-toolbar"><p class="eco-wallet">Saldo <strong>${market.data ? number(market.data.balance) : '—'} monedas</strong></p></div>
      <nav class="eco-chips" aria-label="Mercado">${[['buy','Comprar',listings.length],['sell','Vender',mine],['history','Historial',history.length]].map(([key, label, count]) => chip('data-market-tab', key, label, market.tab === key, count)).join('')}</nav>
      ${market.tab === 'buy' ? `<div class="eco-grid">${listings.map(item => listingTile(item, false)).join('') || `<p class="eco-empty">${market.loading ? 'Cargando…' : 'No hay cartas a la venta ahora mismo.'}</p>`}</div>` : ''}
      ${market.tab === 'sell' ? sellPanel() : ''}
      ${market.tab === 'history' ? `<ol class="eco-history">${history.map(item => { const c = design(item.card_id); return `<li><strong>${esc(c?.name || item.card_id)}</strong><span>${item.status === 'cancelled' ? 'Retirada' : item.role === 'seller' ? `Vendida por ${number(item.price)}` : `Comprada por ${number(item.price)}`}</span><time>${esc(new Date(item.closed_at).toLocaleDateString('es-ES', {day:'numeric', month:'short'}))}</time></li>`; }).join('') || '<p class="eco-empty">Todavía no has comprado ni vendido.</p>'}</ol>` : ''}`;
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
