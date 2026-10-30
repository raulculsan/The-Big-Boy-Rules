/* Keep the original account actions and listeners; only their presentation moves. */
(() => {
  'use strict';
  let active=null;
  const reduced=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function close({immediate=false,restoreFocus=true}={}){
    const state=active;if(!state)return Promise.resolve();
    if(state.closing){if(immediate)state.finish?.();return state.closed;}
    state.closing=true;if(state.frame)cancelAnimationFrame(state.frame);state.trigger?.setAttribute('aria-expanded','false');
    document.body.classList.remove('profile-account-sheet-open');
    state.dialog.classList.remove('is-visible');
    let resolved;state.closed=new Promise(resolve=>{resolved=resolve;});
    const finish=()=>{
      if(state.finished)return;state.finished=true;clearTimeout(state.timer);
      if(state.marker.parentNode)state.marker.replaceWith(state.menu);
      state.menu.className=state.originalClass;
      state.menu.hidden=state.originalHidden;
      if(state.originalAria===null)state.menu.removeAttribute('aria-hidden');else state.menu.setAttribute('aria-hidden',state.originalAria);
      state.dialog.close();state.dialog.remove();
      if(active===state)active=null;
      if(restoreFocus&&document.documentElement.dataset.inputModality!=='pointer'&&state.trigger?.isConnected&&!document.querySelector('dialog[open]'))state.trigger.focus({preventScroll:true});
      resolved();
    };
    state.finish=finish;
    if(immediate||reduced())finish();else state.timer=setTimeout(finish,280);
    return state.closed;
  }
  function open({menu,user,trigger}={}){
    if(!menu?.parentNode)return;
    if(active&&!active.closing)return;
    if(active){void active.closed.then(()=>open({menu,user,trigger}));return;}
    const marker=document.createComment('profile-account-menu');menu.before(marker);
    const dialog=document.createElement('dialog');dialog.className='profile-account-sheet';dialog.dataset.motionOwner='profile-account-sheet';dialog.tabIndex=-1;dialog.autofocus=true;dialog.setAttribute('aria-labelledby','profileAccountSheetTitle');
    dialog.innerHTML='<section class="profile-account-sheet-panel"><header class="profile-account-sheet-heading"><button type="button" class="profile-account-sheet-handle" data-profile-sheet-close aria-label="Cerrar opciones de la cuenta"><span></span></button><div class="profile-account-sheet-account"><span class="profile-account-sheet-initial" aria-hidden="true"></span><div><small>The Big Boy Rules</small><h2 id="profileAccountSheetTitle">Tu cuenta</h2></div><button type="button" data-profile-sheet-close class="profile-account-sheet-close" aria-label="Cerrar opciones">×</button></div></header><div class="profile-account-sheet-content"></div></section>';
    const state={menu,marker,dialog,trigger,originalClass:menu.className,originalHidden:menu.hidden,originalAria:menu.getAttribute('aria-hidden'),closing:false,closed:null,frame:0,timer:0,finished:false};active=state;
    const name=String(user?.name||user?.user_metadata?.name||user?.username||'Tu cuenta');
    dialog.querySelector('h2').textContent=name;
    dialog.querySelector('.profile-account-sheet-initial').textContent=name.slice(0,1).toLocaleUpperCase('es');
    menu.classList.add('profile-account-sheet-actions');menu.hidden=false;menu.setAttribute('aria-hidden','false');
    dialog.querySelector('.profile-account-sheet-content').append(menu);
    document.body.append(dialog);document.body.classList.add('profile-account-sheet-open');trigger?.setAttribute('aria-expanded','true');
    dialog.showModal();
    // Let the hidden clip paint before revealing. This surface owns its motion;
    // the shared dialog animator must never translate or scale its outer shell.
    const reveal=()=>{if(active===state&&!state.closing){state.frame=0;dialog.classList.add('is-visible');}};
    if(reduced())reveal();else state.frame=requestAnimationFrame(()=>{if(active===state&&!state.closing)state.frame=requestAnimationFrame(reveal);});
    dialog.addEventListener('cancel',e=>{e.preventDefault();void close();});
    dialog.addEventListener('click',e=>{
      if(e.target===dialog||e.target.closest('[data-profile-sheet-close]'))void close();
      // Let the existing action handler run before restoring the original menu.
      else if(e.target.closest('.profile-account-sheet-actions button'))queueMicrotask(()=>void close({restoreFocus:false}));
    });
    const header=dialog.querySelector('.profile-account-sheet-heading'),panel=dialog.querySelector('.profile-account-sheet-panel');
    let gesture=null;
    header.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('.profile-account-sheet-close'))return;gesture={id:e.pointerId,y:e.clientY,t:performance.now(),distance:0};header.setPointerCapture?.(e.pointerId);});
    header.addEventListener('pointermove',e=>{if(!gesture||gesture.id!==e.pointerId)return;gesture.distance=Math.max(0,e.clientY-gesture.y);panel.style.setProperty('--profile-sheet-drag',`${gesture.distance}px`);});
    const release=e=>{if(!gesture||gesture.id!==e.pointerId)return;const {distance,t}=gesture;gesture=null;if(distance>100||(distance>25&&distance/Math.max(1,performance.now()-t)>.55))void close();else panel.style.removeProperty('--profile-sheet-drag');};
    header.addEventListener('pointerup',release);header.addEventListener('pointercancel',()=>{gesture=null;panel.style.removeProperty('--profile-sheet-drag');});
  }
  globalThis.ProfileAccountSheet=Object.freeze({open,close});
})();
