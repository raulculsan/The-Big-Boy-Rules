import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {JSDOM} from 'jsdom';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const grids={base:[6,4],directional:[5,4],contextual:[4,4],room:[4,1],talk:[3,1]};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function setup(approved=true){
 const dom=new JSDOM('<main><span class="tigreton-character"><i class="chota-idle-body"></i><i class="chota-idle-feet"></i><i class="chota-idle-head"></i><i class="chota-sleep-chest"></i></span></main>',{url:'https://club.test/',runScripts:'outside-only'}),w=dom.window,jobs=[],revoked=[],loads=[],blobs=new Map();let fetches=0;
 const contract=JSON.parse(read('icons/mascot/chota-v2/tailored-v5/manifest-v1.json'));w.fetch=async()=>{fetches++;return{ok:true,json:async()=>({...contract,approved})}};
 w.Image=class{set src(value){this.url=value;loads.push(value);const sheet=blobs.get(value)||Object.keys(grids).find(s=>new RegExp('-'+s+'(?:-|\\.webp$)').test(value));[this.naturalWidth,this.naturalHeight]=(grids[sheet]||[6,4]).map(n=>n*256);}decode(){return Promise.resolve();}};
 let serial=0;w.URL.createObjectURL=blob=>{const url='blob:'+serial++;blobs.set(url,blob.sheet);return url;};w.URL.revokeObjectURL=url=>revoked.push(url);
 w.Worker=class{constructor(){this.terminated=false;}postMessage(value){jobs.push({value,worker:this});}terminate(){this.terminated=true;}};
 w.eval(read('chota-appearance.js'));w.eval(read('chota-wardrobe.js'));
 const finish=async index=>{const job=jobs[index],results=Object.keys(grids).map(sheet=>{const blob=new w.Blob(['sheet']);blob.sheet=sheet;return{sheet,blob};});await job.worker.onmessage({data:{sequence:job.value.sequence,results}});};
 return{w,dom,jobs,revoked,loads,fetches:()=>fetches,finish,close:()=>dom.window.close()};
}
const item=(slot,key)=>({id:'chota-'+key,item_kind:'clothing',slot,owned:true,rig_version:'chota-'+slot+'-overlay-v1',garment:{type:'builtin',key}});
const originalItems=()=>({topwear:item('topwear','original-stussy-v1'),bottomwear:item('bottomwear','original-jeans-v1'),footwear:item('footwear','original-jordan-chicago-v1'),outerwear:null});
test('modular code stays inactive and network-free until an explicitly approved contract is requested',async()=>{const h=setup(false);try{
 assert.equal(h.fetches(),0);assert.equal(h.jobs.length,0);assert.equal(h.w.ChotaAppearance.enabled(),false);
 await assert.rejects(h.w.ChotaWardrobe.applyOutfit(originalItems()),/pendiente de revisión/);
 assert.equal(h.w.document.documentElement.dataset.chotaModular,undefined);assert.equal(h.w.ChotaWardrobe.outfit().length,0);
 }finally{h.close();}});
test('all four clothing slots commit with a matching five-sheet composition; frame changes create no worker jobs',async()=>{const h=setup();try{
 const character=h.w.document.querySelector('.tigreton-character');h.w.ChotaWardrobe.frame(character,'talk',2);
 const promise=h.w.ChotaWardrobe.applyOutfit(originalItems());await flush();assert.equal(h.jobs.length,1);assert.equal(h.w.ChotaWardrobe.outfit().length,0,'no half-equipped outfit before composition');
 assert.ok(Object.values(h.jobs[0].value.anatomy).every(url=>url.includes('/tailored-v5/anatomy-')),'defaults use garment-free anatomy, never a flattened clothed actor');assert.equal(h.jobs[0].value.layers.length,3);assert.ok(h.jobs[0].value.layers.every(layer=>Object.values(layer.atlases).every(url=>url.includes('/tailored-v5/original-'))));
 await h.finish(0);await promise;assert.equal(h.w.ChotaAppearance.enabled(),true);assert.equal(h.w.ChotaWardrobe.outfit().length,3);assert.equal(h.w.ChotaWardrobe.shoes(),'chota-original-jordan-chicago-v1');
 for(const[sheet,[cols,rows]]of Object.entries(grids))for(let frame=0;frame<({base:24,directional:20,contextual:16,room:4,talk:3}[sheet]);frame++)h.w.ChotaWardrobe.frame(character,sheet,frame);
 assert.equal(h.jobs.length,1,'composition only on an outfit change');assert.match(character.querySelector('.chota-wardrobe-shoes-main').dataset.shoesFrame,/talk:2$/);
 assert.equal(character.querySelector('.chota-idle-body').children[0].className,'chota-wardrobe-pants chota-wardrobe-pants-idle-body');
 assert.equal(character.querySelector('.chota-idle-body').children[1].className,'chota-wardrobe-shoes chota-wardrobe-shoes-idle-body');
 }finally{h.close();}});
test('an owner reset cancels in-flight composition and never restores the previous account outfit',async()=>{const h=setup();try{
 const promise=h.w.ChotaWardrobe.applyOutfit(originalItems());await flush();assert.equal(h.jobs.length,1);
 await h.w.ChotaWardrobe.applyOutfit(null);await h.finish(0);await promise;
 assert.equal(h.w.ChotaAppearance.enabled(),false);assert.equal(h.w.ChotaWardrobe.outfit().length,0);assert.equal(h.w.document.querySelector('.has-chota-shoes'),null);
 assert.match(h.w.ChotaAppearance.sheet('base'),/chota-poses\.webp$/);
 }finally{h.close();}});
test('clearing each original slot is explicit; recomposition does not force defaults back on',async()=>{const h=setup();try{
 let clothes=originalItems();let promise=h.w.ChotaWardrobe.applyOutfit(clothes);await flush();await h.finish(0);await promise;
 clothes={...clothes,footwear:null};promise=h.w.ChotaWardrobe.applyOutfit(clothes);await flush();await h.finish(1);await promise;
 assert.equal(h.w.ChotaWardrobe.shoes(),null);assert.equal(h.w.ChotaWardrobe.outfit().length,2);
 promise=h.w.ChotaWardrobe.applyOutfit({topwear:null,bottomwear:null,footwear:null,outerwear:null});await flush();await h.finish(2);await promise;
 assert.equal(h.w.ChotaWardrobe.outfit().length,0);assert.equal(h.w.ChotaAppearance.enabled(),true,'bare anatomical body remains active');
 }finally{h.close();}});

test('legacy NULL slots use visual originals without granting ownership; modular NULL slots remain bare',async()=>{const h=setup();try{
 const empty={topwear:null,bottomwear:null,footwear:null,outerwear:null};let promise=h.w.ChotaWardrobe.applyLegacyOutfit(empty);await flush();assert.equal(h.jobs[0].value.layers.length,3);await h.finish(0);await promise;
 assert.equal(h.w.ChotaWardrobe.outfit().length,0,'implicit visuals never become owned/equipped inventory');assert.equal(h.w.ChotaWardrobe.shirt(),null);
 promise=h.w.ChotaWardrobe.applyOutfit(empty);await flush();assert.equal(h.jobs[1].value.layers.length,0);await h.finish(1);await promise;assert.equal(h.w.ChotaAppearance.enabled(),true);
 }finally{h.close();}});
test('fitting preview composes independently, never cancels or equips an actual outfit, and releases its own blobs',async()=>{const h=setup();try{
 const actual=h.w.ChotaWardrobe.applyOutfit(originalItems());await flush();const model=h.w.document.createElement('span');model.className='fitting-chota';model.innerHTML='<span class="fitting-chota-body"></span>';h.w.document.body.append(model);
 const trial=h.w.ChotaWardrobe.preview(model,{...originalItems(),topwear:{...item('topwear','supreme-negra-v1'),owned:false}});await flush();assert.equal(h.jobs.length,2);assert.notEqual(h.jobs[0].worker,h.jobs[1].worker);
 await h.finish(1);await trial;const trialURL=model.querySelector('.fitting-chota-body').style.backgroundImage;assert.equal(model.dataset.chotaComposed,'true');assert.equal(h.w.ChotaAppearance.enabled(),false);assert.equal(h.w.ChotaWardrobe.shirt(),null);
 await h.finish(0);await actual;assert.equal(h.w.ChotaWardrobe.shirt(),'chota-original-stussy-v1');assert.equal(model.querySelector('.fitting-chota-body').style.backgroundImage,trialURL);
 const equippedURL=h.w.ChotaAppearance.sheet('base');h.w.ChotaWardrobe.releasePreview(model);assert.equal(h.jobs[1].worker.terminated,true);assert.equal(h.jobs[0].worker.terminated,false);assert.ok(!h.revoked.includes(equippedURL));assert.equal(model.dataset.chotaComposed,undefined);
 }finally{h.close();}});
