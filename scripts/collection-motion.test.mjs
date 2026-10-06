import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const flush=()=>new Promise(r=>setImmediate(r));
function setup({reduced=false,deferred=false,failed=false}={}) {
 const dom=new JSDOM(read('index.html'),{url:'https://club.test/#sobres',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
 const mq=new w.EventTarget();mq.matches=reduced;w.matchMedia=()=>mq;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 const animations=[],requests=[];let resolve;
 w.TrophyMotion={loadPlayer:()=>Promise.resolve({loadAnimation(options){const a={options,frame:0,plays:0,destroyed:false,listeners:{},addEventListener(n,fn){this.listeners[n]=fn;},goToAndStop(f){this.frame=f;},goToAndPlay(f){this.frame=f;this.plays++;},destroy(){this.destroyed=true;},emit(n){this.listeners[n]?.();}};animations.push(a);return a;}})};
 w.fetch=url=>{requests.push(url);const response={ok:!failed,json:async()=>({layers:[]})};return deferred?new Promise(r=>{resolve=()=>r(response);}):Promise.resolve(response);};
 const s=d.getElementById('collectionCardTilt');s.getBoundingClientRect=()=>({width:240,height:420});
 s.setPointerCapture=id=>{s.captured=id;};s.hasPointerCapture=id=>s.captured===id;s.releasePointerCapture=()=>{s.captured=null;};
 w.eval(read('collection-motion.js'));w.eval(read('card-collection.js'));
 function pointer(type,x,y=100,id=1){const e=new w.Event(type);Object.assign(e,{pointerId:id,clientX:x,clientY:y,button:0,isPrimary:true});s.dispatchEvent(e);}
 return {dom,w,d,s,mq,animations,requests,pointer,resolve:()=>resolve(),open:(name)=>[...d.querySelectorAll('.collection-card-tile')].find(b=>!name||b.textContent.includes(name)).click()};
}
test('edition selects distinct Lottie foil, with no extra players or stale effect on switching',async()=>{
 const h=setup();
 for(const [name,file] of [['LUCA DE TENA','card-touch-special'],['BOROX','card-touch-legendary'],['JOSE ENRIQUE','card-touch']]){
  const previous=h.animations.at(-1);h.open(name);await flush();
  if(previous)assert.equal(previous.destroyed,true);
  assert.match(h.requests.at(-1),new RegExp('/'+file+'\\.json\\?'));
  const a=h.animations.at(-1);a.emit('DOMLoaded');assert.equal(a.frame,30);assert.equal(a.options.autoplay,false);assert.equal(a.options.loop,false);
  h.pointer('pointerdown',100);h.pointer('pointermove',140);await new Promise(r=>setTimeout(r,25));assert.ok(a.frame>30);
  h.pointer('pointercancel',140);assert.equal(h.d.getElementById('collectionCardFoil').style.opacity,'0');
  h.w.CardCollection.close();assert.equal(a.destroyed,true);
 }
 assert.equal(h.animations.length,3);h.open('BOROX');await flush();assert.equal(h.requests.length,3,'reuse cached JSON');
 h.w.CardCollection.close();h.dom.window.close();
});
test('rare foils respect reduced motion and unknown editions safely use common foil',async()=>{
 const h=setup({reduced:true});
 for(const name of ['LUCA DE TENA','BOROX']){h.open(name);await flush();assert.equal(h.requests.length,0);h.w.CardCollection.close();}
 h.mq.matches=false;
 const detach=h.w.CollectionMotion.attachCard(h.s,h.d.getElementById('collectionCardFoil'),()=>{},'Unknown');await flush();
 assert.match(h.requests[0],/\/card-touch\.json\?/);detach();h.dom.window.close();
});
test('rare effects are different vector compositions, light enough for touch scrubbing',()=>{
 const variants=['card-touch','card-touch-special','card-touch-legendary'].map(n=>read('icons/cards/'+n+'.json'));
 assert.equal(new Set(variants).size,3);
 for(const raw of variants){const a=JSON.parse(raw);assert.equal(a.op,61);assert.equal(a.w,400);assert.equal(a.h,700);assert.equal(a.assets.length,0);assert.ok(raw.length<16000);assert.ok(a.layers.every(l=>l.ty===4&&!l.ef));}
 assert.equal(JSON.parse(variants[1]).layers.length,4);
 assert.equal(JSON.parse(variants[2]).layers.filter(l=>l.nm.startsWith('Faceta')).length,3);
});
test('no animation loads on the catalogue; drag scrubs foil and release flips exactly once',async()=>{
 const h=setup();assert.equal(h.requests.length,0);h.open();await flush();const a=h.animations[0];a.emit('DOMLoaded');
 h.pointer('pointerdown',100);h.pointer('pointermove',160);await new Promise(r=>setTimeout(r,25));
 assert.match(h.s.style.transform,/rotateY\(10deg\)/);assert.ok(a.frame>30);
 h.pointer('pointerup',190);h.pointer('lostpointercapture',190);
 assert.equal(h.d.getElementById('collectionCardFlip').getAttribute('aria-pressed'),'true');assert.equal(h.s.style.transform,'');assert.equal(h.d.getElementById('collectionCardFoil').style.opacity,'0');
 h.w.CardCollection.close();assert.ok(a.destroyed);h.dom.window.close();
});
test('all editions hide foil at rest and on tap, reveal progressively on movement and fade on release',async()=>{
 const h=setup(),foil=h.d.getElementById('collectionCardFoil');
 const tick=()=>new Promise(r=>setTimeout(r,25));
 for(const name of ['JOSE ENRIQUE','LUCA DE TENA','BOROX']){
  h.open(name);assert.equal(foil.style.opacity,'0');await flush();h.animations.at(-1).emit('DOMLoaded');assert.equal(foil.style.opacity,'0');
  h.pointer('pointerdown',100);await tick();assert.equal(foil.style.opacity,'0');
  h.pointer('pointermove',102);await tick();assert.equal(foil.style.opacity,'0');
  h.pointer('pointermove',112);await tick();assert.ok(Number(foil.style.opacity)>0&&Number(foil.style.opacity)<1);
  h.pointer('pointermove',140);await tick();assert.equal(foil.style.opacity,'1');
  const reflectedFrame=h.animations.at(-1).frame;
  h.pointer('pointerup',140);assert.equal(foil.style.opacity,'0');assert.equal(h.animations.at(-1).frame,reflectedFrame,'no visible jump during fade');
  h.pointer('pointerdown',100);h.pointer('pointermove',100,145);await tick();assert.equal(foil.style.opacity,'1');
  h.pointer('pointercancel',100,145);assert.equal(foil.style.opacity,'0');h.w.CardCollection.close();
 }
 h.dom.window.close();
 assert.match(read('packs.css'),/\.collection-card-foil\s*\{[^}]*opacity:0;[^}]*transition:opacity/);
});
test('late Lottie readiness after release cannot reveal a resting card',async()=>{
 const h=setup({deferred:true}),foil=h.d.getElementById('collectionCardFoil');h.open('BOROX');
 h.pointer('pointerdown',100);h.pointer('pointermove',140);await new Promise(r=>setTimeout(r,25));assert.equal(foil.style.opacity,'0');
 h.pointer('pointerup',140);h.resolve();await flush();h.animations[0].emit('DOMLoaded');assert.equal(foil.style.opacity,'0');
 h.w.CardCollection.close();h.dom.window.close();
});
test('short or vertical drags and pointer cancellation never flip; keyboard remains usable',async()=>{
 const h=setup();h.open();await flush();
 for(const end of ['pointerup','pointercancel']){h.pointer('pointerdown',100);h.pointer('pointermove',120,280);h.pointer(end,120,280);assert.equal(h.d.getElementById('collectionCardFlip').getAttribute('aria-pressed'),'false');}
 h.s.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'ArrowRight'}));assert.equal(h.d.getElementById('collectionCardFlip').getAttribute('aria-pressed'),'true');
 h.w.CardCollection.close();h.dom.window.close();
});
test('closing while assets load cannot create a stale player; reopening starts cleanly',async()=>{
 const h=setup({deferred:true});h.open();h.w.CardCollection.close();h.resolve();await flush();assert.equal(h.animations.length,0);
 h.open();await flush();assert.equal(h.animations.length,1);h.w.CardCollection.close();h.dom.window.close();
});
test('reduced motion skips Lottie and tilt but retains swipe, flip button and static pack preview',async()=>{
 const h=setup({reduced:true});h.open();h.pointer('pointerdown',100);h.pointer('pointermove',200);h.pointer('pointerup',200);
 assert.equal(h.s.style.transform,'');assert.equal(h.requests.length,0);assert.equal(h.d.getElementById('collectionCardFlip').getAttribute('aria-pressed'),'true');h.w.CardCollection.close();
 h.d.getElementById('packPreviewButton').click();assert.match(h.d.getElementById('packPreviewStatus').textContent,/estática/);assert.equal(h.requests.length,0);h.w.CollectionMotion.close();h.dom.window.close();
});
test('pack preview plays once, replays, closes on navigation and never changes balance',async()=>{
 const h=setup();const count=h.d.getElementById('packsCount');count.textContent='5';h.d.getElementById('packPreviewButton').click();await flush();
 const a=h.animations[0];a.emit('DOMLoaded');assert.equal(a.plays,1);assert.equal(a.options.loop,false);a.emit('complete');assert.equal(h.d.getElementById('packPreviewDialog').dataset.motionState,'ready');
 assert.match(h.d.getElementById('packPreviewStatus').textContent,/No se ha gastado/);assert.equal(count.textContent,'5');
 h.d.getElementById('packPreviewReplay').click();await flush();assert.ok(a.destroyed);assert.equal(h.requests.length,1);
 h.w.dispatchEvent(new h.w.Event('hashchange'));assert.equal(h.d.getElementById('packPreviewDialog').open,false);assert.ok(h.animations[1].destroyed);assert.equal(h.d.activeElement.id,'packPreviewButton');h.dom.window.close();
});
test('failed animation restores poster and offers replay without touching server',async()=>{
 const h=setup({failed:true});h.d.getElementById('packPreviewButton').click();await flush();assert.equal(h.d.getElementById('packPreviewDialog').dataset.motionState,'static');assert.equal(h.d.getElementById('packPreviewReplay').disabled,false);
 assert.ok(h.requests.every(url=>url.startsWith('icons/cards/')));h.w.CollectionMotion.close();h.dom.window.close();
});
test('motion preference change cancels drag; background closes preview and stale callbacks stay dead',async()=>{
 const h=setup();h.open();await flush();h.animations[0].emit('DOMLoaded');h.pointer('pointerdown',100);h.pointer('pointermove',160);
 h.mq.matches=true;h.mq.dispatchEvent(new h.w.Event('change'));assert.equal(h.s.style.transform,'');assert.ok(h.animations[0].destroyed);h.w.CardCollection.close();
 h.mq.matches=false;h.d.getElementById('packPreviewButton').click();await flush();const a=h.animations.at(-1);h.w.CollectionMotion.close();a.emit('DOMLoaded');assert.equal(a.plays,0);h.dom.window.close();
});
test('Lottie assets contain real bounded keyframes, use local approved art, and ship offline/native',()=>{
 for(const name of ['card-touch','card-touch-special','card-touch-legendary','pack-opening']) {
  const file=`icons/cards/${name}.json`,json=JSON.parse(read(file));assert.equal(json.fr,60);assert.ok(json.layers.length>=3);
  for(const layer of json.layers)for(const prop of Object.values(layer.ks))if(prop.a===1){assert.ok(prop.k.length>=2);assert.ok(prop.k.every(k=>k.t>=0&&k.t<json.op));}
  for(const layer of json.layers)if(layer.masksProperties)assert.equal(layer.hasMask,true,'Lottie must normalize mask tangents before rendering');
  for(const asset of json.assets)assert.ok(readFileSync(new URL('../icons/cards/'+asset.p,import.meta.url)).length>0);
  assert.ok(read('service-worker.js').includes(name+'.json'));assert.equal(read(file),read('ios/App/App/public/'+file));
 }
 assert.equal(read('collection-motion.js'),read('ios/App/App/public/collection-motion.js'));
 assert.doesNotMatch(read('collection-motion.js'),/\.rpc\(|localStorage|Math.random/);
});
