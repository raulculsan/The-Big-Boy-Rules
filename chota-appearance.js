/* Outfit composition is shared by every scene. Body parts and clothes are paired
   to the original 67 poses; previews have independent workers and blob lifetimes. */
(() => {
  'use strict';
  const grids={base:[6,4],directional:[5,4],contextual:[4,4],room:[4,1],talk:[3,1]};
  const legacy={base:'chota-poses.webp',directional:'chota-directional-v1.webp',contextual:'chota-contextual-v1.webp',room:'chota-room-life-v1.webp',talk:'chota-talk.webp'};
  // Tailored atlases keep their names across art fixes; the revision busts the
  // public-media cache so a phone never mixes old and new layers of one outfit.
  const ART_REVISION='604',root=document.documentElement,absolute=value=>{const url=new URL(value,document.baseURI);if(url.pathname.includes('/tailored-v5/')&&!url.search)url.searchParams.set('v',ART_REVISION);return url.href;},previews=new Set();
  let contract=null,preparing=null,enabled=false;
  const valid=paths=>paths&&Object.keys(paths).length===5&&Object.keys(grids).every(sheet=>typeof paths[sheet]==='string'&&/^icons\/mascot\/chota-v2\/tailored-v5\/[a-z0-9-]+\.webp$/.test(paths[sheet]));
  function prepare(){
    if(preparing)return preparing;
    preparing=(async()=>{
      const response=await fetch('icons/mascot/chota-v2/tailored-v5/manifest-v1.json',{credentials:'same-origin',cache:'no-cache'});
      if(!response.ok)throw new Error('La apariencia del Chota aún no está disponible.');
      const value=await response.json();
      if(value.version!==1||value.rigVersion!==5||value.approved!==true||value.cell!==256||!valid(value.anatomy)||!valid(value.foreground)||!['topwear','bottomwear','footwear'].every(slot=>valid(value.bare?.[slot])))throw new Error('La apariencia del Chota está pendiente de revisión.');
      contract=value;return value;
    })().catch(error=>{preparing=null;throw error;});return preparing;
  }
  const revoke=entry=>{if(entry&&!entry.released){entry.released=true;for(const url of Object.values(entry.urls))URL.revokeObjectURL(url);}};
  async function decode(paths){await Promise.all(Object.entries(grids).map(async([sheet,[cols,rows]])=>{const image=new Image();image.src=paths[sheet];await image.decode().catch(error=>{throw new Error(`No se pudo decodificar ${image.src}: ${error.message}`);});if(image.naturalWidth!==cols*256||image.naturalHeight!==rows*256)throw new Error('La apariencia no coincide con sus animaciones.');}));}
  function channel(publish){
    let worker=null,sequence=0,pending=null,current=null,disposed=false;
    const finish=value=>{if(pending){pending.resolve(value);pending=null;}};
    function cancel(){sequence++;finish(false);}
    function ensure(){
      if(worker)return worker;
      if(typeof Worker!=='function')throw new Error('Este dispositivo necesita una versión compatible con el armario.');
      worker=new Worker(new URL('chota-compositor-worker.js?v=20261109-tailored-v5-604',document.baseURI));
      worker.onmessage=async({data})=>{
        if(!pending||data.sequence!==pending.sequence)return;
        const request=pending,urls={};
        if(data.error){pending=null;request.reject(new Error(data.error));return;}
        try{
          if(!Array.isArray(data.results)||data.results.length!==5)throw new Error('La apariencia está incompleta.');
          for(const result of data.results){if(!grids[result.sheet]||urls[result.sheet]||!(result.blob instanceof Blob))throw new Error('La apariencia no es válida.');urls[result.sheet]=URL.createObjectURL(result.blob);}
          await decode(urls);
          if(request.sequence!==sequence||disposed){revoke({urls});return;}
          const old=current,entry={signature:request.signature,urls,released:false};entry.release=()=>{revoke(entry);if(current===entry)current=null;};current=entry;
          if(publish){enabled=true;for(const sheet of Object.keys(grids)){root.style.setProperty(`--chota-outfit-${sheet}`,`url("${urls[sheet]}")`);root.style.setProperty(`--chota-neutral-${sheet}`,`url("${urls[sheet]}")`);}root.dataset.chotaModular='true';}
          pending=null;request.resolve(publish?true:entry);
          // CSS/canvas consumers get the replacement before the previous blobs
          // are retired; a canceled decode can never install a stale outfit.
          const frame=globalThis.requestAnimationFrame||((fn)=>setTimeout(fn,16));frame(()=>frame(()=>revoke(old)));
          if(publish)globalThis.dispatchEvent(new Event('chota-appearance-change'));
        }catch(error){revoke({urls});if(pending===request){pending=null;request.reject(error);}}
      };
      worker.onerror=()=>{const request=pending;pending=null;request?.reject(new Error('No se pudo preparar la apariencia del Chota.'));worker?.terminate();worker=null;};return worker;
    }
    async function render(layers){
      const token=++sequence;finish(false);await prepare();if(token!==sequence||disposed)return false;
      const signature=JSON.stringify(layers);if(publish&&enabled&&current?.signature===signature&&!current.released)return true;
      return new Promise((resolve,reject)=>{
        pending={sequence:token,signature,resolve,reject};
        const paths=map=>Object.fromEntries(Object.entries(map).map(([sheet,url])=>[sheet,absolute(url)]));
        try{ensure().postMessage({sequence:token,anatomy:paths(contract.anatomy),bare:Object.fromEntries(Object.entries(contract.bare).map(([slot,atlases])=>[slot,paths(atlases)])),foreground:paths(contract.foreground),layers:layers.map(layer=>({slot:layer.slot,type:layer.type,atlases:paths(layer.atlases)}))});}
        catch(error){pending=null;reject(error);}
      });
    }
    function clear(){cancel();worker?.terminate();worker=null;revoke(current);current=null;}
    function dispose(){disposed=true;clear();previews.delete(api);}
    const api={render,cancel,clear,dispose,current:()=>current,disposed:()=>disposed};return api;
  }
  const equipped=channel(true);
  function reset(){
    equipped.clear();for(const preview of [...previews])preview.dispose();enabled=false;delete root.dataset.chotaModular;
    for(const sheet of Object.keys(grids)){root.style.removeProperty(`--chota-outfit-${sheet}`);root.style.removeProperty(`--chota-neutral-${sheet}`);}
    globalThis.dispatchEvent(new Event('chota-appearance-change'));
  }
  function createPreview(){const preview=channel(false);previews.add(preview);return preview;}
  const sheet=key=>equipped.current()?.urls[key]||'icons/mascot/chota-v2/'+legacy[key];
  globalThis.addEventListener('pagehide',reset);
  globalThis.ChotaAppearance=Object.freeze({prepare,compose:layers=>equipped.render(layers),cancel:()=>equipped.cancel(),reset,createPreview,base:sheet,sheet,enabled:()=>enabled});
})();
