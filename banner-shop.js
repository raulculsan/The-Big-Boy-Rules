/* Wallet, inventory and purchases are authoritative server RPC results. */
(() => {
  let options, state = null, busy = false, loading = false, failure = '', notice = '', generation = 0, request = null, profileTarget = null;
  const memberBanners = new Map();
  const memberBannerRequests = new Map(), memberBannerFetchedAt = new Map();
  let membersTarget = null, memberObserver = null, memberBannerCacheOwner = null, memberBannerCacheSignature = '';
  const memberBannerCacheKey = owner => `bb:member-banner-posters:v1:${options?.cacheNamespace || 'local'}:${owner}`;
  function restoreMemberBannerPosters() {
    const owner = options?.session();
    if (!owner || memberBannerCacheOwner === owner) return;
    memberBanners.clear(); memberBannerFetchedAt.clear();
    memberBannerCacheOwner = owner; memberBannerCacheSignature = '';
    try {
      const cached = JSON.parse(localStorage.getItem(memberBannerCacheKey(owner)) || 'null');
      if (!Array.isArray(cached?.banners) || !Number.isFinite(cached.savedAt) || Date.now() - cached.savedAt > 86400000) return;
      for (const [id, banner] of cached.banners.slice(0, 200)) {
        if (typeof id !== 'string' || (banner !== null && (typeof banner?.id !== 'string' || typeof banner?.name !== 'string' || typeof banner?.art_key !== 'string'))) continue;
        memberBanners.set(id, banner && {id:banner.id, name:banner.name, art_key:banner.art_key,presentation:globalThis.ShopCatalogMedia?.presentation(banner)});
      }
      // No fetched-at timestamps: cached artwork is always revalidated.
    } catch { /* A missing/invalid cache only delays artwork until its RPC. */ }
  }
  function saveMemberBannerPosters() {
    const owner = options?.session();
    if (!owner || memberBannerCacheOwner !== owner) return;
    const banners = [...memberBanners].slice(0, 200).map(([id, banner]) => [id, banner ? {id:String(banner.id), name:String(banner.name || ''), art_key:String(banner.art_key || ''),presentation:globalThis.ShopCatalogMedia?.presentation(banner)} : null]);
    const signature = JSON.stringify(banners);
    if (signature === memberBannerCacheSignature) return;
    try { localStorage.setItem(memberBannerCacheKey(owner), JSON.stringify({savedAt:Date.now(), banners})); memberBannerCacheSignature = signature; } catch {}
  }
  const visibleMemberTiles = new Set(), observedMemberTiles = new Set();
  const bannerVideos = new Set(), visibleBannerVideos = new WeakSet(), pendingBannerVideos = new WeakSet();
  const bannerMotionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  let bannerVideoObserver;
  function updateBannerVideo(video) {
    if (!video.isConnected) {
      bannerVideoObserver?.unobserve(video); bannerVideos.delete(video);
      video.pause(); video.removeAttribute('src'); video.load();
      return;
    }
    if (document.hidden || bannerMotionPreference.matches || !visibleBannerVideos.has(video)) {video.pause(); video.classList.remove('is-ready'); return;}
    if (!video.getAttribute('src')) video.src = video.dataset.bannerSrc;
    if (!video.paused || pendingBannerVideos.has(video)) return;
    pendingBannerVideos.add(video);
    // iOS can reject autoplay in Low Power Mode. Keep the poster until actual
    // playback and retry on the next gesture or when the app returns.
    Promise.resolve(video.play()).catch(() => video.classList.remove('is-ready'))
      .finally(() => pendingBannerVideos.delete(video));
  }
  function registerBannerVideos(root = document) {
    bannerVideos.forEach(updateBannerVideo);
    root.querySelectorAll('video[data-banner-src]').forEach(video => {
      if (bannerVideos.has(video)) return;
      bannerVideos.add(video); video.muted = true; video.defaultMuted = true;
      video.autoplay = true; video.playsInline = true;
      video.setAttribute('webkit-playsinline', '');
      video.addEventListener('playing', () => video.classList.add('is-ready'));
      video.addEventListener('pause', () => video.classList.remove('is-ready'));
      video.addEventListener('emptied', () => video.classList.remove('is-ready'));
      video.addEventListener('canplay', () => updateBannerVideo(video));
      video.addEventListener('error', () => {
        if (!video.isConnected || !video.getAttribute('src') || !video.dataset.bannerRemote || video.dataset.remoteTried) return;
        video.dataset.remoteTried = 'true'; video.src = video.dataset.bannerRemote;
        updateBannerVideo(video);
      });
      if ('IntersectionObserver' in globalThis) {
        bannerVideoObserver ||= new IntersectionObserver(entries => entries.forEach(entry => {
          if (entry.isIntersecting) visibleBannerVideos.add(entry.target); else visibleBannerVideos.delete(entry.target);
          updateBannerVideo(entry.target);
        }), {threshold:0.01});
        bannerVideoObserver.observe(video);
      } else {visibleBannerVideos.add(video); updateBannerVideo(video);}
    });
  }
  document.addEventListener('visibilitychange', () => bannerVideos.forEach(updateBannerVideo));
  window.addEventListener('pageshow', () => bannerVideos.forEach(updateBannerVideo));
  document.addEventListener('pointerup', () => {
    for (const video of bannerVideos) if (video.paused) updateBannerVideo(video);
  }, {passive:true});
  bannerMotionPreference.addEventListener('change', () => bannerVideos.forEach(updateBannerVideo));
  let reveal = null, swipe = null, suppressRevealClickUntil = 0, detachRevealFoil, detachRevealVfx;
  let lastInventory = null, inventoryOwner = null, inventorySavedAt = 0, shopResetTimer, shopCountdownTimer;
  const dailyBanners = () => Array.isArray(state?.daily_banner_ids)
    ? state.daily_banner_ids.map(id => state.banners?.find(banner => banner.id === id)).filter(banner => banner && banner.id !== 'banner-de-prueba').slice(0, 5)
    : (state?.banners || []).filter(banner => banner.id !== 'banner-de-prueba' && banner.in_daily_shop !== false).slice(0, 5);
  function updateShopCountdown() {
    clearTimeout(shopCountdownTimer);
    const subtitle = el('shopBannersPanel')?.querySelector('.shop-section-heading p');
    if (!subtitle) return;
    const reset = Date.parse(state?.shop_next_reset_at);
    const remaining = Number.isFinite(reset) ? Math.max(0, Math.ceil((reset - Date.now()) / 1000)) : null;
    const text = remaining === null ? 'Actualización diaria'
      : remaining === 0 ? (online() ? 'Actualizando selección…' : 'Actualización pendiente')
      : `Se renueva en ${[Math.floor(remaining / 3600), Math.floor(remaining / 60) % 60, remaining % 60].map(value => String(value).padStart(2, '0')).join(':')}`;
    if (subtitle.textContent !== text) subtitle.textContent = text;
    // Only the text ticks: artwork and purchase controls retain their DOM state.
    if (remaining > 0 && el('bannerShopDialog')?.open && !document.hidden) {
      shopCountdownTimer = setTimeout(updateShopCountdown, 1000 - Date.now() % 1000 + 20);
    }
  }
  function scheduleShopReset() {
    clearTimeout(shopResetTimer);
    const delay = Date.parse(state?.shop_next_reset_at) - Date.now();
    if (!Number.isFinite(delay) || delay < 0) return;
    shopResetTimer = setTimeout(() => {
      if (options?.session() && el('bannerShopDialog')?.open && !document.hidden) void refresh();
    }, Math.min(delay + 250, 2147483647));
  }
  const offlineInventoryOwnerKey = 'bb:album-inventory:last-owner';
  const inventoryCacheKey = owner => `bb:album-inventory:v1:${owner}`;
  function restoreInventory(owner) {
    if (inventoryOwner === owner) return;
    inventoryOwner = owner || null; lastInventory = null; inventorySavedAt = 0;
    if (!owner) return;
    try {
      const previousOwner=localStorage.getItem(offlineInventoryOwnerKey);
      if(previousOwner && previousOwner!==owner) {localStorage.removeItem(inventoryCacheKey(previousOwner));localStorage.removeItem(offlineInventoryOwnerKey);}
      const cached = JSON.parse(localStorage.getItem(inventoryCacheKey(owner)) || 'null');
      if (cached?.owner !== owner || !Array.isArray(cached.cards) || !Number.isFinite(cached.savedAt)) return;
      lastInventory = cached.cards.filter(row => typeof row.card_id === 'string' && Number.isSafeInteger(row.quantity) && row.quantity > 0).map(row => ({card_id:row.card_id, quantity:row.quantity}));
      inventorySavedAt = cached.savedAt;
    } catch { /* Storage may be disabled. The server inventory remains available. */ }
  }
  function saveInventory(owner, cards) {
    if (!owner || owner !== options?.session() || !Array.isArray(cards)) return;
    inventoryOwner = owner; inventorySavedAt = Date.now(); lastInventory = cards;
    try { localStorage.setItem(inventoryCacheKey(owner), JSON.stringify({owner,savedAt:inventorySavedAt,cards:cards.map(row => ({card_id:row.card_id,quantity:Number(row.quantity)}))})); localStorage.setItem(offlineInventoryOwnerKey,owner); } catch {}
  }
  function offlineInventory() {
    try {
      const owner=localStorage.getItem(offlineInventoryOwnerKey);
      if(!owner)return null;
      const snapshot=JSON.parse(localStorage.getItem(inventoryCacheKey(owner)) || 'null');
      if(snapshot?.owner!==owner || !Array.isArray(snapshot.cards) || !Number.isFinite(snapshot.savedAt))return null;
      return {savedAt:snapshot.savedAt,cards:snapshot.cards.filter(row=>typeof row.card_id==='string' && Number.isSafeInteger(row.quantity) && row.quantity>0).map(row=>({card_id:row.card_id,quantity:row.quantity}))};
    }catch{return null;}
  }
  function forgetOfflineInventory() {
    try {const owner=localStorage.getItem(offlineInventoryOwnerKey);if(owner)localStorage.removeItem(inventoryCacheKey(owner));localStorage.removeItem(offlineInventoryOwnerKey);}catch{}
    document.dispatchEvent(new CustomEvent('bb:offline-album-change'));
  }
  const revealDialog = document.createElement('dialog');
  revealDialog.className = 'pack-reveal-dialog';
  revealDialog.setAttribute('aria-label', 'Abrir sobre: revelar cartas');
  document.body.append(revealDialog);
  const discardEffects = new Set();
  const extraCopies = () => (state?.cards || []).reduce((sum, item) => sum + Math.max(0, Number(item.quantity) - 1), 0);
  const characterCardIds = new Set(['francisco-trigo-vice-city','cristobal-fabrik-vice-city','ruben-king-vice-city','felipe-hp-full-art','felipe-hp','daniel-gonzalez-motos-full-art','daniel-gonzalez-motos','jose-enrique-fernandez-cruz-normal','juan-manuel-perez-saldana-retro','juan-carlos-vega-quevedo-retro','carlos-sanchez-rodriguez-retro']);
  function renderReveal() {
    if (!reveal || !revealDialog.open) return;
    if (reveal.summary) { renderRevealSummary(); return; }
    const item = reveal.cards[reveal.index], design = card(item.card_id);
    // Keep the turning card intact during wallet refreshes and discards.
    if (revealDialog.dataset.cardIndex !== String(reveal.index)) {
      detachRevealVfx?.();detachRevealVfx=null;
      detachRevealFoil?.();detachRevealFoil=null;
      revealDialog.dataset.cardIndex = String(reveal.index);
      revealDialog.innerHTML = `<header class="pack-reveal-header"><span>Carta ${reveal.index + 1} de ${reveal.cards.length}</span><button type="button" class="pack-reveal-skip" data-reveal-skip>Ver todas</button><button type="button" data-reveal-close aria-label="Cerrar: todas las cartas ya están guardadas">✕</button></header><div class="pack-reveal-center"><div class="pack-reveal-stage"><button type="button" class="pack-reveal-card" data-reveal-flip aria-label="Girar carta" aria-pressed="false"><span class="pack-reveal-face pack-reveal-back"><img src="${escape(design?.back || 'icons/cards/reverso-comun-unificado-v1.jpg')}" width="948" height="1660" decoding="async" alt="Reverso de carta" draggable="false"></span><span class="pack-reveal-face pack-reveal-front" aria-hidden="true">${design ? `<img src="${escape(design.front)}" width="${escape(design.width || 948)}" height="${escape(design.height || 1660)}" decoding="async" alt="${escape(design.name)}" draggable="false">` : '<span>Carta guardada</span>'}</span></button></div></div><div class="pack-reveal-footer"><div class="pack-reveal-info" aria-live="polite"></div><div class="pack-reveal-actions"></div><p class="pack-reveal-status" role="status"></p></div>`;
      if(design?.edition==='Full Art'||design?.edition==='Vice City'){
        const foil=document.createElement('span');foil.setAttribute('aria-hidden','true');
        revealDialog.querySelector('.pack-reveal-front').append(foil);
        detachRevealFoil=globalThis.CollectionMotion?.attachFullArtFoil(revealDialog.querySelector('.pack-reveal-stage'),foil,design.edition);
      }
      revealDialog.querySelector('[data-reveal-flip]').focus({preventScroll:true});
      const next = card(reveal.cards[reveal.index + 1]?.card_id);
      [next?.front, next?.back].filter(Boolean).forEach(src => {
        const image = new Image(); image.decoding = 'async'; image.src = src;
        void image.decode?.().catch(() => {});
      });
    }
    const turn = revealDialog.querySelector('[data-reveal-flip]');
    if (reveal.flipped && !turn.classList.contains('is-flipped')) {
      const front = turn.querySelector('.pack-reveal-front');
      front.setAttribute('aria-hidden','false');
      turn.querySelector('.pack-reveal-back').setAttribute('aria-hidden','true');
      turn.classList.add('is-flipped'); turn.setAttribute('aria-pressed','true'); turn.setAttribute('aria-label',`${design?.name || item.card_id}. Pulsa para ${reveal.index + 1 < reveal.cards.length ? 'ver la siguiente carta' : 'terminar el sobre'}${canDiscardReveal(reveal.index) ? '. Flecha arriba para descartarla' : ''}`);
    }
    const displayKind = item.kind === 'member' ? (characterCardIds.has(item.card_id) ? 'Personaje' : 'Miembro') : item.kind === 'object' ? 'Objeto' : item.kind === 'location' ? 'Ubicación' : '';
    revealDialog.querySelector('.pack-reveal-info').innerHTML = reveal.flipped ? `<h3>${escape(design?.name || item.card_id)}</h3><p>${escape(displayKind)} · ${escape(rarityNames[item.edition] || item.edition)} · ${reveal.discarded.has(reveal.index) ? 'Repetida descartada' : Number(item.quantity) > 1 ? 'Repetida' : 'Nueva'}</p>` : '';
    revealDialog.querySelector('.pack-reveal-status').textContent = failure || notice;
  }
  function canDiscardReveal(index) {
    const item = reveal?.cards[index];
    if (!item || reveal.discarded.has(index) || reveal.uncertain.has(index) || Number(item.quantity) <= 1) return false;
    const owned = state?.cards?.find(row => row.card_id === item.card_id);
    return !state || Number(owned?.quantity) > 1;
  }
  function showRevealSummary() {
    if (!reveal || reveal.discarding) return;
    clearTimeout(revealTimer);
    stopRevealOpening();
    detachRevealVfx?.(); detachRevealVfx = null;
    detachRevealFoil?.(); detachRevealFoil = null;
    const gesture = swipe; swipe = null;
    if (gesture?.stage.hasPointerCapture(gesture.id)) gesture.stage.releasePointerCapture(gesture.id);
    revealDialog.getAnimations({subtree:true}).forEach(animation => animation.cancel());
    reveal.phase = 'idle'; reveal.advancing = false; reveal.summary = true;
    revealDialog.classList.remove('is-opening-pack');
    delete revealDialog.dataset.cardIndex;
    renderRevealSummary();
    revealDialog.querySelector('[data-reveal-save]')?.focus({preventScroll:true});
  }
  function renderRevealSummary() {
    if (!reveal?.summary || !revealDialog.open) return;
    revealDialog.classList.add('is-pack-summary');
    if (!revealDialog.querySelector('.pack-summary-grid')) {
      revealDialog.innerHTML = `<header class="pack-reveal-header"><span>Tu sobre</span><button type="button" data-reveal-close aria-label="Cerrar: tus cartas están guardadas">✕</button></header><div class="pack-summary-content"><div class="pack-summary-grid" role="group" aria-label="Cartas del sobre"></div></div><footer class="pack-summary-footer"><p class="pack-summary-balance"></p><div class="pack-summary-actions"><button type="button" class="packs-buy" data-reveal-save>Guardar todo</button></div><p class="pack-reveal-status" role="status" aria-live="polite"></p></footer>`;
      revealDialog.querySelector('.pack-summary-grid').innerHTML = reveal.cards.map((item,index) => {
        const design = card(item.card_id);
        return `<div class="pack-summary-item"><button type="button" class="pack-summary-card" data-summary-card="${index}"><img src="${escape(design?.front || design?.back || 'icons/cards/reverso-comun-unificado-v1.jpg')}" alt="${escape(design?.name || item.card_id)}" draggable="false" decoding="async"></button><span class="pack-summary-label"></span></div>`;
      }).join('');
    }
    reveal.cards.forEach((item,index) => {
      const button = revealDialog.querySelector(`[data-summary-card="${index}"]`);
      button.disabled = busy || loading || !canDiscardReveal(index) || !online();
      button.classList.toggle('is-discarded',reveal.discarded.has(index));
      button.parentElement.querySelector('.pack-summary-label').textContent = reveal.discarded.has(index) ? 'Descartada' : reveal.uncertain.has(index) ? 'Revisar' : Number(item.quantity) > 1 ? 'Repetida' : 'Nueva';
    });
    revealDialog.querySelector('[data-reveal-save]').textContent = reveal.discarded.size ? 'Guardar restantes' : 'Guardar todo';
    revealDialog.querySelector('.pack-summary-balance').textContent = state ? coins() : 'Actualizando saldo…';
    revealDialog.querySelector('.pack-reveal-status').textContent = failure || (busy ? 'Descartando repetidas…' : loading ? 'Actualizando colección…' : notice);
  }
  async function discardRevealCards(indices) {
    if (!reveal?.summary || busy || loading || !online()) return;
    const current = reveal, token = generation, user = options.session();
    const targets = [...new Set(indices)].filter(canDiscardReveal);
    if (!targets.length) return;
    busy = true; current.discarding = true; failure = ''; notice = ''; render();
    let earned = 0, completed = 0, discardError = '';
    try {
      for (const index of targets) {
        if (token !== generation || user !== options.session()) return;
        const item = current.cards[index];
        try {
          // The server checks ownership and always retains the last copy.
          const data = await rpc('discard_duplicate_card',{target_card_id:item.card_id,copies:1});
          if (token !== generation || user !== options.session()) return;
          current.discarded.add(index);
          const owned = state?.cards?.find(row => row.card_id === item.card_id);
          if (owned && Number.isFinite(Number(data.quantity))) owned.quantity = Number(data.quantity);
          if (state && Number.isFinite(Number(data.balance))) state.balance = Number(data.balance);
          earned += Number(data.coins_earned) || 0; completed++;
          if (reveal === current && revealDialog.open) {
            const image = revealDialog.querySelector(`[data-summary-card="${index}"]`);
            if (image && !revealReduced()) await image.animate([{transform:'translateY(0)',opacity:1},{transform:'translateY(-42px) scale(.88)',opacity:0}],{duration:220,easing:'ease-out'}).finished.catch(() => {});
            renderRevealSummary();
          }
        } catch (error) {
          // A lost response may follow a committed exchange. Never retry that
          // copy automatically or let a second tap spend another stored copy.
          current.uncertain.add(index);
          discardError = errorMessage(error); break;
        }
      }
      state = null;
      await refresh();
      if (token !== generation || user !== options.session()) return;
      notice = completed ? `+${earned} monedas` : '';
      if (discardError) failure = `${discardError} Las demás cartas siguen guardadas. Revisa la colección para comprobar el descarte pendiente.`;
    } finally {
      if (token === generation) {current.discarding = false; busy = false; render();
        if (reveal === current && revealDialog.open) revealDialog.querySelector('[data-reveal-save]')?.focus({preventScroll:true});}
    }
  }
  let summarySwipe = null;
  revealDialog.addEventListener('pointerdown',event => {
    const target = event.target.closest('[data-summary-card]');
    if (!target || target.disabled || summarySwipe || !event.isPrimary || event.button !== 0) return;
    summarySwipe = {target,id:event.pointerId,x:event.clientX,y:event.clientY,dy:0,vertical:false};
    target.setPointerCapture(event.pointerId);
  });
  revealDialog.addEventListener('pointermove',event => {
    const gesture = summarySwipe;
    if (!gesture || event.pointerId !== gesture.id) return;
    gesture.dy = event.clientY - gesture.y;
    gesture.vertical ||= gesture.dy < -10 && -gesture.dy > Math.abs(event.clientX - gesture.x) * 1.3;
    if (gesture.vertical) {gesture.target.style.transform = `translateY(${Math.max(-55,Math.min(0,gesture.dy))}px)`; gesture.target.style.opacity = String(Math.max(.35,1 + gesture.dy / 160));}
  });
  function finishSummarySwipe(event) {
    const gesture = summarySwipe;
    if (!gesture || gesture.id !== event.pointerId) return;
    summarySwipe = null;
    if (event.type === 'pointerup') gesture.dy = event.clientY - gesture.y;
    gesture.target.style.removeProperty('transform'); gesture.target.style.removeProperty('opacity');
    if (gesture.target.hasPointerCapture(event.pointerId)) gesture.target.releasePointerCapture(event.pointerId);
    if (!gesture.vertical) return;
    suppressRevealClickUntil = Date.now() + 500;
    if (event.type === 'pointerup' && gesture.dy < -35) void discardRevealCards([Number(gesture.target.dataset.summaryCard)]);
  }
  revealDialog.addEventListener('pointerup',finishSummarySwipe);
  revealDialog.addEventListener('pointercancel',finishSummarySwipe);
  revealDialog.addEventListener('lostpointercapture',finishSummarySwipe);
  const revealReduced = () => (globalThis.ClubMotion?.media || matchMedia('(prefers-reduced-motion: reduce)')).matches;
  const motionTimings = globalThis.CollectionMotion?.timings || {flip:420, opening:720, advance:200, discard:480, reward:620};
  let revealTimer = 0, revealOpening = null;
  const stopRevealOpening = () => {revealOpening?.stop();revealOpening = null;revealDialog.classList.remove('is-opening-pack');};
  function finishRevealMotion(current) {
    clearTimeout(revealTimer);
    if (reveal !== current || !revealDialog.open) return;
    current.phase = 'idle';
    revealDialog.classList.remove('is-opening-pack');
    revealDialog.querySelector('.pack-reveal-center')?.classList.remove('is-arriving');
  }
  function flipReveal() {
    if (!reveal || reveal.flipped || reveal.phase !== 'idle') return;
    const current = reveal; current.flipped = true; current.phase = 'flipping'; renderReveal();
    const stage=revealDialog.querySelector('.pack-reveal-stage');
    stage.querySelector('.pack-reveal-card').dataset.packRevealRarity=current.cards[current.index].edition;
    detachRevealVfx?.();
    detachRevealVfx=globalThis.CollectionMotion?.playPackReveal(stage,current.cards[current.index].edition);
    clearTimeout(revealTimer);
    revealTimer = setTimeout(() => finishRevealMotion(current),revealReduced() ? 0 : motionTimings.flip);
  }
  function startReveal(cards) {
    if (!cards.length) return;
    reveal = {cards,index:0,flipped:false,discarded:new Set(),uncertain:new Set(),phase:'idle'};
    revealDialog.classList.remove('is-pack-summary');
    delete revealDialog.dataset.cardIndex;
    if(globalThis.ClubMotion?.openDialog)globalThis.ClubMotion.openDialog(revealDialog);else revealDialog.showModal(); renderReveal();
    if (!revealReduced()) {
      // The draw is already saved: the tear is presentation and can be skipped at any point.
      const current = reveal;
      current.phase = 'opening';
      revealDialog.classList.add('is-opening-pack');
      revealOpening = globalThis.PackOpening?.play({stage:revealDialog.querySelector('.pack-reveal-stage'),
        back:escape(card(cards[0].card_id)?.back || 'icons/cards/reverso-comun-unificado-v1.jpg'),count:cards.length,
        edition:globalThis.PackOpening.bestEdition(cards),onDone:() => {revealOpening = null; finishRevealMotion(current);}});
      if (!revealOpening) finishRevealMotion(current);
    }
  }
  revealDialog.addEventListener('click', event => {
    if (event.target.closest('[data-reveal-close]')) globalThis.ClubMotion?.closeDialog ? void globalThis.ClubMotion.closeDialog(revealDialog) : revealDialog.close();
    if (Date.now() < suppressRevealClickUntil) return;
    if (event.target.closest('[data-reveal-skip]')) {showRevealSummary(); return;}
    if (event.target.closest('[data-reveal-save]')) {globalThis.ClubMotion?.closeDialog ? void globalThis.ClubMotion.closeDialog(revealDialog) : revealDialog.close(); return;}
    if (event.target.closest('[data-reveal-flip]')) {if (revealOpening) revealOpening.tear(); else activateReveal();}
  });
  // Swiping a revealed duplicate up exchanges it and moves on. The card only
  // returns if the server refused, since a lost reply is surfaced as a failure.
  async function discardRevealCard(stage) {
    const current = reveal, index = current?.index;
    if (!current?.flipped || current.phase !== 'idle' || current.advancing || current.discarding || busy || loading || !online() || !canDiscardReveal(index)) return false;
    stage.classList.add('is-discarding');
    await mutate('discard_duplicate_card', {target_card_id:current.cards[index].card_id,copies:1}, '', index);
    if (reveal === current && current.discarded.has(index) && revealDialog.open) advanceReveal(stage);
    else stage.classList.remove('is-discarding');
    return true;
  }
  function activateReveal() {
    if (!reveal || reveal.phase !== 'idle' || reveal.advancing || reveal.discarding) return;
    if (reveal.flipped) advanceReveal(revealDialog.querySelector('.pack-reveal-stage'));
    else flipReveal();
  }
  function advanceReveal(stage) {
    if (!reveal?.flipped || reveal.phase !== 'idle' || reveal.advancing || reveal.discarding) return;
    const current = reveal;
    detachRevealVfx?.();detachRevealVfx=null;
    current.advancing = true; current.phase = 'advancing';
    stage.style.transform = `translateX(${current.releaseX || 0}px)`;
    stage.style.opacity = String(current.releaseOpacity ?? 1);
    current.releaseX = 0; current.releaseOpacity = 1;
    // Commit the finger's final pose before the departure transition starts.
    void stage.offsetWidth;
    stage.classList.add('is-leaving');
    stage.style.removeProperty('transform');
    stage.style.removeProperty('opacity');
    revealTimer = setTimeout(() => {
      if (reveal !== current || !revealDialog.open) return;
      if (current.index + 1 === current.cards.length) showRevealSummary();
      else {
        current.index++; current.flipped = false; current.advancing = false;
        current.phase = revealReduced() ? 'idle' : 'arriving';
        renderReveal();
        if (current.phase === 'arriving') {
          // Entrance belongs to the parent; the card keeps exclusive ownership
          // of rotation and the stage keeps exclusive ownership of swiping.
          revealDialog.querySelector('.pack-reveal-center').classList.add('is-arriving');
          revealTimer = setTimeout(() => finishRevealMotion(current),220);
        }
      }
    }, revealReduced() ? 0 : motionTimings.advance);
  }
  revealDialog.addEventListener('pointerdown', event => {
    const stage = event.target.closest('.pack-reveal-stage');
    if (swipe || !stage || !reveal || reveal.phase !== 'idle' || reveal.advancing || reveal.discarding || !event.isPrimary || event.button !== 0) return;
    swipe = {id:event.pointerId,x:event.clientX,y:event.clientY,stage,flipped:reveal.flipped,index:reveal.index,dx:0,horizontal:false};
    // Keep one capture owner from down through up. Moving capture off the
    // touched button mid-gesture emits a bubbling lostpointercapture.
    stage.setPointerCapture(event.pointerId);
  });
  revealDialog.addEventListener('pointermove', event => {
    if (!swipe || swipe.id !== event.pointerId) return;
    swipe.dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    if (!swipe.horizontal && Math.abs(swipe.dx) > 12 && Math.abs(swipe.dx) > Math.abs(dy) * 1.3) {
      swipe.horizontal = true;
    }
    if (!swipe.horizontal && !swipe.up && swipe.flipped && dy < -12 && -dy > Math.abs(swipe.dx) * 1.3 && canDiscardReveal(swipe.index)) swipe.up = true;
    if (swipe.up) {
      swipe.dy = dy;
      swipe.stage.classList.add('is-dragging');
      swipe.stage.style.transform = `translateY(${Math.min(0,dy) * .6}px) scale(${Math.max(.9,1 + Math.min(0,dy) / 1400)})`;
      swipe.stage.style.opacity = String(Math.max(.35,1 + Math.min(0,dy) / 320));
      return;
    }
    // A swipe on the back reveals it in place; only a revealed card follows
    // the finger when navigating to the next card.
    if (!swipe.horizontal || !swipe.flipped) return;
    swipe.stage.classList.add('is-dragging');
    swipe.stage.style.transform = `translateX(${Math.max(-28,Math.min(0,swipe.dx) * .2)}px)`;
    swipe.stage.style.opacity = String(Math.max(.35, 1 + Math.min(0, swipe.dx) / 400));
  });
  function finishSwipe(event) {
    if (!swipe || swipe.id !== event.pointerId) return;
    // Ignore loss from the child button's implicit touch capture. Only the
    // stage owns this gesture; unrelated bubbling losses cannot cancel it.
    if (event.type === 'lostpointercapture' && event.target !== swipe.stage) return;
    const gesture = swipe; swipe = null;
    if (event.type === 'pointerup') {
      gesture.dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      gesture.horizontal ||= Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(dy) * 1.3;
      gesture.tap = !gesture.horizontal && !gesture.up && Math.hypot(gesture.dx,dy) <= 12;
      if (gesture.up) gesture.dy = dy;
    }
    gesture.stage.classList.remove('is-dragging');
    gesture.stage.style.removeProperty('transform');
    gesture.stage.style.removeProperty('opacity');
    // Any completed pointer sequence owns its follow-up click, including a
    // canceled/vertical gesture. Keyboard activation still reaches click.
    suppressRevealClickUntil = Date.now() + 500;
    if (gesture.stage.hasPointerCapture(event.pointerId)) gesture.stage.releasePointerCapture(event.pointerId);
    if (event.type !== 'pointerup' || !reveal || reveal.index !== gesture.index) return;
    // Capturing on the stage retargets the up/click; handle a stationary tap
    // here as well so tap-to-reveal remains available.
    if (gesture.tap) {activateReveal(); return;}
    if (gesture.up && gesture.dy < -Math.min(70,gesture.stage.clientHeight * .16)) {void discardRevealCard(gesture.stage); return;}
    if (!gesture.horizontal || gesture.dx >= -Math.min(70,gesture.stage.clientWidth * .25)) return;
    if (gesture.flipped) {
      reveal.releaseX = Math.max(-28,Math.min(0,gesture.dx) * .2);
      reveal.releaseOpacity = Math.max(.35,1 + Math.min(0,gesture.dx) / 400);
      advanceReveal(gesture.stage);
    }
    else flipReveal();
  }
  revealDialog.addEventListener('pointerup', finishSwipe);
  revealDialog.addEventListener('pointercancel', finishSwipe);
  revealDialog.addEventListener('lostpointercapture', finishSwipe);
  revealDialog.addEventListener('dragstart',event => {if (event.target.closest('.pack-reveal-stage, .pack-summary-card')) event.preventDefault();});
  (globalThis.ClubMotion?.media || matchMedia('(prefers-reduced-motion: reduce)')).addEventListener('change',event => {if (event.matches) {if (revealOpening) {const current = reveal; stopRevealOpening(); finishRevealMotion(current);}detachRevealVfx?.();detachRevealVfx=null;if(reveal && reveal.phase !== 'advancing') finishRevealMotion(reveal);}});
  revealDialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowUp' && reveal && !event.repeat) {
      const summaryCard = event.target.closest('[data-summary-card]');
      if (summaryCard) {event.preventDefault(); void discardRevealCards([Number(summaryCard.dataset.summaryCard)]);}
      else if (!reveal.summary) {event.preventDefault(); void discardRevealCard(revealDialog.querySelector('.pack-reveal-stage'));}
    }
    if (event.key === 'ArrowLeft' && reveal && !reveal.summary && reveal.phase === 'idle' && !reveal.advancing && !event.repeat && !event.target.closest('[data-reveal-close]')) {
      event.preventDefault();
      if (reveal.flipped) advanceReveal(revealDialog.querySelector('.pack-reveal-stage'));
      else flipReveal();
    }
  });
  revealDialog.addEventListener('close', () => {stopRevealOpening();detachRevealVfx?.();detachRevealVfx=null;detachRevealFoil?.();detachRevealFoil=null;clearTimeout(revealTimer); summarySwipe = null; revealDialog.getAnimations({subtree:true}).forEach(animation => animation.cancel()); revealDialog.classList.remove('is-opening-pack','is-pack-summary'); reveal = null; const gesture = swipe; swipe = null; if (gesture?.stage.hasPointerCapture(gesture.id)) gesture.stage.releasePointerCapture(gesture.id); el('ownedPackOpen')?.focus({preventScroll:true});});
  const el = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const card = id => globalThis.CardCollection?.catalog.find(item => item.id === id);
  const online = () => navigator.onLine !== false && !!options?.session();
  const rarityNames = {common:'Común',retro:'Retro',special:'Especial',epic:'Épica',legendary:'Legendaria',full_art:'Full Art',vice_city:'Vice City',halloween:'Halloween'};
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
  let galiciaSceneId = 0;
  function galiciaArtwork(banner, extra, compact = false, lightweight = false) {
    // Each mounted tile gets its own clip IDs; all joints use the 2172 × 724
    // source coordinates, preserving their registration at every display size.
    const id = `galicia-${++galiciaSceneId}`;
    const sceneFit = compact ? 'none' : 'xMidYMid meet';
    const sceneWidth = compact ? 1299 : 2172;
    const figure = `<image href="icons/banners/${compact ? 'alberto-galicia-member-figures-v1.webp' : 'alberto-galicia-figures-v1.webp'}" width="${sceneWidth}" height="724"/>`;
    const background = `<image href="icons/banners/${compact ? 'alberto-galicia-member-bg-v1.webp' : 'alberto-galicia-bg-v1.webp'}" width="${sceneWidth}" height="724"/>`;
    const head = '275,0 500,0 500,180 442,218 388,241 323,209 290,166';
    const goats = [
      {box:[575,305,510,419], head:'882,466 975,471 987,522 1083,585 1083,724 918,724 884,624 847,557', joint:'906px 539px', tail:'585,322 652,322 675,362 664,412 615,406 585,377', tailJoint:'655px 395px', ear:'858,562 890,550 935,552 946,564 930,587 894,602 864,587', earJoint:'936px 561px', wind:'3.7s', phase:'0s', duration:'5.8s'},
      {box:[1085,305,515,419], head:'1090,451 1180,451 1285,481 1348,572 1303,631 1259,724 1085,724', joint:'1250px 558px', tail:'1500,331 1589,331 1600,377 1580,411 1520,427 1510,398', tailJoint:'1515px 398px', ear:'1085,562 1115,553 1165,550 1160,575 1126,603 1085,615', earJoint:'1158px 560px', wind:'4.6s', phase:'-2.3s', duration:'7.1s'},
      {box:[1600,300,520,424], head:'1600,465 1715,465 1794,496 1855,559 1836,611 1772,724 1600,724', joint:'1770px 558px', tail:'1987,316 2070,316 2070,383 2040,421 1999,406 1990,362', tailJoint:'2006px 400px', ear:'1600,560 1640,551 1700,550 1690,569 1650,586 1600,582', earJoint:'1695px 559px', wind:'3.2s', phase:'-4.1s', duration:'6.4s'}
    ];
    // The Krita exports contain baked goat transforms. Use their final bounds
    // for compact tiles; the wide scene retains its articulated source joints.
    if (compact) {
      [[545,525,239,199],[784,525,234,199],[1018,520,281,204]].forEach((box,i) => { goats[i].box = box; });
    }
    const goatSplit = 575, goatFeet = 565;
    const goatDefs = goats.map((goat, i) => {
      const [x,y,w,h] = goat.box;
      if (compact || lightweight) return `<clipPath id="${id}-goat-${i}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>`;
      return `<clipPath id="${id}-goat-${i}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath><clipPath id="${id}-goat-head-${i}"><polygon points="${goat.head}"/></clipPath><clipPath id="${id}-goat-upper-${i}"><rect x="${x}" y="${y}" width="${w}" height="${goatSplit-y}"/></clipPath><clipPath id="${id}-goat-feet-${i}"><rect x="${x}" y="${goatFeet}" width="${w}" height="${724-goatFeet}"/></clipPath><clipPath id="${id}-goat-tail-${i}"><polygon points="${goat.tail}"/></clipPath><clipPath id="${id}-goat-ear-${i}"><polygon points="${goat.ear}"/></clipPath><mask id="${id}-goat-face-${i}" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="white"/><polygon points="${goat.ear}" fill="black"/></mask><mask id="${id}-goat-body-${i}" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="white"/><polygon points="${goat.head}" fill="black"/><polygon points="${goat.tail}" fill="black"/></mask>`;
    }).join('');
    const goatArt = (compact || lightweight) ? goats.map((goat,i) => `<g class="banner-galicia-member-goat" style="--graze-duration:${goat.duration};--graze-phase:${goat.phase};--member-goat-joint:${goat.box[0]+goat.box[2]/2}px 724px"><g clip-path="url(#${id}-goat-${i})">${figure}</g></g>`).join('') : goats.map((goat, i) => `<g class="banner-galicia-goat" style="--graze-duration:${goat.duration};--graze-phase:${goat.phase};--goat-joint:${goat.joint};--tail-joint:${goat.tailJoint};--ear-joint:${goat.earJoint};--wind-duration:${goat.wind}" clip-path="url(#${id}-goat-${i})"><g clip-path="url(#${id}-goat-feet-${i})" mask="url(#${id}-goat-body-${i})">${figure}</g><g class="banner-galicia-goat-body"><g clip-path="url(#${id}-goat-upper-${i})" mask="url(#${id}-goat-body-${i})">${figure}</g></g><g class="banner-galicia-goat-tail"><g clip-path="url(#${id}-goat-tail-${i})">${figure}</g></g><g class="banner-galicia-goat-head"><g clip-path="url(#${id}-goat-head-${i})" mask="url(#${id}-goat-face-${i})">${figure}</g><g class="banner-galicia-goat-ear"><g clip-path="url(#${id}-goat-ear-${i})">${figure}</g></g></g></g>`).join('');
    // Feathered source patches keep the painted foliage, with each base pinned
    // to the ground. The sky patches stop above the mountain silhouettes.
    const foliage = [
      {x:105,y:130,rx:230,ry:145,joint:'145px 277px',duration:'4.8s',phase:'-1.1s',tree:true},
      {x:compact ? 1210 : 2060,y:176,rx:144,ry:120,joint:compact ? '1220px 300px' : '2070px 300px',duration:'5.6s',phase:'-3.4s',tree:true},
      ...Array.from({length:compact ? 6 : lightweight ? 2 : 10}, (_,i) => ({x:95+i*226,y:690,rx:170,ry:95,joint:`${95+i*226}px 724px`,duration:`${3.1+(i%4)*.4}s`,phase:`${i*-.47}s`}))
    ];
    const foliageDefs = foliage.map((patch,i) => `<mask id="${id}-foliage-${i}" maskUnits="userSpaceOnUse" x="${patch.x-patch.rx}" y="${patch.y-patch.ry}" width="${patch.rx*2}" height="${patch.ry*2}"><ellipse cx="${patch.x}" cy="${patch.y}" rx="${patch.rx}" ry="${patch.ry}" fill="url(#${id}-foliage-fade)"/></mask>`).join('');
    const foliageArt = (trees) => foliage.map((patch,i) => !!patch.tree === trees ? `<g class="banner-galicia-foliage ${trees ? 'is-tree' : ''}" style="--foliage-joint:${patch.joint};--wind-duration:${patch.duration};--wind-phase:${patch.phase}"><g mask="url(#${id}-foliage-${i})">${background}</g></g>` : '').join('');
    const grass = Array.from({length:compact ? 21 : lightweight ? 10 : 35}, (_, i) => {
      const x = 25 + i * 63, y = 722 - (i % 3) * 5;
      return `<g class="banner-galicia-blade" style="--blade-phase:${i * -.19}s;--blade-joint:${x}px ${y}px"><path d="M${x} ${y} Q${x-14} ${y-41} ${x-5} ${y-75} M${x} ${y} Q${x+15} ${y-37} ${x+36} ${y-52}"/><path class="is-light" d="M${x+5} ${y} Q${x+27} ${y-18} ${x+43} ${y-26}"/></g>`;
    }).join('');
    const cloudXs = compact ? [400,800,1150] : lightweight ? [1160] : [650,1160,1690];
    const cloudDefs = cloudXs.map((x,i) => `<mask id="${id}-cloud-${i}" maskUnits="userSpaceOnUse" x="${x-340}" y="-65" width="680" height="160"><ellipse cx="${x}" cy="12" rx="340" ry="80" fill="url(#${id}-cloud-fade)"/></mask>`).join('');
    const clouds = cloudXs.map((_,i) => `<g class="banner-galicia-clouds" style="--cloud-duration:${23+i*8}s;--cloud-phase:${i*-9}s"><g mask="url(#${id}-cloud-${i})">${background}</g></g>`).join('');
    const birds = Array.from({length:lightweight ? 3 : 5},(_,i) => `<g class="banner-galicia-bird-flight" style="--flight-duration:${17+i*3}s;--flight-phase:${-i*4.3}s;--flight-height:${108+(i%3)*37}px;--bird-scale:${.7+(i%3)*.25}"><g class="banner-galicia-bird" style="--flap-duration:${.72+i*.11}s"><path class="banner-galicia-wing is-left" d="M0 0 Q-13 -16 -29 -11 Q-13 -7 0 3Z"/><path class="banner-galicia-wing is-right" d="M0 0 Q13 -16 29 -11 Q13 -7 0 3Z"/><path d="M-3 0 Q0 -5 4 0 L10 3 L3 4 L0 10Z"/></g></g>`).join('');
    // Only the registered face changes; the soft edge preserves the original
    // head silhouette and the expression follows the same animated head joint.
    const expression = `<g class="banner-galicia-expression" mask="url(#${id}-expression)"><image href="icons/banners/alberto-galicia-expression-v2.webp" width="2172" height="724"/></g>`;
    return `<div class="banner-art banner-alberto-galicia ${extra}" role="img" aria-label="${escape(banner.name || 'Alberto Velasco con sus cabras en Galicia')}"><img class="banner-galicia-fallback" src="icons/banners/${compact ? 'alberto-galicia-member-v1.png' : 'posters/alberto-galicia-v1.webp'}" width="${sceneWidth}" height="724" alt="" decoding="async" aria-hidden="true"><svg class="banner-galicia-scene" viewBox="0 0 ${sceneWidth} 724" preserveAspectRatio="${sceneFit}" aria-hidden="true" focusable="false"><defs><clipPath id="${id}-alberto"><rect width="545" height="724"/></clipPath><clipPath id="${id}-head"><polygon points="${head}"/></clipPath><clipPath id="${id}-torso"><rect y="155" width="545" height="395"/></clipPath><clipPath id="${id}-legs"><rect y="535" width="545" height="189"/></clipPath><mask id="${id}-body" maskUnits="userSpaceOnUse" x="0" y="0" width="545" height="724"><rect width="545" height="724" fill="white"/><polygon points="${head}" fill="black"/></mask><radialGradient id="${id}-cloud-fade"><stop offset="45%" stop-color="white"/><stop offset="100%" stop-color="black"/></radialGradient><radialGradient id="${id}-foliage-fade"><stop offset="50%" stop-color="white"/><stop offset="100%" stop-color="black"/></radialGradient><radialGradient id="${id}-expression-fade"><stop offset="65%" stop-color="white"/><stop offset="100%" stop-color="black"/></radialGradient><mask id="${id}-expression" maskUnits="userSpaceOnUse" x="357" y="62" width="126" height="152"><ellipse cx="420" cy="138" rx="63" ry="76" fill="url(#${id}-expression-fade)"/></mask>${cloudDefs}${foliageDefs}${goatDefs}</defs>${background}${clouds}${foliageArt(true)}${birds}<g class="banner-galicia-alberto" clip-path="url(#${id}-alberto)"><g clip-path="url(#${id}-legs)">${figure}</g><g class="banner-galicia-torso"><g clip-path="url(#${id}-torso)" mask="url(#${id}-body)">${figure}</g></g><g class="banner-galicia-head"><g clip-path="url(#${id}-head)">${figure}${expression}</g></g></g>${goatArt}${foliageArt(false)}<g class="banner-galicia-grass">${grass}</g><g class="banner-galicia-breeze"><path d="M730 473 Q820 441 917 460"/><path d="M1460 269 Q1530 245 1616 256"/></g></svg></div>`;
  }
  function artwork(banner, extra = '') {
    const remote=globalThis.ShopCatalogMedia?.banner(banner,extra,bannerMotionPreference.matches);
    if(remote)return remote;
    if (banner?.art_key === 'jose-enrique-ojos-v1') {
      const base = 'icons/banners/jose-enrique-ojos-v1/';
      const remote = 'https://raulculsan.github.io/The-Big-Boy-Rules/icons/banners/jose-enrique-ojos-v1/jose-enrique-ojos-v2.mp4';
      return `<div class="banner-art banner-fufi-flight banner-jose-eyes ${extra}" style="background-image:url('${base}poster.jpg');background-color:#0b1020" role="img" aria-label="${escape(banner.name || 'José Enrique bajo la lluvia, con los ojos iluminándose')}"><img src="${base}poster.jpg" width="1440" height="480" alt="" decoding="async" aria-hidden="true"><video data-banner-src="${base}jose-enrique-ojos-v2.mp4" data-banner-remote="${remote}" poster="${base}poster.jpg" width="1440" height="480" autoplay muted loop playsinline preload="none" disablepictureinpicture disableremoteplayback tabindex="-1" aria-hidden="true"></video></div>`;
    }
    if (banner?.art_key === 'fufi-supervuelo-v1') {
      const base = 'icons/banners/fufi-supervuelo-v1/';
      const remote = 'https://nfvggpgeypkkqceivkaq.supabase.co/storage/v1/object/public/group-media/banners/fufi-supervuelo-v1.mp4';
      return `<div class="banner-art banner-fufi-flight ${extra}" role="img" aria-label="${escape(banner.name || 'Fufi volando entre nubes')}"><img src="${base}poster.jpg" width="1440" height="480" alt="" decoding="async" aria-hidden="true"><video data-banner-src="${base}fufi-supervuelo-v1.mp4" data-banner-remote="${remote}" poster="${base}poster.jpg" width="1440" height="480" autoplay muted loop playsinline preload="none" disablepictureinpicture disableremoteplayback tabindex="-1" aria-hidden="true"></video></div>`;
    }
    // Only known artwork keys become styles; future Krita exports are added here.
    const panorama = {
      'madrid-medianoche-v1': 'icons/banners/madrid-medianoche-v1.jpg',
      'costa-atlantica-v1': 'icons/banners/costa-atlantica-v1.jpg'
    }[banner?.art_key];
    // Native WebKit can defer lazy images inside a dialog even after showModal().
    // The fixed-ratio surface and eager image give every shop tile real geometry;
    // the same local bitmap is also a CSS fallback while the image decodes.
    if (panorama) return `<div class="banner-art banner-panorama ${extra}" style="background-image:url('${panorama}')" role="img" aria-label="${escape(banner.name)}"><img src="${panorama}" width="2172" height="724" alt="" loading="eager" decoding="async"></div>`;
    if (banner?.art_key === 'alberto-galicia-anime-v1') return galiciaArtwork(banner, extra, false, extra.includes('member-banner-art'));
    if (banner?.art_key === 'miguel-basket-bano-v1') {
      const poses = ['00', '00a', '01', '01a', '02', '02a', '03'].map((frame, index) => `<image class="banner-basket-pose banner-basket-pose-${index}" href="icons/banners/miguel-basket-miguel-${frame}-v1.webp" width="2172" height="724"/>`).join('');
      const shots = Array.from({length: 3}, (_, i) => `<g class="banner-basket-shot banner-basket-shot-${i}"><text x="0" y="0" text-anchor="middle" dominant-baseline="central">💩</text></g>`).join('');
      const subject = `<g class="banner-basket-held"><text x="0" y="0" text-anchor="middle" dominant-baseline="central">💩</text></g>${poses}`;
      const wideScene = `<svg class="banner-basket-scene " viewBox="0 0 2172 724" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"><image href="icons/banners/miguel-basket-bano-bg-v1.webp" width="2172" height="724"/>${subject}${shots}<g class="banner-basket-impact" transform="translate(1780 539)"><ellipse class="banner-basket-ring" rx="60" ry="12"/><path class="banner-basket-splash" d="M-42 -3 Q-67 -66 -78 -37 M-18 -8 Q-29 -86 -42 -67 M12 -8 Q28 -91 39 -63 M38 -3 Q65 -60 78 -39"/><text class="banner-basket-score" x="0" y="-75" text-anchor="middle">+3</text></g></svg>`;
      return `<div class="banner-art banner-miguel-basket ${extra}" role="img" aria-label="${escape(banner.name || 'Miguel encesta emojis en el váter')}"><img class="banner-basket-fallback" src="icons/banners/posters/miguel-basket-v1.webp" width="2172" height="724" alt="" decoding="async" aria-hidden="true">${wideScene}</div>`;
    }
    if (banner?.art_key === 'miguel-moto-anime-v1') {
      // All moving motorcycle parts use the source image's coordinates, so they
      // stay attached to the wheels and hair in every banner size.
      const spokes = Array.from({length: 6}, (_, i) => `<path d="M0 -58 L0 -132" transform="rotate(${i * 60})"/>`).join('');
      const wheels = `<svg class="banner-moto-wheels" viewBox="0 0 1312 1199" fill="none"><g transform="translate(503 929) rotate(8) scale(.47 1)"><g class="banner-moto-wheel-spin"><circle r="145" class="banner-moto-wheel-rim"/><g class="banner-moto-wheel-spokes">${spokes}</g><circle r="156" class="banner-moto-wheel-tread"/></g></g><g transform="translate(962 916) rotate(8) scale(.43 .67)"><g class="banner-moto-wheel-spin is-front"><circle r="145" class="banner-moto-wheel-rim"/><g class="banner-moto-wheel-spokes">${spokes}</g><circle r="156" class="banner-moto-wheel-tread"/></g></g></svg>`;
      return `<div class="banner-art banner-miguel-moto ${extra}" role="img" aria-label="${escape(banner.name || 'Miguel en moto por la ciudad')}"><div class="banner-moto-city banner-moto-far" aria-hidden="true"></div><div class="banner-moto-clouds" aria-hidden="true"><i></i><i></i></div><div class="banner-moto-city banner-moto-mid" aria-hidden="true"></div><div class="banner-moto-city banner-moto-near" aria-hidden="true"></div><div class="banner-moto-city banner-moto-near banner-moto-near-delayed" aria-hidden="true"></div><div class="banner-moto-road" aria-hidden="true">${Array.from({length: 12}, (_, i) => `<i class="banner-moto-lane ${i > 5 ? 'is-right' : ''}" style="--phase:${i % 6}"></i>`).join('')}</div><div class="banner-moto-rider-group" aria-hidden="true"><div class="banner-moto-shadow"></div><div class="banner-moto-rider-plane"><img class="banner-moto-rider" src="icons/banners/miguel-moto-rider-v2.webp" width="1312" height="1199" alt="" decoding="async">${wheels}<img class="banner-moto-hair" src="icons/banners/miguel-moto-rider-v2.webp" width="1312" height="1199" alt="" decoding="async"><svg class="banner-moto-wind" viewBox="0 0 1312 1199" fill="none"><path d="M710 43 Q684 27 669 42 M729 29 Q711 13 693 25 M693 64 Q670 53 658 65"/></svg></div></div><div class="banner-moto-light" aria-hidden="true"></div></div>`;
    }
    return `<div class="banner-art banner-neutral ${extra}" role="img" aria-label="${escape(banner?.name || 'Banner de perfil')}"><span>BB</span></div>`;
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
      const signature=JSON.stringify([banner.id,banner.art_key,banner.presentation]);
      if (hero.dataset.bannerSignature !== signature || !hero.querySelector('.profile-banner')) {
        hero.querySelector('.profile-banner')?.remove();
        hero.insertAdjacentHTML('afterbegin', artwork(banner, 'profile-banner'));
        hero.dataset.bannerId = String(banner.id);hero.dataset.bannerSignature=signature;
      }
    } else if (hero) {
      if (avatar) hero.before(avatar);
      hero.remove();
    }
    if (own) {
      const balance = node.querySelector('[data-wallet-balance]');
      if (balance) balance.textContent = state ? Number(state.balance).toLocaleString('es-ES') : '—';
      node.querySelector('[data-banner-shop]')?.setAttribute('aria-label', `Abrir tienda de banners. ${coins()}`);
      node.querySelector('[data-wallet]')?.setAttribute('aria-label', `Saldo: ${coins()}`);
    }
    registerBannerVideos(node);
  }
  function memberBanner(userId) {
    if (userId && userId === options?.session() && state) {
      return state.banners?.find(item => item.id === state.equipped_banner_id) || null;
    }
    return memberBanners.get(userId) || null;
  }
  function memberPoster(banner, priority = false) {
    const remote=globalThis.ShopCatalogMedia?.banner(banner,'member-banner-art',true,priority);
    if(remote)return remote;
    if (banner?.art_key === 'jose-enrique-ojos-v1') return `<div class="banner-art banner-fufi-flight banner-jose-eyes member-banner-art" style="background-image:url('icons/banners/jose-enrique-ojos-v1/poster.jpg');background-color:#0b1020" role="img" aria-label="${escape(banner.name)}"><img src="icons/banners/jose-enrique-ojos-v1/poster.jpg" width="1440" height="480" alt="" loading="${priority ? 'eager' : 'lazy'}" decoding="async"></div>`;
    if (banner?.art_key === 'fufi-supervuelo-v1') return `<div class="banner-art banner-fufi-flight member-banner-art" role="img" aria-label="${escape(banner.name)}"><img src="icons/banners/fufi-supervuelo-v1/poster.jpg" width="1440" height="480" alt="" loading="${priority ? 'eager' : 'lazy'}" decoding="async"></div>`;
    const image = {'alberto-galicia-anime-v1':'posters/alberto-galicia-v1.webp', 'miguel-basket-bano-v1':'posters/miguel-basket-v1.webp', 'miguel-moto-anime-v1':'posters/miguel-moto-v1.webp', 'madrid-medianoche-v1':'madrid-medianoche-v1.jpg', 'costa-atlantica-v1':'costa-atlantica-v1.jpg'}[banner?.art_key];
    if (image) return `<div class="banner-art member-banner-art" role="img" aria-label="${escape(banner.name)}"><img src="icons/banners/${image}" width="2172" height="724" alt="" loading="${priority ? 'eager' : 'lazy'}" fetchpriority="${priority ? 'high' : 'auto'}" decoding="async" style="width:100%;height:100%;object-fit:contain"></div>`;
    return artwork(null, 'member-banner-art');
  }
  function memberArtwork(userId) {
    return memberPoster(memberBanner(userId));
  }
  function paintMember(node) {
    const banner = memberBanner(node.dataset.memberBannerUser);
    const key = JSON.stringify([banner?.id || '',banner?.art_key,banner?.presentation]);
    const surface = node.querySelector('.club-member-banner');
    if (!surface) return;
    // Every visible carousel tile keeps its live scene. A fixed first-two
    // budget can leave an entering tile on its poster after another tile exits.
    const visible = !memberObserver || visibleMemberTiles.has(node);
    const animate = visible && !document.hidden && !(globalThis.ClubMotion?.media || matchMedia('(prefers-reduced-motion: reduce)')).matches;
    const changed = surface.dataset.bannerId !== key;
    const mode = animate ? 'animated' : 'poster';
    if (changed || !surface.firstElementChild || surface.dataset.bannerMode !== mode) {
      surface.innerHTML = animate ? artwork(banner, 'member-banner-art') : memberPoster(banner, node.dataset.memberPriority === 'true');
      surface.dataset.bannerId = key;
      surface.dataset.bannerMode = mode;
    }
    // Offscreen tiles retain one poster, releasing SVG masks and compositor layers.
    // Visible tiles keep the complete 2172 × 724 composition and original aspect.
    registerBannerVideos(surface);
  }
  globalThis.ClubMotion?.media.addEventListener('change', () => paintMembers());
  function paintMembers() {
    if (!membersTarget?.isConnected) return;
    membersTarget.querySelectorAll('[data-member-banner-user]').forEach(paintMember);
  }
  function loadMemberBanners(userIds, force = false) {
    if (!online()) return Promise.resolve();
    const ids = [...new Set(userIds)].filter(id => id && !memberBannerRequests.has(id) && (force || Date.now() - (memberBannerFetchedAt.get(id) || 0) >= 60000));
    const existing = [...new Set(userIds.map(id => memberBannerRequests.get(id)).filter(Boolean))];
    if (!ids.length) return Promise.all(existing);
    const token = generation, session = options.session();
    const pending = (async () => {
      for (let offset = 0; offset < ids.length; offset += 200) {
        const chunk = ids.slice(offset, offset + 200);
        let records;
        try {
          records = await rpc('get_member_profile_banners', {target_user_ids:chunk});
        } catch (error) {
          if (!['PGRST202','42883'].includes(error?.code)) throw error;
          // Compatibility while the batch migration is being deployed. Bound
          // concurrency instead of starting a connection for every member.
          records = [];
          let cursor = 0;
          await Promise.all(Array.from({length:Math.min(4,chunk.length)}, async () => {
            while (cursor < chunk.length) {
              const userId = chunk[cursor++];
              records.push({user_id:userId, banner:await rpc('get_member_profile_banner', {target_user_id:userId})});
            }
          }));
        }
        if (token !== generation || session !== options.session()) return;
        const banners = new Map((records || []).map(record => [record.user_id,record.banner]));
        chunk.forEach(id => {memberBanners.set(id, banners.get(id) || null); memberBannerFetchedAt.set(id, Date.now());});
      }
      saveMemberBannerPosters();
      paintProfile(); paintMembers();
    })().catch(() => {
      if (token === generation && session === options.session()) ids.forEach(id => memberBannerFetchedAt.set(id, Date.now()));
    }).finally(() => {
      ids.forEach(id => {if (memberBannerRequests.get(id) === pending) memberBannerRequests.delete(id);});
    });
    ids.forEach(id => memberBannerRequests.set(id, pending));
    return Promise.all([...existing,pending]);
  }
  function loadMemberBanner(userId, force = false) {
    return loadMemberBanners([userId], force);
  }
  function mountMembers(node) {
    restoreMemberBannerPosters();
    if (membersTarget !== node) {
      memberObserver?.disconnect(); visibleMemberTiles.clear(); observedMemberTiles.clear(); membersTarget = node;
      memberObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRect.width > 0 && entry.intersectionRect.height > 0) visibleMemberTiles.add(entry.target);
          else visibleMemberTiles.delete(entry.target);
        }
        // Process the complete visibility snapshot before painting. WebKit can
        // report entering cards before exiting cards during a horizontal swipe.
        paintMembers();
      }) : null;
    }
    const tiles = [...node.querySelectorAll('[data-member-banner-user]')];
    // Drop detached cards after a list rerender; observers otherwise retain them.
    for (const tile of observedMemberTiles) if (!node.contains(tile)) {
      memberObserver?.unobserve(tile); observedMemberTiles.delete(tile); visibleMemberTiles.delete(tile);
    }
    // Hydration/presence updates often mount the same list. Keep observation
    // intact so unchanged visible banners do not restart their animation.
    tiles.forEach(tile => {
      if (!observedMemberTiles.has(tile)) { observedMemberTiles.add(tile); memberObserver?.observe(tile); }
    });
    paintMembers();
    void loadMemberBanners(tiles.map(tile => tile.dataset.memberBannerUser).filter(id => id !== options?.session() || !state));
  }
  document.addEventListener('visibilitychange', paintMembers);
  function renderEditor() {
    const settings = el('profileBannerSettings');
    if (!settings || settings.hidden) return;
    const picker = el('profileBannerPicker'), list = el('profileBannerOptions');
    if (state) {
      const owned = (state.banners || []).filter(banner => banner.owned);
      const selected = owned.find(banner => banner.id === state.equipped_banner_id);
      el('profileBannerSelection').textContent = selected?.name || 'Sin banner';
      const signature = JSON.stringify(owned.map(({id, name, art_key,presentation}) => [id, name, art_key,presentation]));
      if (list.dataset.signature !== signature) {
        list.dataset.signature = signature;
        list.innerHTML = `<button type="button" class="profile-banner-option" data-profile-banner="" data-banner-id="" aria-pressed="${!state.equipped_banner_id}"><div class="profile-banner-empty" aria-hidden="true">BB</div><span class="profile-banner-option-name">Sin banner</span></button>` + owned.map(banner => `<button type="button" class="profile-banner-option" data-profile-banner="${escape(banner.id)}" data-banner-id="${escape(banner.id)}" aria-pressed="${banner.id === state.equipped_banner_id}">${artwork(banner)}<span class="profile-banner-option-name">${escape(banner.name)}</span></button>`).join('');
      }
    }
    list.querySelectorAll('button').forEach(button => {
      button.disabled = busy || loading || !state || !online();
      button.setAttribute('aria-pressed', String((button.dataset.profileBanner || null) === (state?.equipped_banner_id || null)));
    });
    picker.setAttribute('aria-busy', String(busy || loading));
    el('profileBannerStatus').textContent = failure || (busy ? 'Aplicando banner…' : loading ? 'Cargando tus banners…' : !online() ? 'Conéctate para elegir tu banner.' : notice || (state && !(state.banners || []).some(banner => banner.owned) ? 'Todavía no tienes banners comprados.' : ''));
    el('profileBannerRetry').hidden = !failure && (loading || !!state);
    el('profileBannerRetry').disabled = busy || loading || !online();
    registerBannerVideos(list);
  }
  function openEditor(own) {
    el('profileBannerSettings').hidden = !own;
    el('profileBannerPicker').hidden = true;
    el('profileBannerToggle').setAttribute('aria-expanded', 'false');
    failure = ''; notice = '';
    if (own) {renderEditor(); void refresh();}
  }
  function closeEditor() {
    el('profileBannerSettings').hidden = true;
    el('profileBannerPicker').hidden = true;
    el('profileBannerToggle').setAttribute('aria-expanded', 'false');
  }
  function render() {
    if (state && options?.session()) {
      const userId = options.session();
      memberBanners.set(userId, state.banners?.find(item => item.id === state.equipped_banner_id) || null);
      memberBannerFetchedAt.set(userId, Date.now());
      saveMemberBannerPosters();
    }
    paintProfile();
    paintMembers();
    renderReveal();
    renderEditor();
    document.querySelectorAll('[data-duplicates-count]').forEach(node => {node.textContent = state ? extraCopies() : '—'; node.closest('button')?.setAttribute('aria-label', `Gestionar ${state ? extraCopies() : ''} cartas repetidas`);});
    if (el('discardAllDuplicates')) el('discardAllDuplicates').disabled = busy || loading || !extraCopies() || !online();
    if (el('duplicatesStatus')) el('duplicatesStatus').textContent = failure || notice || (loading ? 'Actualizando repetidas…' : state ? `${extraCopies()} copias repetidas. Conservas una de cada carta.` : 'Actualiza la colección para consultar las repetidas.');
    if (state?.cards) lastInventory = state.cards;
    globalThis.CardAlbum?.update({cards:lastInventory, catalog:state?.card_catalog, loading:loading || busy, failure, savedAt:inventorySavedAt});
    globalThis.CollectionSocial?.update(lastInventory);
    const status = el('bannerShopStatus');
    if (status) { status.textContent = failure || (loading ? 'Actualizando colección…' : notice); status.classList.toggle('is-error', !!failure); status.classList.toggle('is-passive', !failure && !!state); }
    if (el('bannerShopBalance')) el('bannerShopBalance').textContent = coins();
    document.querySelectorAll('[data-wallet-balance]').forEach(node => {node.textContent = state ? Number(state.balance).toLocaleString('es-ES') : '—';});
    document.querySelectorAll('[data-wallet]').forEach(node => node.setAttribute('aria-label', `Saldo: ${coins()}`));
    if (el('ownedPackOpen')) el('ownedPackOpen').disabled = busy || loading || !state?.available_packs?.length || !online();
    if (el('packsStatusTitle')) el('packsStatusTitle').textContent = failure ? 'No se pudo actualizar' : busy || loading ? 'Sincronizando sobres' : !online() ? 'Sin conexión' : !state ? 'Consulta tus sobres' : state.available_packs?.length ? 'Sobres disponibles' : 'Sin sobres disponibles';
    if (el('packsStatusMessage')) el('packsStatusMessage').textContent = failure || (busy || loading ? 'Consultando tu colección y tu saldo…' : !online() ? 'Conéctate a internet para abrir sobres.' : state?.available_packs?.length ? 'Pulsa un sobre para abrirlo.' : state ? 'Vuelve mañana para recibir tu sobre diario.' : 'Pulsa Actualizar saldo para consultar tu cuenta.');
    if (el('packsSyncButton')) {el('packsSyncButton').disabled = busy || loading || !online(); el('packsSyncButton').textContent = loading || busy ? 'Actualizando…' : failure ? 'Reintentar' : 'Actualizar saldo';}
    el('ownedPackOpen')?.setAttribute('aria-busy',String(busy));
    if (el('packsInfoBalance')) el('packsInfoBalance').textContent = state ? String(state.available_packs?.length ?? 0) : '—';
    if (el('packsInfoCoins')) el('packsInfoCoins').textContent = state ? `${Number(state.balance).toLocaleString('es-ES')} monedas` : '—';
    if (el('packRarityOdds')) el('packRarityOdds').textContent = state?.rarity_probabilities ? Object.keys(rarityNames).filter(rarity => state.rarity_probabilities[rarity] != null).map(rarity => `${rarityNames[rarity]} ${state.rarity_probabilities[rarity]}%`).join(' · ') : 'Probabilidades disponibles al sincronizar.';
    const shopHeading = el('shopBannersPanel')?.querySelector('.shop-section-heading');
    if (shopHeading) {
      const title = shopHeading.querySelector('h3'), subtitle = shopHeading.querySelector('p');
      if (title) title.textContent = 'Selección de hoy';
      if (subtitle) updateShopCountdown();
    }
    const shopVisible = Boolean(el('bannerShopDialog')?.open);
    const container = el('bannerShopItems');
    if (container && shopVisible) {
      // Selection, ownership and wallet changes update controls in place so
      // decoded images and animated scenes retain their playback position.
      const signature = JSON.stringify(state ? dailyBanners().map(({id,name,description,art_key,presentation}) => [id,name,description,art_key,presentation]) : null);
      if (container.dataset.signature !== signature) {
        container.dataset.signature = signature;
        container.innerHTML = state ? (dailyBanners().map((banner, index) => `<article class="banner-shop-item shop-banner-card ${index === 0 ? 'is-featured' : ''} ${banner.equipped ? 'is-equipped' : ''}"><div class="shop-artwork">${artwork(banner)}</div><div class="shop-card-content"><div class="shop-card-labels"><span class="shop-item-kind">${['alberto-galicia-anime-v1', 'miguel-basket-bano-v1', 'miguel-moto-anime-v1', 'fufi-supervuelo-v1', 'jose-enrique-ojos-v1'].includes(banner.art_key) || ['video'].includes(globalThis.ShopCatalogMedia?.presentation(banner)?.type) || globalThis.ShopCatalogMedia?.presentation(banner)?.animated ? 'Animado' : 'Perfil'}</span>${banner.owned ? `<span class="shop-ownership ${banner.equipped ? 'is-active' : ''}">${banner.equipped ? 'Equipado' : 'En tu colección'}</span>` : ''}</div><h3>${escape(banner.name)}</h3><p>${escape(banner.description || 'Diseño para la cabecera de tu perfil.')}</p><div class="shop-card-purchase"><span class="shop-price">${banner.owned ? '<small>Ya es tuyo</small>' : `<strong>${escape(banner.price)}</strong><small>${Number(banner.price) === 1 ? 'moneda' : 'monedas'}</small>`}</span><button class="packs-sync shop-purchase-button" type="button" data-banner-action="${banner.owned ? 'equip' : 'buy'}" data-banner-id="${escape(banner.id)}" ${busy || loading || banner.equipped || (!banner.owned && Number(state.balance) < Number(banner.price)) || !online() ? 'disabled' : ''}>${banner.equipped ? 'Equipado' : banner.owned ? 'Equipar' : 'Comprar'}</button></div></div></article>`).join('') || '<div class="shop-empty"><strong>Próximamente, nuevos diseños</strong><p>Los banners disponibles aparecerán aquí.</p></div>') : '<div class="shop-empty"><span class="shop-loading-art" aria-hidden="true"></span><strong>Cargando la tienda</strong><p>Los diseños del club aparecerán aquí.</p></div>';
      }
      container.querySelectorAll('[data-banner-action]').forEach(button => {
        const banner = state?.banners?.find(item => item.id === button.dataset.bannerId);
        if (banner) {
          const article = button.closest('.shop-banner-card');
          article.classList.toggle('is-equipped', !!banner.equipped);
          const labels = article.querySelector('.shop-card-labels');
          let ownership = labels.querySelector('.shop-ownership');
          if (banner.owned && !ownership) { ownership = document.createElement('span'); ownership.className = 'shop-ownership'; labels.append(ownership); }
          if (ownership) {
            ownership.hidden = !banner.owned;
            ownership.classList.toggle('is-active', !!banner.equipped);
            ownership.textContent = banner.equipped ? 'Equipado' : 'En tu colección';
          }
          const price = article.querySelector('.shop-price');
          const markup = banner.owned ? '<small>Ya es tuyo</small>' : `<strong>${escape(banner.price)}</strong><small>${Number(banner.price) === 1 ? 'moneda' : 'monedas'}</small>`;
          if (price.dataset.markup !== markup) { price.innerHTML = markup; price.dataset.markup = markup; }
          button.dataset.bannerAction = banner.owned ? 'equip' : 'buy';
          const label = banner.equipped ? 'Equipado' : banner.owned ? 'Equipar' : 'Comprar';
          if (button.textContent !== label) button.textContent = label;
        }
        button.disabled = busy || loading || !banner || banner.equipped || (!banner.owned && Number(state.balance) < Number(banner.price)) || !online();
      });
    }
    const vouchers = el('rewardVoucherItems');
    if (vouchers && shopVisible) {
      const signature = JSON.stringify(state?.vouchers || null);
      if (vouchers.dataset.signature !== signature) {
        vouchers.dataset.signature = signature;
        vouchers.innerHTML = state ? ((state.vouchers || []).map(voucher => `<article class="banner-shop-item reward-voucher-item"><div class="shop-voucher-art" aria-hidden="true"><span class="reward-voucher-mark">BB</span><span>VALE DEL CLUB</span></div><div class="shop-card-content"><div class="shop-card-labels"><span class="shop-item-kind">Canje por premio</span>${voucher.owned_quantity ? `<span class="shop-ownership">${escape(voucher.owned_quantity)} disponibles</span>` : ''}</div><h3>${escape(voucher.name)}</h3><p>${escape(voucher.description || '')}</p><div class="shop-card-purchase"><span class="shop-price">${voucher.owned_quantity ? '<small>Listo para canjear</small>' : `<strong>${escape(voucher.price)}</strong><small>monedas</small>`}</span><button class="packs-sync shop-purchase-button" type="button" data-voucher-action="${voucher.owned_quantity ? 'redeem' : 'unlock'}" data-voucher-id="${escape(voucher.id)}">${voucher.owned_quantity ? 'Canjear' : 'Desbloquear'}</button></div></div></article>`).join('') || '<div class="shop-empty"><strong>Aún no hay vales</strong><p>Los próximos premios aparecerán aquí.</p></div>') : '<div class="shop-empty"><strong>Premios del club</strong><p>Conéctate para consultar los vales.</p></div>';
      }
      vouchers.querySelectorAll('[data-voucher-action]').forEach(button => {
        const voucher = state?.vouchers?.find(item => item.id === button.dataset.voucherId);
        button.disabled = busy || loading || !voucher || !online() || (!voucher.owned_quantity && Number(state.balance) < Number(voucher.price));
      });
    }
    el('bannerShopItems')?.setAttribute('aria-busy', String(busy || loading));
    document.querySelectorAll('[data-shop-banner-count]').forEach(node => {node.textContent = state ? dailyBanners().length : '—';});
    document.querySelectorAll('[data-shop-voucher-count]').forEach(node => {node.textContent = state ? state.vouchers?.length || 0 : '—';});
    if (el('bannerUnequip')) el('bannerUnequip').disabled = busy || loading || !state?.equipped_banner_id || !online();
    renderInventory();
    registerBannerVideos();
  }
  function renderInventory() {
    const inventory = el('ownedCardInventory');
    if (!inventory) return;
    const markup = state ? (extraCopies() ? state.cards.filter(item => Number(item.quantity) > 1).map(item => {
      const design = card(item.card_id), reward = state.discard_rewards?.[item.edition] || 1;
      return `<article class="owned-card" data-owned-card="${escape(item.card_id)}">${design ? `<img data-card-original="${escape(design.front)}" src="${escape(globalThis.CardCollection.thumbnail(design))}" alt="${escape(design.name)}" loading="lazy" decoding="async">` : ''}<h4>${escape(design?.name || item.card_id)}</h4><p>${escape(design?.edition || item.edition)} · ${escape(item.quantity)} ${Number(item.quantity) === 1 ? 'copia' : 'copias'}</p>${Number(item.quantity) > 1 ? `<button type="button" class="packs-sync" data-discard-card="${escape(item.card_id)}">Descartar 1 repetida · +${escape(reward)} monedas</button>` : '<small>Única copia</small>'}</article>`;
    }).join('') : '<p>No tienes cartas repetidas.</p>') : '<p>Tu inventario se mostrará al sincronizar la colección.</p>';
    // Loading and busy state only change controls, keeping decoded card images
    // and focus intact while an unchanged inventory is refreshed.
    if (inventory.dataset.signature !== markup) {
      inventory.innerHTML = markup;
      inventory.dataset.signature = markup;
    }
    inventory.querySelectorAll('[data-discard-card]').forEach(button => {
      button.disabled = busy || loading || !state || !online();
    });
  }
  function refresh(forceDaily = false) {
    if (request) return request;
    const token = generation, user = options?.session();
    restoreInventory(user);
    if (!user) state = null;
    if (!online()) { loading = false; failure = ''; render(); return Promise.resolve(); }
    loading = true; failure = ''; render();
    request = (async () => {
      try {
        // The daily claim must finish before reading available packs. This also
        // covers profile mounting and reconnect, not just packs navigation.
        await options?.synchronizePacks?.(forceDaily);
        if (token !== generation || user !== options.session()) return;
        const catalogRefresh = globalThis.CardCatalogSync?.refresh();
        const data = await rpc('get_banner_shop_state'); if ((data.cards || []).some(item => !card(item.card_id))) await catalogRefresh; if (token === generation && user === options.session()) {state = {...data, banners:(data.banners || []).filter(banner => banner.id !== 'banner-de-prueba'), daily_banner_ids:Array.isArray(data.daily_banner_ids) ? data.daily_banner_ids.filter(id => id !== 'banner-de-prueba') : undefined, equipped_banner_id:data.equipped_banner_id === 'banner-de-prueba' ? null : data.equipped_banner_id}; scheduleShopReset(); saveInventory(user, data.cards); globalThis.DailyPacks?.updateBalance(state.available_packs.length); failure = ''; render();} }
      catch (error) { if (token === generation) {failure = errorMessage(error); render();} }
      finally {if (token === generation) {loading = false; request = null; render();}}
    })();
    return request;
  }
  async function animateDiscard(name, cardId, earned, copies, inReveal) {
    const host = inReveal ? revealDialog : el('duplicatesDialog');
    if (!host?.open || !copies) return;
    const sourceImages = inReveal
      ? [...revealDialog.querySelectorAll('.pack-reveal-front img')]
      : [...host.querySelectorAll('[data-owned-card]')].filter(node => name === 'discard_all_duplicate_cards' || node.dataset.ownedCard === cardId).map(node => node.querySelector('img')).filter(Boolean);
    const layer = document.createElement('div'); layer.className = 'card-discard-effect';
    const hostRect = host.getBoundingClientRect();
    const rewardX = Math.max(65,Math.min(innerWidth-65,hostRect.left+hostRect.width/2));
    const rewardY = Math.max(60,Math.min(innerHeight-80,hostRect.top+95));
    const reward = document.createElement('div'); reward.className = 'card-discard-reward';
    reward.setAttribute('role','status'); reward.setAttribute('aria-live','polite');
    reward.style.left = `${rewardX}px`; reward.style.top = `${rewardY}px`;
    reward.innerHTML = `<span class="card-discard-coin" aria-hidden="true">B</span><strong>+${escape(earned)} ${earned === 1 ? 'moneda' : 'monedas'}</strong>${inReveal ? '' : `<small>${escape(copies)} ${copies === 1 ? 'repetida descartada' : 'repetidas descartadas'}</small>`}`;
    layer.append(reward); host.append(layer);
    const animations = [], originals = [];
    const preference = (globalThis.ClubMotion?.media || matchMedia('(prefers-reduced-motion: reduce)'));
    const cancelMotion = () => {if (preference.matches || document.hidden) animations.forEach(animation => animation.cancel());};
    preference.addEventListener('change', cancelMotion);
    document.addEventListener('visibilitychange', cancelMotion);
    const cleanup = (keepCopiesDimmed = false) => {preference.removeEventListener('change', cancelMotion); document.removeEventListener('visibilitychange', cancelMotion); animations.forEach(animation => animation.cancel()); if (!keepCopiesDimmed) originals.forEach(node => node.classList.remove('is-discard-source')); layer.remove(); discardEffects.delete(cleanup);};
    discardEffects.add(cleanup);
    try {
      // The permanent status already confirms the award. Reduced motion
      // must not hold the wallet UI behind an invisible animation delay.
      if (preference.matches || document.hidden) return;
      const visible = sourceImages.filter(img => {const r = img.getBoundingClientRect(); return r.bottom>hostRect.top && r.top<hostRect.bottom && r.width>0;});
      const candidates = (visible.length ? visible : sourceImages).slice(0,6);
      candidates.forEach((img,index) => {
        const rect = img.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const ghost = document.createElement('img'); ghost.className = 'card-discard-flying';
        ghost.src = img.currentSrc || img.src; ghost.alt=''; ghost.setAttribute('aria-hidden','true');
        Object.assign(ghost.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`});
        layer.append(ghost); img.classList.add('is-discard-source'); originals.push(img);
        const dx=rewardX-(rect.left+rect.width/2),dy=rewardY-(rect.top+rect.height/2);
        animations.push(ghost.animate([
          {transform:'translate(0,0) rotate(0deg) scale(1)',opacity:1,offset:0},
          {transform:`translate(${dx*.15}px,${dy*.15-18}px) rotate(${-5+index*2}deg) scale(.86)`,opacity:1,offset:.28},
          {transform:`translate(${dx*.7}px,${dy*.7}px) rotate(${16+index*3}deg) scale(.32)`,opacity:.85,offset:.7},
          {transform:`translate(${dx}px,${dy}px) rotate(26deg) scale(.04)`,opacity:0,offset:1}
        ],{duration:motionTimings.discard,delay:index*24,easing:'cubic-bezier(.4,0,.2,1)',fill:'both'}));
      });
      for (let index=0;index<9;index++) {
        const spark=document.createElement('i'); spark.className='card-discard-spark'; spark.setAttribute('aria-hidden','true');
        Object.assign(spark.style,{left:`${rewardX}px`,top:`${rewardY}px`}); layer.append(spark);
        const angle=index*Math.PI*2/9,dx=Math.cos(angle)*55,dy=Math.sin(angle)*40;
        animations.push(spark.animate([{transform:'translate(0,0) scale(.4)',opacity:0},{opacity:1,offset:.2},{transform:`translate(${dx}px,${dy}px) scale(.2)`,opacity:0}],{duration:220,delay:motionTimings.discard-180,easing:'ease-out',fill:'both'}));
      }
      animations.push(reward.animate([{transform:'translate(-50%,-50%) scale(.7)',opacity:0},{transform:'translate(-50%,-50%) scale(1.08)',opacity:1,offset:.45},{transform:'translate(-50%,-50%) scale(1)',opacity:1}],{duration:motionTimings.reward,easing:'cubic-bezier(.4,0,.2,1)',fill:'both'}));
      await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
    } catch { /* A visual effect cannot turn a confirmed exchange into a failed transaction. */ }
    finally {cleanup(!inReveal);}
  }
  async function mutate(name, args, message, discardedIndex = null) {
    if (busy || loading || !online()) return;
    const token = generation, user = options.session();
    const equippingBanner = name === 'equip_profile_banner';
    const focus = document.activeElement;
    const revealAtStart = reveal;
    const focusCard = focus?.dataset?.discardCard;
    const focusBanner = focus?.dataset?.bannerId;
    const focusProfileBanner = focus?.dataset?.profileBanner;
    if (discardedIndex != null && revealAtStart) revealAtStart.discarding = true;
    busy = true; failure = ''; notice = ''; render();
    try {
      const data = await rpc(name, args);
      if (token !== generation || user !== options.session()) return;
      if (discardedIndex != null && reveal === revealAtStart) reveal.discarded.add(discardedIndex);
      // Equipping never spends coins. Apply its confirmed result to the current
      // snapshot while revalidating instead of flashing an empty shop/profile.
      if (equippingBanner && state) {
        const equipped = data.equipped_banner_id || null;
        state = {...state, equipped_banner_id:equipped, banners:state.banners.map(banner => ({...banner,equipped:banner.id === equipped}))};
        render();
      } else state = null;
      if (name === 'open_owned_card_pack') {
        const draws = data.cards || (data.card ? [data.card] : []);
        if (draws.some(item => !card(item.card_id))) await globalThis.CardCatalogSync?.refresh(true);
        if (token !== generation || user !== options.session()) return;
        el('ownedPackResult').textContent = `${draws.length} cartas guardadas en tu colección.`;
        startReveal(draws);
        await options.synchronizePacks?.(true);
        if (token !== generation || user !== options.session()) return;
      }
      if (name === 'discard_duplicate_card' || name === 'discard_all_duplicate_cards') {
        const earned = Number(data.coins_earned) || 0;
        const copies = name === 'discard_all_duplicate_cards' ? Number(data.copies_discarded) || 0 : 1;
        // Inside a pack the floating reward is the confirmation; no line follows to the next card.
        message = discardedIndex != null ? '' : `${copies} ${copies === 1 ? 'carta repetida descartada' : 'cartas repetidas descartadas'} · +${earned} ${earned === 1 ? 'moneda' : 'monedas'}.`;
        await animateDiscard(name,args.target_card_id,earned,copies,discardedIndex != null && reveal === revealAtStart);
        if (token !== generation || user !== options.session()) return;
      }
      notice = message;
      await refresh();
    } catch (error) { if (token === generation) {if (!equippingBanner) state = null; const message = errorMessage(error); await refresh(); if (token === generation) failure = equippingBanner ? message : `${message} Comprueba el saldo actualizado antes de repetir la acción.`;} }
    finally {if (token === generation) {
      if (reveal === revealAtStart && reveal) reveal.discarding = false;
      busy = false; render();
      const destination = [...document.querySelectorAll('[data-discard-card], [data-banner-id]')].find(button => !button.disabled && ((focusCard && button.dataset.discardCard === focusCard) || (focusBanner && button.dataset.bannerId === focusBanner)));
      if (focusProfileBanner !== undefined) {
        if (!el('profileBannerSettings').hidden && !el('profileBannerPicker').hidden) {
          const option = [...el('profileBannerOptions').querySelectorAll('[data-profile-banner]')].find(button => button.dataset.profileBanner === focusProfileBanner);
          (option && !option.disabled ? option : el('profileBannerToggle')).focus({preventScroll:true});
        }
      } else if (revealDialog.open) revealDialog.querySelector('[data-reveal-flip]')?.focus({preventScroll:true});
      else if (el('duplicatesDialog').open && focusCard) (destination || el('discardAllDuplicates')).focus({preventScroll:true});
      else if (destination) destination.focus({preventScroll:true});
      else if (focusCard) el('duplicatesDialog')?.querySelector('[data-duplicates-close]')?.focus({preventScroll:true});
    }}
  }
  function mountProfile(node, userId, own) {
    profileTarget = {node, userId, own};
    if (own) {
      const topline = node.querySelector('.club-profile-topline');
      if (topline && !topline.querySelector('[data-banner-shop]')) topline.insertAdjacentHTML('beforeend', '<span class="profile-coin-balance" data-wallet aria-label="Saldo pendiente de sincronización"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M15 8.5c-.7-.7-1.7-1-3-1-1.6 0-2.7.8-2.7 2s1.1 1.7 2.8 2c1.8.3 2.8.8 2.8 2.1 0 1.2-1.2 2.1-3 2.1-1.4 0-2.6-.5-3.4-1.3M12 5.5v13"/></svg><span data-wallet-balance>—</span></span><button type="button" class="banner-shop-trigger" data-banner-shop aria-label="Abrir tienda de banners" aria-haspopup="dialog" title="Tienda"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h18l-2-6H5L3 9Zm1 0v12h16V9M9 21v-7h6v7M3 9c0 3 4 3 4 0 0 3 5 3 5 0 0 3 5 3 5 0 0 3 4 3 4 0"/></svg></button>');
      if (topline && !topline.querySelector('[data-card-album]')) topline.insertAdjacentHTML('beforeend', `<button type="button" class="card-album-trigger" data-card-album aria-label="Abrir mi álbum de cartas">${globalThis.CardAlbum?.icon || ''}</button>`);
      paintProfile();
      if (!state && !request) void refresh();
    } else if (userId) {
      paintProfile();
      void loadMemberBanner(userId, true);
    }
  }
  let duplicatesOpener = null;
  function openDuplicates(trigger) {
    const dialog = el('duplicatesDialog');
    if (!dialog) return;
    // Cached HTML can still have this modal inside the inactive packs route.
    // Native top-layer promotion does not make an inert ancestor interactive.
    if (dialog.parentElement !== document.body) document.body.append(dialog);
    dialog.inert = false; dialog.hidden = false; dialog.removeAttribute('aria-hidden');
    if (dialog.open) {globalThis.ClubMotion?.openDialog?.(dialog);el('duplicatesDialog')?.querySelector('[data-duplicates-close]')?.focus({preventScroll:true}); return;}
    duplicatesOpener = trigger || document.activeElement;
    try {
      render();if(globalThis.ClubMotion?.openDialog)globalThis.ClubMotion.openDialog(dialog);else dialog.showModal(); el('duplicatesDialog')?.querySelector('[data-duplicates-close]')?.focus({preventScroll:true});
    } catch {
      // Never leave an unresponsive top-layer backdrop after a failed mount.
      if (dialog.open) dialog.close(); duplicatesOpener = null; return;
    }
    // A network failure updates the modal status; closing remains available.
    void Promise.resolve().then(() => refresh()).catch(error => {
      if (!dialog.open) return;
      el('duplicatesStatus').textContent = errorMessage(error);
    });
  }
  function initialize(config) {
    options = config;globalThis.ShopCatalogMedia?.configure(config.cacheNamespace);
    globalThis.CollectionSocial?.initialize({session:options.session,rpc:options.rpc,refreshInventory:() => refresh(true)});
    const duplicatesDialog = el('duplicatesDialog');
    if (duplicatesDialog?.parentElement !== document.body && duplicatesDialog) document.body.append(duplicatesDialog);
    duplicatesDialog?.addEventListener('close',() => {
      discardEffects.forEach(cleanup => cleanup());
      const trigger = duplicatesOpener; duplicatesOpener = null;
      if (trigger?.isConnected && !trigger.closest('[inert], [hidden]')) trigger.focus({preventScroll:true});
    });
    globalThis.CardAlbum?.configure({refresh:() => refresh(), navigate:options.navigate});
    document.addEventListener('click', event => {
      if (event.target.closest('[data-banner-shop]')) {
        const shop = el('bannerShopDialog');
        if(globalThis.ClubMotion?.openDialog)globalThis.ClubMotion.openDialog(shop);else if(!shop.open)shop.showModal();
        render();
        updateShopCountdown();
        const artwork = shop.querySelector('.is-featured .shop-artwork');
        if (artwork && !revealReduced()) artwork.animate([
          {opacity:.6, transform:'scale(.985)'},
          {opacity:1, transform:'scale(1)'}
        ], {duration:300, easing:'cubic-bezier(.22,1,.36,1)'});
        void refresh();
      }
      const ownedOption = event.target.closest('[data-profile-banner]');
      if (ownedOption && !el('profileBannerSettings').hidden && !ownedOption.disabled) {
        const id = ownedOption.dataset.profileBanner || null;
        if (state && id !== (state.equipped_banner_id || null) && (id === null || state?.banners?.some(banner => banner.id === id && banner.owned))) void mutate('equip_profile_banner', {target_banner_id:id}, id ? 'Banner aplicado a tu perfil.' : 'Banner retirado de tu perfil.');
      }
      const banner = event.target.closest('[data-banner-action]');
      if (banner) void mutate(banner.dataset.bannerAction === 'buy' ? 'buy_profile_banner' : 'equip_profile_banner', {target_banner_id:banner.dataset.bannerId}, banner.dataset.bannerAction === 'buy' ? 'Banner comprado. Ya puedes equiparlo.' : 'Banner equipado en la cabecera de tu perfil.');
      const voucher = event.target.closest('[data-voucher-action]');
      if (voucher) void mutate(voucher.dataset.voucherAction === 'unlock' ? 'unlock_reward_voucher' : 'redeem_reward_voucher', {target_voucher_id:voucher.dataset.voucherId}, voucher.dataset.voucherAction === 'unlock' ? 'Vale desbloqueado.' : 'Premio canjeado.');
      const duplicatesTrigger = event.target.closest('[data-duplicates-open]');
      if (duplicatesTrigger) openDuplicates(duplicatesTrigger);
      if (event.target.closest('[data-duplicates-close]')) globalThis.ClubMotion?.closeDialog ? void globalThis.ClubMotion.closeDialog(el('duplicatesDialog')) : el('duplicatesDialog').close();
      const discard = event.target.closest('[data-discard-card]');
      if (discard) void mutate('discard_duplicate_card', {target_card_id:discard.dataset.discardCard,copies:1}, 'Carta repetida descartada. Monedas añadidas a tu cuenta.');
    });
    el('discardAllDuplicates').addEventListener('click', () => void mutate('discard_all_duplicate_cards', {}, 'Todas las repetidas descartadas. Monedas añadidas a tu cuenta.'));
    el('profileBannerToggle').addEventListener('click', () => {
      const picker = el('profileBannerPicker');
      picker.hidden = !picker.hidden;
      el('profileBannerToggle').setAttribute('aria-expanded', String(!picker.hidden));
      if (!picker.hidden) {renderEditor(); if (!state && !request) void refresh();}
    });
    el('profileBannerRetry').addEventListener('click', () => void refresh());
    el('bannerShopClose').addEventListener('click', () => globalThis.ClubMotion?.closeDialog ? void globalThis.ClubMotion.closeDialog(el('bannerShopDialog')) : el('bannerShopDialog').close());
    for(const dialog of [el('bannerShopDialog'),el('duplicatesDialog'),revealDialog])dialog?.addEventListener('cancel',event=>{if(globalThis.ClubMotion?.closeDialog){event.preventDefault();void globalThis.ClubMotion.closeDialog(dialog);}});
    el('bannerShopDialog').addEventListener('close', () => clearTimeout(shopCountdownTimer));
    const shopTabs = [...document.querySelectorAll('[data-shop-tab]')];
    const selectShopTab = tab => {
      shopTabs.forEach(item => {
        const selected = item === tab;
        item.setAttribute('aria-selected', String(selected)); item.tabIndex = selected ? 0 : -1;
        el(item.getAttribute('aria-controls')).hidden = !selected;
      });
    };
    shopTabs.forEach((tab, index) => {
      tab.addEventListener('click', () => selectShopTab(tab));
      tab.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? shopTabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + shopTabs.length) % shopTabs.length;
        selectShopTab(shopTabs[next]); shopTabs[next].focus();
      });
    });
    el('packsInfoTrigger')?.addEventListener('click', () => {const trigger=el('packsInfoTrigger'), panel=el('packsInfoPanel'), open=trigger.getAttribute('aria-expanded')==='true';panel.hidden=open;trigger.setAttribute('aria-expanded',String(!open));});
    el('bannerUnequip').addEventListener('click', () => void mutate('equip_profile_banner', {target_banner_id:null}, 'Banner retirado de tu perfil.'));
    el('ownedPackOpen').addEventListener('click', () => void mutate('open_owned_card_pack', {}, ''));
    window.addEventListener('online', () => {
      if (options.session()) void refresh();
      if (membersTarget?.isConnected) mountMembers(membersTarget);
    });
    window.addEventListener('offline', render);
    document.addEventListener('visibilitychange', () => {
      updateShopCountdown();
      if (!document.hidden && options?.session() && el('bannerShopDialog')?.open && Date.parse(state?.shop_next_reset_at) <= Date.now()) void refresh();
    });
    render();
  }
  function reset() {
    clearTimeout(shopResetTimer);
    clearTimeout(shopCountdownTimer);
    closeEditor();
    el('profileBannerOptions').replaceChildren();
    delete el('profileBannerOptions').dataset.signature;
    el('profileBannerSelection').textContent = 'Sin banner';
    discardEffects.forEach(cleanup => cleanup());
    if (inventoryOwner) { try { localStorage.removeItem(inventoryCacheKey(inventoryOwner)); if(localStorage.getItem(offlineInventoryOwnerKey)===inventoryOwner)localStorage.removeItem(offlineInventoryOwnerKey); } catch {} }
    inventoryOwner = null; inventorySavedAt = 0;
    generation++; state = null; lastInventory = null; busy = false; loading = false; request = null; failure = ''; notice = ''; profileTarget = null; memberBanners.clear(); memberBannerRequests.clear(); memberBannerFetchedAt.clear();
    memberBannerCacheOwner = null; memberBannerCacheSignature = '';
    memberObserver?.disconnect(); memberObserver = null; visibleMemberTiles.clear(); observedMemberTiles.clear();
    paintMembers(); membersTarget = null;
    duplicatesOpener = null;
    globalThis.CardAlbum?.reset();
    globalThis.CollectionSocial?.reset();
    revealDialog.close(); el('duplicatesDialog')?.close();
    el('bannerShopDialog')?.close(); if (el('ownedPackResult')) el('ownedPackResult').replaceChildren(); render();
  }
  document.addEventListener('bb:card-catalog-updated', () => {if (options && (revealDialog.open || el('duplicatesDialog')?.open || el('sobres')?.classList.contains('active'))) render();});
  globalThis.BannerShop = Object.freeze({initialize, offlineInventory, forgetOfflineInventory, refresh, openEditor, closeEditor, mountProfile, mountMembers, memberArtwork, artwork, reset});
})();
