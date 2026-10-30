import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const source=read('app.js');
const extract=name=>source.match(new RegExp('function '+name+'\\([^]*?\\n\\}'))[0];
const functions=['chotaRoomVisitLayout','chotaRoomTransform','tigretonSpriteMarkup','createTigretonMotion'].map(extract).join('\n');
function harness(size=400){
 const dom=new JSDOM('<body><div class="clubhouse-room"><div class="chota-room-depth"><div class="tigreton-agenda clubhouse-pet"><div class="chota-character-row"></div></div></div></div></body>',{runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,timers=new Map(),frames=new Map();let now=0,id=0,random=0;const room=w.document.querySelector('.clubhouse-room'),pet=room.querySelector('.tigreton-agenda'),row=room.querySelector('.chota-character-row');
 Object.defineProperty(w.performance,'now',{value:()=>now});w.Math.random=()=>random;
 w.setTimeout=(callback,delay)=>{timers.set(++id,{callback,delay});return id;};w.clearTimeout=id=>timers.delete(id);
 w.requestAnimationFrame=callback=>{frames.set(++id,callback);return id;};w.cancelAnimationFrame=id=>frames.delete(id);
 w.HTMLElement.prototype.animate=()=>({cancel(){},onfinish:null});
 w.IntersectionObserver=class{constructor(callback){this.callback=callback;}observe(){this.callback([{isIntersecting:true}]);}disconnect(){}};
 w.tigretonReducedMotion={matches:false,addEventListener(){},removeEventListener(){}};w.isChotaSleeping=()=>false;w.tigretonDaysUntil=()=>1;
 for(const name of ['ensureChotaDirectionalSprite','ensureChotaContextSprite','ensureChotaRoomSprite'])w[name]=async()=>true;
 w.eval(functions);row.innerHTML=w.tigretonSpriteMarkup();
 const box=(x,y,width)=>({left:x,top:y,width,height:width,right:x+width,bottom:y+width,x,y});
 room.getBoundingClientRect=()=>box(0,0,size);row.getBoundingClientRect=()=>box(size*.36,size*.5354,size*.28);pet.querySelector('.tigreton-sprite').getBoundingClientRect=row.getBoundingClientRect;
 const api=w.createTigretonMotion(pet,false,null,null);
 return {w,api,pet,room,row,async visit(kind){now=50000;random=kind==='sofa'?.75:0;const entry=[...timers.values()].find(t=>t.delay===7000);assert.ok(entry);entry.callback();await new Promise(r=>setImmediate(r));},advance(ms){now+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(now));},close(){api.destroy();dom.window.close();}};
}
test('camera resizing preserves normalised feet, seat scale and current visit phase',async()=>{
 for(const [kind,time] of [['window',6000],['sofa',8000]]){
  const home=harness(360),viewer=harness(650);try{
   await home.visit(kind);home.advance(time);const snapshot=home.api.captureRoomState();assert.equal(snapshot.kind,kind);
   home.api.pause();viewer.api.resume(snapshot);const restored=viewer.api.captureRoomState();
   assert.deepEqual(JSON.parse(JSON.stringify(restored.position)),JSON.parse(JSON.stringify(snapshot.position)));
   assert.equal(restored.elapsed,snapshot.elapsed);assert.equal(viewer.pet.classList.contains('is-sitting-on-sofa'),kind==='sofa');
   const transform=viewer.row.style.transform;assert.match(transform,/scale\(0\.[0-9]+\)/);
   const width=viewer.w.chotaRoomVisitLayout(kind).width;assert.ok(Math.abs(restored.position.s*.28-width)<1e-10);
   const next=viewer.api.captureRoomState();viewer.api.pause();home.api.resume(next);assert.deepEqual(JSON.parse(JSON.stringify(home.api.captureRoomState().position)),JSON.parse(JSON.stringify(snapshot.position)));
  }finally{home.close();viewer.close();}
 }
});
test('seated hips land on the left cushion while the walking approach stays outside the sofa',()=>{
 const c=harness();try{const {target,approach,width}=c.w.chotaRoomVisitLayout('sofa');const hipsY=target.y-(.945-.69)*width;
 assert.ok(hipsY>.60&&hipsY<.62);assert.ok(target.x>.10&&target.x<.15);assert.ok(approach.x>.21&&approach.y>.72);
 }finally{c.close();}
});
function polygon(svg,index=1){const path=svg.match(/d="([^"]+)"/)[1],sub=path.split('Z')[index];return [...sub.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map(([,x,y])=>[+x/1024,+y/1024]);}
function inside(point,vertices){let hit=false;for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){const [xi,yi]=vertices[i],[xj,yj]=vertices[j];if((yi>point[1])!==(yj>point[1])&&point[0]<(xj-xi)*(point[1]-yi)/(yj-yi)+xi)hit=!hit;}return hit;}
test('room-fixed alpha cutouts hide the window-side shoe behind the chair, preserving adjacent floor and the seated head',()=>{
 const normal=read('icons/clubhouse/chota-room-occlusion.svg'),seated=read('icons/clubhouse/chota-sofa-occlusion.svg');
 assert.match(normal,/fill-rule="evenodd"/);assert.ok(inside([.825,.635],polygon(normal)));assert.equal(inside([.765,.635],polygon(normal)),false);
 assert.ok(inside([.055,.655],polygon(seated,2)));assert.equal(inside([.125,.49],polygon(seated,2)),false);
 const css=read('clubhouse.css');assert.match(css,/\.chota-room-depth\s*\{[^}]*pointer-events:none/);assert.doesNotMatch(css,/\.chota-sofa-foreground/);
});

test('viewer speech remains in room coordinates outside the masked, positioned actor',()=>{
 const c=harness(400);try{
  const template=source.match(/if \(!viewer.children.length\) viewer.innerHTML = `([^]*?)`;/)[1];
  const markup=new Function('next','escapeHtml','clubhouseSkyMarkup','clubhouseDaylightMarkup','clubhouseSeasonalMarkup','tigretonSpriteMarkup',`return \`${template}\`;`)({event:{title:'Plan'}},value=>value,()=>'',()=>'',()=>'',c.w.tigretonSpriteMarkup);
  const viewer=c.w.document.createElement('div');viewer.innerHTML=markup;c.w.document.body.append(viewer);
  const room=viewer.querySelector('.chota-viewer-room-scene'),bubble=viewer.querySelector('.chota-viewer-status'),sprite=room.querySelector('.tigreton-sprite');
  assert.equal(bubble.parentElement.parentElement,room,'display:contents slot must be a direct room child');
  assert.equal(bubble.closest('.chota-room-depth,.tigreton-agenda'),null,'the character mask and local origin must not affect speech');
  Object.defineProperty(room,'clientWidth',{value:400});room.getBoundingClientRect=()=>({left:20,top:40,width:400,height:400});sprite.getBoundingClientRect=()=>({left:164,top:254.16,width:112,height:112});
  Object.defineProperty(bubble,'offsetWidth',{value:180});Object.defineProperty(bubble,'offsetHeight',{value:40});bubble.hidden=false;
  c.w.eval(extract('positionChotaBubbles'));c.w.positionChotaBubbles();
  assert.ok(Math.abs(parseFloat(bubble.style.left)-94.24)<.001);assert.ok(Math.abs(parseFloat(bubble.style.top)-178.08)<.001);
  c.w.eval(extract('showChotaCommentResult'));c.w.queueChotaBubblePosition=()=>{};c.w.showChotaCommentResult(bubble,'Nos vemos mañana');
  assert.equal(bubble.querySelector('.chota-viewer-comment').textContent,'Nos vemos mañana');assert.equal(bubble.getAttribute('aria-busy'),'false');
 }finally{c.close();}
});
