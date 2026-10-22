/* Purchases and balances come from the server; the room only paints owned props. */
(() => {
  let options, owner = null, state = null, request = null, generation = 0, loading = false, buying = null, failure = '', notice = '', fetchedAt = 0;
  const rooms = new Set();
  const visibleRooms = new Set();
  const motion = () => globalThis.ClubMotion?.media || matchMedia('(prefers-reduced-motion: reduce)');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const key = id => `bb:chota-room:v1:${options?.cacheNamespace || 'local'}:${id}`;
  const art = kind => {
    if (kind === 'football') return `<svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="91" rx="34" ry="7" fill="#000" opacity=".22"/><circle cx="50" cy="48" r="39" fill="#e8e5d8" stroke="#292a28" stroke-width="3"/><path d="m50 29 17 12-6 20H39l-6-20zM23 20l10 21-19 8M77 20 67 41l19 8M17 65l22-4 1 21M83 65l-22-4-1 21M40 11l10 18 10-18" fill="#282c2d" stroke="#282c2d" stroke-width="2"/><path d="M23 20 40 11m37 9L60 11M14 49l3 16m69-16-3 16M40 82l10 6 10-6" fill="none" stroke="#555b58" stroke-width="2"/><path d="M28 25c7-8 15-11 24-10" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".6"/></svg>`;
    if (kind === 'skateboard') return `<svg viewBox="0 0 180 90" aria-hidden="true"><ellipse cx="89" cy="72" rx="70" ry="8" fill="#000" opacity=".23"/><g transform="rotate(-11 90 45)"><rect x="31" y="51" width="13" height="23" rx="6" fill="#b74432" stroke="#302723" stroke-width="3"/><rect x="133" y="51" width="13" height="23" rx="6" fill="#b74432" stroke="#302723" stroke-width="3"/><path d="M39 46v13m99-13v13M30 58h20m78 0h20" stroke="#a6a6a0" stroke-width="6" stroke-linecap="round"/><path d="M12 38c-1-14 10-23 26-24h107c16 0 25 9 23 22-1 15-13 23-28 23H39C24 59 14 50 12 38Z" fill="#af7848" stroke="#312c26" stroke-width="3"/><path d="M20 34c0-7 7-12 17-12h109c10 0 16 5 15 12-1 9-9 15-22 15H40c-12 0-19-6-20-15Z" fill="#333835" stroke="#1d2322" stroke-width="2"/><path d="m66 28 41 16m-39 0 38-16" stroke="#d4b679" stroke-width="3"/><g fill="#a8aaa0"><circle cx="40" cy="29" r="2"/><circle cx="40" cy="39" r="2"/><circle cx="140" cy="29" r="2"/><circle cx="140" cy="39" r="2"/></g></g></svg>`;
    return `<svg viewBox="0 0 120 90" aria-hidden="true"><ellipse cx="59" cy="74" rx="45" ry="8" fill="#000" opacity=".25"/><g class="chota-vacuum-brush" stroke="#6d7067" stroke-width="3" stroke-linecap="round"><path d="m96 65 15 4m-12-7 8-9m-9 12 3 11"/></g><path d="M16 38v20c0 13 19 23 44 23s44-10 44-23V38" fill="#292f30" stroke="#171c1e" stroke-width="3"/><ellipse cx="60" cy="39" rx="44" ry="26" fill="#d9d7c9" stroke="#222a2b" stroke-width="3"/><ellipse cx="60" cy="39" rx="34" ry="19" fill="#444e4c" stroke="#93998d" stroke-width="2"/><circle cx="60" cy="35" r="8" fill="#bcc2ae" stroke="#222a2b" stroke-width="2"/><path d="M60 28v7m-5-4a7 7 0 1 0 10 0" fill="none" stroke="#26302b" stroke-width="2"/><path d="M41 49h38" stroke="#242d2b" stroke-width="3" stroke-linecap="round"/><circle cx="86" cy="32" r="3" fill="#8bcc9d"/><path d="M23 57c8 9 22 14 39 14" fill="none" stroke="#56605c" stroke-width="3" stroke-linecap="round"/></svg>`;
  };
  const known = new Set(['football','skateboard','robot-vacuum']);
  function validState(data) {
    if (!data || !Array.isArray(data.items)) throw new Error('No se pudo leer la tienda del Chota.');
    return {balance:Number(data.balance) || 0, items:data.items.filter(item => item && typeof item.id === 'string' && known.has(item.art_key)).map(item => ({id:item.id,name:String(item.name || ''),description:String(item.description || ''),price:Math.max(0,Number(item.price)||0),art_key:item.art_key,owned:item.owned===true,active:item.active!==false}))};
  }
  function changeOwner() {
    const current = options?.session() || null;
    if (owner === current) return;
    generation++; owner = current; state = null; request = null; loading = false; buying = null; failure = ''; notice = ''; fetchedAt = 0;
    if (owner) try { const cached = JSON.parse(localStorage.getItem(key(owner)) || 'null'); if (cached?.owner === owner && Array.isArray(cached.items)) state = validState(cached); } catch {}
    paintRooms(); render();
  }
  function remember() {
    if (!owner || !state) return;
    try { localStorage.setItem(key(owner), JSON.stringify({owner, ...state})); } catch {}
  }
  function paintMotion() {
    const canMove = !document.hidden && !motion().matches;
    for (const room of rooms) {
      if (!room.isConnected) { observer?.unobserve(room); rooms.delete(room); visibleRooms.delete(room); continue; }
      room.classList.toggle('chota-props-moving', canMove && visibleRooms.has(room));
    }
  }
  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) visibleRooms.add(entry.target); else visibleRooms.delete(entry.target);
    }
    paintMotion();
  }, {threshold:.1}) : null;
  function paintRoom(room) {
    let layer = room.querySelector(':scope > .chota-room-props');
    if (!layer) { layer = document.createElement('div'); layer.className = 'chota-room-props'; layer.setAttribute('aria-hidden','true'); room.append(layer); }
    const owned = (state?.items || []).filter(item => item.owned);
    const signature = owned.map(item => item.id).sort().join('|');
    if (layer.dataset.signature === signature) return;
    layer.dataset.signature = signature;
    layer.innerHTML = owned.map(item => `<div class="chota-room-prop chota-room-${esc(item.art_key)}" data-chota-room-item="${esc(item.id)}">${art(item.art_key)}</div>`).join('');
  }
  function paintRooms() { for (const room of rooms) if (room.isConnected) paintRoom(room); paintMotion(); }
  function mountRoom(room) {
    if (!room) return;
    changeOwner();
    if (!rooms.has(room)) { rooms.add(room); observer?.observe(room); if (!observer) visibleRooms.add(room); }
    paintRoom(room); paintMotion();
    if (owner && !fetchedAt && !request) {
      const actor = owner;
      const load = () => { if (actor === options?.session()) void refresh(); };
      if (window.requestIdleCallback) requestIdleCallback(load,{timeout:3000}); else setTimeout(load,600);
    }
  }
  function unmountRoom(room) {
    if (!room) return;
    observer?.unobserve(room); rooms.delete(room); visibleRooms.delete(room); room.classList.remove('chota-props-moving');
  }
  function render() {
    const container = document.getElementById('chotaShopItems');
    if (!container) return;
    const status = document.getElementById('chotaShopStatus');
    if (status) { status.textContent = failure || notice || (loading && !state ? 'Cargando su habitación…' : ''); status.classList.toggle('is-error',!!failure); }
    const count = document.querySelector('[data-shop-chota-count]');
    if (count) count.textContent = state ? String(state.items.filter(item => item.owned).length) : '—';
    const items = (state?.items || []).filter(item => item.active || item.owned);
    const markup = items.length ? items.map(item => `<article class="chota-shop-item${item.owned?' is-owned':''}"><div class="chota-shop-object chota-shop-${esc(item.art_key)}" aria-hidden="true">${art(item.art_key)}</div><div class="chota-shop-copy"><h4>${esc(item.name)}</h4><p>${esc(item.description)}</p><div class="chota-shop-purchase"><span>${item.owned ? 'En su habitación' : `<strong>${esc(item.price)}</strong> monedas`}</span><button type="button" data-chota-buy="${esc(item.id)}" ${item.owned || buying || loading || !owner || navigator.onLine===false || state.balance<item.price ? 'disabled':''}>${item.owned?'Comprado':buying===item.id?'Comprando…':'Comprar'}</button></div></div></article>`).join('') : `<div class="chota-shop-empty"><strong>${failure?'La tienda no está disponible':'Un sitio para sus cosas'}</strong><p>${failure?'Vuelve a intentarlo para cargar sus objetos.':'Los objetos aparecerán aquí al conectar con el club.'}</p><button type="button" data-chota-retry ${loading?'disabled':''}>${loading?'Cargando…':'Actualizar'}</button></div>`;
    if (container.dataset.markup !== markup) { container.innerHTML = markup; container.dataset.markup = markup; }
  }
  async function rpc(name,args) { const result = await options.rpc(name,args); if (result.error) throw result.error; return result.data; }
  function refresh(force=false) {
    changeOwner();
    if (!owner || navigator.onLine===false) { render(); return Promise.resolve(state); }
    if (request) return request;
    if (!force && fetchedAt && Date.now()-fetchedAt<60000) return Promise.resolve(state);
    const actor=owner, token=generation; loading=true; failure=''; render();
    const pending=(async()=>{
      try {
        const result=validState(await rpc('get_chota_shop_state'));
        if (token!==generation || actor!==options.session()) return;
        state=result; fetchedAt=Date.now(); remember(); paintRooms(); return state;
      } catch(error) { if(token===generation) failure=['PGRST202','42883'].includes(error?.code)?'La tienda del Chota está pendiente de activar.':error.message || 'No se pudieron cargar sus objetos.'; }
      finally { if(token===generation) {loading=false;request=null;render();} }
    })();
    request=pending; return pending;
  }
  async function buy(id) {
    changeOwner();
    const item=state?.items.find(item=>item.id===id);
    if (!owner || !item || item.owned || buying || loading || navigator.onLine===false) return;
    const actor=owner,token=generation; buying=id;failure='';notice='';render();
    try {
      const data=await rpc('buy_chota_item',{target_item_id:id,expected_price:item.price});
      if(token!==generation || actor!==options.session()) return;
      state=validState(data); fetchedAt=Date.now();notice=`${item.name} ya está en su habitación.`;remember();paintRooms();
      const balance=document.getElementById('bannerShopBalance'); if(balance)balance.textContent=`${state.balance.toLocaleString('es-ES')} monedas`;
      document.dispatchEvent(new CustomEvent('bb:chota-items-updated',{detail:{itemId:id}}));
      void Promise.resolve(options.refreshWallet?.()).catch(()=>{});
    } catch(error) {if(token===generation)failure=error.message || 'No se pudo completar la compra.';}
    finally {if(token===generation){buying=null;render();}}
  }
  function initialize(config) {
    options=config;
    document.addEventListener('click',event=>{
      const button=event.target.closest('[data-chota-buy]');
      if(button){void buy(button.dataset.chotaBuy);return;}
      if(event.target.closest('[data-chota-retry]'))void refresh(true);
      if(event.target.closest('[data-shop-tab="chota"], [data-banner-shop]'))void refresh(true);
    });
    document.addEventListener('visibilitychange',paintMotion);
    motion().addEventListener?.('change',paintMotion);
    window.addEventListener('online',()=>{if(options.session())void refresh(true);});
    window.addEventListener('offline',render);
    render();
  }
  function reset() {generation++;owner=null;state=null;request=null;loading=false;buying=null;fetchedAt=0;failure='';notice='';paintRooms();render();}
  globalThis.ChotaShop=Object.freeze({initialize,mountRoom,unmountRoom,refresh,reset});
})();
