/* A shared, versioned appearance for CSS cameos and canvas scenes. Disabled until
   the anatomical asset manifest is explicitly approved and every sheet decodes. */
(() => {
  'use strict';
  const grids={base:[6,4],directional:[5,4],contextual:[4,4],room:[4,1],talk:[3,1]};
  const legacy={base:'chota-poses.webp',directional:'chota-directional-v1.webp',contextual:'chota-contextual-v1.webp',room:'chota-room-life-v1.webp',talk:'chota-talk.webp'};
  let contract=null,preparing=null,enabled=false,worker=null,sequence=0,current=null,pending=null,retiring=null;
  const root=document.documentElement;
  const absolute=value=>new URL(value,document.baseURI).href;
  function validatePaths(paths){
    if(!paths||Object.keys(paths).length!==5)return false;
    return Object.keys(grids).every(sheet=>typeof paths[sheet]==='string'&&/^icons\/mascot\/chota-v2\/(neutral|wardrobe-originals)\/[a-z0-9-]+\.webp$/.test(paths[sheet]));
  }
  async function decode(paths){
    await Promise.all(Object.entries(grids).map(async([sheet,[cols,rows]])=>{const image=new Image();image.src=paths[sheet];await image.decode().catch(error=>{throw new Error(`No se pudo decodificar ${image.src}: ${error.message}`);});if(image.naturalWidth!==cols*256||image.naturalHeight!==rows*256)throw new Error('El cuerpo del Chota no coincide con sus animaciones.');}));
  }
  function prepare(){
    if(preparing)return preparing;
    preparing=(async()=>{
      const response=await fetch('icons/mascot/chota-v2/neutral/manifest-v1.json',{credentials:'same-origin',cache:'no-cache'});
      if(!response.ok)throw new Error('La nueva base del Chota aún no está disponible.');
      const value=await response.json();
      if(value.version!==1||value.approved!==true||!validatePaths(value.neutral)||!validatePaths(value.defaults))throw new Error('La nueva base del Chota está pendiente de revisión.');
      await Promise.all([decode(value.neutral),decode(value.defaults)]);
      contract=value;return value;
    })().catch(error=>{preparing=null;throw error;});
    return preparing;
  }
  function revoke(entry){if(entry)for(const url of Object.values(entry.urls))URL.revokeObjectURL(url);}
  function retire(entry){
    if(!entry)return;if(retiring)revoke(retiring);retiring=entry;
    const frame=globalThis.requestAnimationFrame||((fn)=>setTimeout(fn,16));
    frame(()=>frame(()=>{if(retiring===entry){revoke(entry);retiring=null;}}));
  }
  function finishPending(value){if(pending){pending.resolve(value);pending=null;}}
  function ensureWorker(){
    if(worker)return worker;
    if(typeof Worker!=='function')throw new Error('Este dispositivo necesita una versión compatible para el nuevo armario.');
    worker=new Worker(new URL('chota-compositor-worker.js?v=20261109-chota-modular-600',document.baseURI));
    worker.onmessage=async({data})=>{
      if(!pending||data.sequence!==pending.sequence)return;
      if(data.error){pending.reject(new Error(data.error));pending=null;return;}
      const request=pending,urls={};
      try{
        if(!Array.isArray(data.results)||data.results.length!==5)throw new Error('La apariencia está incompleta.');
        for(const result of data.results){if(!grids[result.sheet]||!(result.blob instanceof Blob))throw new Error('La apariencia no es válida.');urls[result.sheet]=URL.createObjectURL(result.blob);}
        await decode(urls);
        if(request.sequence!==sequence){revoke({urls});return;}
        const previous=current;current={signature:request.signature,urls};enabled=true;
        for(const sheet of Object.keys(grids)){
          root.style.setProperty(`--chota-outfit-${sheet}`,`url("${urls[sheet]}")`);
          root.style.setProperty(`--chota-neutral-${sheet}`,`url("${contract.neutral[sheet]}")`);
        }
        root.dataset.chotaModular='true';
        // Old textures remain valid until the replacement has decoded and committed.
        retire(previous);
        finishPending(true);globalThis.dispatchEvent(new Event('chota-appearance-change'));
      }catch(error){revoke({urls});if(pending===request){pending=null;request.reject(error);}}
    };
    worker.onerror=()=>{if(pending){pending.reject(new Error('No se pudo preparar la apariencia del Chota.'));pending=null;}worker?.terminate();worker=null;};
    return worker;
  }
  async function compose(layers){
    const token=++sequence;finishPending(false);
    await prepare();
    if(token!==sequence)return false;
    const signature=JSON.stringify(layers);
    if(current?.signature===signature&&enabled)return true;
    return new Promise((resolve,reject)=>{
      pending={sequence:token,signature,resolve,reject};
      const originals={bottomwear:'original-jeans',footwear:'original-jordan-chicago',topwear:'original-stussy'};
      const allOriginal=layers.length===3&&new Set(layers.map(layer=>layer.slot)).size===3&&layers.every(layer=>originals[layer.slot]&&Object.keys(grids).every(sheet=>layer.atlases[sheet]===`icons/mascot/chota-v2/wardrobe-originals/${originals[layer.slot]}-${sheet}-${layer.slot==='footwear'?'v1':'v2'}.webp`));
      const compositionBase=allOriginal?contract.defaults:contract.neutral,compositionLayers=allOriginal?[]:layers;
      try{ensureWorker().postMessage({sequence:token,base:Object.fromEntries(Object.entries(compositionBase).map(([sheet,url])=>[sheet,absolute(url)])),layers:compositionLayers.map(layer=>({slot:layer.slot,atlases:Object.fromEntries(Object.entries(layer.atlases).map(([sheet,url])=>[sheet,absolute(url)]))}))});}
      catch(error){pending=null;reject(error);}
    });
  }
  function reset(){
    sequence++;finishPending(false);enabled=false;delete root.dataset.chotaModular;
    for(const sheet of Object.keys(grids)){if(contract)root.style.setProperty(`--chota-outfit-${sheet}`,`url("${contract.defaults[sheet]}")`);else root.style.removeProperty(`--chota-outfit-${sheet}`);root.style.removeProperty(`--chota-neutral-${sheet}`);}
    const previous=current;current=null;retire(previous);
    worker?.terminate();worker=null;globalThis.dispatchEvent(new Event('chota-appearance-change'));
  }
  function cancel(){sequence++;finishPending(false);}
  const base=sheet=>enabled?contract.neutral[sheet]:contract?.defaults[sheet]||'icons/mascot/chota-v2/'+legacy[sheet];
  const sheet=key=>current?.urls[key]||contract?.defaults[key]||'icons/mascot/chota-v2/'+legacy[key];
  globalThis.addEventListener('pagehide',()=>{worker?.terminate();worker=null;finishPending(false);if(retiring){revoke(retiring);retiring=null;}});
  globalThis.ChotaAppearance=Object.freeze({prepare,compose,cancel,reset,base,sheet,enabled:()=>enabled});
})();
