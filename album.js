/* The catalog defines slots; only the server inventory fills them. */
(() => {
  const rarities = [{key:'common',label:'Común',capacity:[12,4,4]}, {key:'retro',label:'Retro',capacity:[8,6,6]}, {key:'special',label:'Especial',capacity:[6,7,7]}, {key:'epic',label:'Épica',capacity:[6,7,7]}, {key:'legendary',label:'Legendaria',capacity:[6,7,7]}];
  const kinds = [{key:'miembros',label:'Miembros'}, {key:'ubicaciones',label:'Ubicaciones'}, {key:'objetos',label:'Objetos'}];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const rarityOf = item => ({comun:'common',retro:'retro',especial:'special',epica:'epic',legendaria:'legendary'}[normalize(item.edition)] || 'common');
  const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15M5 8h4M5 11h4M15 8h4M15 11h4"/></svg>';
  let inventory = null, loading = false, failure = '', page = 0, slots = [], refresh, opener;
  const dialog = document.createElement('dialog');
  dialog.id = 'cardAlbumDialog'; dialog.className = 'card-album-dialog'; dialog.setAttribute('aria-labelledby','cardAlbumTitle');
  dialog.innerHTML = `<div class="card-album"><header class="card-album-header"><div><span class="eyebrow">LOS NUESTROS · COLECCIÓN 01</span><h2 id="cardAlbumTitle">Mi álbum</h2></div><button type="button" class="duplicate-cards-trigger" data-duplicates-open aria-label="Gestionar cartas repetidas" aria-haspopup="dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h13v17H7zM4 7H2v15h13v-2"/></svg><span data-duplicates-count>0</span></button><button type="button" class="packs-back" data-album-close aria-label="Cerrar álbum">✕</button></header><p id="cardAlbumSummary" class="card-album-summary"></p><p id="cardAlbumStatus" role="status"></p><nav class="card-album-tabs" aria-label="Rarezas del álbum">${rarities.map(r => `<button type="button" data-album-rarity="${r.key}">${r.label}</button>`).join('')}</nav><section id="cardAlbumLeaf" class="card-album-leaf" aria-labelledby="cardAlbumPageTitle"><h3 id="cardAlbumPageTitle"></h3><div id="cardAlbumSlots" class="card-album-slots"></div></section><footer class="card-album-navigation"><button type="button" class="packs-sync" data-album-prev aria-label="Página anterior">← Anterior</button><span id="cardAlbumPageCount" role="status"></span><button type="button" class="packs-sync" data-album-next aria-label="Página siguiente">Siguiente →</button></footer><small class="card-album-note">Los huecos sin carta esperan a tus próximos sobres. Los espacios reservados se llenarán con nuevas cartas del catálogo.</small></div>`;
  document.body.append(dialog);
  function buildSlots() {
    const catalog = globalThis.CardCollection?.catalog || [];
    slots = rarities.flatMap(rarity => kinds.flatMap((kind, index) => {
      const designs = catalog.filter(item => rarityOf(item) === rarity.key && (item.folder || 'miembros') === kind.key);
      return Array.from({length:Math.max(rarity.capacity[index], designs.length)}, (_, position) => ({rarity,kind,design:designs[position] || null}));
    }));
  }
  function render() {
    if (!dialog.open) return;
    const owned = new Map((inventory || []).map(item => [item.card_id, Number(item.quantity)]));
    const totalPages = Math.ceil(slots.length / 5);
    page = Math.min(page, Math.max(0,totalPages - 1));
    const visible = slots.slice(page * 5, page * 5 + 5), rarity = visible[0]?.rarity;
    document.getElementById('cardAlbumSummary').textContent = inventory ? `${slots.filter(slot => slot.design && owned.get(slot.design.id) > 0).length} cartas conseguidas · ${slots.length} huecos` : `${slots.length} huecos · colección pendiente de sincronización`;
    document.getElementById('cardAlbumStatus').textContent = failure || (loading ? 'Actualizando tu álbum…' : inventory ? '' : 'Actualiza tu colección para ver tus cartas.');
    document.getElementById('cardAlbumPageTitle').textContent = `${rarity?.label || ''} · ${[...new Set(visible.map(slot => slot.kind.label))].join(' / ')}`;
    document.getElementById('cardAlbumLeaf').dataset.rarity = rarity?.key;
    document.getElementById('cardAlbumSlots').innerHTML = visible.map((slot,index) => {
      const quantity = slot.design && owned.get(slot.design.id), number = String(page * 5 + index + 1).padStart(3,'0');
      return quantity > 0 ? `<button type="button" class="card-album-slot is-owned" data-album-card="${escape(slot.design.id)}" aria-label="Ver ${escape(slot.design.name)}, ${escape(slot.rarity.label)}, ${quantity} copias"><img src="${escape(slot.design.front)}" alt="${escape(slot.design.name)}" loading="lazy" decoding="async"><span class="card-album-slot-number">${number}</span><strong>${escape(slot.design.name)}</strong><small>${slot.kind.label} · ${quantity} ${quantity === 1 ? 'copia' : 'copias'}</small></button>` : `<div class="card-album-slot is-empty" aria-label="Hueco ${number}, ${slot.rarity.label}, ${slot.kind.label}, ${slot.design ? 'carta por conseguir' : 'reservado para una nueva carta'}"><div class="card-album-silhouette">${icon}<span>${number}</span></div><span class="card-album-slot-number" aria-hidden="true">${number}</span><strong>${slot.design ? 'Por conseguir' : 'Próximamente'}</strong><small>${slot.kind.label} · ${slot.rarity.label}</small></div>`;
    }).join('');
    document.getElementById('cardAlbumPageCount').textContent = `${page + 1} / ${totalPages}`;
    dialog.querySelector('[data-album-prev]').disabled = page === 0;
    dialog.querySelector('[data-album-next]').disabled = page >= totalPages - 1;
    dialog.querySelectorAll('[data-album-rarity]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.albumRarity === rarity?.key)));
  }
  function turn(destination) {page = Math.max(0,Math.min(Math.ceil(slots.length / 5) - 1,destination)); render(); const leaf=document.getElementById('cardAlbumLeaf'); leaf.scrollTop=0; if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) leaf.animate([{opacity:.4,transform:'translateX(8px)'},{opacity:1,transform:'translateX(0)'}],{duration:220,easing:'ease-out'});}
  function open(trigger) {opener = trigger || document.activeElement; buildSlots(); dialog.showModal(); render(); void refresh?.();}
  document.addEventListener('click',event => {const trigger = event.target.closest('[data-card-album]'); if (trigger) open(trigger);});
  dialog.addEventListener('click',event => {
    if (event.target.closest('[data-album-close]')) dialog.close();
    if (event.target.closest('[data-album-prev]')) turn(page - 1);
    if (event.target.closest('[data-album-next]')) turn(page + 1);
    const tab = event.target.closest('[data-album-rarity]');
    if (tab) turn(Math.floor(slots.findIndex(slot => slot.rarity.key === tab.dataset.albumRarity) / 5));
    const card = event.target.closest('[data-album-card]');
    if (card) globalThis.CardCollection?.open(card.dataset.albumCard, card);
  });
  dialog.addEventListener('keydown',event => {if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {event.preventDefault(); turn(page + (event.key === 'ArrowRight' ? 1 : -1));}});
  let touchStart = null;
  dialog.addEventListener('touchstart',event => {touchStart = event.touches.length === 1 ? {x:event.touches[0].clientX,y:event.touches[0].clientY}:null;},{passive:true});
  dialog.addEventListener('touchend',event => {if (!touchStart || !event.changedTouches[0]) return; const dx = event.changedTouches[0].clientX-touchStart.x,dy=event.changedTouches[0].clientY-touchStart.y; touchStart=null; if (Math.abs(dx)>70 && Math.abs(dx)>Math.abs(dy)*1.5) turn(page+(dx<0?1:-1));},{passive:true});
  dialog.addEventListener('close',() => {if (opener?.isConnected) opener.focus({preventScroll:true});});
  window.addEventListener('hashchange',() => dialog.close());
  globalThis.CardAlbum = Object.freeze({icon,open,update(data) {inventory=data.cards; loading=!!data.loading; failure=data.failure || ''; render();},configure(config) {refresh=config.refresh;},reset() {inventory=null; page=0; dialog.close();}});
})();
