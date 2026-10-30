import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../../../app.js',import.meta.url),'utf8');
const start=source.indexOf('function createTigretonMotion('),end=source.indexOf('\nfunction tigretonSpriteMarkup',start);
const fn=source.slice(start,end).replace('    play,\n    speak,','    play, _visit:visitRoom, _state:()=>roomVisit,\n    speak,');
function setup(viewer=false) {
 let now=0,seq=0,sleeping=false;const timers=new Map(),listeners=new Map();
 function classes() {const set=new Set();return {add(...a){a.forEach(x=>set.add(x));},remove(...a){a.forEach(x=>set.delete(x));},contains(x){return set.has(x);},toggle(x,on){if(on)set.add(x);else set.delete(x);},set};}
 const node=(box={left:0,top:0,width:1024,height:1024})=>({classList:classes(),style:{},dataset:{},querySelector(){return null;},querySelectorAll(){return [];},getBoundingClientRect(){return box;},animate(){return {cancel(){},onfinish:null};},setAttribute(){},append(){}});
 const room=node(),body=node({left:360,top:500,width:320,height:320}),character=node(),shadow=node(),motion=node({left:340,top:480,width:360,height:380}),pet=node({left:340,top:480,width:360,height:380});
 room.dataset.time='day';room.clientWidth=1024;let foreground=null;
 room.querySelector=s=>s==='.chota-sofa-foreground'?foreground:null;room.append=n=>{foreground=n;};
 pet.closest=()=>room;
 const parts=new Map([['.tigreton-character',character],['.tigreton-shadow',shadow],['.tigreton-sprite',body],['.tigreton-sleep-mark',node()],['.tigreton-spark',node()],['.chota-character-row',viewer?motion:null]]);
 pet.querySelector=s=>parts.get(s)||null;
 character.querySelector=()=>node();character.querySelectorAll=()=>[node(),node()];
 const doc={hidden:false,createElement:()=>node(),getElementById:()=>null,addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:k=>listeners.delete(k)};
 const reduced={matches:false,addEventListener:(k,f)=>listeners.set('reduced',f),removeEventListener:()=>listeners.delete('reduced')};
 const context={console,performance:{now:()=>now},setTimeout:(f,d)=>{const id=++seq;timers.set(id,{f,time:now+d});return id;},clearTimeout:id=>timers.delete(id),document:doc,tigretonReducedMotion:reduced,isChotaSleeping:()=>sleeping,tigretonDaysUntil:()=>4,ensureChotaDirectionalSprite:()=>Promise.resolve(true),ensureChotaContextSprite:()=>Promise.resolve(true),ensureChotaRoomSprite:()=>Promise.resolve(true),chotaSpritesReady:{poses:true,talk:true},ensureChotaSprites:()=>Promise.resolve(),IntersectionObserver:class{constructor(f){this.f=f;}observe(){this.f([{isIntersecting:true}]);}disconnect(){}},Date,Math};
 const api=vm.runInNewContext(`(${fn})`,context)(pet,false,{id:'clubhouse-idle'},new Date());
 async function tick(ms) {const target=now+ms;let count=0;while(true){const next=[...timers].filter(([,t])=>t.time<=target).sort((a,b)=>a[1].time-b[1].time)[0];if(!next)break;if(++count>10000)throw Error('runaway timer');now=next[1].time;timers.delete(next[0]);next[1].f();await Promise.resolve();}now=target;await Promise.resolve();}
 return {api,pet,character,shadow,room,motion:viewer?motion:pet,timers,doc,reduced,listeners,tick,setSleeping:v=>sleeping=v};
}
for(const viewer of [false,true]) {
 const t=setup(viewer);t.api._visit('window');await new Promise(setImmediate);
 assert(t.api._state());await t.tick(5800);
 assert.match(t.motion.style.transform,/translate\(/);assert(t.character.style.transform.includes('scaleX(-1)'));
 await t.tick(11300);assert.equal(t.api._state(),null);assert.equal(t.motion.style.transform,'');
 t.api._visit('board');await new Promise(setImmediate);await t.tick(7000);
 assert(t.api._state());assert.equal(t.api._state().kind,'board');
 await t.tick(6500);assert.equal(t.api._state(),null);assert.equal(t.motion.style.transform,'');
 t.api._visit('sofa');await new Promise(setImmediate);await t.tick(6500);
 assert(t.pet.classList.contains('is-sitting-on-sofa'));assert(t.room.classList.contains('is-chota-on-sofa'));assert.equal(t.shadow.style.opacity,'0');
 const transform=t.motion.style.transform;t.api.noticeUser();assert.equal(t.motion.style.transform,transform);assert(t.api._state().returning);
 await t.tick(7000);assert.equal(t.api._state(),null);assert.equal(t.motion.style.transform,'');assert(!t.room.classList.contains('is-chota-on-sofa'));
 t.api._visit('window');await new Promise(setImmediate);await t.tick(1000);t.doc.hidden=true;t.listeners.get('visibilitychange')();assert.equal(t.api._state(),null);assert.equal(t.timers.size,0);
 t.doc.hidden=false;t.listeners.get('visibilitychange')();t.api._visit('sofa');await new Promise(setImmediate);await t.tick(1000);t.reduced.matches=true;t.listeners.get('reduced')();assert.equal(t.api._state(),null);assert.equal(t.timers.size,0);
 t.reduced.matches=false;t.api.refresh();t.api._visit('window');await new Promise(setImmediate);await t.tick(1000);t.setSleeping(true);t.api.refresh();assert.equal(t.api._state(),null);assert(t.pet.classList.contains('is-sleeping'));
 t.api.destroy();assert.equal(t.timers.size,0);assert.equal(t.motion.style.transform,'');
}
console.log('PASS: room visits, perspective, sofa contact, touch return, viewer geometry, hidden/reduced-motion/sleep cleanup.');
