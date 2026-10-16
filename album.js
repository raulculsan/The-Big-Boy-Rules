/* The catalog defines slots; only the server inventory fills them. */
(() => {
  const rarities = [{key:'common',label:'Común',capacity:[12,4,4]}, {key:'retro',label:'Retro',capacity:[8,6,6]}, {key:'special',label:'Especial',capacity:[6,7,7]}, {key:'epic',label:'Épica',capacity:[6,7,7]}, {key:'legendary',label:'Legendaria',capacity:[6,7,7]}, {key:'full_art',label:'Full Art',capacity:[10,5,5]}, {key:'vice_city',label:'Vice City',capacity:[10,5,5]}];
  const kinds = [{key:'miembros',label:'Miembros'}, {key:'ubicaciones',label:'Ubicaciones'}, {key:'objetos',label:'Objetos'}];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const rarityOf = item => ({common:'common',comun:'common',retro:'retro',special:'special',especial:'special',epic:'epic',epica:'epic',legendary:'legendary',legendaria:'legendary','full art':'full_art',full_art:'full_art','vice city':'vice_city',vice_city:'vice_city'}[normalize(item.rarity || item.edition)] || 'common');
  const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15M5 8h4M5 11h4M15 8h4M15 11h4"/></svg>';
  let collections = [{id:'los-nuestros-01',name:'Los nuestros · Colección 01'}], selectedCollection = 'los-nuestros-01';
  let query = '', kindFilter = '', rarityFilter = '', ownershipFilter = '', allSlots = [];
  let savedAt = 0;
  let inventory = null, loading = false, failure = '', page = 0, slots = [], refresh, navigate, opener, returnSection = 'sobres', renderedSlots = '';
  const dialog = document.createElement('section');
  dialog.id = 'album'; dialog.className = 'page-section card-album-page'; dialog.hidden = true; dialog.setAttribute('aria-labelledby','cardAlbumTitle');
  dialog.innerHTML = `<div class="card-album"><header class="card-album-header"><div><span class="eyebrow"><span data-album-collection-name>LOS NUESTROS · COLECCIÓN 01</span></span><h2 id="cardAlbumTitle" tabindex="-1">Mi álbum</h2></div><button type="button" class="duplicate-cards-trigger" data-duplicates-open aria-label="Gestionar cartas repetidas" aria-haspopup="dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h13v17H7zM4 7H2v15h13v-2"/></svg><span data-duplicates-count>0</span></button><button type="button" class="packs-back" data-album-close aria-label="Volver de álbum">←</button></header><p id="cardAlbumSummary" class="card-album-summary"></p><div id="cardAlbumStatus" role="status" aria-live="polite"><span data-album-status-message></span><button type="button" data-album-retry hidden>Reintentar</button></div><div class="card-album-tools"><label class="album-collection-select"><span>Colección</span><select data-album-collection aria-label="Colección"></select></label><label class="album-card-search"><span aria-hidden="true">⌕</span><input type="search" data-album-search placeholder="Buscar carta" aria-label="Buscar carta por nombre" autocomplete="off"></label><details class="album-filter-panel"><summary>Filtros<span data-album-filter-count></span></summary><div class="album-filter-fields"><label>Rareza<select data-album-filter="rarity"><option value="">Todas</option>${rarities.map(r => `<option value="${r.key}">${r.label}</option>`).join('')}</select></label><label>Tipo<select data-album-filter="kind"><option value="">Todos</option><option value="Miembro">Miembros</option><option value="Personaje">Personajes</option><option value="Ubicación">Ubicaciones</option><option value="Objeto">Objetos</option></select></label><label>Estado<select data-album-filter="ownership"><option value="">Todas las cartas</option><option value="missing">Me faltan</option><option value="owned">Conseguidas</option></select></label><button type="button" data-album-clear>Limpiar filtros</button></div></details></div><nav class="card-album-tabs" aria-label="Rarezas del álbum">${rarities.map(r => `<button type="button" data-album-rarity="${r.key}">${r.label}</button>`).join('')}</nav><div class="card-album-page-viewport"><section id="cardAlbumLeaf" class="card-album-leaf" aria-labelledby="cardAlbumPageTitle"><h3 id="cardAlbumPageTitle"></h3><div id="cardAlbumSlots" class="card-album-slots"></div></section></div><nav class="card-album-page-controls" aria-label="Páginas del álbum"><div class="card-album-compass-heading"><span>PÁGINAS</span><span id="cardAlbumPageCount" class="card-album-page-count" role="status" aria-live="polite"></span></div><div class="card-album-compass"><span class="card-album-compass-needle" aria-hidden="true"></span><div id="cardAlbumPageCompass" class="card-album-compass-track" aria-label="Seleccionar página"></div></div></nav></div>`;
  const main = document.querySelector('main.app') || document.body.appendChild(Object.assign(document.createElement('main'),{className:'app'}));
  main.append(dialog);
  const isOpen = () => dialog.classList.contains('active') && !dialog.hidden;
  function buildSlots() {
    const catalog = (globalThis.CardCollection?.catalog || []).filter(item => (item.collection || 'los-nuestros-01') === selectedCollection);
    allSlots = rarities.flatMap(rarity => kinds.flatMap((kind, index) => {
      const designs = catalog.filter(item => rarityOf(item) === rarity.key && (item.folder || 'miembros') === kind.key);
      return Array.from({length:Math.max(rarity.capacity[index], designs.length)}, (_, position) => ({rarity,kind,design:designs[position] || null}));
    })).map((slot,index) => ({...slot,number:index + 1}));
    applyFilters();
  }
  function applyFilters() {
    const owned = new Map((inventory || []).map(item => [item.card_id,Number(item.quantity)]));
    const filtering = query || kindFilter || rarityFilter || ownershipFilter;
    slots = filtering ? allSlots.filter(slot => slot.design && (!query || normalize(slot.design.name).includes(normalize(query))) && (!kindFilter || normalize(slot.design.kind) === normalize(kindFilter)) && (!rarityFilter || slot.rarity.key === rarityFilter) && (!ownershipFilter || (ownershipFilter === 'owned' ? owned.get(slot.design.id) > 0 : !(owned.get(slot.design.id) > 0)))) : allSlots;
    const selector = dialog.querySelector('[data-album-collection]');
    const options = collections.map(c => `<option value="${escape(c.id)}">${escape(c.name)}</option>`).join('');
    if (selector.innerHTML !== options) selector.innerHTML = options;
    selector.value = selectedCollection;
    selector.parentElement.hidden = collections.length < 2;
    dialog.querySelector('[data-album-collection-name]').textContent = collections.find(c => c.id === selectedCollection)?.name || 'Colección';
    dialog.querySelector('[data-album-filter-count]').textContent = [kindFilter,rarityFilter,ownershipFilter].filter(Boolean).length || '';
  }
  function changeFilters() {stopTurn(); page = 0; compassQueued = null; renderedSlots = ''; applyFilters(); render();}
  const warmedImages = new Set();
  let warmGeneration = 0;
  let pageAnimations = [], pageGhost = null, pageMotionToken = 0, turning = false, pendingRender = false, pageOrderTimer = 0;
  const motionMedia = globalThis.ClubMotion?.media || window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedMotion = () => motionMedia.matches;
  function stopTurn() {
    pageMotionToken++; clearTimeout(pageOrderTimer); pageOrderTimer = 0; pageAnimations.forEach(animation => animation.cancel()); pageAnimations = [];
    pageGhost?.remove(); pageGhost = null; turning = false;
    const viewport = dialog.querySelector('.card-album-page-viewport');
    viewport.classList.remove('is-turning'); viewport.style.removeProperty('height');
    const leaf = document.getElementById('cardAlbumLeaf');
    leaf.inert = false; leaf.removeAttribute('aria-hidden');
    dialog.querySelectorAll('[data-album-prev],[data-album-next],[data-album-rarity]').forEach(button => button.removeAttribute('aria-busy'));

  }
  function render(prepare = false) {
    if (!isOpen() && !prepare) return;
    if (turning) {pendingRender = true; return;}
    const owned = new Map((inventory || []).map(item => [item.card_id, Number(item.quantity)]));
    const totalPages = Math.max(1,Math.ceil(slots.length / 5));
    page = Math.min(page, Math.max(0,totalPages - 1));
    const visible = slots.slice(page * 5, page * 5 + 5), rarity = visible[0]?.rarity;
    document.getElementById('cardAlbumSummary').textContent = inventory ? `${slots.filter(slot => slot.design && owned.get(slot.design.id) > 0).length} cartas conseguidas · ${slots.length} huecos` : `${slots.length} huecos · colección pendiente de sincronización`;
    const status = document.getElementById('cardAlbumStatus');
    // Refreshing a populated album must not insert a new row and move the page.
    const offline = navigator.onLine === false;
    dialog.querySelector('[data-duplicates-open]').disabled = offline;
    const cachedLabel = savedAt ? `Última sincronización: ${new Date(savedAt).toLocaleString('es-ES',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}.` : '';
    const message = offline && inventory ? `Sin conexión · Solo lectura. ${cachedLabel}` : failure && inventory ? `${failure} ${cachedLabel}` : failure || (!inventory ? (offline ? 'Sin conexión. Conéctate para cargar tu álbum.' : loading ? 'Cargando tu colección…' : 'Consulta tu colección para ver tus cartas.') : '');
    status.querySelector('[data-album-status-message]').textContent = message;
    status.hidden = !message; status.classList.toggle('is-error',!!failure);
    const retry = status.querySelector('[data-album-retry]');
    retry.hidden = !failure && (loading || !!inventory || offline);
    retry.disabled = loading || offline; retry.textContent = loading ? 'Actualizando…' : 'Reintentar';
    dialog.setAttribute('aria-busy',String(loading));
    document.getElementById('cardAlbumPageTitle').textContent = visible.length ? `${rarity?.label || ''} · ${[...new Set(visible.map(slot => slot.kind.label))].join(' / ')}` : 'No hay cartas con estos filtros';
    document.getElementById('cardAlbumLeaf').dataset.rarity = rarity?.key;
    const markup = visible.map((slot,index) => {
      const quantity = slot.design && owned.get(slot.design.id), number = String(slot.number).padStart(3,'0');
      const mark = slot.design ? (!offline ? globalThis.CollectionSocial?.actions(slot.design.id,quantity > 0) : '') || '' : '';
      const face = quantity > 0 ? `<button type="button" class="card-album-slot is-owned" data-album-card="${escape(slot.design.id)}" aria-label="Ver ${escape(slot.design.name)}, ${escape(slot.rarity.label)}, ${quantity} copias"><img data-card-original="${escape(slot.design.front)}" src="${escape(globalThis.CardCollection.thumbnail(slot.design))}" alt="${escape(slot.design.name)}" loading="eager" decoding="async"><span class="card-album-slot-number">${number}</span><strong>${escape(slot.design.name)}</strong><small>${slot.kind.label} · ${quantity} ${quantity === 1 ? 'copia' : 'copias'}</small></button>` : `<div class="card-album-slot is-empty" aria-label="Hueco ${number}, ${slot.rarity.label}, ${slot.kind.label}, ${slot.design ? 'carta por conseguir' : 'reservado para una nueva carta'}"><div class="card-album-silhouette">${icon}<span>${number}</span></div><span class="card-album-slot-number" aria-hidden="true">${number}</span><strong>${slot.design ? escape(slot.design.name) : 'Próximamente'}</strong><small>${slot.kind.label} · ${slot.rarity.label}</small></div>`;
      return `<article class="card-album-cell">${face}${mark}</article>`;
    }).join('') || '<p class="album-empty-results">Prueba otro nombre o limpia los filtros.</p>';
    // Keep decoded image elements across loading/balance updates and reopening.
    if (markup !== renderedSlots) {document.getElementById('cardAlbumSlots').innerHTML = markup; renderedSlots = markup;}
    // Small list thumbnails decode to ~0.9 MiB. Warm only two sequentially
    // and cancel when navigation changes; originals decode only in the viewer.
    const generation = ++warmGeneration;
    const neighbors = slots.slice((page + 1) * 5,(page + 2) * 5)
      .filter(slot => slot.design && owned.get(slot.design.id) && !warmedImages.has(globalThis.CardCollection.thumbnail(slot.design)))
      .slice(0,2);
    void (async () => {
      for (const slot of neighbors) {
        if (generation !== warmGeneration || !isOpen() || document.hidden) break;
        const src = globalThis.CardCollection.thumbnail(slot.design);
        warmedImages.add(src);
        const image = new Image(); image.decoding = 'async'; image.src = src;
        try { await image.decode?.(); } catch { warmedImages.delete(src); }
      }
    })();
    document.getElementById('cardAlbumPageCount').textContent = `${page + 1} / ${totalPages}`;
    renderCompass(totalPages);
    dialog.querySelectorAll('[data-album-rarity]').forEach(button => {button.setAttribute('aria-pressed',String(button.dataset.albumRarity === rarity?.key)); button.disabled = !slots.some(slot => slot.rarity.key === button.dataset.albumRarity);});
  }
  const compass = document.getElementById('cardAlbumPageCompass');
  let compassTimer = 0, compassDragging = false, compassQueued = null, compassMouse = null, compassSuppressClick = 0;
  function centerCompass(index) {
    const tick = compass.children[index];
    if (tick && compass.clientWidth) compass.scrollLeft = tick.offsetLeft + tick.offsetWidth / 2 - compass.clientWidth / 2;
  }
  function renderCompass(totalPages) {
    if (compass.children.length !== totalPages) {
      compass.innerHTML = Array.from({length:totalPages}, (_, index) => `<button type="button" class="card-album-compass-tick" data-album-page="${index}" aria-label="Página ${index + 1}"><span>${String(index + 1).padStart(2,'0')}</span></button>`).join('');
    }
    [...compass.children].forEach((tick,index) => {
      tick.setAttribute('aria-current',index === page ? 'page' : 'false');
      tick.tabIndex = index === page ? 0 : -1;
    });
    if (!compassDragging && compassQueued === null) centerCompass(page);
  }
  async function selectCompass(index) {
    if (!isOpen()) return;
    if (turning) {compassQueued = index; return;}
    await turn(index);
    if (compassQueued !== null && isOpen()) {
      const next = compassQueued; compassQueued = null;
      void selectCompass(next);
    }
  }
  function settleCompass() {
    clearTimeout(compassTimer);
    if (!isOpen() || compassDragging || !compass.clientWidth) return;
    const center = compass.scrollLeft + compass.clientWidth / 2;
    const nearest = [...compass.children].reduce((best,tick) => Math.abs(tick.offsetLeft + tick.offsetWidth / 2 - center) < Math.abs(best.offsetLeft + best.offsetWidth / 2 - center) ? tick : best,compass.firstElementChild);
    if (nearest) void selectCompass(Number(nearest.dataset.albumPage));
  }
  compass.addEventListener('scroll',() => {
    clearTimeout(compassTimer);
    compassTimer = setTimeout(settleCompass,160);
  },{passive:true});
  compass.addEventListener('pointerdown',event => {
    if (!event.isPrimary || event.button !== 0) return;
    clearTimeout(compassTimer); compassDragging = true;
    if (event.pointerType === 'mouse') compassMouse = {id:event.pointerId,x:event.clientX,left:compass.scrollLeft,moved:false};
  });
  compass.addEventListener('pointermove',event => {
    if (!compassMouse || compassMouse.id !== event.pointerId) return;
    const distance = event.clientX - compassMouse.x;
    if (Math.abs(distance) > 5) {
      compassMouse.moved = true; compass.classList.add('is-dragging');
      if (!compass.hasPointerCapture(event.pointerId)) compass.setPointerCapture(event.pointerId);
      compass.scrollLeft = compassMouse.left - distance;
      event.preventDefault();
    }
  });
  function releaseCompass(event) {
    if (compassMouse && compassMouse.id !== event.pointerId) return;
    if (compassMouse?.moved) compassSuppressClick = Date.now() + 350;
    compassMouse = null; compassDragging = false; compass.classList.remove('is-dragging');
    if (compass.hasPointerCapture(event.pointerId)) compass.releasePointerCapture(event.pointerId);
    clearTimeout(compassTimer); compassTimer = setTimeout(settleCompass,180);
  }
  compass.addEventListener('pointerup',releaseCompass);
  compass.addEventListener('pointercancel',releaseCompass);
  compass.addEventListener('lostpointercapture',event => {if (event.target === compass && compassDragging) releaseCompass(event);});
  compass.addEventListener('click',event => {
    const tick = event.target.closest('[data-album-page]');
    if (!tick) return;
    event.preventDefault(); event.stopPropagation();
    if (Date.now() < compassSuppressClick) return;
    clearTimeout(compassTimer); compassQueued = null;
    centerCompass(Number(tick.dataset.albumPage));
    void selectCompass(Number(tick.dataset.albumPage));
  });
  compass.addEventListener('keydown',event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const current = Number(event.target.closest('[data-album-page]')?.dataset.albumPage ?? page);
    const next = Math.max(0,Math.min(compass.children.length - 1,event.key === 'Home' ? 0 : event.key === 'End' ? compass.children.length - 1 : current + (event.key === 'ArrowRight' ? 1 : -1)));
    compassQueued = null; centerCompass(next); void selectCompass(next);
    compass.children[next]?.focus({preventScroll:true});
  });
  if (globalThis.ResizeObserver) new ResizeObserver(() => {if (isOpen() && !compassDragging && compassQueued === null) centerCompass(page);}).observe(compass);
  function copyLeaf(leaf, extraClass = '') {
    const copy = leaf.cloneNode(true);
    copy.removeAttribute('id'); copy.removeAttribute('aria-labelledby');
    copy.setAttribute('aria-hidden','true'); copy.inert = true;
    copy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    copy.classList.add('card-album-sheet-face');
    if (extraClass) copy.classList.add(extraClass);
    return copy;
  }
  function makeSheet(leaf, className, height) {
    const sheet = document.createElement('div'); sheet.className = `card-album-turn-sheet ${className}`;
    sheet.setAttribute('aria-hidden','true'); sheet.inert = true; sheet.style.height = `${height}px`; sheet.dataset.scrollTop = String(leaf.scrollTop);
    const face = copyLeaf(leaf); face.scrollTop = leaf.scrollTop;
    const back = document.createElement('div'); back.className = 'card-album-sheet-back';
    back.innerHTML = `<span>${icon}</span><small>${escape(collections.find(c => c.id === selectedCollection)?.name)}</small>`;
    const shade = document.createElement('div'); shade.className = 'card-album-fold-shade';
    sheet.append(face,back,shade); return sheet;
  }
  async function turn(destination) {
    const target = Math.max(0,Math.min(Math.ceil(slots.length / 5) - 1,destination));
    if (turning || target === page || !isOpen()) return;
    stopTurn();
    const leaf = document.getElementById('cardAlbumLeaf'), forward = target > page;
    const viewport = dialog.querySelector('.card-album-page-viewport');
    const oldHeight = leaf.getBoundingClientRect().height;
    const outgoing = makeSheet(leaf,'is-outgoing',oldHeight);
    const animateTurn = !reducedMotion();
    // Conceal the stationary destination before updating it. Only the moving
    // paper faces are painted until the incoming sheet reaches its final pose.
    if (animateTurn) {viewport.classList.add('is-turning'); leaf.inert = true; leaf.setAttribute('aria-hidden','true');}
    page = target; render(); leaf.scrollTop = 0;
    if (!animateTurn) return;
    const newHeight = leaf.getBoundingClientRect().height;
    const incoming = makeSheet(leaf,'is-incoming',newHeight);
    const layer = document.createElement('div'); layer.className = 'card-album-turn-layer';
    layer.setAttribute('aria-hidden','true'); layer.inert = true;
    layer.append(outgoing,incoming); viewport.append(layer);
    // A detached clone cannot retain scrollTop until it has layout. Restore the
    // position after mounting, so a scrolled page does not jump during its turn.
    outgoing.querySelector('.card-album-sheet-face').scrollTop = Number(outgoing.dataset.scrollTop);
    incoming.querySelector('.card-album-sheet-face').scrollTop = 0;
    pageGhost = layer; turning = true;
    viewport.style.height = `${Math.max(oldHeight,newHeight)}px`;
    viewport.classList.add('is-turning');
    const token = pageMotionToken;
    dialog.querySelectorAll('[data-album-prev],[data-album-next],[data-album-rarity]').forEach(button => button.setAttribute('aria-busy','true'));
    // A right-hand page leaves the left spine; reversing returns it from that spine.
    const origin = forward ? 'left center' : 'right center', sign = forward ? -1 : 1;
    outgoing.style.transformOrigin = incoming.style.transformOrigin = origin;
    incoming.style.visibility = 'hidden';
    // Decode the destination before its moving face becomes visible.
    try {
    await Promise.race([
      Promise.all([...incoming.querySelectorAll('img')].map(img => img.decode?.().catch(() => {}) || Promise.resolve())),
      new Promise(resolve => setTimeout(resolve,180))
    ]);
    if (token !== pageMotionToken || !isOpen()) return;
    incoming.style.visibility = '';
    // Both leaves share one continuous timeline. The departing paper keeps
    // moving and becomes transparent before it can linger beside the spine.
    incoming.style.zIndex = '4';
    const options = {duration:globalThis.CollectionMotion?.timings?.page || 480,easing:'cubic-bezier(.4,0,.2,1)',fill:'both'};
    pageAnimations = [
      outgoing.animate([
        {transform:'rotateY(0deg)',opacity:1,offset:0},
        {transform:`rotateY(${sign * 42}deg)`,opacity:1,offset:.38},
        {transform:`rotateY(${sign * 82}deg)`,opacity:.75,offset:.68},
        {transform:`rotateY(${sign * 94}deg)`,opacity:0,offset:.88},
        {transform:`rotateY(${sign * 102}deg)`,opacity:0,offset:1}
      ],options),
      incoming.animate([
        {transform:`rotateY(${-sign * 96}deg)`,opacity:0,offset:0},
        {transform:`rotateY(${-sign * 96}deg)`,opacity:0,offset:.25},
        {transform:`rotateY(${-sign * 78}deg)`,opacity:1,offset:.45},
        {transform:'rotateY(0deg)',opacity:1,offset:1}
      ],options),
      outgoing.querySelector('.card-album-fold-shade').animate([{opacity:0},{opacity:.55,offset:.68},{opacity:0}],options),
      incoming.querySelector('.card-album-fold-shade').animate([{opacity:.55},{opacity:0}],options)
    ];
    await Promise.all(pageAnimations.map(animation => animation.finished.catch(() => {})));
    clearTimeout(pageOrderTimer); pageOrderTimer = 0;
    if (token !== pageMotionToken) return;
    // Reveal the identical stationary leaf in the same frame as removing its
    // moving copy, so there is neither a duplicated page nor a blank hand-off.
    viewport.classList.remove('is-turning'); leaf.inert = false; leaf.removeAttribute('aria-hidden');
    // Settle the cover height only after the sheets have finished crossing.
    layer.remove(); pageGhost = null;
    pageAnimations.forEach(animation => animation.cancel()); pageAnimations = [];
    if (Math.abs(oldHeight - newHeight) > 1) {
      const resize = viewport.animate([{height:`${Math.max(oldHeight,newHeight)}px`},{height:`${newHeight}px`}],{duration:globalThis.CollectionMotion?.timings?.settle || 140,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
      pageAnimations.push(resize); await resize.finished.catch(() => {});
      if (token !== pageMotionToken) return;
    }
    stopTurn(); if (pendingRender) {pendingRender = false; render();}
    } finally {
      // A canceled, interrupted, or unsupported animation must never leave
      // the real page hidden. An older turn cannot clean up a newer turn.
      if (token === pageMotionToken && turning) {stopTurn(); if (pendingRender) {pendingRender=false; render();}}
      if (!turning && compassQueued !== null && isOpen()) {const next=compassQueued; compassQueued=null; queueMicrotask(() => {void selectCompass(next);});}
    }
  }
  motionMedia.addEventListener('change',event => {if (event.matches) {stopTurn(); if (pendingRender) {pendingRender = false; render();}}});
  function fallbackNavigate(sectionId) {
    document.querySelectorAll('.page-section').forEach(section => {
      section.classList.toggle('active',section.id === sectionId); section.inert = section.id !== sectionId;
    });
    didNavigate(sectionId);
    history.replaceState(null,'',`#${sectionId}`);
  }
  function open(trigger) {
    if (isOpen()) return;
    opener = trigger || document.activeElement;
    returnSection = document.querySelector('.page-section.active')?.id || 'sobres';
    (navigate || fallbackNavigate)('album');
  }
  function close() {
    if (!isOpen()) return;
    (navigate || fallbackNavigate)(returnSection === 'album' ? 'sobres' : returnSection);
    if (opener?.isConnected) opener.focus({preventScroll:true});
  }
  function didNavigate(sectionId, previousSection) {
    const opening = sectionId === 'album';
    document.body.classList.toggle('album-page-open',opening);
    if (!opening) {clearTimeout(compassTimer); compassQueued=null; compassDragging=false; compassMouse=null; compass.classList.remove('is-dragging'); stopTurn(); pendingRender = false; touchStart = null; dialog.hidden = true; return;}
    if (previousSection && previousSection !== 'album') returnSection = previousSection;
    stopTurn(); buildSlots(); render(true); dialog.hidden = false;
    requestAnimationFrame(() => {if (isOpen()) centerCompass(page);});
    document.getElementById('cardAlbumTitle').focus({preventScroll:true});
    void refresh?.();
    void globalThis.CollectionSocial?.refresh();
  }
  document.addEventListener('collection-social-change',() => render());
  document.addEventListener('click',event => {const trigger = event.target.closest('[data-card-album]'); if (trigger) open(trigger);});
  let viewerPosition = null;
  function rememberViewerPosition() {
    const nodes = new Set([dialog, document.getElementById('cardAlbumLeaf'), dialog.querySelector('.card-album-tabs')]);
    for (let parent = dialog.parentElement; parent; parent = parent.parentElement) nodes.add(parent);
    viewerPosition = {page, windowX:window.scrollX, windowY:window.scrollY, nodes:[...nodes].filter(Boolean).map(node => ({node,top:node.scrollTop,left:node.scrollLeft}))};
  }
  // Native dialog focus restoration may scroll an ancestor after the viewer's
  // close handler. Restore every album scroller after those handlers settle.
  document.addEventListener('close',event => {
    if (event.target.id !== 'collectionCardDialog' || !viewerPosition) return;
    const saved = viewerPosition; viewerPosition = null;
    const restore = () => {
      if (!isOpen() || page !== saved.page) return;
      saved.nodes.forEach(({node,top,left}) => {if (node.isConnected) node.scrollTo({top,left,behavior:'instant'});});
      window.scrollTo({top:saved.windowY,left:saved.windowX,behavior:'instant'});
    };
    queueMicrotask(restore); requestAnimationFrame(restore);
  },true);
  let suppressCardClickUntil = 0;
  dialog.addEventListener('click',event => {
    if (Date.now() < suppressCardClickUntil && event.target.closest('[data-album-card]')) {event.preventDefault(); return;}
    if (event.target.closest('[data-album-close]')) close();
    if (event.target.closest('[data-album-retry]')) void refresh?.();
    const tab = event.target.closest('[data-album-rarity]');
    if (tab && !tab.disabled) turn(Math.floor(slots.findIndex(slot => slot.rarity.key === tab.dataset.albumRarity) / 5));
    if (event.target.closest('[data-album-clear]')) {query = kindFilter = rarityFilter = ownershipFilter = ''; dialog.querySelector('[data-album-search]').value = ''; dialog.querySelectorAll('[data-album-filter]').forEach(input => input.value = ''); changeFilters();}
    const card = event.target.closest('[data-album-card]');
    if (card) {
      rememberViewerPosition();
      globalThis.CardCollection?.open(card.dataset.albumCard, card);
    }
  });

  dialog.addEventListener('input',event => {if (event.target.matches('[data-album-search]')) {query = event.target.value.trim(); changeFilters();}});
  dialog.addEventListener('change',event => {const field = event.target; if (field.matches('[data-album-collection]')) {selectedCollection = field.value; buildSlots(); changeFilters();} if (field.matches('[data-album-filter]')) {if (field.dataset.albumFilter === 'rarity') rarityFilter = field.value; if (field.dataset.albumFilter === 'kind') kindFilter = field.value; if (field.dataset.albumFilter === 'ownership') ownershipFilter = field.value; changeFilters();}});
  dialog.addEventListener('keydown',event => {if (event.target.matches('input,select,summary')) return; if (event.key === 'Escape') {event.preventDefault(); close(); return;} if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {event.preventDefault(); turn(page + (event.key === 'ArrowRight' ? 1 : -1));}});
  let touchStart = null;
  const gestureViewport = dialog.querySelector('.card-album-page-viewport');
  gestureViewport.addEventListener('pointerdown',event => {
    if (!isOpen() || turning || !event.isPrimary || event.button !== 0) return;
    touchStart = {id:event.pointerId,x:event.clientX,y:event.clientY,horizontal:false};
  });
  gestureViewport.addEventListener('pointermove',event => {
    if (!touchStart || touchStart.id !== event.pointerId) return;
    const dx = event.clientX-touchStart.x,dy = event.clientY-touchStart.y;
    if (Math.abs(dx)>12 && Math.abs(dx)>Math.abs(dy)*1.5) {
      touchStart.horizontal = true;
      if (!gestureViewport.hasPointerCapture(event.pointerId)) gestureViewport.setPointerCapture(event.pointerId);
      if (event.cancelable) event.preventDefault();
    }
  });
  gestureViewport.addEventListener('pointerup',event => {
    if (!touchStart || touchStart.id !== event.pointerId) return;
    const gesture = touchStart; touchStart = null;
    if (gestureViewport.hasPointerCapture(event.pointerId)) gestureViewport.releasePointerCapture(event.pointerId);
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
    if (gesture.horizontal) suppressCardClickUntil=Date.now()+500;
    if (Math.abs(dx)>Math.min(70,gestureViewport.clientWidth*.2) && Math.abs(dx)>Math.abs(dy)*1.5) {
      suppressCardClickUntil=Date.now()+500; void turn(page+(dx<0?1:-1));
    }
  });
  gestureViewport.addEventListener('pointercancel',() => {touchStart=null;});
  gestureViewport.addEventListener('lostpointercapture',event => {
    // The touched card can lose its implicit capture when horizontal tracking
    // transfers to the viewport. That bubbling child event is not cancellation.
    if (event.target === gestureViewport) touchStart=null;
  });
  gestureViewport.addEventListener('dragstart',event => event.preventDefault());
  window.addEventListener('hashchange',() => {
    const target = location.hash.slice(1);
    if (isOpen() && target !== 'album' && document.getElementById(target)?.classList.contains('page-section')) (navigate || fallbackNavigate)(target);
  });
  globalThis.CardAlbum = Object.freeze({icon,open,close,didNavigate,update(data) {inventory=data.cards; savedAt=data.savedAt || 0; loading=!!data.loading; failure=data.failure || ''; applyFilters(); render();},configure(config) {refresh=config.refresh; navigate=config.navigate; if (config.collections?.some(c => c?.id && c?.name)) {collections = config.collections.filter(c => c?.id && c?.name); if (!collections.some(c => c.id === selectedCollection)) selectedCollection = collections[0]?.id || 'los-nuestros-01'; buildSlots(); render();}},reset() {clearTimeout(compassTimer); compassQueued=null; compassDragging=false; compassMouse=null; compass.classList.remove('is-dragging'); document.body.classList.remove('album-page-open'); stopTurn(); pendingRender=false; warmedImages.clear(); inventory=null; savedAt=0; query=kindFilter=rarityFilter=ownershipFilter=''; dialog.querySelector('[data-album-search]').value=''; dialog.querySelectorAll('[data-album-filter]').forEach(input => input.value=''); page=0; renderedSlots=''; opener=null; viewerPosition=null; touchStart=null; dialog.hidden=true; dialog.classList.remove('active'); dialog.inert=true;}});
})();
