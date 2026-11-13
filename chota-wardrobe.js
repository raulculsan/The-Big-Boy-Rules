/* Garment renderer: selection is supplied by verified shop state; purchases stay on the server. */
(() => {
  'use strict';
  const colors=Object.freeze(['negro','crema','rojo','azul','oliva','morado']);
  const sheets=Object.freeze({base:{cols:6,rows:4,count:24},directional:{cols:5,rows:4,count:20},contextual:{cols:4,rows:4,count:16},room:{cols:4,rows:1,count:4},talk:{cols:3,rows:1,count:3}});
  const states=new WeakMap(),requests=new Map();
  let wardrobeNoticePending=false;
  function notifyWardrobe(){if(wardrobeNoticePending)return;wardrobeNoticePending=true;queueMicrotask(()=>{wardrobeNoticePending=false;globalThis.dispatchEvent?.(new Event('chota-wardrobe-change'));});}
  let selected=null,equipSequence=0,serverId=null,serverAtlases=null,storageBase='';
  let outfitSequence=0;
  const localURL=(color,sheet)=>`icons/mascot/chota-v2/wardrobe/tnf-${color}-${sheet}-v5.webp`;
  const selectedID=()=>serverId || (selected?'chota-tnf-'+selected+'-v1':null);
  const url=(color,sheet)=>serverAtlases&&color===serverId?serverAtlases[sheet]:localURL(color,sheet);
  function configure(origin){try{const parsed=new URL(origin||globalThis.BIG_BOY_CONFIG?.supabaseUrl);storageBase=parsed.protocol==='https:'&&!parsed.username&&!parsed.password?parsed.origin+'/storage/v1/object/public/shop-media/':'';}catch{storageBase='';}}
  configure();
  // Trousers and T-shirts are independent slots drawn under the coat; same sheets, cells and pivots.
  const overlays=Object.freeze({
    bottomwear:{name:'pants',rig:'chota-bottomwear-overlay-v1',key:/^(carhartt-(marron|azul-oscuro)|original-jeans)-v1$/,dir:'wardrobe-bottomwear',idle:[['.chota-idle-body','idle-body'],['.chota-idle-feet','idle-feet']]},
    footwear:{name:'shoes',rig:'chota-footwear-overlay-v1',key:/^original-jordan-chicago-v1$/,dir:'wardrobe-originals',idle:[['.chota-idle-body','idle-body'],['.chota-idle-feet','idle-feet'],['.chota-sleep-chest','sleep-chest']]},
    topwear:{name:'shirt',rig:'chota-topwear-overlay-v1',key:/^(carhartt-(crudo|oliva)|supreme-(negra|roja)|stussy-(blanca|azul)|original-stussy)-v1$/,dir:'wardrobe-topwear',idle:[['.chota-idle-body','idle-body'],['.chota-idle-head','idle-head'],['.chota-sleep-chest','sleep-chest']]},
  });
  const rigs=Object.freeze({outerwear:'chota-overlay-v1',bottomwear:overlays.bottomwear.rig,topwear:overlays.topwear.rig,footwear:overlays.footwear.rig});
  // Garments whose printed mark has a pre-mirrored variant for scaleX(-1) scenes.
  const FLIPPED=/^(carhartt-(marron|azul-oscuro)|supreme-(negra|roja))-v1$/;
  const overlayURL=(slot,key,sheet)=>`icons/mascot/chota-v2/tailored-v5/${key.replace(/-v1$/,'')}-${sheet}.webp`;
  function describe(item){
    if(!item||typeof item.id!=='string'||!item.id||item.id.length>60||item.item_kind!=='clothing'||!Object.hasOwn(rigs,item.slot)||item.rig_version!==rigs[item.slot])return null;
    const garment=item.garment;if(!garment||typeof garment!=='object'||Array.isArray(garment))return null;
    if(garment.type==='builtin'&&overlays[item.slot]){if(typeof garment.key!=='string'||!overlays[item.slot].key.test(garment.key))return null;const color=garment.key.replace(/-v1$/,'');return {id:item.id,slot:item.slot,type:'builtin',color,cell:256,atlases:Object.fromEntries(Object.keys(sheets).map(sheet=>[sheet,overlayURL(item.slot,garment.key,sheet)])),...(FLIPPED.test(garment.key)?{flipAtlases:Object.fromEntries(Object.keys(sheets).map(sheet=>[sheet,overlayURL(item.slot,garment.key.replace(/-v1$/,'-flip-v1'),sheet)]))}:{})};}
    if(garment.type==='builtin'){const color=colors.find(color=>garment.key==='tnf-'+color+'-v1');return color?{id:item.id,type:'builtin',color,cell:256,atlases:Object.fromEntries(Object.keys(sheets).map(sheet=>[sheet,localURL(color,sheet)]))}:null;}
    if(garment.type!=='atlas'||![128,256].includes(garment.cell)||!garment.atlases||!storageBase||Object.keys(garment.atlases).length!==5)return null;
    const atlases={};for(const sheet of Object.keys(sheets)){const path=garment.atlases[sheet];if(typeof path!=='string'||!/^chota\/wardrobe\/[A-Za-z0-9/_-]{1,180}\.webp$/.test(path)||path.split('/').some(part=>!part||part==='.'||part==='..'))return null;atlases[sheet]=storageBase+path.split('/').map(encodeURIComponent).join('/');}
    return {id:item.id,...(overlays[item.slot]?{slot:item.slot}:{}),type:'atlas',cell:garment.cell,atlases};
  }
  function decode(descriptor,signature){
    if(!requests.has(signature))requests.set(signature,Promise.all(Object.entries(sheets).map(([sheet,grid])=>{const image=new Image();image.src=descriptor.atlases[sheet];return image.decode().catch(error=>{throw new Error(`No se pudo decodificar ${image.src}: ${error.message}`);}).then(()=>{if(!image.naturalWidth||(descriptor.type==='atlas'&&(image.naturalWidth!==grid.cols*descriptor.cell||image.naturalHeight!==grid.rows*descriptor.cell)))throw new Error('La prenda no coincide con el rig del Chota.');});})).then(()=>true).catch(error=>{requests.delete(signature);throw error;}));
    return requests.get(signature);
  }
  // ── Overlay slots (trousers, T-shirt). Class names: chota-wardrobe-<name>-<kind>, has-chota-<name>.
  const worn={bottomwear:null,footwear:null,topwear:null},wornSequence={bottomwear:0,footwear:0,topwear:0};
  const cap=name=>name[0].toUpperCase()+name.slice(1);
  async function applyOverlay(slot,item){
    outfitSequence++;globalThis.ChotaAppearance?.cancel();
    const sequence=++wornSequence[slot];
    if(!item){worn[slot]=null;document.querySelectorAll('.tigreton-character').forEach(character=>unmountOverlay(character,slot));notifyWardrobe();return null;}
    const descriptor=describe(item);if(!descriptor||descriptor.slot!==slot||item.owned!==true)throw new TypeError('Esta prenda no está disponible en tu armario.');
    await decode(descriptor,JSON.stringify(descriptor));if(sequence!==wornSequence[slot])return null;
    const name=overlays[slot].name;worn[slot]=descriptor;document.querySelectorAll('.tigreton-character').forEach(character=>{character.querySelectorAll(`.chota-wardrobe-${name}`).forEach(node=>node.removeAttribute(`data-${name}-frame`));mountOverlay(character,slot);});notifyWardrobe();return descriptor.id;
  }
  const applyPants=item=>globalThis.ChotaAppearance?.createPreview?applySingle('bottomwear',item):applyOverlay('bottomwear',item),applyShirt=item=>globalThis.ChotaAppearance?.createPreview?applySingle('topwear',item):applyOverlay('topwear',item),applyShoes=item=>globalThis.ChotaAppearance?.createPreview?applySingle('footwear',item):applyOverlay('footwear',item);
  function unmountOverlay(character,slot){const name=overlays[slot].name;character.classList.remove(`has-chota-${name}`);delete character.dataset[`chota${cap(name)}`];character.style.removeProperty(`--chota-${name}-base`);character.querySelectorAll(`.chota-wardrobe-${name}`).forEach(node=>node.remove());}
  // Stacking, bottom to top: sprite, trousers, T-shirt, coat; hands stay above inside the idle torso.
  function overlayLayer(parent,slot,kind,before){
    const name=overlays[slot].name;let node=parent.querySelector(`:scope > .chota-wardrobe-${name}-${kind}`);
    if(!node){node=document.createElement('span');node.className=`chota-wardrobe-${name} chota-wardrobe-${name}-${kind}`;node.setAttribute('aria-hidden','true');parent.insertBefore(node,before===undefined?parent.firstChild:before);}
    return node;
  }
  function mountOverlay(character,slot){
    const descriptor=worn[slot];if(!character||!descriptor)return;
    const name=overlays[slot].name;
    character.classList.add(`has-chota-${name}`);character.dataset[`chota${cap(name)}`]=descriptor.id;
    character.style.setProperty(`--chota-${name}-base`,`url("${descriptor.atlases.base}")`);
    const above=slot==='bottomwear'?character.querySelector(':scope > .chota-wardrobe-shoes-main')||character.querySelector(':scope > .chota-wardrobe-shirt-main')||character.querySelector(':scope > .chota-wardrobe-main'):slot==='footwear'?character.querySelector(':scope > .chota-wardrobe-shirt-main')||character.querySelector(':scope > .chota-wardrobe-main'):character.querySelector(':scope > .chota-wardrobe-main');
    overlayLayer(character,slot,'main',above);
    for(const [selector,kind]of overlays[slot].idle){
      const parent=character.querySelector(selector);if(!parent)continue;
      const rank={pants:0,shoes:1,shirt:2},desired=rank[name];
      const before=[...parent.children].find(child=>{const other=Object.keys(rank).find(key=>child.classList.contains(`chota-wardrobe-${key}`));return other?rank[other]>desired:!child.classList.contains('chota-wardrobe-'+name);});
      overlayLayer(parent,slot,kind,before||null);
    }
    paintOverlay(character,slot,states.get(character)||{sheet:'base',frame:0});
  }
  function paintOverlay(character,slot,state){
    const descriptor=worn[slot];if(!descriptor)return;
    const name=overlays[slot].name,sheet=sheets[state.sheet],node=character.querySelector(`:scope > .chota-wardrobe-${name}-main`);
    if(!node)return;
    const signature=descriptor.id+':'+state.sheet+':'+state.frame;if(node.dataset[`${name}Frame`]===signature)return;
    node.dataset[`${name}Frame`]=signature;
    node.style.backgroundImage=`url("${descriptor.atlases[state.sheet]}")`;
    node.style.backgroundSize=`${sheet.cols*100}% ${sheet.rows*100}%`;
    node.style.backgroundPosition=`${sheet.cols===1?0:(state.frame%sheet.cols)*100/(sheet.cols-1)}% ${sheet.rows===1?0:Math.floor(state.frame/sheet.cols)*100/(sheet.rows-1)}%`;
  }
  const mountOverlays=character=>{for(const slot of ['bottomwear','footwear','topwear'])if(worn[slot])mountOverlay(character,slot);};
  const paintOverlays=(character,state)=>{for(const slot of ['bottomwear','footwear','topwear'])if(worn[slot])paintOverlay(character,slot,state);};

  async function applyOwned(item){
    if(globalThis.ChotaAppearance?.createPreview)return applySingle(item?.slot||'outerwear',item);
    outfitSequence++;globalThis.ChotaAppearance?.cancel();
    if(item===null)return previewEquip(null);
    if(overlays[item?.slot])return applyOverlay(item.slot,item);
    const descriptor=describe(item);if(!descriptor||item.owned!==true)throw new TypeError('Esta prenda no está disponible en tu armario.');
    const sequence=++equipSequence,signature=JSON.stringify(descriptor);
    if(!requests.has(signature))requests.set(signature,Promise.all(Object.entries(sheets).map(([sheet,grid])=>{const image=new Image();image.src=descriptor.atlases[sheet];return image.decode().catch(error=>{throw new Error(`No se pudo decodificar ${image.src}: ${error.message}`);}).then(()=>{if(!image.naturalWidth||(descriptor.type==='atlas'&&(image.naturalWidth!==grid.cols*descriptor.cell||image.naturalHeight!==grid.rows*descriptor.cell)))throw new Error('La prenda no coincide con el rig del Chota.');});})).then(()=>true).catch(error=>{requests.delete(signature);throw error;}));
    await requests.get(signature);if(sequence!==equipSequence)return null;
    serverId=descriptor.id;serverAtlases=descriptor.atlases;selected=descriptor.id;document.querySelectorAll('.tigreton-character').forEach(character=>{character.querySelector('.chota-wardrobe-main')?.removeAttribute('data-coat-frame');mount(character);});notifyWardrobe();return serverId;
  }
  function ensure(color){
    if(!requests.has(color))requests.set(color,Promise.all(Object.keys(sheets).map(sheet=>{const image=new Image();image.src=localURL(color,sheet);return image.decode().catch(error=>{throw new Error(`No se pudo decodificar ${image.src}: ${error.message}`);}).then(()=>{if(!image.naturalWidth)throw new Error('No se pudo cargar el abrigo.');});})).then(()=>true).catch(error=>{requests.delete(color);throw error;}));
    return requests.get(color);
  }
  function layer(parent,kind){
    let node=parent.querySelector(`:scope > .chota-wardrobe-${kind}`);
    if(!node){node=document.createElement('span');node.className=`chota-wardrobe-layer chota-wardrobe-${kind}`;node.setAttribute('aria-hidden','true');parent.append(node);}
    return node;
  }
  function paint(character,state){
    if(!selected)return;
    const sheet=sheets[state.sheet],node=character.querySelector(':scope > .chota-wardrobe-main');
    if(!node)return;
    const signature=selected+':'+state.sheet+':'+state.frame;if(node.dataset.coatFrame===signature)return;
    node.dataset.coatFrame=signature;
    node.style.backgroundImage=`url("${url(selected,state.sheet)}")`;
    node.style.backgroundSize=`${sheet.cols*100}% ${sheet.rows*100}%`;
    node.style.backgroundPosition=`${sheet.cols===1?0:(state.frame%sheet.cols)*100/(sheet.cols-1)}% ${sheet.rows===1?0:Math.floor(state.frame/sheet.cols)*100/(sheet.rows-1)}%`;
  }
  function mount(character){
    if(!character)return;
    if(!states.has(character))states.set(character,{sheet:'base',frame:0});
    mountOverlays(character);
    if(!selected)return;
    character.classList.add('has-chota-outfit');
    character.dataset.chotaOutfit=selectedID();
    character.style.setProperty('--chota-coat-base',`url("${url(selected,'base')}")`);
    layer(character,'main');
    for(const [selector,kind]of [['.chota-idle-body','idle-body'],['.chota-idle-head','idle-head'],['.chota-idle-paw','idle-paw'],['.chota-sleep-chest','sleep-chest']]){const parent=character.querySelector(selector);if(parent)layer(parent,kind);}
    paint(character,states.get(character));
  }
  function frame(character,sheet,index){
    if(!character||!sheets[sheet]||!Number.isInteger(index)||index<0||index>=sheets[sheet].count)return;
    const old=states.get(character);
    if(old?.sheet===sheet&&old.frame===index)return;
    const state={sheet,frame:index};states.set(character,state);if(selected)paint(character,state);paintOverlays(character,state);
    globalThis.ChotaCloth?.frame(character,sheet,index);
  }
  async function previewEquip(id){
    if(globalThis.ChotaAppearance?.createPreview){
      if(id===null)return setDescriptor('outerwear',null);
      const color=colors.find(color=>id===color||id===`chota-tnf-${color}-v1`);if(!color)throw new TypeError('Abrigo de prueba desconocido.');
      return setDescriptor('outerwear',describe({id:'chota-tnf-'+color+'-v1',item_kind:'clothing',slot:'outerwear',rig_version:rigs.outerwear,garment:{type:'builtin',key:'tnf-'+color+'-v1'}}));
    }
    outfitSequence++;globalThis.ChotaAppearance?.cancel();
    const sequence=++equipSequence;
    if(id===null){selected=null;serverId=null;serverAtlases=null;for(const character of document.querySelectorAll('.tigreton-character')){character.classList.remove('has-chota-outfit');delete character.dataset.chotaOutfit;character.style.removeProperty('--chota-coat-base');character.querySelectorAll('.chota-wardrobe-layer').forEach(node=>node.remove());}notifyWardrobe();return null;}
    const color=colors.find(color=>id===color||id===`chota-tnf-${color}-v1`);
    if(!color)throw new TypeError('Abrigo de prueba desconocido.');
    await ensure(color);if(sequence!==equipSequence)return null;
    serverId=null;serverAtlases=null;selected=color;document.querySelectorAll('.tigreton-character').forEach(mount);notifyWardrobe();
    return 'chota-tnf-'+color+'-v1';
  }
  // What he wears, bottom to top, as five-sheet atlases: lets other scenes (the daily dilemma) dress their own sprite.
  function outfit(){
    const layers=[];
    for(const slot of ['bottomwear','footwear','topwear'])if(worn[slot])layers.push({slot,atlases:{...worn[slot].atlases}});
    if(selected)layers.push({slot:'outerwear',atlases:Object.fromEntries(Object.keys(sheets).map(sheet=>[sheet,url(selected,sheet)]))});
    return layers;
  }
  // Slot state remains server-owned. Legacy NULLs use visual originals only;
  // modular NULLs are genuinely bare. Both modes use this same compositor.
  let legacyVisual=true;
  const slots=['bottomwear','footwear','topwear','outerwear'];
  function currentDescriptors(){return{...worn,outerwear:selected?{id:selectedID(),type:serverAtlases?'atlas':'builtin',cell:256,atlases:Object.fromEntries(Object.keys(sheets).map(sheet=>[sheet,url(selected,sheet)]))}:null};}
  function originals(){return Object.fromEntries(Object.entries({topwear:'original-stussy-v1',bottomwear:'original-jeans-v1',footwear:'original-jordan-chicago-v1'}).map(([slot,key])=>[slot,describe({id:'visual-'+key,item_kind:'clothing',slot,rig_version:rigs[slot],garment:{type:'builtin',key}})]));}
  function visualLayers(descriptors,legacy){const defaults=legacy?originals():{};return slots.map(slot=>[slot,descriptors[slot]||defaults[slot]]).filter(([,d])=>d).map(([slot,d])=>({slot,type:d.type,atlases:d.atlases,...(d.flipAtlases?{flipAtlases:d.flipAtlases}:{})}));}
  async function commit(descriptors,legacy,token){
    await Promise.all(Object.values(descriptors).filter(Boolean).map(d=>decode(d,JSON.stringify(d))));if(token!==outfitSequence)return null;
    if(!await globalThis.ChotaAppearance.compose(visualLayers(descriptors,legacy))||token!==outfitSequence)return null;
    legacyVisual=legacy;equipSequence++;for(const slot of Object.keys(worn)){wornSequence[slot]++;worn[slot]=descriptors[slot]||null;}
    const coat=descriptors.outerwear;selected=coat?.id||null;serverId=coat?.id||null;serverAtlases=coat?.atlases||null;
    for(const character of document.querySelectorAll('.tigreton-character')){
      character.querySelectorAll('.chota-wardrobe-layer,.chota-wardrobe-pants,.chota-wardrobe-shoes,.chota-wardrobe-shirt').forEach(node=>node.remove());
      for(const slot of Object.keys(overlays))if(!worn[slot])unmountOverlay(character,slot);
      if(!coat){character.classList.remove('has-chota-outfit');delete character.dataset.chotaOutfit;character.style.removeProperty('--chota-coat-base');}
      mount(character);
    }
    notifyWardrobe();return Object.fromEntries(slots.map(slot=>[slot,descriptors[slot]?.id||null]));
  }
  function ownedDescriptor(slot,item){if(!item)return null;const d=describe(item);if(!d||item.owned!==true||item.slot!==slot)throw new TypeError('Esta prenda no está disponible en tu armario.');return d;}
  async function applyAll(items,legacy){
    const token=++outfitSequence;globalThis.ChotaAppearance?.cancel();
    if(items===null){
      equipSequence++;for(const slot of Object.keys(worn)){wornSequence[slot]++;worn[slot]=null;}selected=null;serverId=null;serverAtlases=null;legacyVisual=true;
      for(const character of document.querySelectorAll('.tigreton-character')){for(const slot of Object.keys(overlays))unmountOverlay(character,slot);character.classList.remove('has-chota-outfit');delete character.dataset.chotaOutfit;character.style.removeProperty('--chota-coat-base');character.querySelectorAll('.chota-wardrobe-layer').forEach(node=>node.remove());}
      for(const node of [...previewNodes])releasePreview(node);globalThis.ChotaAppearance?.reset();notifyWardrobe();return null;
    }
    if(!items||typeof items!=='object'||Array.isArray(items)||!globalThis.ChotaAppearance)throw new TypeError('El armario aún no está preparado.');
    const descriptors=Object.fromEntries(slots.map(slot=>[slot,ownedDescriptor(slot,items[slot])]));return commit(descriptors,legacy,token);
  }
  const applyOutfit=items=>applyAll(items,false),applyLegacyOutfit=items=>applyAll(items,true);
  async function setDescriptor(slot,descriptor){const token=++outfitSequence;globalThis.ChotaAppearance?.cancel();const descriptors={...currentDescriptors(),[slot]:descriptor};const result=await commit(descriptors,legacyVisual,token);return result?descriptor?.id||null:null;}
  async function applySingle(slot,item){return setDescriptor(slot,ownedDescriptor(slot,item));}
  const previewStates=new WeakMap(),previewNodes=new Set();let previewObserver=null;
  function releasePreview(node){const state=previewStates.get(node);if(!state)return;state.token++;state.channel.dispose();previewStates.delete(node);previewNodes.delete(node);node.removeAttribute('data-chota-composed');node.querySelector('.fitting-chota-body')?.style.removeProperty('background-image');}
  async function preview(node,items,{legacy=false}={}){
    if(!node||!globalThis.ChotaAppearance?.createPreview)return false;
    const descriptors=Object.fromEntries(slots.map(slot=>{const item=items?.[slot],d=item?describe(item):null;if(item&&(!d||item.slot!==slot))throw new TypeError('La prenda no tiene una vista compatible.');return[slot,d];})),layers=visualLayers(descriptors,legacy),signature=JSON.stringify(layers);
    let state=previewStates.get(node);if(state?.channel.disposed()){previewStates.delete(node);state=null;}
    if(state?.signature===signature){if(state.entry&&!state.entry.released)return true;if(state.promise)return state.promise;}
    if(!state){state={channel:globalThis.ChotaAppearance.createPreview(),token:0,entry:null,signature:''};previewStates.set(node,state);previewNodes.add(node);const dialog=node.closest('dialog');dialog?.addEventListener('close',()=>releasePreview(node),{once:true});}
    if(!previewObserver&&typeof MutationObserver==='function'){previewObserver=new MutationObserver(()=>{for(const model of previewNodes)if(!model.isConnected)releasePreview(model);});previewObserver.observe(document.documentElement,{childList:true,subtree:true});}
    const token=++state.token;state.signature=signature;
    state.promise=state.channel.render(layers).then(entry=>{
      if(!entry)return false;if(state.token!==token||!node.isConnected){entry.release();return false;}
      const body=node.querySelector('.fitting-chota-body');if(!body){entry.release();return false;}
      const previous=state.entry;state.entry=entry;body.style.backgroundImage=`url("${entry.urls.base}")`;body.style.backgroundSize='600% 400%';node.dataset.chotaComposed='true';if(previous!==entry)previous?.release();return true;
    }).finally(()=>{if(state.token===token)state.promise=null;});return state.promise;
  }
  // What the cloth follow-through (chota-cloth.js) redraws: shirt and coat as worn, defaults included.
  const clothLayers=()=>visualLayers(currentDescriptors(),legacyVisual).filter(layer=>layer.slot==='topwear'||layer.slot==='outerwear');
  globalThis.ChotaWardrobe=Object.freeze({clothLayers,outfit,applyOutfit,applyLegacyOutfit,preview,releasePreview,mount,frame,previewEquip,applyOwned,applyPants,applyShirt,applyShoes,describe,configure,selected:selectedID,pants:()=>worn.bottomwear?.id||null,shirt:()=>worn.topwear?.id||null,shoes:()=>worn.footwear?.id||null,items:()=>colors.map(color=>({id:`chota-tnf-${color}-v1`,color,purchase_enabled:false,active:false,price_coins:null})),poseCount:67});
})();
