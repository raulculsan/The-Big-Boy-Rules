/* Declarative shop artwork: trusted Storage files and bounded visual values only. */
(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let base = '';
  function configure(origin) {
    try { const url=new URL(origin || globalThis.BIG_BOY_CONFIG?.supabaseUrl);base=url.protocol==='https:'&&!url.username&&!url.password?`${url.origin}/storage/v1/object/public/shop-media/`:''; } catch {base='';}
  }
  configure();
  const path = (value,folder,video=false) => typeof value==='string' && value.length<=240 && value.startsWith(`${folder}/`) && !value.split('/').some(part=>!part || part==='.' || part==='..') && /^[a-zA-Z0-9/_-]+\.(png|jpe?g|webp|gif|avif|svg|mp4|webm)$/i.test(value) && (video?/\.(mp4|webm)$/i:/\.(png|jpe?g|webp|gif|avif|svg)$/i).test(value) ? value : null;
  const number = (value,min,max) => typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
  const color = value => typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
  function presentation(item,kind='banner') {
    const p=item?.presentation;
    if(!p || typeof p!=='object' || Array.isArray(p))return null;
    if(kind==='chota'&&p.type==='room_style') {
      if(!p.colors || !['wall','floor','rug'].every(key=>color(p.colors[key])))return null;
      return {type:'room_style',colors:{wall:p.colors.wall,floor:p.colors.floor,rug:p.colors.rug}};
    }
    const video=kind==='banner'&&p.type==='video';
    if((kind==='banner'&&!['image','video'].includes(p.type)) || (kind==='chota'&&p.type!=='decoration'))return null;
    const folder=kind==='banner'?'banners':'chota',file=path(p.path,folder,video),poster=path(p.poster_path,folder);
    if(!file || ((video||p.animated===true)&&!poster) || !number(p.width,1,8192)||!number(p.height,1,8192))return null;
    const result={type:p.type,path:file,width:p.width,height:p.height,animated:p.animated===true};
    if(poster)result.poster_path=poster;
    if(kind==='chota') {
      const t=p.placement;
      if(!t || !number(t.x,0,100)||!number(t.y,0,100)||!number(t.width,1,100)||!number(t.rotation??0,-180,180)||!number(t.z??0,0,10))return null;
      result.placement={x:t.x,y:t.y,width:t.width,rotation:t.rotation??0,z:t.z??0};
      result.motion=['sway','float','spin'].includes(p.motion)?p.motion:'none';
    }
    return result;
  }
  const url = file => base ? base+file.split('/').map(encodeURIComponent).join('/') : '';
  function banner(item,extra='',posterOnly=false,priority=false) {
    const p=presentation(item);if(!p||!base)return '';
    const poster=p.poster_path||p.path,src=url(posterOnly?poster:p.path);
    const image=`<img data-shop-media src="${escape(p.type==='video'?url(poster):src)}" width="${p.width}" height="${p.height}" alt="" loading="${posterOnly&&extra.includes('member-banner-art')&&!priority?'lazy':'eager'}" decoding="async"${p.poster_path?` data-shop-fallback="${escape(url(p.poster_path))}"`:''}>`;
    const video=p.type==='video'&&!posterOnly?`<video data-banner-src="${escape(src)}" poster="${escape(url(poster))}" width="${p.width}" height="${p.height}" autoplay muted loop playsinline preload="none" disablepictureinpicture disableremoteplayback tabindex="-1" aria-hidden="true"></video>`:'';
    return `<div class="banner-art banner-remote ${escape(extra)}" role="img" aria-label="${escape(item.name || 'Banner de perfil')}"><span class="shop-media-fallback" aria-hidden="true">BB</span>${image}${video}</div>`;
  }
  function decoration(item,inRoom=false) {
    const p=presentation(item,'chota');if(p?.type!=='decoration'||!base)return '';
    return `<span class="chota-remote-motion" data-chota-motion="${inRoom?p.motion:'none'}"><img data-shop-media src="${escape(url(p.path))}" width="${p.width}" height="${p.height}" alt="" loading="${inRoom?'eager':'lazy'}" decoding="async" draggable="false"></span>`;
  }
  const styleVariables = p => p?.type==='room_style'?`--room-wall:${p.colors.wall};--room-floor:${p.colors.floor};--room-rug:${p.colors.rug}`:'';
  const placement = p => p?.type==='decoration'?`left:${p.placement.x}%;top:${p.placement.y}%;width:${p.placement.width}%;z-index:${p.placement.z};transform:rotate(${p.placement.rotation}deg)`:'';
  document.addEventListener('error',event=>{
    const image=event.target;
    if(!image.matches?.('img[data-shop-media]'))return;
    if(image.dataset.shopFallback&&!image.dataset.shopFallbackTried&&image.src!==image.dataset.shopFallback) {image.dataset.shopFallbackTried='true';image.src=image.dataset.shopFallback;}
    else image.hidden=true;
  },true);
  globalThis.ShopCatalogMedia=Object.freeze({configure,presentation,banner,decoration,styleVariables,placement});
})();
