import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../../../app.js',import.meta.url),'utf8');
const start=source.indexOf('function createTigretonMotion('),end=source.indexOf('\nfunction tigretonSpriteMarkup',start);
const fn=source.slice(start,end);
function setup(viewer=false) {
 let now=0,sequence=0,sleeping=true;const timers=new Map(),listeners=new Map(),running=new Set();
 const classes=()=>{const values=new Set();return {add(...items){items.forEach(x=>values.add(x));},remove(...items){items.forEach(x=>values.delete(x));},contains:x=>values.has(x),toggle(x,on){on?values.add(x):values.delete(x);}};};
 const node=()=>({classList:classes(),style:{},dataset:{},querySelector(){return null;},querySelectorAll(){return [];},getBoundingClientRect(){return {left:0,top:0,width:256,height:256};},setAttribute(){},append(){},animate(frames,options){const animation={target:this,frames,options,cancel(){running.delete(animation);}};running.add(animation);return animation;}});
 const room=node(),pet=node(),character=node(),chest=node(),head=node(),tail=node(),row=node();room.dataset.time='night';room.clientWidth=1024;pet.closest=()=>room;
 const parts=new Map([['.tigreton-character',character],['.tigreton-shadow',node()],['.tigreton-sleep-mark',node()],['.tigreton-spark',node()],['.chota-character-row',viewer?row:null],['.tigreton-sprite',node()]]);
 pet.querySelector=selector=>parts.get(selector)||null;
 character.querySelector=selector=>({'.chota-sleep-chest':chest,'.chota-sleep-head':head,'.chota-sleep-tail':tail})[selector]||node();character.querySelectorAll=()=>[node(),node()];
 const doc={hidden:false,createElement:node,getElementById:()=>null,addEventListener:(name,cb)=>listeners.set(name,cb),removeEventListener:name=>listeners.delete(name)};
 const reduced={matches:false,addEventListener:(_,cb)=>listeners.set('reduced',cb),removeEventListener:()=>listeners.delete('reduced')};
 const context={performance:{now:()=>now},setTimeout:(cb,delay)=>{const id=++sequence;timers.set(id,{cb,time:now+delay});return id;},clearTimeout:id=>timers.delete(id),document:doc,tigretonReducedMotion:reduced,isChotaSleeping:()=>sleeping,tigretonDaysUntil:()=>4,ensureChotaDirectionalSprite:()=>Promise.resolve(true),ensureChotaContextSprite:()=>Promise.resolve(true),ensureChotaRoomSprite:()=>Promise.resolve(true),chotaSpritesReady:{poses:true,talk:true},ensureChotaSprites:()=>Promise.resolve(),IntersectionObserver:class{constructor(cb){this.cb=cb;}observe(){this.cb([{isIntersecting:true}]);}disconnect(){}},Date,Math};
 const api=vm.runInNewContext(`(${fn})`,context)(pet,false,{id:'clubhouse-idle'},new Date());
 async function tick(ms){const target=now+ms;while(true){const next=[...timers].filter(([,task])=>task.time<=target).sort((a,b)=>a[1].time-b[1].time)[0];if(!next)break;now=next[1].time;timers.delete(next[0]);next[1].cb();await Promise.resolve();}now=target;await Promise.resolve();}
 return {api,pet,character,chest,head,tail,running,doc,reduced,listeners,timers,tick,setSleeping:value=>sleeping=value};
}
for (const viewer of [false,true]) {
 const t=setup(viewer);
 const breath=()=>[...t.running].filter(animation=>animation.target===t.chest && animation.options.iterations===Infinity);
 assert(t.character.classList.contains('is-sleep-breathing'));assert.equal(breath().length,1);
 const first=breath()[0];t.api.refresh();t.api.refresh();assert.equal(breath()[0],first);assert.equal(breath().length,1);
 await t.tick(16000);assert([...t.running].some(animation=>animation.target===t.tail));assert.equal(breath()[0],first);
 await t.tick(16000);assert([...t.running].some(animation=>animation.target===t.head));assert.equal(breath()[0],first);
 t.api.reactSleeping();assert.equal(breath().length,0);await t.tick(800);assert.equal(breath().length,1);
 t.api.pause();assert.equal(breath().length,0);assert(!t.character.classList.contains('is-sleep-breathing'));
 t.api.resume();assert.equal(breath().length,1);
 t.doc.hidden=true;t.listeners.get('visibilitychange')();assert.equal(breath().length,0);
 t.doc.hidden=false;t.listeners.get('visibilitychange')();assert.equal(breath().length,1);
 t.reduced.matches=true;t.listeners.get('reduced')();assert.equal(breath().length,0);
 t.reduced.matches=false;t.listeners.get('reduced')();assert.equal(breath().length,1);
 assert.equal(t.api.bedtime(()=>{}),true);await new Promise(setImmediate);await t.tick(18500);assert.equal(breath().length,1);
 t.setSleeping(false);t.api.refresh();assert.equal(breath().length,0);assert(!t.character.classList.contains('is-sleep-breathing'));
 t.api.destroy();assert.equal(t.running.size,0);assert.equal(t.timers.size,0);
}
console.log('PASS: independent tail/head movements preserve breathing; refresh, touch, bedtime, viewer and lifecycle cleanup.');
