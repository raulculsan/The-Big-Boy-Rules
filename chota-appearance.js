/* Outfit composition is shared by every scene. Body parts and clothes are paired
   to the original 67 poses; previews have independent workers and blob lifetimes. */
(() => {
  'use strict';
  const grids={base:[6,4],directional:[5,4],contextual:[4,4],room:[4,1],talk:[3,1]};
  const legacy={base:'chota-poses.webp',directional:'chota-directional-v1.webp',contextual:'chota-contextual-v1.webp',room:'chota-room-life-v1.webp',talk:'chota-talk.webp'};
  // Tailored atlases keep their names across art fixes; the revision busts the
  // public-media cache so a phone never mixes old and new layers of one outfit.
  const ART_REVISION='611',root=document.documentElement,absolute=value=>{const url=new URL(value,document.baseURI);if(url.pathname.includes('/tailored-v5/')&&!url.search)url.searchParams.set('v',ART_REVISION);return url.href;},previews=new Set();
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
      worker=new Worker(new URL('chota-compositor-worker.js?v=20261109-tailored-v5-609',document.baseURI));
      worker.onmessage=async({data})=>{
        if(!pending||data.sequence!==pending.sequence)return;
        const request=pending,urls={};
        if(data.error){pending=null;request.reject(new Error(data.error));return;}
        try{
          if(!Array.isArray(data.results)||(data.results.length!==5&&data.results.length!==10))throw new Error('La apariencia está incompleta.');
          for(const result of data.results){const key=String(result.sheet).replace(/^flip-/,'');if(!grids[key]||urls[result.sheet]||!(result.blob instanceof Blob))throw new Error('La apariencia no es válida.');urls[result.sheet]=URL.createObjectURL(result.blob);}
          await decode(urls);
          if(request.sequence!==sequence||disposed){revoke({urls});return;}
          const old=current,entry={signature:request.signature,urls,released:false};entry.release=()=>{revoke(entry);if(current===entry)current=null;};current=entry;
          if(publish){showOutfit(urls);void store(request.signature,data.results);}
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
        try{ensure().postMessage({sequence:token,anatomy:paths(contract.anatomy),bare:Object.fromEntries(Object.entries(contract.bare).map(([slot,atlases])=>[slot,paths(atlases)])),foreground:paths(contract.foreground),flip:publish,layers:layers.map(layer=>({slot:layer.slot,type:layer.type,atlases:paths(layer.atlases),...(layer.flipAtlases?{flipAtlases:paths(layer.flipAtlases)}:{})}))});}
        catch(error){pending=null;reject(error);}
      });
    }
    function clear(){cancel();worker?.terminate();worker=null;revoke(current);current=null;}
    // The outfit saved by the last session is shown before the server answers.
    function adopt(signature,urls){if(current||disposed)return false;current={signature,urls,released:false};current.release=()=>{revoke(current);current=null;};return true;}
    function dispose(){disposed=true;clear();previews.delete(api);}
    const api={render,cancel,clear,dispose,adopt,current:()=>current,disposed:()=>disposed};return api;
  }
  function showOutfit(urls){enabled=true;for(const sheet of Object.keys(grids)){root.style.setProperty(`--chota-outfit-${sheet}`,`url("${urls[sheet]}")`);root.style.setProperty(`--chota-neutral-${sheet}`,`url("${urls[sheet]}")`);root.style.setProperty(`--chota-flip-${sheet}`,`url("${urls['flip-'+sheet]||urls[sheet]}")`);}root.dataset.chotaModular='true';settle();}
  // Opening the app used to show the old baked clothes until the worker had
  // composed the outfit. The last committed outfit is kept on the device (one
  // record, cleared on logout) and restored first; until then the Chota waits
  // hidden for a moment instead of wearing the wrong clothes.
  const DB='chota-outfit',FLAG='chota-outfit-saved';
  let pendingTimer=0,ownerId=null,adoptedOwner=null;
  function settle(){clearTimeout(pendingTimer);delete root.dataset.chotaPending;}
  function database(){return new Promise((resolve,reject)=>{if(!globalThis.indexedDB)return reject(new Error('no idb'));const open=indexedDB.open(DB,1);open.onupgradeneeded=()=>open.result.createObjectStore('outfit');open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);});}
  async function store(signature,results){if(!ownerId)return;try{const owner=ownerId,db=await database();await new Promise((resolve,reject)=>{const tx=db.transaction('outfit','readwrite');tx.objectStore('outfit').put({revision:ART_REVISION,owner,signature,sheets:Object.fromEntries(results.map(r=>[r.sheet,r.blob]))},'current');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();localStorage.setItem(FLAG,'1');}catch{}}
  async function forget(){try{localStorage.removeItem(FLAG);const db=await database();await new Promise(resolve=>{const tx=db.transaction('outfit','readwrite');tx.objectStore('outfit').delete('current');tx.oncomplete=resolve;tx.onerror=resolve;});db.close();}catch{}}
  async function restore(){
    try{
      const db=await database(),saved=await new Promise((resolve,reject)=>{const get=db.transaction('outfit').objectStore('outfit').get('current');get.onsuccess=()=>resolve(get.result);get.onerror=()=>reject(get.error);});db.close();
      if(!saved||saved.revision!==ART_REVISION||!saved.owner||(ownerId&&saved.owner!==ownerId)||!saved.sheets||Object.keys(grids).some(sheet=>!(saved.sheets[sheet] instanceof Blob))){settle();return;}
      const urls=Object.fromEntries(Object.entries(saved.sheets).map(([sheet,blob])=>[sheet,URL.createObjectURL(blob)]));
      await decode(urls);
      if((ownerId&&saved.owner!==ownerId)||!equipped.adopt(saved.signature,urls)){revoke({urls});settle();return;}
      adoptedOwner=saved.owner;
      showOutfit(urls);globalThis.dispatchEvent(new Event('chota-appearance-change'));
    }catch{settle();}
  }
  const equipped=channel(true);
  let hasSaved=false;try{hasSaved=localStorage.getItem(FLAG)==='1';}catch{}
  if(hasSaved){root.dataset.chotaPending='true';pendingTimer=setTimeout(settle,2500);void restore();}
  function reset({keepSaved=false}={}){
    if(!keepSaved){void forget();adoptedOwner=null;}settle();
    equipped.clear();for(const preview of [...previews])preview.dispose();enabled=false;delete root.dataset.chotaModular;
    for(const sheet of Object.keys(grids)){root.style.removeProperty(`--chota-outfit-${sheet}`);root.style.removeProperty(`--chota-neutral-${sheet}`);root.style.removeProperty(`--chota-flip-${sheet}`);}
    globalThis.dispatchEvent(new Event('chota-appearance-change'));
  }
  // The shop names the signed-in member; a saved outfit from anyone else is dropped.
  function claim(id){if(!id)return;ownerId=id;if(adoptedOwner&&adoptedOwner!==ownerId){adoptedOwner=null;reset();}}
  function createPreview(){const preview=channel(false);previews.add(preview);return preview;}
  const sheet=key=>equipped.current()?.urls[key]||'icons/mascot/chota-v2/'+legacy[key];
  globalThis.addEventListener('pagehide',()=>reset({keepSaved:true}));
  globalThis.ChotaAppearance=Object.freeze({contract:()=>contract,url:absolute,claim,prepare,compose:layers=>equipped.render(layers),cancel:()=>equipped.cancel(),reset,createPreview,base:sheet,sheet,enabled:()=>enabled});
})();
