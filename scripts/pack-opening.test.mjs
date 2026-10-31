import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
function setup() {
  const dom=new JSDOM('<div id="stage"></div>',{pretendToBeVisual:true,runScripts:'outside-only'});
  dom.window.eval(read('pack-opening.js'));
  return {w:dom.window,d:dom.window.document,stage:dom.window.document.getElementById('stage'),P:dom.window.PackOpening};
}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const pointer=(h,type,x,y=20)=>{const event=new h.w.Event(type,{bubbles:true});Object.assign(event,{pointerId:1,isPrimary:true,button:0,clientX:x,clientY:y,pointerType:'touch'});h.stage.querySelector('.pack-tear').dispatchEvent(event);};

test('the tear edge crosses the whole pack and is irregular',()=>{
  const line=setup().P.tearLine();
  assert.ok(line[0][0]<=130&&line.at(-1)[0]>=890);
  assert.ok(new Set(line.map(point=>Math.round(point[1]))).size>4);
  assert.ok(line.every((point,index)=>!index||point[0]>line[index-1][0]));
});

test('both strip pieces share the moving tear point',()=>{
  const {P}=setup(),line=P.tearLine();
  for(const front of [.1,.5,.9]){
    const {pivot,before,after}=P.stripPieces(line,front);
    assert.ok(before.some(point=>point===pivot));
    assert.ok(after.some(point=>point===pivot));
  }
});

test('the aura follows the best card, whatever the order',()=>{
  const {P}=setup();
  assert.equal(P.bestEdition([{edition:'common'},{edition:'full_art'},{edition:'epic'}]),'full_art');
  assert.equal(P.bestEdition([{edition:'common'}]),'common');
  assert.equal(P.bestEdition([{edition:'unknown'}]),'common');
});

test('a short slow drag returns the strip; distance or a flick commits',()=>{
  const {P}=setup();
  assert.equal(P.shouldComplete(.3,.1),false);
  assert.equal(P.shouldComplete(.6,.1),true);
  assert.equal(P.shouldComplete(.3,1),true);
  assert.equal(P.shouldComplete(.05,2),false);
});

test('stop removes every trace and never reports completion',async()=>{
  const h=setup();let done=0;
  const run=h.P.play({stage:h.stage,back:'back.jpg',onDone:()=>done++});
  assert.equal(h.stage.querySelectorAll('.pack-tear-card').length,6);
  run.stop();run.stop();await wait(20);
  assert.equal(h.stage.children.length,0);assert.equal(done,0);
});

test('tear completes once and cleans up, even if requested twice',async()=>{
  const h=setup();let done=0;
  const run=h.P.play({stage:h.stage,back:'back.jpg',onDone:()=>done++});
  run.tear();run.tear();
  await wait(1900);
  assert.equal(done,1);assert.equal(h.stage.children.length,0);
});

test('a tap opens the pack; an abandoned drag leaves it ready to tear again',async()=>{
  const h=setup();let done=0;
  h.P.play({stage:h.stage,back:'back.jpg',onDone:()=>done++});
  pointer(h,'pointerdown',10);pointer(h,'pointercancel',60);
  await wait(300);
  assert.equal(h.stage.querySelector('.pack-tear').classList.contains('is-bursting'),false);
  pointer(h,'pointerdown',10);pointer(h,'pointerup',10);
  await wait(1900);
  assert.equal(done,1);
});
