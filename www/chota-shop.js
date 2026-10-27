/* Purchases and balances come from the server; the room only paints owned props. */
(() => {
  let options, owner = null, state = null, request = null, generation = 0, loading = false, buying = null, failure = '', notice = '', fetchedAt = 0;
  const rooms = new Set();
  const visibleRooms = new Set();
  const motion = () => globalThis.ClubMotion?.media || matchMedia('(prefers-reduced-motion: reduce)');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const key = id => `bb:chota-room:v1:${options?.cacheNamespace || 'local'}:${id}`;
  const propArt = Object.freeze({
    football: {src:'icons/clubhouse/props/football-v2.png', width:1313, height:1198},
    skateboard: {src:'icons/clubhouse/props/skateboard-v2.png', width:1536, height:1024},
    'robot-vacuum': {src:'icons/clubhouse/props/robot-vacuum-v2.png', width:1536, height:1024},
    'warm-lights': {src:'icons/clubhouse/props/warm-lights-v1.svg',width:700,height:112,decoration:true},
    'club-neon': {src:'icons/clubhouse/props/club-neon-v1.svg',width:220,height:80,decoration:true},
    'club-cushion': {src:'icons/clubhouse/props/club-cushion-v1.svg',width:120,height:110,decoration:true},
    'vintage-radio': {src:'icons/clubhouse/props/vintage-radio-v1.svg',width:160,height:100,decoration:true}
  });
  const art = (kind, inRoom = false) => {
    const asset = inRoom && kind === 'skateboard' ? {src:'icons/clubhouse/props/skateboard-leaning-v3.png',width:1024,height:1536} : propArt[kind];
    if (!asset) return '';
    const brush = '<svg viewBox="0 0 40 40"><g fill="none" stroke="#9b7b43" stroke-width="2.5" stroke-linecap="square"><path d="M20 20 9 6m13 13L14 4m4 18L5 10m15 10 17-2m-18 4 18 1m-16-6 16-4m-17 7-7 16m4-17-9 14m15-12-5 16"/></g><circle cx="20" cy="20" r="4" fill="#3e3b32"/></svg>';
    const brushes = inRoom && kind === 'robot-vacuum' ? `<span class="chota-vacuum-brush" aria-hidden="true">${brush}</span><span class="chota-vacuum-brush chota-vacuum-brush--right" aria-hidden="true">${brush}</span>` : '';
    return `${brushes}<img${inRoom && kind === 'robot-vacuum' ? ' class="chota-vacuum-body"' : ''} src="${asset.src}" width="${asset.width}" height="${asset.height}" alt="" aria-hidden="true" decoding="async" loading="${inRoom ? 'eager' : 'lazy'}" draggable="false">`;
  };
  const known = new Set(Object.keys(propArt));
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
    // Seasonal art belongs to the room's own layer. Purchased decorations never replace it.
    layer.innerHTML = owned.map(item => `<div class="chota-room-prop chota-room-${esc(item.art_key)}${propArt[item.art_key]?.decoration ? ' chota-room-prop--decoration' : ''}" data-chota-room-item="${esc(item.id)}">${art(item.art_key, true)}</div>`).join('');
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
    const markup = items.length ? items.map(item => `<article class="chota-shop-item${item.owned?' is-owned':''}"><div class="chota-shop-object chota-shop-${esc(item.art_key)}" aria-hidden="true">${art(item.art_key)}</div><div class="chota-shop-copy"><span class="chota-shop-kind">${propArt[item.art_key]?.decoration ? 'Decoración' : 'Objeto del Chota'}</span><h4>${esc(item.name)}</h4><p>${esc(item.description)}</p><div class="chota-shop-purchase"><span>${item.owned ? 'En su habitación' : `<strong>${esc(item.price)}</strong> monedas`}</span><button type="button" data-chota-buy="${esc(item.id)}" ${item.owned || buying || loading || !owner || navigator.onLine===false || state.balance<item.price ? 'disabled':''}>${item.owned?'Comprado':buying===item.id?'Comprando…':'Comprar'}</button></div></div></article>`).join('') : `<div class="chota-shop-empty"><strong>${failure?'La tienda no está disponible':'Un sitio para sus cosas'}</strong><p>${failure?'Vuelve a intentarlo para cargar sus objetos.':'Los objetos aparecerán aquí al conectar con el club.'}</p><button type="button" data-chota-retry ${loading?'disabled':''}>${loading?'Cargando…':'Actualizar'}</button></div>`;
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
