import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source=readFileSync(new URL('../chota-outdoor.js',import.meta.url),'utf8');
function harness({phase='day',values=[0,.1,.5,.5,.5],fallback=.5}={}){
 const dom=new JSDOM('<body><div id="home" class="clubhouse-room"><div class="clubhouse-sky"></div></div><dialog open><div id="viewer" class="chota-viewer-room-scene"><div class="clubhouse-sky"></div></div></dialog></body>',{runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,doc=w.document,timers=new Map(),animations=[],listeners=new Set();let clock=0,id=0,observer,hidden=false;
 Object.defineProperty(doc,'hidden',{get:()=>hidden});
 w.HTMLElement.prototype.animate=function(frames,options){const animation={node:this,frames,options,currentTime:0,cancelled:false,cancel(){this.cancelled=true;}};animations.push(animation);return animation;};
 class Observer{constructor(callback){observer=this;this.callback=callback;this.disconnected=false;}observe(){}unobserve(){}disconnect(){this.disconnected=true;}}
 const motion={matches:false,addEventListener(type,callback){listeners.add(callback);}};
 const setTimer=(callback,delay)=>{timers.set(++id,{callback,at:clock+delay});return id;},clearTimer=id=>timers.delete(id);
 w.eval(source.replace('globalThis.ClubOutdoor=Object.freeze(createClubOutdoor());','globalThis.makeOutdoor=createClubOutdoor;'));
 const api=w.makeOutdoor({doc,random:()=>values.length?values.shift():fallback,now:()=>clock,setTimer,clearTimer,Observer,motion});
 const home=doc.getElementById('home'),viewer=doc.getElementById('viewer');home.dataset.time=viewer.dataset.time=phase;
 const kind=room=>room.querySelector('.club-outdoor-patrol')?'patrol':room.querySelector('[data-outdoor-kind]')?.dataset.outdoorKind||null;
 function advance(ms){const end=clock+ms;let guard=0;while(true){const next=[...timers.entries()].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;assert.ok(++guard<100);clock=next[1].at;timers.delete(next[0]);next[1].callback();}clock=end;}
 return {w,doc,api,home,viewer,timers,animations,motion,kind,advance,next(){const at=Math.min(...[...timers.values()].map(t=>t.at));assert.ok(Number.isFinite(at));advance(at-clock);},visible(room,value=true){observer.callback([{target:room,isIntersecting:value,intersectionRatio:value?1:0}]);},hidden(value){hidden=value;doc.dispatchEvent(new w.Event('visibilitychange'));},reduce(value){motion.matches=value;for(const fn of listeners)fn({matches:value});},close(){api.reset();dom.window.close();}};
}
test('daytime flight starts occasionally, completes once and waits a real cooldown',()=>{
 const h=harness();try{h.api.mount(h.home);h.visible(h.home);h.advance(17999);assert.equal(h.kind(h.home),null);h.advance(1);assert.equal(h.kind(h.home),'bird');assert.equal(h.timers.size,1);
 h.advance(8100);assert.equal(h.kind(h.home),null);assert.equal(h.home.querySelectorAll('svg').length,0);h.advance(54999);assert.equal(h.kind(h.home),null);
 assert.equal(h.home.querySelector('.club-outdoor-sky-events').getAttribute('aria-hidden'),'true');
 }finally{h.close();}
});
test('patrol is night-only, lasts seconds and cannot repeat on the next short interval',()=>{
 const h=harness({phase:'night',values:[0,.99,.5,.5],fallback:.99});try{h.api.mount(h.home);h.visible(h.home);h.next();assert.equal(h.kind(h.home),'patrol');
 const sweeps=h.animations.filter(a=>a.options.duration===2600);assert.equal(sweeps.length,2);assert.ok(sweeps.every(a=>a.options.easing==='ease-in-out'));
 h.next();assert.equal(h.kind(h.home),null);h.next();assert.equal(h.kind(h.home),'plane','three-minute patrol cooldown');
 }finally{h.close();}
 const day=harness({values:[0,.99]});try{day.api.mount(day.home);day.visible(day.home);day.next();assert.equal(day.kind(day.home),'plane');}finally{day.close();}
});
test('normal and enlarged room share one current event and phase without replaying it',()=>{
 const h=harness();try{h.api.mount(h.home);h.visible(h.home);h.next();h.advance(2200);
 h.api.mount(h.viewer);h.visible(h.viewer);assert.equal(h.kind(h.home),null);assert.equal(h.kind(h.viewer),'bird');
 const viewerFlight=h.animations.find(a=>a.node.closest('#viewer')&&a.node.classList.contains('club-outdoor-flyer'));assert.equal(viewerFlight.currentTime,2200);
 h.advance(700);h.api.unmount(h.viewer);assert.equal(h.kind(h.home),'bird');assert.equal(h.kind(h.viewer),null);
 const resumed=h.animations.filter(a=>a.node.closest('#home')&&a.node.classList.contains('club-outdoor-flyer')).at(-1);assert.equal(resumed.currentTime,2900);
 h.advance(5200);assert.equal(h.kind(h.home),null,'original end time, not a fresh animation');
 }finally{h.close();}
});
test('offscreen, background, motion preferences and reset release timers and animations',()=>{
 const h=harness();try{h.api.mount(h.home);h.visible(h.home);h.next();h.visible(h.home,false);assert.equal(h.timers.size,0);assert.equal(h.kind(h.home),null);assert.ok(h.animations.every(a=>a.cancelled));
 h.visible(h.home);assert.equal(h.timers.size,1);h.hidden(true);assert.equal(h.timers.size,0);h.hidden(false);h.next();h.reduce(true);assert.equal(h.kind(h.home),null);assert.equal(h.timers.size,0);
 h.reduce(false);assert.equal(h.timers.size,1);h.doc.documentElement.dataset.reducedMotion='true';h.w.dispatchEvent(new h.w.CustomEvent('club:motion-change'));assert.equal(h.timers.size,0);
 h.api.reset();assert.equal(h.home.querySelector('.club-outdoor-sky-events'),null);h.advance(360000);assert.equal(h.kind(h.home),null);
 }finally{h.close();}
});
test('phase changes remove reflections at dawn and birds after darkness',()=>{
 for(const [phase,values,nextPhase,kind] of [['night',[0,.99],'dawn','patrol'],['day',[0,.1],'night','bird']]){
  const h=harness({phase,values});try{h.api.mount(h.home);h.visible(h.home);h.next();assert.equal(h.kind(h.home),kind);h.home.dataset.time=nextPhase;h.api.sync();assert.equal(h.kind(h.home),null);assert.equal(h.timers.size,1);}finally{h.close();}
 }
});
