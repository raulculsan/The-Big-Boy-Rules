import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const names=['chotaRoomObstacles','chotaRoomSegmentClear','chotaRoomRoute','chotaRoomRoutePoint','chotaRoomSupportPoint','chotaRoomVisitLayout','chotaRoomTransform','chotaLifeCatalog','chotaAttentionFamily','chotaChooseLifeAction','chotaLifeTracks','createTigretonMotion','tigretonSpriteMarkup'];
const functions=names.map(name=>source.match(new RegExp('function '+name+'\\([^]*?\\n\\}'))[0]).join('\n');
function harness({size=400,busy=false,seed=9371}={}) {
 const dom=new JSDOM('<body><div class="clubhouse-room" data-time="evening"><div class="clubhouse-sky"></div><div class="chota-room-depth"><div class="tigreton-agenda"><div class="chota-character-row"></div></div></div></div></body>',{runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,room=w.document.querySelector('.clubhouse-room'),pet=room.querySelector('.tigreton-agenda'),row=room.querySelector('.chota-character-row'),timers=new Map(),frames=new Map(),animations=[];let now=0,id=0,sleeping=false,hidden=false,state=seed;
 w.Math.random=()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296};
 Object.defineProperty(w.performance,'now',{value:()=>now});Object.defineProperty(w.document,'hidden',{get:()=>hidden});
 w.setTimeout=(callback,delay=0)=>{timers.set(++id,{callback,due:now+delay});return id};w.clearTimeout=key=>timers.delete(key);
 w.requestAnimationFrame=callback=>{frames.set(++id,callback);return id};w.cancelAnimationFrame=key=>frames.delete(key);
 w.Element.prototype.animate=function(keyframes,options){const record={node:this,keyframes,options,cancelled:false,currentTime:0,cancel(){this.cancelled=true},onfinish:null};animations.push(record);return record};
 w.IntersectionObserver=class{constructor(cb){this.cb=cb}observe(){this.cb([{isIntersecting:true}])}disconnect(){}};
 let motionChanged;w.tigretonReducedMotion={matches:false,addEventListener(type,fn){motionChanged=fn},removeEventListener(){}};
 w.isChotaSleeping=()=>sleeping;w.tigretonDaysUntil=()=>1;
 for(const name of ['ensureChotaDirectionalSprite','ensureChotaContextSprite','ensureChotaRoomSprite','ensureChotaSprites']) w[name]=async()=>true;
 w.chotaSpritesReady={poses:true,talk:true};w.eval(functions);row.innerHTML=w.tigretonSpriteMarkup();
 const rect=(x,y,width,height=width)=>({left:x*size,top:y*size,width:width*size,height:height*size});
 Object.defineProperty(room,'clientWidth',{value:size});room.getBoundingClientRect=()=>rect(0,0,1);row.getBoundingClientRect=()=>rect(.36,.5354,.28);
 for(const node of [pet,pet.querySelector('.tigreton-sprite'),pet.querySelector('.tigreton-character')]) node.getBoundingClientRect=row.getBoundingClientRect;
 if(busy){room.insertAdjacentHTML('beforeend','<div class="clubhouse-plan"></div><div class="chota-room-robot-vacuum chota-room-prop"></div><div class="chota-room-football chota-room-prop"></div>');room.querySelector('.chota-room-robot-vacuum').getBoundingClientRect=()=>rect(.45,.84,.1,.067);room.querySelector('.chota-room-football').getBoundingClientRect=()=>rect(.2,.79,.07,.064)}
 const api=w.createTigretonMotion(pet,false,busy?{id:'plan'}:null,busy?new Date():null);
 return {w,api,room,pet,row,animations,timers,frames,advance(ms){now+=ms;const due=[...timers].filter(([,t])=>t.due<=now);for(const [key,t]of due)if(timers.delete(key))t.callback();const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(now))},sleep(value){sleeping=value;api.refresh()},hidden(value){hidden=value;w.document.dispatchEvent(new w.Event('visibilitychange'))},reduced(value){w.tigretonReducedMotion.matches=value;motionChanged()},close(){api.destroy();dom.window.close()}};
}
test('six new rig actions keep floor/shoes stationary and have bounded, recoverable tracks',()=>{
 const h=harness();try{
 const actions=Object.keys(h.w.chotaLifeCatalog());assert.equal(actions.length,6);
 for(const action of actions){h.api.play(action);assert.equal(h.pet.dataset.attention,action);assert.equal(h.row.style.transform,'');assert.equal(h.pet.style.transform,'');
 const tracks=h.animations.filter(a=>!a.cancelled);assert.ok(tracks.length>=4);
 assert.ok(tracks.every(a=>a.node!==h.row && !a.node.classList.contains('chota-idle-feet')));
 for(const track of tracks){assert.equal(track.options.iterations,undefined);assert.equal(track.keyframes[0].offset,0);assert.equal(track.keyframes.at(-1).offset,1);const property=track.keyframes[0].transform!==undefined?'transform':'opacity';assert.equal(track.keyframes[0][property],track.keyframes.at(-1)[property]);}
 }
 assert.equal(h.frames.size,0,'gestures do not create a layout or animation RAF loop');
 }finally{h.close()}
});
test('policy respects per-action/family cooldown, recent touch and evening-only drowsiness',()=>{
 const h=harness();try{
 const choose=h.w.chotaChooseLifeAction,base={now:300000,moment:'evening',lastAction:'',times:new Map(),families:new Map(),lastTouchAt:-Infinity};
 for(const [action,info]of Object.entries(h.w.chotaLifeCatalog())){
 const times=new Map(Object.keys(h.w.chotaLifeCatalog()).map(key=>[key,key===action?-Infinity:300000]));
 assert.equal(choose({...base,times}),action);
 assert.equal(choose({...base,times:new Map(times).set(action,300000-info.cooldown+1)}),null);
 assert.equal(choose({...base,times,families:new Map([[info.family,300000-info.familyCooldown+1]])}),null);
 assert.equal(choose({...base,times,lastAction:action}),null);
 }
 assert.equal(choose({...base,lastTouchAt:299000}),null);
 const onlyRest=new Map(Object.keys(h.w.chotaLifeCatalog()).map(key=>[key,key==='drowsy'?-Infinity:300000]));assert.equal(choose({...base,moment:'day',times:onlyRest}),null);
 }finally{h.close()}
});
test('interaction, navigation, reduced motion and midnight sleep cancel every new gesture',()=>{
 for(const cancel of [h=>h.api.noticeUser(),h=>h.api.pause(),h=>h.hidden(true),h=>h.reduced(true),h=>h.sleep(true)]){
 const h=harness();try{h.api.play('sneeze');const tracks=h.animations.filter(a=>!a.cancelled);cancel(h);assert.ok(tracks.every(a=>a.cancelled));assert.notEqual(h.pet.dataset.attention,'sneeze');}finally{h.close()}
 }
 const h=harness();try{h.sleep(true);for(const action of Object.keys(h.w.chotaLifeCatalog()))h.api.play(action);assert.equal(h.pet.classList.contains('is-sleeping'),true);assert.equal(h.pet.dataset.attention,undefined);assert.equal(h.api.captureRoomState().life,null);}finally{h.close()}
});
test('fullscreen handoff preserves gesture phase, direction, cooldown ages and grounded scale',()=>{
 const small=harness({size:360}),large=harness({size:650});try{
 small.api.play('listen');small.advance(1150);const state=small.api.captureRoomState();small.api.pause();large.api.resume(state);const restored=large.api.captureRoomState();
 assert.equal(restored.life.action,'listen');assert.equal(restored.life.elapsed,1150);assert.equal(restored.life.direction,state.life.direction);assert.equal(JSON.stringify(restored.ambient),JSON.stringify(state.ambient));
 assert.ok(large.animations.filter(a=>!a.cancelled).every(a=>a.currentTime===1150));assert.equal(large.row.style.transform,'');
 }finally{small.close();large.close()}
});
test('a real outdoor marker can draw an eligible listening gesture, while an absent event is not fabricated',()=>{
 const h=harness();try{
 const now=100000,base={now,moment:'day',lastAction:'',times:new Map(),families:new Map(),lastTouchAt:-Infinity,random:.8};
 assert.equal(h.w.chotaChooseLifeAction({...base,outdoor:true}),'listen');assert.notEqual(h.w.chotaChooseLifeAction({...base,outdoor:false}),'listen');
 }finally{h.close()}
});
test('seeded busy room actually selects all new gestures over twenty minutes without starving families',async(t)=>{
 const h=harness({busy:true});try{
 const events=[];let previous='';
 for(let elapsed=0;elapsed<1200000;elapsed+=250){h.advance(250);await Promise.resolve();const current=h.pet.dataset.attention||'';if(current && current!==previous)events.push({action:current,at:elapsed});previous=current;}
 const life=h.w.chotaLifeCatalog(),selected=events.filter(e=>life[e.action]);
 t.diagnostic('20 min loaded room: '+Object.keys(life).map(action=>action+'='+selected.filter(e=>e.action===action).length).join(', '));
 assert.ok(events.some(e=>e.action.startsWith('visit-')));assert.ok(events.some(e=>['plan','roomba','window'].includes(e.action)));
 for(const action of Object.keys(life))assert.ok(selected.some(e=>e.action===action),'not reached: '+action);
 assert.ok(selected.length>=12 && selected.length<=40,'small gestures leave substantial quiet time');
 for(let i=1;i<selected.length;i++){assert.notEqual(selected[i].action,selected[i-1].action);assert.ok(selected[i].at-selected[i-1].at>=22000);}
 const last=new Map();for(const event of selected){if(last.has(event.action))assert.ok(event.at-last.get(event.action)>=life[event.action].cooldown);last.set(event.action,event.at);}
 }finally{h.close()}
});

test('a visible outdoor DOM event is used by the production scheduler and destroy releases timers',()=>{
 const h=harness();try {
 const bird=h.w.document.createElement('span');bird.className='club-outdoor-flyer';bird.dataset.outdoorKind='bird';bird.getBoundingClientRect=()=>({left:350,top:80,width:12,height:8});h.room.querySelector('.clubhouse-sky').append(bird);
 h.advance(20000);assert.equal(h.pet.dataset.attention,'listen');
 const tracks=h.animations.filter(a=>!a.cancelled);assert.ok(tracks.length>=4);
 h.api.destroy();assert.equal(h.timers.size,0);assert.equal(h.frames.size,0);assert.ok(tracks.every(a=>a.cancelled));
 }finally{h.close()}
});
