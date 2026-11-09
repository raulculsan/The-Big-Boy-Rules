/* Purchases and balances come from the server; the room only paints owned props. */
(() => {
  let options, owner = null, state = null, request = null, generation = 0, loading = false, buying = null, equipping = null, failure = '', notice = '', fetchedAt = 0;
  let roomTab = 'ambientes';
  let stateTrusted=false,outfitSignature='',modularSignature='';
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
    'vintage-radio': {src:'icons/clubhouse/props/vintage-radio-v1.svg',width:160,height:100,decoration:true},
    darts: {src:'icons/clubhouse/props/darts-board-v1.svg',width:128,height:140,decoration:true}
  });
  const roomStyles = Object.freeze({
    'room-midnight': {name:'Azul noche',wall:'#425d9a',floor:'#776077',rug:'#65539e'},
    'room-forest': {name:'Bosque',wall:'#43755c',floor:'#8a754c',rug:'#397765'},
    'room-terracotta': {name:'Terracota',wall:'#a7654d',floor:'#b67d4e',rug:'#985f43'}
  });
  const remote = item => globalThis.ShopCatalogMedia?.presentation(item,'chota');
  const themeFor = item => remote(item)?.type==='room_style' ? remote(item) : roomStyles[item?.art_key];
  const isStyle = item => !!themeFor(item);
  const styleSurfaces = '<span class="chota-style-wall"></span><span class="chota-style-floor"></span><span class="chota-style-rug"></span>';
  const stylePreview = (kind,item) => `<div class="chota-style-preview" data-room-style="${remote(item)?.type==='room_style'?'remote':esc(kind)}" style="${globalThis.ShopCatalogMedia?.styleVariables(remote(item)) || ''}"><img src="icons/clubhouse/club-room-v1.webp" width="1024" height="1024" alt="" loading="lazy" decoding="async"><div class="chota-room-style">${styleSurfaces}</div></div>`;
  const art = (kind, inRoom = false, item) => {
    if(isClothing(item))return inRoom?'':clothingArt(item);
    if (isStyle(item) || roomStyles[kind] || kind === 'original') return stylePreview(kind,item);
    if (remote(item)?.type==='decoration') return globalThis.ShopCatalogMedia.decoration(item,inRoom);
    const asset = inRoom && kind === 'skateboard' ? {src:'icons/clubhouse/props/skateboard-leaning-v3.png',width:1024,height:1536} : propArt[kind];
    if (!asset) return '';
    const brush = '<svg viewBox="0 0 40 40"><g fill="none" stroke="#9b7b43" stroke-width="2.5" stroke-linecap="square"><path d="M20 20 9 6m13 13L14 4m4 18L5 10m15 10 17-2m-18 4 18 1m-16-6 16-4m-17 7-7 16m4-17-9 14m15-12-5 16"/></g><circle cx="20" cy="20" r="4" fill="#3e3b32"/></svg>';
    const brushes = inRoom && kind === 'robot-vacuum' ? `<span class="chota-vacuum-brush" aria-hidden="true">${brush}</span><span class="chota-vacuum-brush chota-vacuum-brush--right" aria-hidden="true">${brush}</span>` : '';
    return `${brushes}<img${inRoom && kind === 'robot-vacuum' ? ' class="chota-vacuum-body"' : ''} src="${asset.src}" width="${asset.width}" height="${asset.height}" alt="" aria-hidden="true" decoding="async" loading="${inRoom ? 'eager' : 'lazy'}" draggable="false">`;
  };
  function floorDepth(item) {
    const p=remote(item);
    if(p?.type==='decoration' && p.placement.y>=55) {
      const feet=p.placement.y+p.placement.width*p.height/p.width*.9;
      return feet>80?4:2;
    }
    return ['football','robot-vacuum'].includes(item.art_key)?4:item.art_key==='skateboard'?2:null;
  }
  const known = new Set([...Object.keys(propArt),...Object.keys(roomStyles)]);
  const clothingSlots=Object.freeze({outerwear:'Abrigos',topwear:'Parte de arriba',bottomwear:'Pantalones',footwear:'Calzado',headwear:'Cabeza',accessories:'Accesorios'});
  const isClothing=item=>item?.item_kind==='clothing' && Object.hasOwn(clothingSlots,item.slot);
  const clothingDescriptor=item=>globalThis.ChotaWardrobe?.describe?.(item) || null;
  const clothingProductImage=item=>{
    if(!clothingDescriptor(item)||item.garment?.type!=='builtin')return '';
    const originals={'original-stussy-v1':'shirt','original-jeans-v1':'pants','original-jordan-chicago-v1':'shoes'};
    if(originals[item.garment.key])return `icons/shop/garments-v3/original-${originals[item.garment.key]}.webp`;
    const value=String(item.garment.key||''),patterns={outerwear:/^tnf-(negro|crema|rojo|azul|oliva|morado)-v1$/,bottomwear:/^carhartt-(marron|azul-oscuro)-v1$/,topwear:/^(carhartt-(crudo|oliva)|supreme-(negra|roja)|stussy-(blanca|azul))-v1$/};
    return patterns[item.slot]?.test(value)?`icons/shop/garments-v3/${value.replace(/-v1$/,'')}.webp`:'';
  };
  function clothingArt(item){
    const descriptor=clothingDescriptor(item);
    if(!descriptor)return '<span class="chota-clothing-unavailable">Vista pendiente</span>';
    const product=clothingProductImage(item);
    if(product)return `<span class="chota-clothing-preview chota-clothing-product"><img src="${product}" width="384" height="384" alt="" aria-hidden="true" loading="lazy" decoding="async" draggable="false"></span>`;
    return `<span class="chota-clothing-preview"><span class="chota-clothing-base"></span><span class="chota-clothing-coat" style="background-image:url('${esc(descriptor.atlases.base)}')"></span></span>`;
  }
  function paintModularWardrobe(){
    if(!stateTrusted||!globalThis.ChotaWardrobe?.applyOutfit)return false;
    if(state?.wardrobe_version!==1&&!globalThis.ChotaAppearance?.createPreview)return false;
    const apply=state?.wardrobe_version===1?globalThis.ChotaWardrobe.applyOutfit:globalThis.ChotaWardrobe.applyLegacyOutfit;if(!apply)return false;
    const clothing=Object.fromEntries(['bottomwear','footwear','topwear','outerwear'].map(slot=>[slot,state.items.find(item=>item.id===state[slot]&&item.owned&&item.slot===slot&&clothingDescriptor(item))||null]));
    const signature=JSON.stringify([owner,state.wardrobe_version,clothing]);if(modularSignature===signature)return true;modularSignature=signature;const token=generation;
    void apply(clothing).catch(error=>{if(token===generation&&modularSignature===signature){modularSignature='';failure=error.message||'No se pudo preparar el armario.';render();}});return true;
  }
  function paintWardrobe(){
    if(!globalThis.ChotaWardrobe?.applyOwned)return;
    const item=stateTrusted?state?.items.find(item=>item.id===state.outerwear && item.owned && clothingDescriptor(item)):null;
    const signature=JSON.stringify([owner,stateTrusted,item?.id || null,item?.garment || null]);
    if(signature===outfitSignature)return;outfitSignature=signature;const token=generation;
    void globalThis.ChotaWardrobe.applyOwned(item || null).catch(error=>{if(token===generation&&signature===outfitSignature){outfitSignature='';failure=error.message || 'No se pudo cargar la prenda.';void globalThis.ChotaWardrobe.applyOwned(null);render();}});
  }
  let pantsSignature='';
  function paintTrousers(){
    if(!globalThis.ChotaWardrobe?.applyPants)return;
    const item=stateTrusted?state?.items.find(item=>item.id===state.bottomwear && item.owned && clothingDescriptor(item)):null;
    const signature=JSON.stringify([owner,stateTrusted,item?.id || null,item?.garment || null]);
    if(signature===pantsSignature)return;pantsSignature=signature;const token=generation;
    void globalThis.ChotaWardrobe.applyPants(item || null).catch(error=>{if(token===generation&&signature===pantsSignature){pantsSignature='';failure=error.message || 'No se pudo cargar la prenda.';void globalThis.ChotaWardrobe.applyPants(null);render();}});
  }
  let shirtSignature='';
  function paintShirt(){
    if(!globalThis.ChotaWardrobe?.applyShirt)return;
    const item=stateTrusted?state?.items.find(item=>item.id===state.topwear && item.owned && clothingDescriptor(item)):null;
    const signature=JSON.stringify([owner,stateTrusted,item?.id || null,item?.garment || null]);
    if(signature===shirtSignature)return;shirtSignature=signature;const token=generation;
    void globalThis.ChotaWardrobe.applyShirt(item || null).catch(error=>{if(token===generation&&signature===shirtSignature){shirtSignature='';failure=error.message || 'No se pudo cargar la prenda.';void globalThis.ChotaWardrobe.applyShirt(null);render();}});
  }
  // The wardrobe is a fitting room: the Chota tries coats and trousers on before anything is bought.
  const fitting={outerwear:null,topwear:null,bottomwear:null,footwear:null},fittingEquipped={};let fittingSlot='outerwear';
  const coatAtlas=item=>clothingDescriptor(item)?.atlases?.base || '';
  const fitCopy=Object.freeze({
    footwear:{tab:'Zapatillas',none:'Sin zapatillas',noneDesc:'Sus patas, sin calzado.',worn:'Las lleva puestas',stored:'En su armario',put:'Ponérselas',putting:'Poniéndoselas…',remove:'Quitárselas',removing:'Quitándoselas…',bare:'Ir descalzo',trying:'Probando sin zapatillas',now:'Así va ahora',thumb:'--hc:142px;--hx:-.324;--hy:-.39'},
    outerwear:{tab:'Abrigos',none:'Sin abrigo',noneDesc:'Su sudadera de siempre, sin nada encima.',worn:'Lo lleva puesto',stored:'En su armario',put:'Ponérselo',putting:'Poniéndoselo…',remove:'Quitárselo',removing:'Quitándoselo…',bare:'Dejarlo sin abrigo',trying:'Probando sin abrigo',now:'Así va ahora',thumb:'--hc:142px;--hx:-.324;--hy:-.39'},
    topwear:{tab:'Camisetas',none:'Su camiseta',noneDesc:'La camiseta blanca de siempre.',worn:'La lleva puesta',stored:'En su armario',put:'Ponérsela',putting:'Poniéndosela…',remove:'Quitársela',removing:'Quitándosela…',bare:'Volver a su camiseta',trying:'Probando su camiseta',now:'Así va ahora',thumb:'--hc:142px;--hx:-.324;--hy:-.47'},
    bottomwear:{tab:'Pantalones',none:'Sus vaqueros',noneDesc:'Los vaqueros de siempre, con sus zapatillas.',worn:'Los lleva puestos',stored:'En su armario',put:'Ponérselos',putting:'Poniéndoselos…',remove:'Quitárselos',removing:'Quitándoselos…',bare:'Volver a sus vaqueros',trying:'Probando sus vaqueros',now:'Así va ahora',thumb:'--hc:154px;--hx:-.316;--hy:-.608'},
  });
  // The wardrobe reads like the Chota himself, head to feet.
  const ARMARIO=Object.freeze([
    {slot:'outerwear',layer:'coat',title:'Abrigo',plural:'abrigos',own:'Sin abrigo',worn:'Puesto',busy:['Quitándoselo…','Poniéndoselo…'],remove:'Quitar',legacy:'Quitar'},
    {slot:'topwear',layer:'shirt',title:'Camiseta',plural:'camisetas',own:'Su camiseta blanca',worn:'Puesta',busy:['Quitándosela…','Poniéndosela…'],remove:'Quitar',legacy:'Su camiseta'},
    {slot:'bottomwear',layer:'pants',title:'Pantalón',plural:'pantalones',own:'Sus vaqueros',worn:'Puesto',busy:['Quitándoselo…','Poniéndoselo…'],remove:'Quitar',legacy:'Sus vaqueros'},
    {slot:'footwear',layer:'shoes',title:'Zapatillas',plural:'zapatillas',own:'Sin zapatillas',worn:'Puestas',busy:['Quitándoselas…','Poniéndoselas…'],remove:'Quitar',legacy:'Quitar'},
  ]);
  const bareName=slot=>({outerwear:'Sin abrigo',topwear:'Sin camiseta',bottomwear:'Sin pantalón',footwear:'Sin zapatillas'})[slot];
  const removing=slot=>slot==='outerwear'?'original':'original-'+slot;
  // Trousers and T-shirts live folded on Codex's three-shelf cabinet: nine stacks of up to four
  // models, bottom to top; T-shirts keep each brand in its own stacks. Positions follow its 1024 × 1024 layout.
  const SHELF={src:'icons/shop/club-store-v1/clothing-cabinet-v2.webp',garment:200,rise:.3,shelves:[{y:351,top:150},{y:586,top:389},{y:813,top:617}],centers:[230,512,794]};
  const BRANDS=Object.freeze({carhartt:'Carhartt',supreme:'Supreme',stussy:'Stüssy'});
  const foldedArt=item=>{
    const key=item?.garment?.type==='builtin'?String(item.garment.key||''):'';
    if(item?.slot==='bottomwear'&&/^carhartt-(marron|azul-oscuro)-v1$/.test(key))return {src:`icons/shop/club-store-v1/pants-${key.replace(/-v1$/,'')}-fold-v2.webp`,width:384,height:128,brand:'carhartt'};
    if(item?.slot==='topwear'&&/^(carhartt-(crudo|oliva)|supreme-(negra|roja)|stussy-(blanca|azul))-v1$/.test(key))return {src:`icons/shop/club-store-v1/shirt-${key.replace(/-v1$/,'')}-fold-v1.webp`,width:384,height:128,brand:key.split('-')[0]};
    return null;
  };
  function shelfPlan(items){
    const models=items.filter(foldedArt),groups=new Map();
    for(const item of models){const brand=item.slot==='topwear'?foldedArt(item).brand:'';if(!groups.has(brand))groups.set(brand,[]);groups.get(brand).push(item);}
    const piles=[];for(const rows of groups.values()){rows.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);for(let i=0;i<rows.length;i+=4)piles.push(rows.slice(i,i+4));}
    return piles.slice(0,9).map((rows,slot)=>{
      const shelf=SHELF.shelves[Math.floor(slot/3)],center=SHELF.centers[slot%3];let bottom=shelf.y;
      const layers=rows.map((item,index)=>{const art=foldedArt(item),height=SHELF.garment*art.height/art.width,top=bottom-height;bottom-=height*SHELF.rise;return {item,art,left:center-SHELF.garment/2,top,width:SHELF.garment,height,z:10+Math.floor(slot/3)*10+index};});
      return {slot,ids:rows.map(item=>item.id),layers};
    });
  }
  const chipName=item=>item.slot==='bottomwear'?(item.wardrobe_key==='azul-oscuro'?'Azul oscuro':item.wardrobe_key==='marron'?'Marrón':item.name):item.slot==='topwear'?item.name.replace(/^Camiseta\s+/i,''):item.name;
  function renderClothing(){
    const container=document.getElementById('clothingShopItems');if(!container)return;
    const status=document.getElementById('clothingShopStatus');if(status){status.textContent=failure || notice || (loading&&!state?'Cargando el armario…':'');status.classList.toggle('is-error',!!failure);}
    if(!state){container.innerHTML=`<div class="chota-shop-empty"><strong>${failure?'No se pudo abrir el armario':'Cargando la ropa del Chota'}</strong><p>${failure?'Vuelve a intentarlo para ver tus prendas y el saldo real.':'Las prendas se consultan con el club.'}</p><button type="button" data-chota-retry ${loading?'disabled':''}>Actualizar</button></div>`;delete container.dataset.catalogue;return;}
    const all=state.items.filter(item=>isClothing(item)&&(item.active||item.owned)&&clothingDescriptor(item));
    const bySlot={outerwear:all.filter(item=>item.slot==='outerwear'),topwear:all.filter(item=>item.slot==='topwear'),bottomwear:all.filter(item=>item.slot==='bottomwear'),footwear:all.filter(item=>item.slot==='footwear')};
    const slots=Object.keys(bySlot).filter(slot=>bySlot[slot].length);
    if(!slots.includes(fittingSlot))fittingSlot=slots[0]||'outerwear';
    for(const slot of Object.keys(bySlot)){const rows=bySlot[slot],previous=fittingEquipped[slot];if(previous!==undefined&&(fitting[slot]===previous||(fitting[slot]==='original'&&previous===null)))fitting[slot]=state[slot]||'original';if(fitting[slot]!=='original'&&!rows.some(item=>item.id===fitting[slot]))fitting[slot]=state[slot]||rows.find(item=>!item.owned)?.id||rows[0]?.id||'original';fittingEquipped[slot]=state[slot]||null;}
    const items=bySlot[fittingSlot],legacyCopy=fitCopy[fittingSlot],copy=state.wardrobe_version===1?{...legacyCopy,none:bareName(fittingSlot),noneDesc:'Este espacio queda libre.',bare:bareName(fittingSlot),trying:bareName(fittingSlot)}:legacyCopy;
    const signature=JSON.stringify([fittingSlot,slots,all.map(item=>[item.id,item.name,item.description,item.garment])]);
    if(container.dataset.catalogue!==signature){
      const tabs=slots.length>1?`<div class="fitting-tabs" role="tablist" aria-label="Tipo de prenda">${slots.map(slot=>`<button type="button" role="tab" data-fitting-slot="${slot}" aria-selected="${slot===fittingSlot}">${fitCopy[slot].tab}</button>`).join('')}</div>`:'';
      const hangers=[{id:'original',name:copy.none},...items].map(item=>{const product=clothingProductImage(item);return `<button type="button" class="fitting-hanger${item.id==='original'?' is-bare':''}" role="radio" data-clothing-try="${esc(item.id)}" aria-label="${esc(item.name)}" style="${copy.thumb}"><span class="fitting-hanger-hook" aria-hidden="true"></span><span class="fitting-hanger-coat${product?' is-product':''}" aria-hidden="true"${item.id==='original'?'':` style="--coat:url('${esc(product||coatAtlas(item))}')"`}></span><span class="fitting-hanger-mark"></span></button>`;}).join('');
      const pct=value=>`${(value/10.24).toFixed(3)}%`;
      const shelf=fittingSlot==='outerwear'?[]:shelfPlan(items);
      const picker=shelf.length?`<div class="pants-shelf" aria-hidden="true"><img class="pants-shelf-cabinet" src="${SHELF.src}" alt="" width="1024" height="1024" draggable="false" decoding="async">${shelf.map(stack=>`<button type="button" class="pants-shelf-stack" tabindex="-1" data-shelf-stack="${esc(stack.ids.join(','))}" style="left:${pct(stack.layers[0].left)};top:${pct(stack.layers.at(-1).top)};width:${pct(SHELF.garment)};height:${pct(stack.layers[0].top+stack.layers[0].height-stack.layers.at(-1).top)}"></button>${stack.layers.map(layer=>`<img class="pants-shelf-fold" data-shelf-item="${esc(layer.item.id)}" src="${esc(layer.art.src)}" alt="" draggable="false" decoding="async" style="left:${pct(layer.left)};top:${pct(layer.top)};width:${pct(layer.width)};height:${pct(layer.height)};z-index:${layer.z}">`).join('')}`).join('')}</div><div class="fitting-rail fitting-chips" role="radiogroup" aria-label="${copy.tab} del Chota">${[{id:'original',name:copy.none},...items].map(item=>`<button type="button" class="fitting-chip${item.id==='original'?' is-bare':''}" role="radio" data-clothing-try="${esc(item.id)}" aria-label="${esc(item.name)}"><span class="fitting-chip-name">${esc(item.id==='original'?copy.none:chipName(item))}</span><span class="fitting-hanger-mark"></span></button>`).join('')}</div>`:'';
      const room=container.querySelector('.fitting-room');
      container.innerHTML=`<div class="fitting">${room?'':'<div class="fitting-room" aria-hidden="true"><span class="fitting-wall"></span><span class="fitting-spot"></span><span class="fitting-mirror"><i></i></span><span class="fitting-stool"></span><span class="fitting-floor"></span><span class="fitting-rug"></span><span class="fitting-curtain fitting-curtain--left"></span><span class="fitting-curtain fitting-curtain--right"></span><span class="fitting-shadow"></span><span class="fitting-chota" data-chota-fitting><span class="fitting-chota-body"></span><span class="fitting-chota-pants"></span><span class="fitting-chota-shoes"></span><span class="fitting-chota-shirt"></span><span class="fitting-chota-coat"></span></span><span class="fitting-sign">Probador</span></div>'}${tabs}${picker||`<div class="fitting-rail" role="radiogroup" aria-label="${copy.tab} del Chota">${hangers}</div>`}<div class="fitting-info"><span class="fitting-state"></span><h4 class="fitting-name"></h4><p class="fitting-desc"></p><div class="fitting-actions"><button type="button" class="fitting-primary"></button><button type="button" class="fitting-secondary"></button></div></div></div>${all.length?'':'<p class="chota-shop-empty">Todavía no hay prendas disponibles.</p>'}`;
      // The model keeps animating across tab changes.
      if(room)container.querySelector('.fitting').prepend(room);
      container.dataset.catalogue=signature;
    }
    const busy=!!buying||!!equipping||loading||!owner||navigator.onLine===false;
    const wearing=state[fittingSlot],chosen=fitting[fittingSlot]==='original'?null:items.find(item=>item.id===fitting[fittingSlot]);
    for(const hanger of container.querySelectorAll('[data-clothing-try]')){
      const item=items.find(item=>item.id===hanger.dataset.clothingTry),checked=hanger.dataset.clothingTry===fitting[fittingSlot],worn=item?item.id===wearing:!wearing;
      hanger.setAttribute('aria-checked',String(checked));hanger.tabIndex=checked?0:-1;hanger.classList.toggle('is-worn',worn);hanger.classList.toggle('is-owned',!!item?.owned);
      hanger.querySelector('.fitting-hanger-mark').textContent=worn?'Puesto':!item?'':item.owned?'Tuyo':String(item.price);
    }
    for(const fold of container.querySelectorAll('[data-shelf-item]'))fold.classList.toggle('is-picked',fold.dataset.shelfItem===fitting[fittingSlot]);
    // The model wears every choice at once; on the T-shirt tab the closed coat comes off so the tee shows.
    const previewItems=Object.fromEntries(['bottomwear','footwear','topwear','outerwear'].map(slot=>[slot,fitting[slot]==='original'||(slot==='outerwear'&&fittingSlot==='topwear')?null:bySlot[slot].find(item=>item.id===fitting[slot])||null]));
    const model=container.querySelector('[data-chota-fitting]');
    if(globalThis.ChotaAppearance?.createPreview&&globalThis.ChotaWardrobe?.preview){void globalThis.ChotaWardrobe.preview(model,previewItems,{legacy:state.wardrobe_version!==1}).catch(()=>{if(model?.isConnected)container.querySelector('.fitting-state').textContent='No se pudo preparar la vista.';});}
    else{
    const show=(selector,slot)=>{const node=container.querySelector(selector);if(!node)return;const item=fitting[slot]==='original'||(slot==='outerwear'&&fittingSlot==='topwear')?null:bySlot[slot].find(item=>item.id===fitting[slot]);const url=item?coatAtlas(item):'';if(node.dataset.coat!==url){node.dataset.coat=url;node.style.backgroundImage=url?`url("${url}")`:'none';}};
    show('.fitting-chota-coat','outerwear');show('.fitting-chota-shirt','topwear');show('.fitting-chota-pants','bottomwear');show('.fitting-chota-shoes','footwear');
    }
    const set=(selector,text)=>{const node=container.querySelector(selector);if(node&&node.textContent!==text)node.textContent=text;};
    set('.fitting-state',chosen?(chosen.id===wearing?copy.worn:chosen.owned?copy.stored:`${chosen.price} monedas`):(wearing?copy.trying:copy.now));
    set('.fitting-name',chosen?chosen.name:copy.none);
    set('.fitting-desc',chosen?chosen.description:copy.noneDesc);
    const primary=container.querySelector('.fitting-primary'),secondary=container.querySelector('.fitting-secondary');
    if(!primary||!secondary)return;
    for(const button of [primary,secondary])for(const name of ['data-chota-buy','data-chota-clothing-equip','data-chota-clothing-slot','data-checkout-kind','data-checkout-slot','data-checkout-name','data-checkout-price','data-checkout-desc','data-checkout-coat','data-checkout-pants','data-checkout-shirt','data-checkout-shoes','data-checkout-look','data-checkout-legacy'])button.removeAttribute(name);
    secondary.hidden=true;
    const equip=(button,id,label,busyLabel)=>{button.dataset.chotaClothingEquip=id;button.dataset.chotaClothingSlot=fittingSlot;button.textContent=equipping===(id==='original'?removing(fittingSlot):id)?busyLabel:label;button.disabled=busy;};
    if(chosen&&!chosen.owned){
      const look=slot=>{if(slot===fittingSlot)return coatAtlas(chosen);if(slot==='outerwear'&&fittingSlot==='topwear')return '';const item=fitting[slot]==='original'?null:bySlot[slot].find(item=>item.id===fitting[slot]);return item?coatAtlas(item):'';};
      Object.assign(primary.dataset,{chotaBuy:chosen.id,checkoutKind:'clothing',checkoutSlot:fittingSlot,checkoutName:chosen.name,checkoutPrice:String(chosen.price),checkoutDesc:chosen.description,checkoutCoat:look('outerwear'),checkoutShirt:look('topwear'),checkoutPants:look('bottomwear'),checkoutShoes:look('footwear'),checkoutLook:JSON.stringify(Object.fromEntries(Object.entries(previewItems).map(([slot,item])=>[slot,item?{id:item.id,item_kind:item.item_kind,slot:item.slot,rig_version:item.rig_version,garment:item.garment}:null]))),checkoutLegacy:String(state.wardrobe_version!==1)});
      primary.textContent=buying===chosen.id?'Comprando…':`Comprar · ${chosen.price}`;primary.disabled=busy;
    }else if(chosen&&chosen.id!==wearing)equip(primary,chosen.id,copy.put,copy.putting);
    else if(chosen){primary.textContent=copy.worn;primary.disabled=true;secondary.hidden=false;equip(secondary,'original',copy.remove,copy.removing);}
    else if(wearing)equip(primary,'original',copy.bare,copy.removing);
    else{primary.textContent=copy.now;primary.disabled=true;}
  }
  let inventoryDialog=null, inventoryTrigger=null;
  function closeInventory(){
    if(inventoryDialog?.open)inventoryDialog.close();
  }
  function ensureInventory(){
    if(inventoryDialog)return inventoryDialog;
    const dialog=document.createElement('dialog');dialog.id='chotaInventoryDialog';dialog.className='chota-inventory';dialog.setAttribute('aria-labelledby','chotaInventoryTitle');
    dialog.innerHTML='<header class="chota-inventory-header"><div><h2 id="chotaInventoryTitle">El armario del Chota</h2></div><button type="button" data-chota-inventory-close aria-label="Cerrar armario"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><div class="chota-inventory-body"><p class="chota-inventory-status" role="status" aria-live="polite"></p><div class="chota-inventory-list"></div></div>';
    dialog.addEventListener('close',()=>{const trigger=inventoryTrigger;inventoryTrigger=null;if(trigger?.isConnected)trigger.focus({preventScroll:true});});
    document.body.append(dialog);inventoryDialog=dialog;return dialog;
  }
  function renderInventory(){
    if(!inventoryDialog?.open)return;
    const list=inventoryDialog.querySelector('.chota-inventory-list'),status=inventoryDialog.querySelector('.chota-inventory-status');
    status.textContent=failure || (loading?'Consultando tu inventario…':notice);
    status.classList.toggle('is-error',!!failure);
    if(!stateTrusted){list.innerHTML=`<div class="chota-inventory-empty"><h3>${failure?'No se pudo abrir tu armario':'Preparando tu ropa'}</h3><p>${failure?'Tus prendas siguen guardadas. Vuelve a intentarlo.':'Comprobando las prendas de tu inventario.'}</p>${failure?'<button type="button" data-chota-retry>Reintentar</button>':''}</div>`;delete list.dataset.catalogue;return;}
    const items=state.items.filter(item=>item.owned&&isClothing(item)&&clothingDescriptor(item));
    const modular=state.wardrobe_version===1,shortName=item=>item.slot==='topwear'?item.name.replace(/^Camiseta\s+/i,''):item.name;
    const wearing=shelf=>{const item=state[shelf.slot]?items.find(item=>item.id===state[shelf.slot]):null;return item?shortName(item):modular?bareName(shelf.slot):shelf.own;};
    const signature=JSON.stringify([state.wardrobe_version,items.map(item=>[item.id,item.name,item.garment])]);
    if(list.dataset.catalogue!==signature){
      const check='<svg class="armario-check" viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7"/></svg>';
      const card=item=>{const product=clothingProductImage(item);return `<button type="button" class="armario-card" data-inventory-item="${esc(item.id)}" data-chota-clothing-equip="${esc(item.id)}" data-chota-clothing-slot="${item.slot}"><span class="armario-card-art" aria-hidden="true">${product?`<img src="${esc(product)}" alt="" width="384" height="384" loading="lazy" decoding="async" draggable="false">`:clothingArt(item)}</span><span class="armario-card-name">${esc(shortName(item))}</span><span class="armario-card-state">${check}<span></span></span></button>`;};
      const section=shelf=>{const own=items.filter(item=>item.slot===shelf.slot);return `<section class="armario-shelf" id="armario-${shelf.slot}" data-armario-slot="${shelf.slot}" aria-labelledby="armario-${shelf.slot}-title"><header class="armario-shelf-head"><div><h3 id="armario-${shelf.slot}-title">${shelf.title}</h3><p data-armario-now="${shelf.slot}"></p></div><button type="button" class="armario-remove" data-chota-clothing-equip="original" data-chota-clothing-slot="${shelf.slot}"></button></header>${own.length?`<div class="armario-row" role="group" aria-label="${shelf.title}">${own.map(card).join('')}</div>`:`<p class="armario-none">Aún no tienes ${shelf.plural}. Los que consigas en la tienda aparecerán aquí.</p>`}</section>`;};
      list.innerHTML=!items.length?'<div class="chota-inventory-empty"><h3>Aún no tiene prendas guardadas</h3><p>La ropa que consigas en la tienda aparecerá aquí.</p></div>':`<section class="armario-look" aria-label="Lo que lleva ahora"><span class="armario-look-stage" aria-hidden="true"><span class="fitting-chota" data-chota-fitting><span class="fitting-chota-body"></span><span class="fitting-chota-pants"></span><span class="fitting-chota-shoes"></span><span class="fitting-chota-shirt"></span><span class="fitting-chota-coat"></span></span></span><div class="armario-look-copy"><h3>Lo que lleva ahora</h3><ul>${ARMARIO.map(shelf=>`<li><a href="#armario-${shelf.slot}" data-armario-jump="${shelf.slot}"><span>${shelf.title}</span><strong data-armario-wearing="${shelf.slot}"></strong></a></li>`).join('')}</ul></div></section>${ARMARIO.map(section).join('')}`;
      list.dataset.catalogue=signature;
      list.onclick=event=>{const jump=event.target.closest('[data-armario-jump]');if(!jump)return;event.preventDefault();list.querySelector(`#armario-${jump.dataset.armarioJump}`)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});};
    }
    const busy=!!buying||!!equipping||loading||!owner||navigator.onLine===false;
    for(const button of list.querySelectorAll('.armario-card')){
      const id=button.dataset.chotaClothingEquip,slot=button.dataset.chotaClothingSlot,shelf=ARMARIO.find(shelf=>shelf.slot===slot),worn=state[slot]===id;
      const label=button.querySelector('.armario-card-state span');if(label)label.textContent=equipping===id?shelf.busy[1]:worn?shelf.worn:'';
      button.disabled=busy||worn;button.classList.toggle('is-worn',worn);button.setAttribute('aria-pressed',String(worn));
      button.setAttribute('aria-label',worn?`${button.querySelector('.armario-card-name').textContent}, ${shelf.worn.toLowerCase()}`:`Ponerle ${button.querySelector('.armario-card-name').textContent}`);
    }
    for(const shelf of ARMARIO){
      const bare=!state[shelf.slot],remove=list.querySelector(`.armario-remove[data-chota-clothing-slot="${shelf.slot}"]`);
      if(remove){remove.textContent=equipping===removing(shelf.slot)?shelf.busy[0]:modular?shelf.remove:shelf.legacy;remove.hidden=bare;remove.disabled=busy;remove.setAttribute('aria-label',`${modular?'Quitar':'Volver a'} ${shelf.title.toLowerCase()}`);}
      for(const node of list.querySelectorAll(`[data-armario-wearing="${shelf.slot}"],[data-armario-now="${shelf.slot}"]`)){const text=wearing(shelf);if(node.textContent!==text)node.textContent=text;node.classList.toggle('is-bare',bare);}
      const item=state[shelf.slot]?items.find(item=>item.id===state[shelf.slot]):null;
      const layer=list.querySelector(`.armario-look .fitting-chota-${shelf.layer}`),url=item?coatAtlas(item):'';
      if(layer&&layer.dataset.coat!==url){const first=layer.dataset.coat===undefined;layer.dataset.coat=url;layer.style.backgroundImage=url?`url("${url}")`:'none';if(!first)globalThis.StoreRooms?.showOff(list.querySelector('.armario-look [data-chota-fitting]'));}
    }
    const inventoryModel=list.querySelector('.armario-look [data-chota-fitting]');if(inventoryModel&&globalThis.ChotaAppearance?.createPreview)inventoryModel.dataset.chotaComposed='true';
  }
  function openInventory(trigger){
    changeOwner();if(!owner)return;
    inventoryTrigger=trigger || document.activeElement;notice='';failure='';
    const dialog=ensureInventory();if(!dialog.open)dialog.showModal();renderInventory();
    void refresh(true);
  }
  function validState(data) {
    if (!data || !Array.isArray(data.items)) throw new Error('No se pudo leer la tienda del Chota.');
    const items=data.items.filter(item => item && typeof item.id === 'string' && (known.has(item.art_key)||remote(item)||isClothing(item))).map(item => ({presentation:remote(item),id:item.id,name:String(item.name || ''),description:String(item.description || ''),price:Math.max(0,Number(item.price)||0),art_key:item.art_key,owned:item.owned===true,active:item.active!==false,item_kind:item.item_kind,slot:item.slot,wardrobe_key:item.wardrobe_key,rig_version:item.rig_version,garment:item.garment}));
    const equipped=items.find(item=>item.id===data.room_style && item.owned && isStyle(item));
    const clothing=items.find(item=>item.id===data.outerwear&&item.owned&&isClothing(item)&&item.slot==='outerwear');
    const trousers=items.find(item=>item.id===data.bottomwear&&item.owned&&isClothing(item)&&item.slot==='bottomwear');
    const shirt=items.find(item=>item.id===data.topwear&&item.owned&&isClothing(item)&&item.slot==='topwear');
    const shoes=items.find(item=>item.id===data.footwear&&item.owned&&isClothing(item)&&item.slot==='footwear');
    return {wardrobe_version:data.wardrobe_version===1?1:0,removed_original_slots:Array.isArray(data.removed_original_slots)?data.removed_original_slots.filter(slot=>['topwear','bottomwear','footwear'].includes(slot)):[],footwear:shoes?.id||null,balance:Number(data.balance) || 0,items,room_style:equipped?.id || null,outerwear:clothing?.id || null,topwear:shirt?.id || null,bottomwear:trousers?.id || null};
  }
  function changeOwner() {
    const current = options?.session() || null;
    if (owner === current) return;
    closeInventory();if(state?.wardrobe_version===1||globalThis.ChotaAppearance?.enabled?.())void globalThis.ChotaWardrobe?.applyOutfit?.(null);modularSignature='';generation++; stateTrusted=false;outfitSignature='';pantsSignature='';shirtSignature='';owner = current; state = null; request = null; loading = false; buying = null; equipping = null; failure = ''; notice = ''; fetchedAt = 0; roomTab = 'ambientes';
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
    const equipped=state?.items.find(item=>item.id===state.room_style && item.owned && isStyle(item));
    room.dataset.roomStyle=remote(equipped)?.type==='room_style'?'remote':equipped?.art_key || 'original';
    for(const key of ['wall','floor','rug']) {const value=remote(equipped)?.colors?.[key];if(value)room.style.setProperty(`--room-${key}`,value);else room.style.removeProperty(`--room-${key}`);}
    let surfaces=room.querySelector(':scope > .chota-room-style');
    if (!surfaces) { surfaces=document.createElement('div');surfaces.className='chota-room-style';surfaces.setAttribute('aria-hidden','true');surfaces.innerHTML=styleSurfaces;room.append(surfaces); }
    let layer = room.querySelector(':scope > .chota-room-props');
    if (!layer) { layer = document.createElement('div'); layer.className = 'chota-room-props'; layer.setAttribute('aria-hidden','true'); room.append(layer); }
    const owned = (state?.items || []).filter(item => item.owned && !isStyle(item) && !isClothing(item));
    const signature = JSON.stringify(owned.map(item => [item.id,item.art_key,item.presentation]));
    if (layer.dataset.signature === signature) return;
    layer.dataset.signature = signature;
    // Seasonal art belongs to the room's own layer. Purchased decorations never replace it.
    layer.innerHTML = owned.map(item => `<div class="chota-room-prop chota-room-${remote(item)?'remote':esc(item.art_key)}${remote(item)||propArt[item.art_key]?.decoration ? ' chota-room-prop--decoration' : ''}" data-chota-room-item="${esc(item.id)}"${floorDepth(item)!==null?` data-chota-rest-z="${floorDepth(item)}"`: ''} style="${globalThis.ShopCatalogMedia?.placement(remote(item)) || ''};${floorDepth(item)!==null?`z-index:${floorDepth(item)};`: ''}">${art(item.art_key, true,item)}</div>`).join('');
  }
  function paintRooms() { if(!paintModularWardrobe()){paintWardrobe();paintTrousers();paintShirt();}for (const room of rooms) if (room.isConnected) paintRoom(room); paintMotion(); }
  function mountRoom(room) {
    if (!room) return;
    changeOwner();
    if (!rooms.has(room)) { rooms.add(room); observer?.observe(room); if (!observer) visibleRooms.add(room); }
    if(!room.querySelector(':scope > .chota-room-wardrobe-layer')){
      const cabinet=document.createElement('button');cabinet.type='button';cabinet.className='chota-room-wardrobe';cabinet.dataset.chotaInventory='';cabinet.setAttribute('aria-label','Abrir el armario del Chota');
      const layer=document.createElement('div');layer.className='chota-room-wardrobe-layer';
      layer.innerHTML='<img class="chota-room-wardrobe-art" src="icons/clubhouse/chota-wardrobe-integrated-v2.webp" width="1024" height="1024" alt="" draggable="false" decoding="async">';layer.append(cabinet);room.append(layer);
    }
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
  function selectRoomTab(value, focus=false) {
    if (!['ambientes','objetos'].includes(value)) return;
    roomTab=value;
    const container=document.getElementById('chotaShopItems');
    for (const tab of container?.querySelectorAll('[data-chota-tab]') || []) {
      const selected=tab.dataset.chotaTab===roomTab;
      tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;
      if (selected && focus) tab.focus();
    }
    for (const panel of container?.querySelectorAll('[data-chota-panel]') || []) panel.hidden=panel.dataset.chotaPanel!==roomTab;
  }
  function render() {
    renderInventory();
    renderClothing();
    const container = document.getElementById('chotaShopItems');
    if (!container) return;
    const status = document.getElementById('chotaShopStatus');
    if (status) { status.textContent = failure || notice || (loading && !state ? 'Cargando su habitación…' : ''); status.classList.toggle('is-error',!!failure); status.classList.toggle('is-notice',!failure && !!notice); }
    const count = document.querySelector('[data-shop-chota-count]');
    if (count) count.textContent = state ? String(state.items.filter(item => item.owned && !isClothing(item)).length) : '—';
    const items = (state?.items || []).filter(item => !isClothing(item) && (item.active || item.owned));
    const busy=!!buying || !!equipping || loading || !owner || navigator.onLine===false;
    const card=item=>{
      const theme=isStyle(item) || item.art_key==='original';
      return `<article class="chota-shop-item${theme?' chota-shop-style':''}" data-chota-item="${esc(item.id)}"><div class="chota-shop-object chota-shop-${remote(item)?'remote':esc(item.art_key)}" aria-hidden="true">${art(item.art_key,false,item)}</div><div class="chota-shop-copy"><span class="chota-shop-kind">${theme?'Estilo de habitación':remote(item)||propArt[item.art_key]?.decoration?'Decoración':'Objeto del Chota'}</span><h4>${esc(item.name)}</h4><p>${esc(item.description)}</p><div class="chota-shop-purchase"><span></span><button type="button"></button></div></div></article>`;
    };
    const themes=items.filter(isStyle);
    const props=items.filter(item=>!isStyle(item));
    const original={id:'original',art_key:'original',name:'La sede original',description:'Paredes azul tinta, madera cálida y alfombra del club.',owned:true,price:0};
    if (!state) {
      const markup=`<div class="chota-shop-empty"><strong>${failure?'La tienda no está disponible':'Un sitio para sus cosas'}</strong><p>${failure?'Vuelve a intentarlo para cargar sus objetos.':'Los objetos aparecerán aquí al conectar con el club.'}</p><button type="button" data-chota-retry ${loading?'disabled':''}>${loading?'Cargando…':'Actualizar'}</button></div>`;
      if (container.dataset.markup!==markup) { container.innerHTML=markup;container.dataset.markup=markup; }
      delete container.dataset.catalogue;
      return;
    }
    const cards=[original,...themes,...props];
    // Keep decoded previews and focus in place while an RPC changes button/ownership state.
    const catalogue=JSON.stringify(cards.map(({id,art_key,name,description,presentation})=>[id,art_key,name,description,presentation]));
    if (container.dataset.catalogue!==catalogue) {
      container.innerHTML=`<div class="chota-shop-tabs" role="tablist" aria-label="Contenido de la habitación"><button type="button" id="chotaAmbientesTab" role="tab" aria-controls="chotaAmbientesPanel" data-chota-tab="ambientes">Ambientes</button><button type="button" id="chotaObjetosTab" role="tab" aria-controls="chotaObjetosPanel" data-chota-tab="objetos">Objetos</button></div><div id="chotaAmbientesPanel" class="chota-style-grid" role="tabpanel" aria-labelledby="chotaAmbientesTab" data-chota-panel="ambientes">${[original,...themes].map(card).join('')}</div><div id="chotaObjetosPanel" class="chota-object-grid" role="tabpanel" aria-labelledby="chotaObjetosTab" data-chota-panel="objetos" hidden>${props.length?props.map(card).join(''):'<p class="chota-shop-empty">No hay objetos disponibles.</p>'}</div>`;
      container.dataset.catalogue=catalogue;
      delete container.dataset.markup;
    }
    selectRoomTab(roomTab);
    const byId=new Map(cards.map(item=>[item.id,item]));
    for (const article of container.querySelectorAll('[data-chota-item]')) {
      const item=byId.get(article.dataset.chotaItem);
      const theme=isStyle(item) || item.art_key==='original';
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
        state=result;stateTrusted=true; fetchedAt=Date.now(); remember(); paintRooms(); return state;
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
      state=validState(data);stateTrusted=true; fetchedAt=Date.now();notice=isClothing(item)?`${item.name} puesto.`:isStyle(item)?`${item.name} aplicado.`:`${item.name} ya está en su habitación.`;remember();paintRooms();
      const balance=document.getElementById('bannerShopBalance'); if(balance)balance.textContent=`${state.balance.toLocaleString('es-ES')} monedas`;
      document.dispatchEvent(new CustomEvent('bb:chota-items-updated',{detail:{itemId:id}}));
      void Promise.resolve(options.refreshWallet?.()).catch(()=>{});
    } catch(error) {if(token===generation)failure=error.message || 'No se pudo completar la compra.';}
    finally {if(token===generation){buying=null;render();}}
  }
  async function equip(id) {
    changeOwner();
    const item=id==='original'?null:state?.items.find(item=>item.id===id && item.owned && isStyle(item));
    if (!owner || !state || (id!=='original'&&!item) || buying || equipping || loading || navigator.onLine===false) return;
    const actor=owner,token=generation;equipping=id;failure='';notice='';render();
    try {
      const data=await rpc('equip_chota_room_style',{target_item_id:item?.id || null});
      if(token!==generation || actor!==options.session())return;
      state=validState(data);stateTrusted=true;fetchedAt=Date.now();remember();paintRooms();notice=item?`${item.name} aplicado.`:'La sede vuelve a su estilo original.';
    } catch(error) {if(token===generation)failure=error.message || 'No se pudo aplicar el estilo.';}
    finally {if(token===generation){equipping=null;render();}}
  }
  async function equipClothing(id,requestedSlot){
    changeOwner();const item=id==='original'?null:state?.items.find(item=>item.id===id&&item.owned&&clothingDescriptor(item));
    const slot=item?.slot||(['bottomwear','topwear','footwear'].includes(requestedSlot)?requestedSlot:'outerwear');
    if(!owner||!state||(id!=='original'&&!item)||buying||equipping||loading||navigator.onLine===false)return;
    const actor=owner,token=generation;equipping=item?id:removing(slot);failure='';notice='';render();
    try{const data=slot==='outerwear'?await rpc('equip_chota_outerwear',{target_item_id:item?.id||null}):await rpc('equip_chota_clothing',{target_slot:slot,target_item_id:item?.id||null});if(token!==generation||actor!==options.session())return;state=validState(data);stateTrusted=true;fetchedAt=Date.now();remember();paintRooms();notice=item?`${item.name} puesto.`:state.wardrobe_version===1?`${bareName(slot)}.`:slot==='bottomwear'?'El Chota vuelve a sus vaqueros.':slot==='topwear'?'El Chota vuelve a su camiseta blanca.':'El Chota vuelve a su ropa original.';}
    catch(error){if(token===generation)failure=error.message||'No se pudo cambiar la prenda.';}finally{if(token===generation){equipping=null;render();}}
  }
  function initialize(config) {
    options=config;globalThis.ShopCatalogMedia?.configure(config.cacheNamespace);globalThis.ChotaWardrobe?.configure?.(config.cacheNamespace);
    document.addEventListener('click',event=>{
      const cabinet=event.target.closest('[data-chota-inventory]');if(cabinet){openInventory(cabinet);return;}
      if(event.target.closest('[data-chota-inventory-close]')){closeInventory();return;}
      const tab=event.target.closest('#chotaShopItems [data-chota-tab]');
      if(tab){selectRoomTab(tab.dataset.chotaTab);return;}
      const tryOn=event.target.closest('[data-clothing-try]');if(tryOn){if(fitting[fittingSlot]!==tryOn.dataset.clothingTry){fitting[fittingSlot]=tryOn.dataset.clothingTry;renderClothing();globalThis.StoreRooms?.showOff(document.querySelector('[data-chota-fitting]'));}return;}
      const stack=event.target.closest('[data-shelf-stack]');if(stack){const ids=stack.dataset.shelfStack.split(','),at=ids.indexOf(fitting[fittingSlot]),next=at<0?ids.at(-1):ids[(at-1+ids.length)%ids.length];if(next&&next!==fitting[fittingSlot]){fitting[fittingSlot]=next;renderClothing();globalThis.StoreRooms?.showOff(document.querySelector('[data-chota-fitting]'));}return;}
      const fitSlot=event.target.closest('[data-fitting-slot]');if(fitSlot){if(fittingSlot!==fitSlot.dataset.fittingSlot){fittingSlot=fitSlot.dataset.fittingSlot;renderClothing();const title=document.getElementById('bannerShopTitle');if(title&&document.getElementById('bannerShopDialog')?.dataset.storeView==='clothing')title.textContent=fitCopy[fittingSlot]?.tab||title.textContent;}return;}
      const clothingButton=event.target.closest('[data-chota-clothing-equip]');if(clothingButton){void equipClothing(clothingButton.dataset.chotaClothingEquip,clothingButton.dataset.chotaClothingSlot);return;}
      const styleButton=event.target.closest('[data-chota-equip]');
      if(styleButton){void equip(styleButton.dataset.chotaEquip);return;}
      const button=event.target.closest('[data-chota-buy]');
      if(button){void buy(button.dataset.chotaBuy);return;}
      if(event.target.closest('[data-chota-retry]'))void refresh(true);
      if(event.target.closest('[data-shop-tab="chota"], [data-shop-tab="clothing"], [data-banner-shop]'))void refresh(true);
    });
    document.addEventListener('keydown',event=>{
      const tab=event.target.closest('#chotaShopItems [data-chota-tab]');
      if (!tab || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const next=event.key==='Home'?'ambientes':event.key==='End'?'objetos':tab.dataset.chotaTab==='ambientes'?'objetos':'ambientes';
      selectRoomTab(next,true);
    });
    document.addEventListener('visibilitychange',paintMotion);
    motion().addEventListener?.('change',paintMotion);
    window.addEventListener('online',()=>{if(options.session())void refresh(true);});
    window.addEventListener('offline',render);
    render();
  }
  function reset() {closeInventory();modularSignature='';void globalThis.ChotaWardrobe?.applyOutfit?.(null);generation++;stateTrusted=false;outfitSignature='';pantsSignature='';shirtSignature='';owner=null;state=null;request=null;loading=false;buying=null;equipping=null;fetchedAt=0;failure='';notice='';roomTab='ambientes';paintRooms();render();}
  globalThis.ChotaShop=Object.freeze({initialize,mountRoom,unmountRoom,refresh,reset,selectRoomTab,openInventory});
})();
