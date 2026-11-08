/* Garment renderer: selection is supplied by verified shop state; purchases stay on the server. */
(() => {
  'use strict';
  const colors=Object.freeze(['negro','crema','rojo','azul','oliva','morado']);
  const sheets=Object.freeze({base:{cols:6,rows:4,count:24},directional:{cols:5,rows:4,count:20},contextual:{cols:4,rows:4,count:16},room:{cols:4,rows:1,count:4},talk:{cols:3,rows:1,count:3}});
  const states=new WeakMap(),requests=new Map();
  let selected=null,equipSequence=0,serverId=null,serverAtlases=null,storageBase='';
  const localURL=(color,sheet)=>`icons/mascot/chota-v2/wardrobe/tnf-${color}-${sheet}-v1.webp`;
  const selectedID=()=>serverId || (selected?'chota-tnf-'+selected+'-v1':null);
  const url=(color,sheet)=>serverAtlases&&color===serverId?serverAtlases[sheet]:localURL(color,sheet);
  function configure(origin){try{const parsed=new URL(origin||globalThis.BIG_BOY_CONFIG?.supabaseUrl);storageBase=parsed.protocol==='https:'&&!parsed.username&&!parsed.password?parsed.origin+'/storage/v1/object/public/shop-media/':'';}catch{storageBase='';}}
  configure();
  // Trousers are a second slot drawn under the coat; same sheets, cells and pivots.
  const pantsColors=Object.freeze(['marron','azul-oscuro']);
  const pantsURL=(color,sheet)=>`icons/mascot/chota-v2/wardrobe-bottomwear/carhartt-${color}-${sheet}-v1.webp`;
  const rigs=Object.freeze({outerwear:'chota-overlay-v1',bottomwear:'chota-bottomwear-overlay-v1'});
  function describe(item){
    if(!item||typeof item.id!=='string'||!item.id||item.id.length>60||item.item_kind!=='clothing'||!Object.hasOwn(rigs,item.slot)||item.rig_version!==rigs[item.slot])return null;
    const garment=item.garment;if(!garment||typeof garment!=='object'||Array.isArray(garment))return null;
    if(garment.type==='builtin'&&item.slot==='bottomwear'){const color=pantsColors.find(color=>garment.key==='carhartt-'+color+'-v1');return color?{id:item.id,slot:'bottomwear',type:'builtin',color,cell:128,atlases:Object.fromEntries(Object.keys(sheets).map(sheet=>[sheet,pantsURL(color,sheet)]))}:null;}
    if(garment.type==='builtin'){const color=colors.find(color=>garment.key==='tnf-'+color+'-v1');return color?{id:item.id,type:'builtin',color,cell:128,atlases:Object.fromEntries(Object.keys(sheets).map(sheet=>[sheet,localURL(color,sheet)]))}:null;}
    if(garment.type!=='atlas'||![128,256].includes(garment.cell)||!garment.atlases||!storageBase||Object.keys(garment.atlases).length!==5)return null;
    const atlases={};for(const sheet of Object.keys(sheets)){const path=garment.atlases[sheet];if(typeof path!=='string'||!/^chota\/wardrobe\/[A-Za-z0-9/_-]{1,180}\.webp$/.test(path)||path.split('/').some(part=>!part||part==='.'||part==='..'))return null;atlases[sheet]=storageBase+path.split('/').map(encodeURIComponent).join('/');}
    return {id:item.id,...(item.slot==='bottomwear'?{slot:'bottomwear'}:{}),type:'atlas',cell:garment.cell,atlases};
  }
  // ── Trousers.
  let pants=null,pantsSequence=0;
  function decode(descriptor,signature){
    if(!requests.has(signature))requests.set(signature,Promise.all(Object.entries(sheets).map(([sheet,grid])=>{const image=new Image();image.src=descriptor.atlases[sheet];return image.decode().then(()=>{if(!image.naturalWidth||(descriptor.type==='atlas'&&(image.naturalWidth!==grid.cols*descriptor.cell||image.naturalHeight!==grid.rows*descriptor.cell)))throw new Error('La prenda no coincide con el rig del Chota.');});})).then(()=>true).catch(error=>{requests.delete(signature);throw error;}));
    return requests.get(signature);
  }
  async function applyPants(item){
    const sequence=++pantsSequence;
    if(!item){pants=null;document.querySelectorAll('.tigreton-character').forEach(unmountPants);return null;}
    const descriptor=describe(item);if(!descriptor||descriptor.slot!=='bottomwear'||item.owned!==true)throw new TypeError('Esta prenda no está disponible en tu armario.');
    await decode(descriptor,JSON.stringify(descriptor));if(sequence!==pantsSequence)return null;
    pants=descriptor;document.querySelectorAll('.tigreton-character').forEach(character=>{character.querySelectorAll('.chota-wardrobe-pants').forEach(node=>node.removeAttribute('data-pants-frame'));mountPants(character);});return pants.id;
  }
  function unmountPants(character){character.classList.remove('has-chota-pants');delete character.dataset.chotaPants;character.style.removeProperty('--chota-pants-base');character.querySelectorAll('.chota-wardrobe-pants').forEach(node=>node.remove());}
  function pantsLayer(parent,kind,before){
    let node=parent.querySelector(`:scope > .chota-wardrobe-pants-${kind}`);
    if(!node){node=document.createElement('span');node.className=`chota-wardrobe-pants chota-wardrobe-pants-${kind}`;node.setAttribute('aria-hidden','true');parent.insertBefore(node,before===undefined?parent.firstChild:before);}
    return node;
  }
  function mountPants(character){
    if(!character||!pants)return;
    character.classList.add('has-chota-pants');character.dataset.chotaPants=pants.id;
    character.style.setProperty('--chota-pants-base',`url("${pants.atlases.base}")`);
    // Under the coat and the hands: before the coat layer, first inside the idle torso and feet.
    pantsLayer(character,'main',character.querySelector(':scope > .chota-wardrobe-main'));
    for(const [selector,kind]of [['.chota-idle-body','idle-body'],['.chota-idle-feet','idle-feet']]){const parent=character.querySelector(selector);if(parent)pantsLayer(parent,kind);}
    paintPants(character,states.get(character)||{sheet:'base',frame:0});
  }
  function paintPants(character,state){
    if(!pants)return;
    const sheet=sheets[state.sheet],node=character.querySelector(':scope > .chota-wardrobe-pants-main');
    if(!node)return;
    const signature=pants.id+':'+state.sheet+':'+state.frame;if(node.dataset.pantsFrame===signature)return;
    node.dataset.pantsFrame=signature;
    node.style.backgroundImage=`url("${pants.atlases[state.sheet]}")`;
    node.style.backgroundSize=`${sheet.cols*100}% ${sheet.rows*100}%`;
    node.style.backgroundPosition=`${sheet.cols===1?0:(state.frame%sheet.cols)*100/(sheet.cols-1)}% ${sheet.rows===1?0:Math.floor(state.frame/sheet.cols)*100/(sheet.rows-1)}%`;
  }

  async function applyOwned(item){
    if(item===null)return previewEquip(null);
    if(item?.slot==='bottomwear')return applyPants(item);
    const descriptor=describe(item);if(!descriptor||item.owned!==true)throw new TypeError('Esta prenda no está disponible en tu armario.');
    const sequence=++equipSequence,signature=JSON.stringify(descriptor);
    if(!requests.has(signature))requests.set(signature,Promise.all(Object.entries(sheets).map(([sheet,grid])=>{const image=new Image();image.src=descriptor.atlases[sheet];return image.decode().then(()=>{if(!image.naturalWidth||(descriptor.type==='atlas'&&(image.naturalWidth!==grid.cols*descriptor.cell||image.naturalHeight!==grid.rows*descriptor.cell)))throw new Error('La prenda no coincide con el rig del Chota.');});})).then(()=>true).catch(error=>{requests.delete(signature);throw error;}));
    await requests.get(signature);if(sequence!==equipSequence)return null;
    serverId=descriptor.id;serverAtlases=descriptor.atlases;selected=descriptor.id;document.querySelectorAll('.tigreton-character').forEach(character=>{character.querySelector('.chota-wardrobe-main')?.removeAttribute('data-coat-frame');mount(character);});return serverId;
  }
  function ensure(color){
    if(!requests.has(color))requests.set(color,Promise.all(Object.keys(sheets).map(sheet=>{const image=new Image();image.src=localURL(color,sheet);return image.decode().then(()=>{if(!image.naturalWidth)throw new Error('No se pudo cargar el abrigo.');});})).then(()=>true).catch(error=>{requests.delete(color);throw error;}));
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
    if(pants)mountPants(character);
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
    const state={sheet,frame:index};states.set(character,state);if(selected)paint(character,state);if(pants)paintPants(character,state);
  }
  async function previewEquip(id){
    const sequence=++equipSequence;
    if(id===null){selected=null;serverId=null;serverAtlases=null;for(const character of document.querySelectorAll('.tigreton-character')){character.classList.remove('has-chota-outfit');delete character.dataset.chotaOutfit;character.style.removeProperty('--chota-coat-base');character.querySelectorAll('.chota-wardrobe-layer').forEach(node=>node.remove());}return null;}
    const color=colors.find(color=>id===color||id===`chota-tnf-${color}-v1`);
    if(!color)throw new TypeError('Abrigo de prueba desconocido.');
    await ensure(color);if(sequence!==equipSequence)return null;
    serverId=null;serverAtlases=null;selected=color;document.querySelectorAll('.tigreton-character').forEach(mount);
    return 'chota-tnf-'+color+'-v1';
  }
  globalThis.ChotaWardrobe=Object.freeze({mount,frame,previewEquip,applyOwned,applyPants,describe,configure,selected:selectedID,pants:()=>pants?.id||null,items:()=>colors.map(color=>({id:`chota-tnf-${color}-v1`,color,purchase_enabled:false,active:false,price_coins:null})),poseCount:67});
})();
