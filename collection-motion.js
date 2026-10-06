/* Touch transforms stay on the compositor; Lottie supplies scrubbed foil and pack opening.
   Preview only: this module cannot debit packs or award cards. */
(() => {
  const cache=new Map();
  function data(name) {
    if(!cache.has(name)) {
      const abort=new AbortController(), timer=setTimeout(()=>abort.abort(),8000);
      const version=name==='pack-opening'?'20260904-150':name==='card-touch-retro'?'20261007-163':'20260905-153';
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
  function attachCard(surface,foil,onFlip,edition='Común') {
    // Choose from the edition, never the score or member/location category.
    const effect=edition==='Retro'?'card-touch-retro':edition==='Legendaria'?'card-touch-legendary':edition==='Especial'?'card-touch-special':'card-touch';
    const motion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let pointer=null, origin, bounds, dx=0,dy=0, frame=0, player, dispose,dead=false;
    const clamp=n=>Math.max(-1,Math.min(1,n));
    function paint() {
      frame=0;
      if(dead||motion?.matches)return;
      surface.style.transform=`rotateX(${-clamp(dy/(bounds.height/2))*14}deg) rotateY(${clamp(dx/(bounds.width/2))*20}deg)`;
      player?.goToAndStop(Math.round(30+clamp(dx/(bounds.width/2))*25),true);
      // A tap/rest must never reveal the neutral Lottie frame. Reveal gradually
      // with deliberate movement, including vertical tilt, only once ready.
      foil.style.opacity=String(player?Math.max(0,Math.min(1,(Math.hypot(dx,dy)-3)/24)):0);
    }
    function reset() {
      const old=pointer;pointer=null;
      if(frame)cancelAnimationFrame(frame);frame=0;
      if(old!==null&&surface.hasPointerCapture?.(old))surface.releasePointerCapture(old);
      surface.classList.remove('is-dragging');surface.style.transform='';
      // Fade the last reflected position rather than jumping to the centre.
      foil.style.opacity='0';dx=dy=0;
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
      motion?.removeEventListener('change',configure);document.removeEventListener('visibilitychange',visibility);};
  }
  const dialog=document.getElementById('packPreviewDialog'),button=document.getElementById('packPreviewButton');
  let stop, packPlayer,returnFocus;
  if(dialog&&button) {
    const host=document.getElementById('packPreviewMotion'),status=document.getElementById('packPreviewStatus');
    const replay=document.getElementById('packPreviewReplay'),motion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
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
  globalThis.CollectionMotion=Object.freeze({attachCard,close(){if(dialog?.open)dialog.close();}});
})();
