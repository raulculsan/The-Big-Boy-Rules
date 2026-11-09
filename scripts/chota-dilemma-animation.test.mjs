import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const source=fs.readFileSync(new URL('../chota-decisions.js',import.meta.url),'utf8');
function setup(){
 const dom=new JSDOM('<dialog><div class="chd-chota"><i class="chd-think"></i></div><div class="chd-bubble"><span class="chd-line"></span><span class="chd-ghost"></span></div></dialog>',{runScripts:'outside-only'}),w=dom.window;
 const intervals=new Map(),timeouts=new Map();let serial=0;
 w.setInterval=fn=>{intervals.set(++serial,fn);return serial};w.clearInterval=id=>intervals.delete(id);
 w.setTimeout=fn=>{timeouts.set(++serial,fn);return serial};w.clearTimeout=id=>timeouts.delete(id);
 let outfit=[{slot:'topwear',atlases:{base:'shirt-base.webp',talk:'shirt-talk.webp'}},{slot:'bottomwear',atlases:{base:'pants-base.webp',talk:'pants-talk.webp'}}];
 w.ChotaWardrobe={outfit:()=>outfit};
 // Exercise the production actor directly, without exporting a test API in the app.
 const actor=source.slice(source.indexOf('  const actor = {'),source.indexOf('\n  function meterMarkup'));
 w.eval(`const dialog=document.querySelector('dialog'),reduced={matches:false},sequences={walk:[6,7,8,9],greet:[0,1,2]};${actor};globalThis.qaActor=actor;`);
 const a=w.qaActor;a.wear();
 const check=(sheet,index)=>{const n=a.node(),cols=sheet==='talk'?3:6,rows=sheet==='talk'?1:4;assert.equal(a.sheet,sheet);assert.equal(a.index,index);assert.equal(n.classList.contains('is-talking'),sheet==='talk');assert.equal(n.style.backgroundSize,`${cols*100}% ${rows*100}%`);for(const layer of n.querySelectorAll('.chd-wear')){assert.equal(layer.dataset.sheet,sheet);assert.equal(layer.style.backgroundPosition,n.style.backgroundPosition);assert.equal(layer.style.backgroundSize,n.style.backgroundSize);assert.ok(layer.style.backgroundImage.includes(layer.dataset[sheet]));}};
 return{a,intervals,timeouts,check,replace:()=>{outfit=outfit.map(o=>({...o,atlases:{base:'new-'+o.atlases.base,talk:'new-'+o.atlases.talk}}));a.wear()},close:()=>w.close()};
}
test('dilemma body and every garment share the sheet/cell across all frames and outfit changes',()=>{const h=setup();try{
 for(let i=0;i<24;i++){h.a.frame(i);h.check('base',i);h.replace();h.check('base',i)}
 h.a.say('Una frase lo bastante larga para mantener la boca en movimiento.');h.check('talk',0);
 const mouth=h.intervals.get(h.a.talkTimer);for(const i of [0,1,2,1]){mouth();h.check('talk',i);h.replace();h.check('talk',i)}
}finally{h.close()}});
test('interrupting speech with walking rejects queued mouth ticks; interrupting walking with speech rejects queued steps',()=>{const h=setup();try{
 h.a.say('El habla se interrumpe.');const staleMouth=h.intervals.get(h.a.talkTimer),staleTyping=[...h.timeouts.values()][0];
 h.a.play('walk');h.check('base',6);staleMouth();staleTyping();h.check('base',6);
 const step=h.intervals.get(h.a.timer);step();h.check('base',7);
 h.a.say('Ahora se interrumpe el paseo.');h.check('talk',0);step();h.check('talk',0);
 h.intervals.get(h.a.talkTimer)();h.check('talk',0);h.intervals.get(h.a.talkTimer)();h.check('talk',1);
 h.a.stop();h.replace();h.check('talk',1);
}finally{h.close()}});
test('modular dilemma draws its complete committed outfit while legacy retains the registered garment layers',()=>{
 const css=fs.readFileSync(new URL('../chota-decisions.css',import.meta.url),'utf8');
 assert.match(css,/background: var\(--chota-outfit-base/);assert.match(css,/background-image: var\(--chota-outfit-talk/);
 assert.match(css,/:root\[data-chota-modular="true"\] \.chd-wear\s*\{ display: none; \}/);
});
