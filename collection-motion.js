/* Touch transforms stay on the compositor; Lottie supplies scrubbed foil and pack opening.
   Preview only: this module cannot debit packs or award cards. */
(() => {
  const cache=new Map();
  function data(name) {
    if(!cache.has(name)) {
      const abort=new AbortController(), timer=setTimeout(()=>abort.abort(),8000);
      const version=name==='pack-opening'?'20260904-150':name==='card-touch-special'?'20261012-272':name==='card-touch-retro'?'20261007-163':name==='card-touch-epic'?'20261007-168':'20260905-153';
      cache.set(name,fetch(`icons/cards/${name}.json?v=${version}`,{signal:abort.signal})
        .then(r=>{if(!r.ok) throw Error('Animation unavailable');return r.json();})
        .catch(e=>{cache.delete(name);throw e;}).finally(()=>clearTimeout(timer)));
    }
    return cache.get(name);
  }
  function animation(host,name,onReady,onFailure=()=>{}) {
    let dead=false, player, timer;
    const fail=()=>{if(dead)return; dead=true;clearTimeout(timer);player?.destroy();host.replaceChildren();onFailure();};
    timer=setTimeout(fail,10000);
    Promise.all([globalThis.TrophyMotion.loadPlayer(),data(name)]).then(([lottie,json])=>{
      if(dead)return;
      player=lottie.loadAnimation({container:host,renderer:'svg',loop:false,autoplay:false,
        animationData:JSON.parse(JSON.stringify(json)),assetsPath:'icons/cards/',rendererSettings:{preserveAspectRatio:'xMidYMid meet'}});
      player.addEventListener('DOMLoaded',()=>{if(dead)return;clearTimeout(timer);onReady(player);});
      player.addEventListener('data_failed',fail);player.addEventListener('error',fail);
    }).catch(fail);
    return ()=>{dead=true;clearTimeout(timer);player?.destroy();host.replaceChildren();};
  }
  // A separate foil surface: animation never translates or rotates the card itself.
  function attachFullArtFoil(surface, foil, edition='Full Art') {
    const viceCity=edition==='Vice City';
    const motion=(globalThis.ClubMotion?.media || window.matchMedia?.('(prefers-reduced-motion: reduce)'));
    let dead=false;
    foil.classList.add('full-art-foil');
    foil.classList.toggle('vice-city-foil',viceCity);
    const glints=viceCity
      ? Array.from({length:18},(_,i)=>({x:i%2?94:6,y:7+Math.floor(i/2)*10}))
      : Array.from({length:16},(_,i)=>({x:8+(i*37)%84,y:6+(i*23)%88}));
    foil.innerHTML='<span class="full-art-spectrum"></span><span class="full-art-sheen"></span>'+(viceCity?'<span class="vice-city-streaks"></span>':'')+'<span class="full-art-sparkles">'+glints.map((p,i)=>`<i style="--sx:${p.x}%;--sy:${p.y}%;--delay:${-(i*.47)}s"></i>`).join('')+'</span>';
    const configure=()=>{foil.classList.toggle('is-paused',document.hidden||!!motion?.matches);};
    const move=event=>{
      if(dead||document.hidden||motion?.matches)return;
      const rect=surface.getBoundingClientRect();if(!rect.width||!rect.height)return;
      foil.style.setProperty('--foil-x',`${Math.max(0,Math.min(100,(event.clientX-rect.left)/rect.width*100))}%`);
      foil.style.setProperty('--foil-y',`${Math.max(0,Math.min(100,(event.clientY-rect.top)/rect.height*100))}%`);
    };
    const reset=()=>{foil.style.removeProperty('--foil-x');foil.style.removeProperty('--foil-y');};
    surface.addEventListener('pointermove',move);surface.addEventListener('pointerleave',reset);
    surface.addEventListener('pointerup',reset);surface.addEventListener('pointercancel',reset);
    document.addEventListener('visibilitychange',configure);motion?.addEventListener('change',configure);configure();
    return ()=>{dead=true;surface.removeEventListener('pointermove',move);surface.removeEventListener('pointerleave',reset);
      surface.removeEventListener('pointerup',reset);surface.removeEventListener('pointercancel',reset);
      document.removeEventListener('visibilitychange',configure);motion?.removeEventListener('change',configure);
      reset();foil.classList.remove('full-art-foil','vice-city-foil','is-paused');foil.replaceChildren();};
  }
  const attachViceCityFoil=(surface,foil)=>attachFullArtFoil(surface,foil,'Vice City');
  function attachCard(surface,foil,onFlip,edition='Común') {
    // Choose from the edition, never the score or member/location category.
    const fullArt=edition==='Full Art'||edition==='Vice City', foilParent=foil.parentNode, foilNext=foil.nextSibling;
    if(fullArt)surface.querySelector('.collection-card-stage')?.append(foil);
    const effect=edition==='Retro'?'card-touch-retro':edition==='Legendaria'?'card-touch-legendary':edition==='Épica'?'card-touch-epic':edition==='Especial'?'card-touch-special':'card-touch';
    const motion=(globalThis.ClubMotion?.media || window.matchMedia?.('(prefers-reduced-motion: reduce)'));
    let pointer=null, origin, bounds, dx=0,dy=0, frame=0, player, dispose,dead=false;
    const clamp=n=>Math.max(-1,Math.min(1,n));
    function paint() {
      frame=0;
      if(dead||motion?.matches)return;
      surface.style.transform=`rotateX(${-clamp(dy/(bounds.height/2))*14}deg) rotateY(${clamp(dx/(bounds.width/2))*20}deg)`;
      player?.goToAndStop(Math.round(30+clamp(dx/(bounds.width/2))*25),true);
      // A tap/rest must never reveal the neutral Lottie frame. Reveal gradually
      // with deliberate movement, including vertical tilt, only once ready.
      if(!fullArt)foil.style.opacity=String(player?Math.max(0,Math.min(1,(Math.hypot(dx,dy)-3)/24)):0);
    }
    function reset() {
      const old=pointer;pointer=null;
      if(frame)cancelAnimationFrame(frame);frame=0;
      if(old!==null&&surface.hasPointerCapture?.(old))surface.releasePointerCapture(old);
      surface.classList.remove('is-dragging');surface.style.transform='';
      // Fade the last reflected position rather than jumping to the centre.
      if(!fullArt)foil.style.opacity='0';dx=dy=0;
    }
    function down(e) {
      if(pointer!==null||e.isPrimary===false||(e.button!==undefined&&e.button!==0))return;
      bounds=surface.getBoundingClientRect(); if(!bounds.width||!bounds.height)return;
      pointer=e.pointerId;origin={x:e.clientX,y:e.clientY};dx=dy=0;
      surface.setPointerCapture?.(pointer);surface.classList.add('is-dragging');
    }
    function move(e) {
      if(e.pointerId!==pointer)return;
      dx=e.clientX-origin.x;dy=e.clientY-origin.y;
      if(!frame&&!motion?.matches)frame=requestAnimationFrame(paint);
    }
    function up(e) {
      if(e.pointerId!==pointer)return;
      dx=e.clientX-origin.x;dy=e.clientY-origin.y;
      const flip=Math.abs(dx)>Math.max(48,bounds.width*.28)&&Math.abs(dx)>Math.abs(dy)*1.2;
      reset();if(flip)onFlip();
    }
    const cancel=e=>{if(e.pointerId===pointer)reset();};
    const keyboard=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();reset();onFlip();}};
    function configure() {
      reset();dispose?.();dispose=null;player=null;
      if(fullArt){foil.style.removeProperty('opacity');dispose=attachFullArtFoil(surface,foil,edition);return;}
      if(!motion?.matches&&!document.hidden)dispose=animation(foil,effect,a=>{
        player=a;a.goToAndStop(30,true);
        if(pointer!==null&&!frame)frame=requestAnimationFrame(paint);
      });
    }
    const visibility=()=>{if(document.hidden){reset();dispose?.();dispose=null;player=null;}else configure();};
    const listeners={pointerdown:down,pointermove:move,pointerup:up,pointercancel:cancel,lostpointercapture:cancel,keydown:keyboard};
    Object.entries(listeners).forEach(([name,fn])=>surface.addEventListener(name,fn));
    motion?.addEventListener('change',configure);document.addEventListener('visibilitychange',visibility);configure();
    return ()=>{dead=true;reset();dispose?.();Object.entries(listeners).forEach(([name,fn])=>surface.removeEventListener(name,fn));
      motion?.removeEventListener('change',configure);document.removeEventListener('visibilitychange',visibility);
      if(fullArt){foilParent.insertBefore(foil,foilNext);foil.style.opacity='0';}};
  }
  const dialog=document.getElementById('packPreviewDialog'),button=document.getElementById('packPreviewButton');
  let stop, packPlayer,returnFocus;
  if(dialog&&button) {
    const host=document.getElementById('packPreviewMotion'),status=document.getElementById('packPreviewStatus');
    const replay=document.getElementById('packPreviewReplay'),motion=(globalThis.ClubMotion?.media || window.matchMedia?.('(prefers-reduced-motion: reduce)'));
    function clear(){stop?.();stop=null;packPlayer=null;dialog.dataset.motionState='static';}
    function play() {
      clear();status.textContent='Preparando la apertura…';replay.disabled=true;
      if(motion?.matches){status.textContent='Vista estática: tienes activado reducir movimiento.';replay.disabled=false;return;}
      dialog.dataset.motionState='loading';
      stop=animation(host,'pack-opening',a=>{
        packPlayer=a;dialog.dataset.motionState='playing';status.textContent='Abriendo el sobre de muestra…';
        a.addEventListener('complete',()=>{if(packPlayer!==a)return;dialog.dataset.motionState='ready';
          status.textContent='Vista previa terminada. No se ha gastado ningún sobre ni asignado cartas.';replay.disabled=false;});
        a.goToAndPlay(0,true);
      },()=>{dialog.dataset.motionState='static';status.textContent='No se pudo cargar la animación. Puedes reintentarlo.';replay.disabled=false;});
    }
    button.addEventListener('click',()=>{if(dialog.open)return;returnFocus=button;dialog.showModal();
      document.body.classList.add('pack-preview-open');document.getElementById('packPreviewClose').focus({preventScroll:true});play();});
    document.getElementById('packPreviewClose').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
    dialog.addEventListener('close',()=>{clear();document.body.classList.remove('pack-preview-open');returnFocus?.focus({preventScroll:true});returnFocus=null;});
    replay.addEventListener('click',()=>{if(dialog.open)play();});
    motion?.addEventListener('change',()=>{if(dialog.open)play();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open)dialog.close();});
    window.addEventListener('hashchange',()=>{if(dialog.open)dialog.close();});
  }
  // One-shot rarity reveal. A separate lifecycle keeps navigation independent of VFX.
  const packRevealDurations={common:650,retro:1000,special:1200,epic:1450,legendary:1750,full_art:2000,vice_city:2400};
  function playPackReveal(stage,edition,{peak=false}={}) {
    if(!stage||(globalThis.ClubMotion?.media || window.matchMedia?.('(prefers-reduced-motion: reduce)')).matches)return ()=>{};
    const rarity=Object.hasOwn(packRevealDurations,edition)?edition:'common';
    const host=document.createElement('span');host.className=`pack-rarity-vfx pack-rarity-${rarity}`;
    host.setAttribute('aria-hidden','true');host.dataset.rarity=rarity;
    host.style.setProperty('--reveal-duration',`${packRevealDurations[rarity]}ms`);
    const particle=(kind,count)=>Array.from({length:count},(_,i)=>`<i class="${kind}" style="--i:${i};--angle:${i*360/count}deg;--x:${i%2?94:6}%;--y:${10+(i*29)%80}%;--delay:${i*13}ms"></i>`).join('');
    const scenes={
      common:'<i class="reveal-warm-halo"></i><i class="reveal-warm-glint"></i>',
      retro:'<i class="reveal-film-frame"></i><i class="reveal-film-scan"></i>'+particle('reveal-film-dust',10),
      special:'<i class="reveal-orbit reveal-orbit-a"></i><i class="reveal-orbit reveal-orbit-b"></i>'+particle('reveal-orbit-star',4),
      epic:'<i class="reveal-shockwave"></i><i class="reveal-shockwave reveal-shockwave-echo"></i>'+particle('reveal-crystal',12),
      legendary:'<i class="reveal-sunburst"></i><i class="reveal-gold-ring"></i>'+particle('reveal-gold-spark',20),
      full_art:'<i class="reveal-prism-a"></i><i class="reveal-prism-b"></i><i class="reveal-prism-c"></i>'+particle('reveal-prism-star',16),
      vice_city:'<i class="reveal-neon-sun"></i><i class="reveal-neon-grid"></i><i class="reveal-neon-horizon"></i><i class="reveal-neon-pulse"></i>'+particle('reveal-neon-streak',18)
    };
    host.innerHTML=scenes[rarity];stage.prepend(host);
    let timer,dead=false;
    const motion=(globalThis.ClubMotion?.media || window.matchMedia?.('(prefers-reduced-motion: reduce)'));
    const stop=()=>{if(dead)return;dead=true;clearTimeout(timer);host.getAnimations?.({subtree:true}).forEach(a=>a.cancel());host.remove();motion?.removeEventListener('change',changed);document.removeEventListener('visibilitychange',hidden);};
    const changed=event=>{if(event.matches)stop();};
    const hidden=()=>{if(document.hidden)stop();};
    motion?.addEventListener('change',changed);document.addEventListener('visibilitychange',hidden);
    if(peak){host.classList.add('is-peak');host.style.setProperty('--reveal-delay',`${-packRevealDurations[rarity]*.26}ms`);}
    else timer=setTimeout(stop,280+packRevealDurations[rarity]+260);
    return stop;
  }
  // One timing contract for direct gestures and their CSS counterparts.
  const timings = Object.freeze({flip:420, opening:720, advance:200, page:480, settle:140, discard:480, reward:620});
  for (const [name, duration] of Object.entries(timings)) document.documentElement.style.setProperty(`--collection-${name}-duration`, `${duration}ms`);
  globalThis.CollectionMotion=Object.freeze({timings,playPackReveal,attachCard,attachFullArtFoil,attachViceCityFoil,close(){if(dialog?.open)dialog.close();}});
})();
