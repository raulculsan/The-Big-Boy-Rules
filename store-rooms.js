/* Inside the club store: each department opens on its own piece of furniture,
   the Chota models coats in a fitting room, and every purchase passes through
   a checkout sheet that shows what is being bought and what it costs. The
   purchase itself still runs through each shop's own server call. */
(() => {
  'use strict';
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motionQuality === 'low';
  const dialog = () => document.getElementById('bannerShopDialog');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const coins = value => Number(value || 0).toLocaleString('es-ES');

  // ── The Chota as a model: idle with small gestures, a turn when trying a coat on,
  // a jump when one is bought. Frames follow chota-poses.webp (6 × 4).
  const IDLE = [0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,5,5,5,0,0,0,0,0,0];
  const SHOW_OFF = [2,3,4,3,4,3,2,0];
  const CELEBRATE = [13,14,15,15,15,14,0];
  const players = new WeakMap();
  function setFrame(node, frame) {
    node.style.setProperty('--fx', `${(frame % 6) * 20}%`);
    node.style.setProperty('--fy', `${Math.floor(frame / 6) * (100 / 3)}%`);
  }
  function play(node, frames) {
    if (!node) return;
    const player = players.get(node) || {idle: 0, queue: []};
    player.queue = reduced() ? [] : [...frames];
    players.set(node, player);
    if (reduced()) setFrame(node, 0);
  }
  setInterval(() => {
    if (document.hidden || (!dialog()?.open && !document.getElementById('chotaInventoryDialog')?.open)) return;
    for (const node of document.querySelectorAll('[data-chota-fitting]')) {
      if (!node.offsetParent) continue;
      const player = players.get(node) || {idle: 0, queue: []};
      players.set(node, player);
      if (reduced()) { setFrame(node, 0); continue; }
      const frame = player.queue.length ? player.queue.shift() : IDLE[player.idle++ % IDLE.length];
      setFrame(node, frame);
    }
  }, 150);

  // ── Department entrances: the furniture the member tapped, with the Chota's line.
  const halls = {
    banners: {art: 'icons/shop/club-store-v1/banners-display-v1.webp', title: 'Banners', line: 'Cambian cada día. Si te gusta uno, no lo dejes para mañana.'},
    vouchers: {art: 'icons/shop/club-store-v1/vouchers-counter-v1.webp', title: 'Vales', line: 'Premios de verdad. Los canjeas cuando quieras.'},
    accessories: {art: 'icons/shop/club-store-v1/accessories-shelf-v1.webp', title: 'Para la sede', line: 'Todo lo que compres aparece en mi habitación.'},
  };
  function paintHall() {
    const shop = dialog(), content = shop?.querySelector('.shop-content');
    if (!shop || !content) return;
    const view = shop.dataset.storeView, hall = halls[view];
    let hero = document.getElementById('storeHall');
    if (!hall) { if (hero) hero.hidden = true; return; }
    if (!hero) {
      hero = document.createElement('header');
      hero.id = 'storeHall';
      hero.className = 'store-hall';
      hero.innerHTML = '<div class="store-hall-copy"><h3></h3><p class="store-hall-line"><span class="store-hall-chota" aria-hidden="true"></span><span></span></p></div><img class="store-hall-art" alt="" decoding="async" draggable="false">';
      content.prepend(hero);
    }
    hero.hidden = false;
    hero.dataset.hall = view;
    hero.querySelector('h3').textContent = hall.title;
    hero.querySelector('.store-hall-line span:last-child').textContent = hall.line;
    const img = hero.querySelector('img');
    if (img.getAttribute('src') !== hall.art) img.src = hall.art;
    if (!reduced()) hero.animate([{opacity: 0, transform: 'translateY(6px)'}, {opacity: 1, transform: 'none'}], {duration: 320, easing: 'cubic-bezier(.16,1,.3,1)'});
  }
  function watchViews() {
    const shop = dialog();
    if (!shop) return;
    new MutationObserver(() => {
      if (current?.state !== 'buying') close();
      paintHall();
      if (shop.dataset.storeView === 'clothing') requestAnimationFrame(() => play(document.querySelector('[data-chota-fitting]'), SHOW_OFF));
    }).observe(shop, {attributes: true, attributeFilter: ['data-store-view']});
    // Hangers behave as one radio group: arrows move between coats.
    shop.addEventListener('keydown', event => {
      const hanger = event.target.closest?.('[data-clothing-try]');
      if (!hanger || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const all = [...hanger.parentElement.querySelectorAll('[data-clothing-try]')];
      const index = all.indexOf(hanger);
      const next = event.key === 'Home' ? all[0] : event.key === 'End' ? all.at(-1) : all[(index + (event.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length];
      event.preventDefault();
      next.click();
      next.focus();
      next.scrollIntoView({block: 'nearest', inline: 'nearest'});
    });
  }

  // ── Checkout.
  const kinds = {
    clothing: {label: 'Abrigo para el Chota', note: 'Se lo pondrá en cuanto lo compres.', done: 'Ya lo lleva puesto. Míralo en la sede.'},
    shirt: {label: 'Camiseta para el Chota', note: 'Se la pondrá en cuanto la compres.', done: 'Ya la lleva puesta. Míralo en la sede.'},
    trousers: {label: 'Pantalón para el Chota', note: 'Se los pondrá en cuanto los compres.', done: 'Ya los lleva puestos. Míralo en la sede.'},
    banner: {label: 'Banner de perfil', note: 'Lo podrás poner en la cabecera de tu perfil.', done: 'Ya es tuyo. Equípalo cuando quieras.'},
    voucher: {label: 'Vale del club', note: 'Se guarda en Vales para canjearlo cuando quieras.', done: 'Vale guardado. Canjéalo cuando quieras.'},
    object: {label: 'Objeto para la sede', note: 'Aparecerá en la habitación del Chota.', done: 'Ya está en su habitación.'},
    style: {label: 'Estilo de la sede', note: 'Cambia las paredes y el suelo de la sede.', done: 'La sede ya luce el estilo nuevo.'},
  };
  let bypass = false, current = null;
  const BUY = '[data-chota-buy], [data-banner-action="buy"], [data-voucher-action="unlock"]';
  const number = node => Number(String(node?.textContent || '').replace(/\D/g, '')) || 0;
  function balance() {
    const text = document.getElementById('bannerShopBalance')?.textContent || '';
    return /\d/.test(text) ? number({textContent: text}) : null;
  }
  function describe(button) {
    if (button.matches('[data-chota-buy]')) {
      const id = button.dataset.chotaBuy;
      if (button.dataset.checkoutKind === 'clothing') return {kind: button.dataset.checkoutSlot === 'bottomwear' ? 'trousers' : button.dataset.checkoutSlot === 'topwear' ? 'shirt' : 'clothing', id, name: button.dataset.checkoutName, desc: button.dataset.checkoutDesc, price: Number(button.dataset.checkoutPrice) || 0, coat: button.dataset.checkoutCoat || '', pants: button.dataset.checkoutPants || '', shirt: button.dataset.checkoutShirt || '', selector: `[data-chota-buy="${CSS.escape(id)}"]`};
      const article = button.closest('[data-chota-item]');
      return {kind: article?.classList.contains('chota-shop-style') ? 'style' : 'object', id, name: article?.querySelector('h4')?.textContent, desc: article?.querySelector('p')?.textContent, price: number(article?.querySelector('.chota-shop-purchase strong')), art: article?.querySelector('.chota-shop-object')?.innerHTML || '', selector: `[data-chota-buy="${CSS.escape(id)}"]`};
    }
    const article = button.closest('article');
    if (button.matches('[data-banner-action]')) return {kind: 'banner', id: button.dataset.bannerId, name: article?.querySelector('h3')?.textContent, desc: article?.querySelector('p')?.textContent, price: number(article?.querySelector('.shop-price strong')), art: article?.querySelector('.shop-artwork')?.innerHTML || '', selector: `[data-banner-action="buy"][data-banner-id="${CSS.escape(button.dataset.bannerId)}"]`};
    return {kind: 'voucher', id: button.dataset.voucherId, name: article?.querySelector('h3')?.textContent, desc: article?.querySelector('p')?.textContent, price: number(article?.querySelector('.shop-price strong')), art: article?.querySelector('.shop-voucher-art')?.innerHTML || '', selector: `[data-voucher-action="unlock"][data-voucher-id="${CSS.escape(button.dataset.voucherId)}"]`};
  }
  function preview(item) {
    const layer = (name, url) => `<span class="fitting-chota-${name}"${url ? ` style="background-image:url('${esc(url)}')"` : ''}></span>`;
    if (['clothing', 'trousers', 'shirt'].includes(item.kind)) return `<div class="checkout-model"><span class="checkout-glow"></span><span class="fitting-chota" data-chota-fitting><span class="fitting-chota-body"></span>${layer('pants', item.pants)}${layer('shirt', item.shirt)}${layer('coat', item.coat)}</span><span class="checkout-floor"></span></div>`;
    return `<div class="checkout-art checkout-art--${item.kind}">${item.art}</div>`;
  }
  function sheet() {
    let node = document.getElementById('storeCheckout');
    if (node) return node;
    node = document.createElement('div');
    node.id = 'storeCheckout';
    node.className = 'store-checkout';
    node.hidden = true;
    node.innerHTML = `<div class="checkout-scrim" data-checkout-close></div><section class="checkout-sheet" role="dialog" aria-modal="true" aria-labelledby="checkoutTitle"><span class="checkout-grabber" aria-hidden="true"></span><div class="checkout-preview"></div><div class="checkout-body"><span class="checkout-kind"></span><h3 id="checkoutTitle"></h3><p class="checkout-desc"></p><dl class="checkout-receipt"><div><dt>Precio</dt><dd data-checkout-price></dd></div><div><dt>Tu saldo</dt><dd data-checkout-balance></dd></div><div class="is-total"><dt>Te quedarán</dt><dd data-checkout-after></dd></div></dl><p class="checkout-note" role="status" aria-live="polite"></p><div class="checkout-actions"><button type="button" class="checkout-cancel" data-checkout-close>Ahora no</button><button type="button" class="checkout-confirm" data-checkout-confirm></button></div></div></section>`;
    dialog().append(node);
    return node;
  }
  const coin = value => `<span class="checkout-coin" aria-hidden="true"></span>${coins(value)}`;
  function open(button) {
    const item = describe(button), node = sheet(), have = balance();
    current = {...item, opener: button, state: 'review'};
    node.dataset.kind = item.kind;
    node.dataset.state = 'review';
    node.querySelector('.checkout-preview').innerHTML = preview(item);
    node.querySelectorAll('.checkout-preview video').forEach(video => { video.muted = true; video.play?.().catch(() => {}); });
    node.querySelector('.checkout-kind').textContent = kinds[item.kind].label;
    node.querySelector('#checkoutTitle').textContent = item.name || '';
    node.querySelector('.checkout-desc').textContent = item.desc || '';
    node.querySelector('[data-checkout-price]').innerHTML = coin(item.price);
    node.querySelector('[data-checkout-balance]').innerHTML = have == null ? '—' : coin(have);
    const short = have != null && have < item.price;
    node.querySelector('.is-total dt').textContent = short ? 'Te faltan' : 'Te quedarán';
    node.querySelector('[data-checkout-after]').innerHTML = have == null ? '—' : coin(short ? item.price - have : have - item.price);
    node.querySelector('.is-total').classList.toggle('is-short', short);
    const note = node.querySelector('.checkout-note');
    note.textContent = short ? 'No tienes monedas suficientes todavía.' : kinds[item.kind].note;
    note.classList.toggle('is-error', short);
    const confirm = node.querySelector('[data-checkout-confirm]');
    confirm.textContent = `Comprar por ${coins(item.price)}`;
    confirm.disabled = short || navigator.onLine === false;
    node.querySelector('.checkout-cancel').textContent = 'Ahora no';
    node.querySelector('.checkout-cancel').hidden = false;
    node.hidden = false;
    node.classList.remove('is-leaving');
    if (!reduced()) {
      node.querySelector('.checkout-sheet').animate([{transform: 'translateY(100%)'}, {transform: 'none'}], {duration: 380, easing: 'cubic-bezier(.16,1,.3,1)'});
      node.querySelector('.checkout-scrim').animate([{opacity: 0}, {opacity: 1}], {duration: 240, easing: 'ease-out'});
    }
    play(node.querySelector('[data-chota-fitting]'), SHOW_OFF);
    (confirm.disabled ? node.querySelector('.checkout-cancel') : confirm).focus({preventScroll: true});
  }
  function close() {
    const node = document.getElementById('storeCheckout');
    if (!node || node.hidden || node.classList.contains('is-leaving')) return;
    if (current?.state === 'buying') return;
    const opener = current?.opener;
    current = null;
    const finish = () => { node.hidden = true; node.classList.remove('is-leaving'); node.querySelector('.checkout-preview').innerHTML = ''; };
    if (opener?.isConnected && !opener.disabled) opener.focus({preventScroll: true});
    if (reduced()) { finish(); return; }
    node.classList.add('is-leaving');
    const sheetMove = node.querySelector('.checkout-sheet').animate([{transform: 'none'}, {transform: 'translateY(100%)'}], {duration: 240, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards'});
    node.querySelector('.checkout-scrim').animate([{opacity: 1}, {opacity: 0}], {duration: 240, fill: 'forwards'});
    sheetMove.finished.then(() => { sheetMove.cancel(); node.querySelector('.checkout-scrim').getAnimations().forEach(a => a.cancel()); finish(); }, finish);
  }
  function setState(state, message) {
    const node = sheet();
    current.state = state;
    node.dataset.state = state;
    const confirm = node.querySelector('[data-checkout-confirm]'), cancel = node.querySelector('.checkout-cancel'), note = node.querySelector('.checkout-note');
    note.classList.toggle('is-error', state === 'error');
    if (state === 'buying') { confirm.textContent = 'Comprando…'; confirm.disabled = true; cancel.hidden = true; note.textContent = ''; }
    if (state === 'error') { confirm.textContent = 'Reintentar'; confirm.disabled = false; cancel.hidden = false; note.textContent = message; }
    if (state === 'done') {
      node.querySelector('.checkout-kind').textContent = '¡Es tuyo!';
      note.textContent = kinds[current.kind].done;
      confirm.textContent = 'Hecho';
      confirm.disabled = false;
      cancel.hidden = true;
      const have = balance();
      if (have != null) node.querySelector('[data-checkout-balance]').innerHTML = coin(have);
      play(node.querySelector('[data-chota-fitting]'), CELEBRATE);
      if (!reduced()) {
        node.querySelector('.checkout-preview').animate([{transform: 'scale(1)'}, {transform: 'scale(1.04)'}, {transform: 'scale(1)'}], {duration: 420, easing: 'cubic-bezier(.2,1.4,.4,1)'});
        burst(node.querySelector('.checkout-preview'));
      }
      confirm.focus({preventScroll: true});
    }
  }
  function burst(host) {
    const layer = document.createElement('span');
    layer.className = 'checkout-burst';
    layer.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 14; i++) {
      const piece = document.createElement('i');
      const angle = (i / 14) * Math.PI * 2, distance = 70 + (i % 3) * 26;
      piece.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
      piece.style.setProperty('--dy', `${Math.sin(angle) * distance - 20}px`);
      piece.style.setProperty('--d', `${i * 18}ms`);
      layer.append(piece);
    }
    host.append(layer);
    setTimeout(() => layer.remove(), 1200);
  }
  // The real purchase: press the shop's own button and watch for its outcome.
  function confirmPurchase() {
    if (!current) return;
    if (current.state === 'done') { close(); return; }
    const button = document.querySelector(current.selector);
    if (!button || button.disabled) { setState('error', 'Ahora mismo no se puede comprar. Inténtalo en un momento.'); return; }
    const item = current, started = Date.now();
    setState('buying');
    bypass = true;
    try { button.click(); } finally { bypass = false; }
    const statusFor = ['clothing', 'trousers', 'shirt'].includes(item.kind) ? 'clothingShopStatus' : ['object', 'style'].includes(item.kind) ? 'chotaShopStatus' : 'bannerShopStatus';
    const owned = () => item.kind === 'banner' ? !!document.querySelector(`[data-banner-id="${CSS.escape(item.id)}"]:not([data-banner-action="buy"])`)
      : item.kind === 'voucher' ? !!document.querySelector(`[data-voucher-action="redeem"][data-voucher-id="${CSS.escape(item.id)}"]`)
      : false;
    const onChota = event => { if (event.detail?.itemId === item.id) finish(true); };
    let settled = false;
    function finish(ok, message) {
      if (settled || current !== item) return;
      settled = true;
      document.removeEventListener('bb:chota-items-updated', onChota);
      clearInterval(timer);
      if (ok) setState('done'); else setState('error', message);
    }
    document.addEventListener('bb:chota-items-updated', onChota);
    const timer = setInterval(() => {
      if (current !== item) { clearInterval(timer); document.removeEventListener('bb:chota-items-updated', onChota); return; }
      if (owned()) return finish(true);
      const status = document.getElementById(statusFor);
      if (status?.classList.contains('is-error') && status.textContent.trim() && Date.now() - started > 200) return finish(false, status.textContent.trim());
      if (Date.now() - started > 15000) finish(false, 'No hemos podido confirmar la compra. Revisa tu saldo antes de repetirla.');
    }, 120);
  }

  function initialize() {
    if (!dialog()) return;
    watchViews();
    // Capture phase: the checkout opens before any shop spends coins.
    window.addEventListener('click', event => {
      if (bypass) return;
      const button = event.target.closest?.(BUY);
      if (!button || !dialog()?.contains(button) || button.closest('#storeCheckout')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!button.disabled) open(button);
    }, true);
    document.addEventListener('click', event => {
      if (event.target.closest('[data-checkout-confirm]')) confirmPurchase();
      else if (event.target.closest('[data-checkout-close]')) close();
    });
    // Escape closes the sheet before the store goes back a level.
    document.addEventListener('cancel', event => {
      const node = document.getElementById('storeCheckout');
      if (event.target !== dialog() || !node || node.hidden) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    }, true);
    dialog().addEventListener('close', () => { const node = document.getElementById('storeCheckout'); if (node) { node.hidden = true; current = null; } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once: true}); else initialize();
  globalThis.StoreRooms = Object.freeze({showOff: node => play(node, SHOW_OFF), celebrate: node => play(node, CELEBRATE), open, close});
})();
