/* Purchases and balances come from the server; the room only paints owned props. */
(() => {
  let options, owner = null, state = null, request = null, generation = 0, loading = false, buying = null, equipping = null, failure = '', notice = '', fetchedAt = 0;
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
  const roomStyles = Object.freeze({
    'room-midnight': {name:'Azul noche',wall:'#425d9a',floor:'#776077',rug:'#65539e'},
    'room-forest': {name:'Bosque',wall:'#43755c',floor:'#8a754c',rug:'#397765'},
    'room-terracotta': {name:'Terracota',wall:'#a7654d',floor:'#b67d4e',rug:'#985f43'}
  });
  const styleSurfaces = '<span class="chota-style-wall"></span><span class="chota-style-floor"></span><span class="chota-style-rug"></span>';
  const stylePreview = kind => `<div class="chota-style-preview" data-room-style="${esc(kind)}"><img src="icons/clubhouse/club-room-v1.webp" width="1024" height="1024" alt="" loading="lazy" decoding="async"><div class="chota-room-style">${styleSurfaces}</div></div>`;
  const art = (kind, inRoom = false) => {
    if (roomStyles[kind] || kind === 'original') return stylePreview(kind);
    const asset = inRoom && kind === 'skateboard' ? {src:'icons/clubhouse/props/skateboard-leaning-v3.png',width:1024,height:1536} : propArt[kind];
    if (!asset) return '';
    const brush = '<svg viewBox="0 0 40 40"><g fill="none" stroke="#9b7b43" stroke-width="2.5" stroke-linecap="square"><path d="M20 20 9 6m13 13L14 4m4 18L5 10m15 10 17-2m-18 4 18 1m-16-6 16-4m-17 7-7 16m4-17-9 14m15-12-5 16"/></g><circle cx="20" cy="20" r="4" fill="#3e3b32"/></svg>';
    const brushes = inRoom && kind === 'robot-vacuum' ? `<span class="chota-vacuum-brush" aria-hidden="true">${brush}</span><span class="chota-vacuum-brush chota-vacuum-brush--right" aria-hidden="true">${brush}</span>` : '';
    return `${brushes}<img${inRoom && kind === 'robot-vacuum' ? ' class="chota-vacuum-body"' : ''} src="${asset.src}" width="${asset.width}" height="${asset.height}" alt="" aria-hidden="true" decoding="async" loading="${inRoom ? 'eager' : 'lazy'}" draggable="false">`;
  };
  const known = new Set([...Object.keys(propArt),...Object.keys(roomStyles)]);
  function validState(data) {
    if (!data || !Array.isArray(data.items)) throw new Error('No se pudo leer la tienda del Chota.');
    const items=data.items.filter(item => item && typeof item.id === 'string' && known.has(item.art_key)).map(item => ({id:item.id,name:String(item.name || ''),description:String(item.description || ''),price:Math.max(0,Number(item.price)||0),art_key:item.art_key,owned:item.owned===true,active:item.active!==false}));
    const equipped=items.find(item=>item.id===data.room_style && item.owned && roomStyles[item.art_key]);
    return {balance:Number(data.balance) || 0,items,room_style:equipped?.id || null};
  }
  function changeOwner() {
    const current = options?.session() || null;
    if (owner === current) return;
    generation++; owner = current; state = null; request = null; loading = false; buying = null; equipping = null; failure = ''; notice = ''; fetchedAt = 0;
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
    const equipped=state?.items.find(item=>item.id===state.room_style && item.owned && roomStyles[item.art_key]);
    room.dataset.roomStyle=equipped?.art_key || 'original';
    let surfaces=room.querySelector(':scope > .chota-room-style');
    if (!surfaces) { surfaces=document.createElement('div');surfaces.className='chota-room-style';surfaces.setAttribute('aria-hidden','true');surfaces.innerHTML=styleSurfaces;room.append(surfaces); }
    let layer = room.querySelector(':scope > .chota-room-props');
    if (!layer) { layer = document.createElement('div'); layer.className = 'chota-room-props'; layer.setAttribute('aria-hidden','true'); room.append(layer); }
    const owned = (state?.items || []).filter(item => item.owned && !roomStyles[item.art_key]);
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
    if (status) { status.textContent = failure || notice || (loading && !state ? 'Cargando su habitación…' : ''); status.classList.toggle('is-error',!!failure); status.classList.toggle('is-notice',!failure && !!notice); }
    const count = document.querySelector('[data-shop-chota-count]');
    if (count) count.textContent = state ? String(state.items.filter(item => item.owned).length) : '—';
    const items = (state?.items || []).filter(item => item.active || item.owned);
    const busy=!!buying || !!equipping || loading || !owner || navigator.onLine===false;
    const card=item=>{
      const theme=!!roomStyles[item.art_key] || item.art_key==='original';
      return `<article class="chota-shop-item${theme?' chota-shop-style':''}" data-chota-item="${esc(item.id)}"><div class="chota-shop-object chota-shop-${esc(item.art_key)}" aria-hidden="true">${art(item.art_key)}</div><div class="chota-shop-copy"><span class="chota-shop-kind">${theme?'Estilo de habitación':propArt[item.art_key]?.decoration?'Decoración':'Objeto del Chota'}</span><h4>${esc(item.name)}</h4><p>${esc(item.description)}</p><div class="chota-shop-purchase"><span></span><button type="button"></button></div></div></article>`;
    };
    const themes=items.filter(item=>roomStyles[item.art_key]);
    const props=items.filter(item=>!roomStyles[item.art_key]);
    const original={id:'original',art_key:'original',name:'La sede original',description:'Paredes azul tinta, madera cálida y alfombra del club.',owned:true,price:0};
    if (!items.length) {
      const markup=`<div class="chota-shop-empty"><strong>${failure?'La tienda no está disponible':'Un sitio para sus cosas'}</strong><p>${failure?'Vuelve a intentarlo para cargar sus objetos.':'Los objetos aparecerán aquí al conectar con el club.'}</p><button type="button" data-chota-retry ${loading?'disabled':''}>${loading?'Cargando…':'Actualizar'}</button></div>`;
      if (container.dataset.markup!==markup) { container.innerHTML=markup;container.dataset.markup=markup; }
      delete container.dataset.catalogue;
      return;
    }
    const cards=[original,...themes,...props];
    // Keep decoded previews and focus in place while an RPC changes button/ownership state.
    const catalogue=JSON.stringify(cards.map(({id,art_key,name,description})=>[id,art_key,name,description]));
    if (container.dataset.catalogue!==catalogue) {
      container.innerHTML=`<div class="chota-shop-section-heading"><h4>Elige el ambiente</h4><p>Compra un estilo y cámbialo cuando quieras.</p></div><div class="chota-style-grid">${[original,...themes].map(card).join('')}</div>${props.length?'<div class="chota-shop-section-heading"><h4>Objetos y decoración</h4></div>'+props.map(card).join(''):''}`;
      container.dataset.catalogue=catalogue;
      delete container.dataset.markup;
    }
    const byId=new Map(cards.map(item=>[item.id,item]));
    for (const article of container.querySelectorAll('[data-chota-item]')) {
      const item=byId.get(article.dataset.chotaItem);
      const theme=!!roomStyles[item.art_key] || item.art_key==='original';
      const selected=theme && (item.id==='original' ? !state.room_style : state.room_style===item.id);
      article.classList.toggle('is-owned',item.owned);
      article.classList.toggle('is-equipped',selected);
      const price=article.querySelector('.chota-shop-purchase > span');
      const summary=item.owned ? (theme ? selected?'En uso':'Desbloqueado' : 'En su habitación') : `<strong>${esc(item.price)}</strong> monedas`;
      if (price.dataset.summary!==summary) { price.innerHTML=summary;price.dataset.summary=summary; }
      const button=article.querySelector('.chota-shop-purchase button');
      const equip=theme && item.owned;
      button.toggleAttribute('data-chota-equip',equip);
      button.toggleAttribute('data-chota-buy',!equip);
      button.setAttribute(equip?'data-chota-equip':'data-chota-buy',item.id);
      button.disabled=busy || (equip ? selected : item.owned || state.balance<item.price);
      if (equip) button.setAttribute('aria-pressed',String(selected)); else button.removeAttribute('aria-pressed');
      const label=equipping===item.id?'Aplicando…':buying===item.id?'Comprando…':item.owned?(theme?selected?'En uso':'Usar':'Comprado'):'Comprar';
      if (button.textContent!==label) button.textContent=label;
    }
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
    if (!owner || !item || item.owned || buying || equipping || loading || navigator.onLine===false) return;
    const actor=owner,token=generation; buying=id;failure='';notice='';render();
    try {
      const data=await rpc('buy_chota_item',{target_item_id:id,expected_price:item.price});
      if(token!==generation || actor!==options.session()) return;
      state=validState(data); fetchedAt=Date.now();notice=roomStyles[item.art_key]?`${item.name} aplicado.`:`${item.name} ya está en su habitación.`;remember();paintRooms();
      const balance=document.getElementById('bannerShopBalance'); if(balance)balance.textContent=`${state.balance.toLocaleString('es-ES')} monedas`;
      document.dispatchEvent(new CustomEvent('bb:chota-items-updated',{detail:{itemId:id}}));
      void Promise.resolve(options.refreshWallet?.()).catch(()=>{});
    } catch(error) {if(token===generation)failure=error.message || 'No se pudo completar la compra.';}
    finally {if(token===generation){buying=null;render();}}
  }
  async function equip(id) {
    changeOwner();
    const item=id==='original'?null:state?.items.find(item=>item.id===id && item.owned && roomStyles[item.art_key]);
    if (!owner || !state || (id!=='original'&&!item) || buying || equipping || loading || navigator.onLine===false) return;
    const actor=owner,token=generation;equipping=id;failure='';notice='';render();
    try {
      const data=await rpc('equip_chota_room_style',{target_item_id:item?.id || null});
      if(token!==generation || actor!==options.session())return;
      state=validState(data);fetchedAt=Date.now();remember();paintRooms();notice=item?`${item.name} aplicado.`:'La sede vuelve a su estilo original.';
    } catch(error) {if(token===generation)failure=error.message || 'No se pudo aplicar el estilo.';}
    finally {if(token===generation){equipping=null;render();}}
  }
  function initialize(config) {
    options=config;
    document.addEventListener('click',event=>{
      const styleButton=event.target.closest('[data-chota-equip]');
      if(styleButton){void equip(styleButton.dataset.chotaEquip);return;}
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
  function reset() {generation++;owner=null;state=null;request=null;loading=false;buying=null;equipping=null;fetchedAt=0;failure='';notice='';paintRooms();render();}
  globalThis.ChotaShop=Object.freeze({initialize,mountRoom,unmountRoom,refresh,reset});
})();
