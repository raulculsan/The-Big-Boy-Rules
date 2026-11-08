import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const code=fs.readFileSync(new URL('../chota-wardrobe.js',import.meta.url),'utf8');
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const markup=source.match(/function tigretonSpriteMarkup\([^]*?\n\}/)[0];
function harness(){const dom=new JSDOM('<body><main></main></body>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,loads=[];w.Image=class{naturalWidth=768;set src(value){this.url=value;loads.push(value)}decode(){return Promise.resolve()}};w.eval(code);w.eval(markup);w.document.querySelector('main').innerHTML=w.tigretonSpriteMarkup();return {w,api:w.ChotaWardrobe,loads,character:w.document.querySelector('.tigreton-character'),close:()=>dom.window.close()};}
test('loading the module preserves the original character and does not equip, preload or read ownership',()=>{const h=harness();try{const before=h.character.outerHTML;h.api.mount(h.character);assert.equal(h.character.outerHTML,before);assert.equal(h.api.selected(),null);assert.deepEqual(h.loads,[]);for(const item of h.api.items()){assert.equal(item.purchase_enabled,false);assert.equal(item.active,false);assert.equal(item.price_coins,null);}}finally{h.close()}});
test('equipping one local color decodes its five sheets only and attaches to the real animated joints',async()=>{const h=harness();try{h.api.frame(h.character,'directional',18);await h.api.previewEquip('chota-tnf-rojo-v1');assert.equal(h.loads.length,5);assert.ok(h.loads.every(url=>url.includes('tnf-rojo-')));assert.equal(h.character.querySelector('.chota-wardrobe-main').dataset.coatFrame,'rojo:directional:18');for(const [child,parent]of [['idle-body','chota-idle-body'],['idle-head','chota-idle-head'],['idle-paw','chota-idle-paw'],['sleep-chest','chota-sleep-chest']])assert.ok(h.character.querySelector('.chota-wardrobe-'+child).parentElement.classList.contains(parent));await h.api.previewEquip('rojo');assert.equal(h.loads.length,5,'re-equipping uses the decoded request');await h.api.previewEquip(null);assert.equal(h.character.querySelector('.chota-wardrobe-layer'),null);assert.equal(h.character.classList.contains('has-chota-outfit'),false);}finally{h.close()}});
test('all 67 frames keep original sprite styles untouched while selecting a corresponding garment cell',async()=>{const h=harness();try{await h.api.previewEquip('azul');h.character.style.backgroundPosition='20% 33%';h.character.style.transform='rotate(.7deg)';const original=h.character.style.backgroundPosition;for(const [sheet,count]of Object.entries({base:24,directional:20,contextual:16,room:4,talk:3}))for(let frame=0;frame<count;frame++){h.api.frame(h.character,sheet,frame);assert.equal(h.character.querySelector('.chota-wardrobe-main').dataset.coatFrame,`azul:${sheet}:${frame}`);assert.equal(h.character.style.backgroundPosition,original);assert.equal(h.character.style.transform,'rotate(.7deg)');}assert.equal(h.api.poseCount,67);const before=h.character.querySelector('.chota-wardrobe-main').outerHTML;h.api.frame(h.character,'talk',99);assert.equal(h.character.querySelector('.chota-wardrobe-main').outerHTML,before);await assert.rejects(h.api.previewEquip('fake-paid-item'),{name:'TypeError'});}finally{h.close()}});
test('clearing an in-flight local equip prevents a late decoder from restoring clothing',async()=>{const h=harness();try{let release;h.w.Image=class{naturalWidth=768;set src(v){}decode(){return new Promise(resolve=>{const previous=release;release=()=>{previous?.();resolve()}})}};const pending=h.api.previewEquip('morado');await h.api.previewEquip(null);release();await pending;assert.equal(h.api.selected(),null);assert.equal(h.character.querySelector('.chota-wardrobe-layer'),null);}finally{h.close()}});

test('production frame helpers and sleep/speech/context transitions keep the garment in the same cell',async()=>{
 const h=harness(),w=h.w;let sleeping=false;const timers=[];
 try{
  w.document.querySelector('main').innerHTML='<div class="clubhouse-room"><div class="tigreton-agenda">'+w.tigretonSpriteMarkup()+'</div></div>';
  const character=w.document.querySelector('.tigreton-character'),pet=character.closest('.tigreton-agenda');
  w.IntersectionObserver=class{constructor(cb){this.cb=cb}observe(){this.cb([{isIntersecting:true}])}disconnect(){}};
  w.tigretonReducedMotion={matches:false,addEventListener(){},removeEventListener(){}};w.isChotaSleeping=()=>sleeping;w.tigretonDaysUntil=()=>1;
  w.chotaSpritesReady={poses:true,talk:true};for(const name of ['ensureChotaDirectionalSprite','ensureChotaContextSprite','ensureChotaRoomSprite','ensureChotaSprites'])w[name]=async()=>true;
  w.setTimeout=(fn,delay)=>{timers.push({fn,delay});return timers.length};w.clearTimeout=id=>{if(timers[id-1])timers[id-1].cancelled=true};
  w.Element.prototype.animate=()=>({cancel(){},onfinish:null});
  const names=['chotaLifeCatalog','chotaAttentionFamily','chotaChooseLifeAction','chotaLifeTracks','chotaRoomObstacles','chotaRoomSegmentClear','chotaRoomRoute','chotaRoomRoutePoint','chotaRoomSupportPoint','chotaRoomVisitLayout','chotaRoomTransform','createTigretonMotion'];
  let functions=names.map(name=>source.match(new RegExp('function '+name+'\\([^]*?\\n\\}'))[0]).join('\n');
  functions=functions.replace('    play,\n    speak,','    play,\n    testBase:setFrame,testDirectional:setDirectionalFrame,testRoom:roomPose,testPersonal:playPersonal,\n    speak,');w.eval(functions);
  const api=w.createTigretonMotion(pet,false,null,null);await h.api.previewEquip('crema');const cell=()=>character.querySelector('.chota-wardrobe-main').dataset.coatFrame;
  for(let i=0;i<24;i++){api.testBase(i);assert.equal(cell(),'crema:base:'+i);}for(let i=0;i<20;i++){api.testDirectional(i);assert.equal(cell(),'crema:directional:'+i);}for(let i=0;i<4;i++){api.testRoom(i);assert.equal(cell(),'crema:room:'+i);}
  api.refresh();for(const [action,row]of [['plan',0],['scratch',1],['stretch',2],['shirt',3]]){api.testPersonal(action);await Promise.resolve();await Promise.resolve();assert.equal(cell(),'crema:contextual:'+row*4);}
  api.speak('Hola Chota');assert.match(cell(),/^crema:talk:[0-2]$/);sleeping=true;api.refresh();assert.equal(cell(),'crema:base:22');assert.equal(character.classList.contains('is-sleep-breathing'),true);
  sleeping=false;api.refresh();assert.equal(cell(),'crema:base:0');for(const action of Object.keys(w.chotaLifeCatalog())){api.play(action);assert.equal(cell(),'crema:base:0');assert.equal(character.classList.contains('is-idling'),true);}
  api.pause();assert.equal(character.classList.contains('has-chota-outfit'),true);api.destroy();
 }finally{h.close()}
});

test('all six garment colors contain 67 nonempty transparent cells, with original face and shoes clear',async(t)=>{
 const {loadSharp}=await import('../artwork/chota/wardrobe-rig-v1/load-sharp.mjs');let sharp;try{sharp=await loadSharp();}catch(error){t.skip(error.message);return;}
 const manifest=JSON.parse(fs.readFileSync(new URL('../artwork/chota/wardrobe-rig-v1/runtime-manifest.json',import.meta.url),'utf8'));
 assert.equal(manifest.poseCount,67);assert.equal(manifest.runtime.length,30);
 for(const asset of manifest.runtime){const {data,info}=await sharp(new URL('../'+asset.asset,import.meta.url).pathname).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.width,asset.cols*128);assert.equal(info.height,asset.rows*128);
  for(let frame=0;frame<asset.count;frame++){let opaque=0;const left=frame%asset.cols*128,top=Math.floor(frame/asset.cols)*128;for(let y=0;y<128;y++)for(let x=0;x<128;x++)if(data[((top+y)*info.width+left+x)*4+3]>128)opaque++;assert.ok(opaque>100&&opaque<6000,asset.asset+' frame '+frame+' has only garment pixels');}
  if(asset.sheet==='base')for(const [x,y]of [[140,80],[125,100],[165,110],[105,225],[162,230]])assert.equal(data[(Math.floor(y/2)*info.width+Math.floor(x/2))*4+3],0,asset.color+' preserves original face/shoes');
 }
});
