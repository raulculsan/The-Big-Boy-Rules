/* The illustrated shop routes furniture to the existing server-backed departments. */
(() => {
  const departments=Object.freeze({banners:{tab:'banners',title:'Banners'},vouchers:{tab:'vouchers',title:'Vales'},accessories:{tab:'chota',title:'Objetos'},clothing:{tab:'clothing',title:'Abrigos',slot:'outerwear'},pants:{tab:'clothing',title:'Pantalones',slot:'bottomwear'},shirts:{tab:'clothing',title:'Camisetas',slot:'topwear'}});
  let manifest=null,pending=null,section=null,routing=false,lastFurniture=null,initialized=false,routeVersion=0;
  const dialog=()=>document.getElementById('bannerShopDialog');
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const asset=value=>typeof value==='string'&&/^icons\/shop\/club-store-v1\/[a-z0-9-]+\.(webp|png)$/.test(value)?value:null;
  const rect=(value,w,h)=>Array.isArray(value)&&value.length===4&&value.every(Number.isFinite)&&value[0]>=0&&value[1]>=0&&value[2]>0&&value[3]>0&&value[0]+value[2]<=w+1&&value[1]+value[3]<=h+1;
  function validate(data){
    if(!data||data.width!==1024||data.height!==1280||!Array.isArray(data.layers)||data.layers.length>16||!Array.isArray(data.hotspots))throw new Error('No se pudo leer la tienda.');
    const layers=data.layers.map(layer=>{if(!asset(layer.src)||!rect(layer.rect,data.width,data.height)||!Number.isFinite(layer.z)||layer.z<0||layer.z>20||!/^[-a-z0-9]+$/.test(layer.id))throw new Error('Capa de tienda no válida.');return {id:layer.id,src:layer.src,rect:layer.rect,z:layer.z};});
    const hotspots=Object.keys(departments).filter(id=>!['pants','shirts'].includes(id)||data.hotspots.some(point=>point.section===id)).map(id=>{const point=data.hotspots.find(point=>point.section===id);if(!point||!rect(point.rect,data.width,data.height)||!layers.some(layer=>layer.id===point.layer))throw new Error('Mueble de tienda no válido.');return {section:id,label:String(point.label||departments[id].title),rect:point.rect,layer:point.layer,labelPoint:Array.isArray(point.labelPoint)&&point.labelPoint.length===2&&point.labelPoint.every(Number.isFinite)?point.labelPoint:null};});
    const displays=(data.displays||[]).map(display=>{const layer=layers.find(layer=>layer.id===display.layer);if(!layer||!['pants','shirts'].includes(display.section)||!Array.isArray(display.models))throw new Error('Expositor no válido.');const ids=new Set();const models=display.models.map(item=>{if(!item||!/^[-a-z0-9]{1,80}$/.test(item.id)||ids.has(item.id)||!asset(item.src)||![item.width,item.height].every(n=>Number.isFinite(n)&&n>0&&n<=4096))throw new Error('Prenda de exposición no válida.');ids.add(item.id);return{id:item.id,name:String(item.name||'').slice(0,160),brand:String(item.brand||'').slice(0,80),src:item.src,width:item.width,height:item.height};});return{section:display.section,layer:display.layer,models,groupByBrand:display.groupByBrand===true};});
    return {width:data.width,height:data.height,layers,hotspots,displays,poster:asset(data.poster)};
  }
  const placement=(r,w,h)=>`left:${r[0]/w*100}%;top:${r[1]/h*100}%;width:${r[2]/w*100}%;height:${r[3]/h*100}%`;
  function displayPlan(display,page=0){
    const groups=new Map();for(const item of display.models){const key=display.groupByBrand?item.brand:'';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);}
    const stacks=[];for(const models of groups.values()){models.sort((a,b)=>a.id.localeCompare(b.id));for(let i=0;i<models.length;i+=4)stacks.push(models.slice(i,i+4));}
    const pages=Math.max(1,Math.ceil(stacks.length/9)),current=Math.min(Math.max(0,Number.isInteger(page)?page:0),pages-1),layers=[];
    for(const[slot,models]of stacks.slice(current*9,current*9+9).entries()){const shelf=Math.floor(slot/3),y=[351,586,813][shelf],ceiling=[150,389,617][shelf],center=[230,512,794][slot%3];let bottom=y;for(const[index,item]of models.entries()){const width=200,height=width*item.height/item.width,top=bottom-height;if(top<ceiling)throw new Error('La pila no cabe en la balda.');layers.push({...item,left:center-width/2,top,width,height,z:10+shelf*10+index});bottom-=height*.3;}}
    return{layers,pages,page:current,totalModels:display.models.length};
  }
  function garmentMarkup(display,page=0){return displayPlan(display,page).layers.map(item=>`<img class="club-store-fold" data-store-model="${esc(item.id)}" src="${esc(item.src)}" alt="" draggable="false" decoding="async" style="${placement([item.left,item.top,item.width,item.height],1024,1024)};z-index:${item.z}">`).join('');}
  function paintDisplays(){const stage=document.getElementById('clubStoreStage');if(!stage||!manifest)return;for(const display of manifest.displays){const layer=manifest.layers.find(layer=>layer.id===display.layer);let host=stage.querySelector(`[data-store-display="${display.section}"]`);if(!host){host=document.createElement('span');host.className='club-store-display';host.dataset.storeDisplay=display.section;host.setAttribute('aria-hidden','true');stage.append(host);}host.style.cssText=placement(layer.rect,manifest.width,manifest.height)+`;z-index:${layer.z};`;host.innerHTML=garmentMarkup(display);}}
  function paint(){
    const stage=document.getElementById('clubStoreStage');if(!stage||!manifest)return;
    stage.style.aspectRatio=`${manifest.width}/${manifest.height}`;
    const layerArt=manifest.layers.map((layer,index)=>`<img class="club-store-layer" data-store-layer="${esc(layer.id)}" src="${esc(layer.src)}" style="${placement(layer.rect,manifest.width,manifest.height)};z-index:${layer.z};--store-layer-delay:${Math.min(index,5)*35}ms" width="${layer.rect[2]}" height="${layer.rect[3]}" alt="" decoding="async" draggable="false">`).join('');
    const furniture=manifest.hotspots.map(point=>{const r=point.rect,p=point.labelPoint||[r[0]+r[2]/2,r[1]+r[3]-.08*manifest.height];return `<button type="button" class="club-store-furniture" data-store-department="${point.section}" data-store-target="${esc(point.layer||'')}" style="${placement(r,manifest.width,manifest.height)}" aria-label="Abrir ${esc(point.label)}"><span class="club-store-label" style="left:${(p[0]-r[0])/r[2]*100}%;top:${(p[1]-r[1])/r[3]*100}%">${esc(point.section==='accessories'?'Objetos':point.label)}</span></button>`;}).join('');
    stage.classList.remove('has-poster-fallback');stage.style.removeProperty('background-image');stage.innerHTML=layerArt+furniture;paintDisplays();const fallback=()=>{if(manifest.poster){stage.style.backgroundImage=`url("${manifest.poster}")`;stage.classList.add('has-poster-fallback');}};stage.querySelectorAll('img').forEach(img=>{img.addEventListener('error',fallback,{once:true});if(img.complete&&!img.naturalWidth)fallback();});stage.classList.add('is-ready');stage.removeAttribute('aria-busy');globalThis.StoreSky?.mount(stage);
  }
  async function load(){
    if(manifest){if(!document.querySelector('#clubStoreStage .club-store-layer'))paint();return;}if(pending)return pending;
    const status=document.getElementById('clubStoreSceneStatus'),stage=document.getElementById('clubStoreStage');stage?.setAttribute('aria-busy','true');if(status)status.textContent='Abriendo la tienda…';
    pending=fetch('icons/shop/club-store-v1/manifest.json?v=20261109-clothing-shelves-v2',{credentials:'same-origin'}).then(response=>{if(!response.ok)throw new Error('No se pudo abrir la tienda.');return response.json();}).then(data=>{manifest=validate(data);paint();if(status)status.textContent='';}).catch(error=>{stage?.removeAttribute('aria-busy');if(status){status.textContent=error.message+' ';const retry=document.createElement('button');retry.type='button';retry.dataset.storeRetry='';retry.textContent='Reintentar';status.append(retry);}}).finally(()=>{pending=null;});
    return pending;
  }
  function showHome({focus=false}={}){
    const shop=dialog();if(!shop)return;section=null;routeVersion++;restoreClothing();shop.dataset.storeView='scene';
    document.getElementById('clubStoreScene').hidden=false;shop.querySelector('.shop-content').hidden=true;
    const back=document.getElementById('clubStoreBack');if(back)back.hidden=true;document.getElementById('bannerShopTitle').textContent='Tienda';
    void load();if(!focus){const title=document.getElementById('bannerShopTitle');title.tabIndex=-1;title.focus({preventScroll:true});}if(focus)(lastFurniture?.isConnected?lastFurniture:shop.querySelector('[data-store-department]'))?.focus({preventScroll:true});
  }
  function restoreClothing(){const preview=document.getElementById('clubStoreClothingPreview');if(preview)preview.hidden=true;for(const id of ['clothingShopItems','clothingShopStatus']){const node=document.getElementById(id);if(node)node.hidden=false;}}
  function previewClothing(id,{loading=false}={}){const panel=document.getElementById('shopClothingPanel');if(!panel)return;let preview=document.getElementById('clubStoreClothingPreview');if(!preview){preview=document.createElement('section');preview.id='clubStoreClothingPreview';preview.className='club-store-clothing-preview';panel.append(preview);}const display=manifest?.displays.find(display=>display.section===id),layer=display&&manifest.layers.find(layer=>layer.id===display.layer);for(const name of ['clothingShopItems','clothingShopStatus']){const node=document.getElementById(name);if(node)node.hidden=true;}preview.hidden=false;preview.innerHTML=loading?'<p role="status">Consultando las prendas disponibles…</p>':`<p>${id==='shirts'?'Camisetas en preparación. La compra y el equipamiento se activarán cuando estén disponibles.':'Todavía no hay prendas disponibles en esta categoría.'}</p>${display&&layer?`<div class="club-store-catalogue-cabinet" aria-hidden="true"><img class="club-store-cabinet-art" src="${esc(layer.src)}" alt="" draggable="false">${garmentMarkup(display)}</div><ul class="club-store-design-names">${display.models.map(item=>`<li>${esc(item.name)}</li>`).join('')}</ul>`:''}`;}
  function chooseClothing(id,token){const target=departments[id],select=()=>{if(section!==id||token!==routeVersion)return;const button=document.querySelector(`#clothingShopItems [data-fitting-slot="${target.slot}"]`);if(button){button.click();restoreClothing();}else if(target.slot==='outerwear'&&!document.querySelector('#clothingShopItems [data-fitting-slot]'))restoreClothing();else previewClothing(id);};previewClothing(id,{loading:true});const existing=document.querySelector(`#clothingShopItems [data-fitting-slot="${target.slot}"]`);if(existing){existing.click();restoreClothing();}void Promise.resolve(globalThis.ChotaShop?.refresh()).then(select,select);}
  function openDepartment(id,{fromTab=false}={}){
    const target=departments[id],shop=dialog();if(!target||!shop)return;
    section=id;const token=++routeVersion;restoreClothing();shop.dataset.storeView=target.tab==='clothing'?'clothing':id;document.getElementById('clubStoreScene').hidden=true;shop.querySelector('.shop-content').hidden=false;
    document.getElementById('clubStoreBack').hidden=false;document.getElementById('bannerShopTitle').textContent=target.title;
    if(!fromTab){routing=true;document.querySelector(`[data-shop-tab="${target.tab}"]`)?.click();routing=false;}
    if(id==='accessories')globalThis.ChotaShop?.selectRoomTab('objetos');
    if(target.slot)chooseClothing(id,token);else if(id==='accessories')void globalThis.ChotaShop?.refresh();
    shop.querySelector('.shop-content').scrollTop=0;
    const panel=document.getElementById({banners:'shopBannersPanel',vouchers:'shopVouchersPanel',accessories:'shopChotaPanel',clothing:'shopClothingPanel',pants:'shopClothingPanel',shirts:'shopClothingPanel'}[id]);
    const heading=panel?.querySelector('h3');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
  }
  function syncSceneStatus(){const status=document.getElementById('clubStoreSceneStatus');if(!status||section||!manifest)return;status.textContent=navigator.onLine===false?'Sin conexión. Las compras volverán a estar disponibles al conectar.':document.getElementById('bannerShopStatus')?.classList.contains('is-error')?document.getElementById('bannerShopStatus').textContent:'';}
  function initialize(){
    if(initialized||!dialog())return;initialized=true;dialog().classList.add('club-store');
    document.addEventListener('click',event=>{
      if(event.target.closest('[data-banner-shop]')){showHome();void Promise.allSettled([globalThis.BannerShop?.refresh(),globalThis.ChotaShop?.refresh()]).then(syncSceneStatus);return;}
      const furniture=event.target.closest('[data-store-department]');if(furniture){lastFurniture=furniture;openDepartment(furniture.dataset.storeDepartment);return;}
      if(event.target.closest('#clubStoreBack')){showHome({focus:true});return;}
      if(event.target.closest('[data-store-retry]')){void load();return;}
      const tab=event.target.closest('[data-shop-tab]');if(tab&&!routing){const id=Object.keys(departments).find(id=>departments[id].tab===tab.dataset.shopTab);if(id)openDepartment(id,{fromTab:true});}
    });
    dialog().addEventListener('cancel',event=>{if(section){event.preventDefault();event.stopImmediatePropagation();showHome({focus:true});}},true);
    dialog().addEventListener('close',()=>{section=null;routeVersion++;restoreClothing();});
    document.addEventListener('pointerdown',event=>{const button=event.target.closest('[data-store-target]');if(!button)return;dialog().querySelector(`[data-store-layer="${button.dataset.storeTarget}"]`)?.classList.add('is-pressed');});
    const release=()=>dialog()?.querySelectorAll('.club-store-layer.is-pressed').forEach(layer=>layer.classList.remove('is-pressed'));
    document.addEventListener('pointerup',release,{passive:true});document.addEventListener('pointercancel',release,{passive:true});
    window.addEventListener('online',syncSceneStatus);window.addEventListener('offline',syncSceneStatus);
  }
  globalThis.ClubStore=Object.freeze({initialize,openDepartment,showHome,validate,displayPlan});
})();
