/* One quiet exterior world, shared by the room and its enlarged view. */
(() => {
  'use strict';
  function createClubOutdoor({doc=document, random=Math.random, now=()=>performance.now(), setTimer=setTimeout, clearTimer=clearTimeout, Observer=globalThis.IntersectionObserver, motion=globalThis.ClubMotion?.media || matchMedia('(prefers-reduced-motion: reduce)')}={}) {
    const rooms=new Map();
    let observer=null, startTimer=0, finishTimer=0, event=null, nextAt=0, lastPatrol=-Infinity;
    const reduced=()=>motion.matches || doc.documentElement.dataset.reducedMotion==='true';
    const night=room=>room.dataset.time==='night';
    function clearRoom(state) {
      for(const animation of state.animations)animation.cancel();
      state.animations=[];state.sky?.replaceChildren();state.patrol?.remove();state.patrol=null;state.eventId=null;
    }
    function remove(room) {
      const state=rooms.get(room);if(!state)return;
      clearRoom(state);state.sky?.remove();observer?.unobserve(room);rooms.delete(room);
    }
    function visibleRooms() {
      for(const room of [...rooms.keys()])if(!room.isConnected)remove(room);
      const visible=[...rooms.entries()].filter(([,state])=>state.visible);
      const viewer=visible.filter(([room])=>room.classList.contains('chota-viewer-room-scene') && room.closest('dialog[open]'));
      return viewer.length ? viewer : visible;
    }
    function allowed() {return !doc.hidden && !reduced();}
    function cancelTimers() {clearTimer(startTimer);clearTimer(finishTimer);startTimer=finishTimer=0;}
    function suspend() {
      cancelTimers();event=null;nextAt=0;
      for(const state of rooms.values())clearRoom(state);
    }
    function animate(node,frames,options,state,elapsed) {
      if(!node.animate)return;
      const animation=node.animate(frames,{fill:'both',easing:'linear',...options});
      animation.currentTime=elapsed;state.animations.push(animation);
    }
    function render(room,state) {
      if(state.eventId===event.id)return;
      clearRoom(state);state.eventId=event.id;
      const elapsed=Math.max(0,now()-event.started),duration=event.duration;
      if(event.kind==='patrol') {
        const glow=doc.createElement('span');glow.className='club-outdoor-patrol';glow.setAttribute('aria-hidden','true');
        glow.innerHTML='<i class="club-outdoor-patrol-red"></i><i class="club-outdoor-patrol-blue"></i>';
        room.append(glow);state.patrol=glow;
        // No hard strobe: broad overlapping light sweeps, then the car passes.
        animate(glow,[{opacity:0},{opacity:1,offset:.16},{opacity:1,offset:.78},{opacity:0}],{duration},state,elapsed);
        for(const [index,light] of [...glow.children].entries())animate(light,[{opacity:.03},{opacity:.7,offset:.25},{opacity:.08,offset:.5},{opacity:.6,offset:.75},{opacity:.03}],{duration:2600,iterations:3,delay:index*650,easing:'ease-in-out'},state,elapsed);
      } else {
        const flyer=doc.createElement('span');flyer.className=`club-outdoor-flyer club-outdoor-${event.kind}`;flyer.dataset.outdoorKind=event.kind;
        flyer.style.top=`${event.height}%`;flyer.style.setProperty('--outdoor-facing',event.direction);
        if(night(room))flyer.classList.add('is-night');
        flyer.innerHTML=event.kind==='bird' ? '<svg viewBox="0 0 32 20" aria-hidden="true"><path class="club-outdoor-bird-body" d="m12 11 7-2 4 2-5 3-7-1-5 2 3-4-3-2Z"/><g class="club-outdoor-wings-up"><path d="m15 11-3-9-4-2 1 8 5 5Zm2 0 6-9 5-1-3 8-7 4Z"/></g><g class="club-outdoor-wings-down"><path d="m15 10-5 5-3 4 6-1 5-6Zm2 0 5 6 6 2-3-6-7-4Z"/></g></svg>' : '<svg viewBox="0 0 64 25" aria-hidden="true"><path d="m4 13 20-2L36 2h6l-8 9 20 1 7 4-27 1-11 6h-6l7-7-12-1-6 3H3l3-5Z"/><circle class="club-outdoor-plane-light" cx="35" cy="15" r="1.4"/></svg>';
        state.sky.append(flyer);
        const from=event.direction===1 ? -140 : 665,to=event.direction===1 ? 665 : -140;
        animate(flyer,[{transform:`translate3d(${from}%,0,0)`,opacity:0},{opacity:1,offset:.1},{opacity:1,offset:.9},{transform:`translate3d(${to}%,-35%,0)`,opacity:0}],{duration},state,elapsed);
        if(event.kind==='bird') {
          for(const [index,wing] of [...flyer.querySelectorAll('g')].entries())animate(wing,[{opacity:index ? 0 : 1},{opacity:index ? 1 : 0,offset:.5},{opacity:index ? 0 : 1}],{duration:460,iterations:Infinity,easing:'steps(1,end)'},state,elapsed);
        } else if(night(room))animate(flyer.querySelector('circle'),[{opacity:.15},{opacity:1},{opacity:.15}],{duration:1500,iterations:Infinity,easing:'ease-in-out'},state,elapsed);
      }
    }
    function finish() {
      finishTimer=0;event=null;
      for(const state of rooms.values())clearRoom(state);
      nextAt=now()+55000+random()*60000;sync();
    }
    function start() {
      startTimer=0;const visible=visibleRooms();
      if(!allowed()||!visible.length){suspend();return;}
      const isNight=night(visible[0][0]);
      const patrolAllowed=isNight && now()-lastPatrol>=180000;
      const choice=random();
      const kind=isNight ? (patrolAllowed&&choice>.62 ? 'patrol' : 'plane') : choice<.72 ? 'bird' : 'plane';
      const duration=kind==='patrol' ? 6200 : kind==='bird' ? 7200+random()*1800 : 14500+random()*3000;
      event={kind,duration,started:now(),id:{},direction:random()<.5?1:-1,height:18+random()*39};
      if(kind==='patrol')lastPatrol=now();
      finishTimer=setTimer(finish,duration);sync();
    }
    function sync() {
      const visible=visibleRooms();
      if(!allowed()||!visible.length){suspend();return;}
      // A sunrise or a real change of view must not replay a night-only reflection.
      if(event && ((event.kind==='patrol' && !night(visible[0][0])) || (event.kind==='bird' && night(visible[0][0])))){clearTimer(finishTimer);finish();return;}
      if(event) {
        const shown=new Set(visible.map(([room])=>room));
        for(const [room,state] of rooms)if(!shown.has(room))clearRoom(state);
        for(const [room,state] of visible)render(room,state);
        return;
      }
      if(!startTimer){if(!nextAt)nextAt=now()+18000+random()*20000;startTimer=setTimer(start,Math.max(0,nextAt-now()));}
    }
    function mount(room) {
      if(!room?.isConnected || rooms.has(room))return;
      const sky=room.querySelector('.clubhouse-sky');if(!sky)return;
      const layer=doc.createElement('span');layer.className='club-outdoor-sky-events';layer.setAttribute('aria-hidden','true');sky.append(layer);
      rooms.set(room,{sky:layer,patrol:null,visible:false,animations:[],eventId:null});
      if(!observer&&Observer)observer=new Observer(entries=>{for(const entry of entries){const state=rooms.get(entry.target);if(state)state.visible=entry.isIntersecting&&entry.intersectionRatio!==0;}sync();},{threshold:.12});
      if(observer)observer.observe(room);else {rooms.get(room).visible=true;sync();}
    }
    function unmount(room) {remove(room);sync();}
    function reset() {
      suspend();for(const room of [...rooms.keys()])remove(room);observer?.disconnect();observer=null;lastPatrol=-Infinity;
    }
    doc.addEventListener('visibilitychange',sync);
    motion.addEventListener?.('change',sync);
    // App preference changes dispatch this even if the system preference is unchanged.
    doc.defaultView?.addEventListener('club:motion-change',sync);
    return {mount,unmount,sync,reset};
  }
  globalThis.ClubOutdoor=Object.freeze(createClubOutdoor());
})();
