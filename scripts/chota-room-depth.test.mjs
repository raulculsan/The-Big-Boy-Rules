import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const source=read('app.js');
const extract=name=>source.match(new RegExp('function '+name+'\\([^]*?\\n\\}'))[0];
const functions=['chotaLifeCatalog','chotaAttentionFamily','chotaChooseLifeAction','chotaLifeTracks','chotaRoomObstacles','chotaRoomSegmentClear','chotaRoomRoute','chotaRoomRoutePoint','chotaRoomSupportPoint','chotaRoomVisitLayout','chotaRoomTransform','tigretonSpriteMarkup','createTigretonMotion'].map(extract).join('\n');
function harness(size=400){
 const dom=new JSDOM('<body><div class="clubhouse-room"><div class="chota-room-depth"><div class="tigreton-agenda clubhouse-pet"><div class="chota-character-row"></div></div></div></div></body>',{runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,timers=new Map(),frames=new Map();let now=0,id=0,random=0;const room=w.document.querySelector('.clubhouse-room'),pet=room.querySelector('.tigreton-agenda'),row=room.querySelector('.chota-character-row');
 Object.defineProperty(w.performance,'now',{value:()=>now});w.Math.random=()=>random;
 w.setTimeout=(callback,delay)=>{timers.set(++id,{callback,delay});return id;};w.clearTimeout=id=>timers.delete(id);
 w.requestAnimationFrame=callback=>{frames.set(++id,callback);return id;};w.cancelAnimationFrame=id=>frames.delete(id);
 w.Element.prototype.animate=()=>({cancel(){},onfinish:null});
 w.IntersectionObserver=class{constructor(callback){this.callback=callback;}observe(){this.callback([{isIntersecting:true}]);}disconnect(){}};
 w.tigretonReducedMotion={matches:false,addEventListener(){},removeEventListener(){}};w.isChotaSleeping=()=>false;w.tigretonDaysUntil=()=>1;
 for(const name of ['ensureChotaDirectionalSprite','ensureChotaContextSprite','ensureChotaRoomSprite'])w[name]=async()=>true;
 w.eval(functions);row.innerHTML=w.tigretonSpriteMarkup();
 const box=(x,y,width)=>({left:x,top:y,width,height:width,right:x+width,bottom:y+width,x,y});
 room.getBoundingClientRect=()=>box(0,0,size);row.getBoundingClientRect=()=>box(size*.36,size*.5354,size*.28);pet.querySelector('.tigreton-sprite').getBoundingClientRect=row.getBoundingClientRect;
 const api=w.createTigretonMotion(pet,false,null,null);
 return {w,api,pet,room,row,async visit(kind){now=120000;random=kind==='sofa'?.75:0;const state=api.captureRoomState();state.ambient.lifeAge=0;api.resume(state);const entry=[...timers.values()].find(t=>t.delay===7000+random*6500);assert.ok(entry);const rng=w.Math.random;let draws=0;w.Math.random=()=>++draws===1?0:rng();entry.callback();w.Math.random=rng;await new Promise(r=>setImmediate(r));},advance(ms){now+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(now));},sleep(value){w.isChotaSleeping=()=>value;},runTimer(ms,delay=95){now+=ms;const entry=[...timers.entries()].find(([,t])=>t.delay===delay);assert.ok(entry);timers.delete(entry[0]);entry[1].callback();},frames,close(){api.destroy();dom.window.close();}};
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
 const c=harness();try{const {target,approach,width}=c.w.chotaRoomVisitLayout('sofa');const hipsY=target.y-target.z-(.945-.69)*width;
 assert.ok(hipsY>.60&&hipsY<.62);assert.ok(target.x>.10&&target.x<.15);assert.ok(approach.x>.21&&approach.y>.72);
 }finally{c.close();}
});
function polygon(svg,index=1){const path=svg.match(/<path[^>]* d="([^"]+)"/)[1],sub=path.split('Z')[index];return [...sub.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map(([,x,y])=>[+x/1024,+y/1024]);}
function inside(point,vertices){let hit=false;for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){const [xi,yi]=vertices[i],[xj,yj]=vertices[j];if((yi>point[1])!==(yj>point[1])&&point[0]<(xj-xi)*(point[1]-yi)/(yj-yi)+xi)hit=!hit;}return hit;}
test('depth masks keep the back cushion behind a seated head and hide it only behind the sofa',()=>{
 const back=read('icons/clubhouse/chota-depth-back-back.svg'),seat=read('icons/clubhouse/chota-depth-seat-back.svg'),front=read('icons/clubhouse/chota-depth-front-front.svg');
 assert.equal(inside([.125,.55],polygon(back,0)),true);
 assert.equal(inside([.125,.55],polygon(seat,0)),false);
 assert.equal(inside([.055,.655],polygon(seat,0)),true);
 assert.equal(inside([.125,.55],polygon(front,0)),false);
 assert.equal(inside([.825,.635],polygon(back,1)),true);
 assert.equal(inside([.765,.635],polygon(back,1)),false);
 // SVG masks union black silhouettes, including overlapping table/sofa contours.
 assert.match(back,/<mask[^>]*maskUnits="userSpaceOnUse"/);
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

test('swept feet route around furniture and newly owned floor objects without tunnelling',()=>{
 const c=harness();try {
 const w=c.w,obstacles=[...w.chotaRoomObstacles(),{id:'ball',x0:.43,y0:.68,x1:.5,y1:.73}];
 const from={x:.5,y:.8,s:1},to={x:.345,y:.605,s:.84};
 assert.equal(w.chotaRoomSegmentClear(from,to,obstacles),false,'direct path crosses the purchased object');
 const route=w.chotaRoomRoute(from,to,obstacles);assert.ok(route.length>2);
 for(let i=1;i<route.length;i++) assert.equal(w.chotaRoomSegmentClear(route[i-1],route[i],obstacles),true);
 for(let i=0;i<=100;i++) {const p=w.chotaRoomRoutePoint(route,i/100);assert.equal(p.z,0);for(const b of obstacles) assert.ok(p.x<=b.x0-.023 || p.x>=b.x1+.023 || p.y<=b.y0-.023 || p.y>=b.y1+.023);}
 const blocked=w.chotaRoomRoute(from,{x:.1,y:.65,s:.84},obstacles);assert.equal(blocked.length,1);assert.equal(blocked[0].x,from.x);
 }finally{c.close();}
});
test('support trajectories have downward acceleration, exact landings and a fixed floor projection',()=>{
 const c=harness();try {
 const {approach,target}=c.w.chotaRoomVisitLayout('sofa');
 for(const [a,b] of [[approach,target],[target,approach]]) {
 const points=[0,.25,.5,.75,1].map(t=>c.w.chotaRoomSupportPoint(a,b,t));
 assert.equal(points[0].z,a.z);assert.ok(Math.abs(points[4].z-b.z)<1e-12);
 assert.ok(points[3].z>points[4].z,'lands while descending');
 assert.ok(points[2].z-2*points[1].z+points[0].z<0);
 assert.ok(points.every(p=>p.y===.755 && p.z>=0));
 }
 }finally{c.close();}
});
test('interrupted seat visits dismount before walking home and release masks on pause',async()=>{
 const c=harness();try {
 await c.visit('sofa');c.advance(8000);assert.equal(c.api.captureRoomState().position.z,.088);
 c.api.noticeUser();c.advance(325);const back=c.api.captureRoomState();assert.ok(back.position.z>0);assert.ok(back.returning);
 c.advance(326);assert.equal(c.api.captureRoomState().position.z,0);assert.equal(c.pet.classList.contains('is-sitting-on-sofa'),false);
 const depth=c.pet.closest('.chota-room-depth');assert.equal(depth.dataset.sofaDepth,'front');
 c.api.pause();assert.equal(c.frames.size,0);assert.equal(depth.dataset.sofaDepth,undefined);
 c.api.resume(back);assert.ok(c.api.captureRoomState().position.z>0,'resume preserves the dismount');
 }finally{c.close();}
});
test('room route point and transforms keep height separate from camera size',()=>{
 const c=harness();try {
 const {target}=c.w.chotaRoomVisitLayout('sofa'),home={x:.5,y:.8,s:1};
 for(const size of [320,650,1024]) {const transform=c.w.chotaRoomTransform(target,home,size);const values=transform.match(/translate\(([-.\d]+)px,([-.\d]+)px\)/);assert.ok(Math.abs(+values[2]/size-(target.y-target.z-home.y))<1e-12);}
 }finally{c.close();}
});

test('night walking follows the same floor geometry and its fingertip reaches the switch',async()=>{
 const c=harness();try {
 const rocker=c.w.document.createElement('i');rocker.className='clubhouse-light-switch';c.room.append(rocker);
 rocker.getBoundingClientRect=()=>({left:400*.307,top:400*.482,width:400*.023,height:400*.035});
 c.sleep(true);let switched=0;assert.equal(c.api.bedtime(()=>switched++),true);await new Promise(r=>setImmediate(r));
 c.runTimer(3000);const walk=c.row.style.transform;assert.match(walk,/translate/);
 c.runTimer(3000);assert.equal(switched,1);const values=c.row.style.transform.match(/translate\(([-.\d]+)px,([-.\d]+)px\)/);
 const feet={x:.5+(+values[1])/400,y:.8+(+values[2])/400};
 assert.ok(Math.abs(feet.x+(30/256-.5)*.235-.3185)<1e-10);
 assert.ok(Math.abs(feet.y+(80/256-.945)*.235-.4995)<1e-10);
 assert.equal(c.w.chotaRoomSegmentClear({x:.5,y:.8},feet,c.w.chotaRoomObstacles()),true);
 c.runTimer(6000);assert.match(c.row.style.transform,/translate\(0px,0px\)/);
 }finally{c.close();}
});

test('bedtime interrupts a seated visit by dismounting before the wall route',async()=>{
 const c=harness();try {
 await c.visit('sofa');c.advance(8000);const seatedTransform=c.row.style.transform;
 c.sleep(true);assert.equal(c.api.bedtime(()=>{}),true);assert.equal(c.row.style.transform,seatedTransform,'sprite loading preserves the current support');
 await new Promise(r=>setImmediate(r));c.runTimer(325);assert.equal(c.pet.classList.contains('is-sitting-on-sofa'),true);
 assert.equal(c.pet.closest('.chota-room-depth').dataset.sofaDepth,'seat');
 c.runTimer(326);assert.equal(c.pet.classList.contains('is-sitting-on-sofa'),false);
 assert.equal(c.pet.closest('.chota-room-depth').dataset.sofaDepth,'front');
 c.runTimer(12000);assert.match(c.row.style.transform,/translate\(0px,0px\)/);
 }finally{c.close();}
});

test('a requested new gesture waits for the supported sofa dismount and collision-safe return',async()=>{
 const c=harness();try {
 await c.visit('sofa');c.advance(8000);const before=c.api.captureRoomState().position;
 c.api.play('sneeze');const pending=c.api.captureRoomState();assert.equal(pending.kind,'sofa');assert.ok(pending.returning);assert.deepEqual(JSON.parse(JSON.stringify(pending.position)),JSON.parse(JSON.stringify(before)));
 c.advance(325);assert.ok(c.api.captureRoomState().position.z>0);assert.equal(c.pet.dataset.attention,'visit-sofa');
 c.advance(5000);assert.equal(c.api.captureRoomState().kind,'ambient');assert.equal(c.api.captureRoomState().life.action,'sneeze');assert.equal(c.row.style.transform,'');assert.equal(c.pet.classList.contains('is-sitting-on-sofa'),false);
 }finally{c.close()}
});
