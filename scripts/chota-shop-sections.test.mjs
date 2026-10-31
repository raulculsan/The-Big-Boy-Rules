import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const tick=()=>new Promise(setImmediate);
const portal=JSON.parse(read('artwork/chota/ps-portal/catalog.json'));
function setup(){
 const dom=new JSDOM('<div id="chotaShopStatus"></div><div id="chotaShopItems"></div>',{url:'https://fixture.test',runScripts:'outside-only'}),w=dom.window,d=w.document,calls=[];
 w.matchMedia=()=>({matches:false,addEventListener(){}});w.BIG_BOY_CONFIG={supabaseUrl:'https://fixture.invalid'};
 w.eval(read('shop-catalog-media.js'));w.eval(read('chota-shop.js'));
 let actor='a',state={balance:150,room_style:null,items:[
  {id:'forest',name:'Bosque',art_key:'room-forest',price:60,owned:true},
  {id:'midnight',name:'Azul noche',art_key:'room-midnight',price:60},
  {id:'remote-style',name:'Arena',art_key:'new-room',price:60,presentation:{type:'room_style',colors:{wall:'#554433',floor:'#776655',rug:'#665544'}}},
  {id:'ball',name:'Pelota',art_key:'football',price:10},
  {id:'skate',name:'Skate',art_key:'skateboard',price:20},
  {id:'vacuum',name:'Roomba',art_key:'robot-vacuum',price:30},
  {id:'radio',name:'Radio',art_key:'vintage-radio',price:30},portal
 ]};
 w.ChotaShop.initialize({session:()=>actor,cacheNamespace:'https://fixture.invalid',rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='buy_chota_item')state={...state,items:state.items.map(item=>item.id===args.target_item_id?{...item,owned:true}:item)};
  if(name==='equip_chota_room_style')state={...state,room_style:args.target_item_id};
  return {data:state};
 }});
 return {dom,w,d,calls,setActor:value=>{actor=value;}};
}
test('room tabs separate styles from objects and switch only visibility without RPC or DOM replacement',async()=>{
 const {dom,w,d,calls}=setup();try{
  await w.ChotaShop.refresh();
  const themes=d.getElementById('chotaAmbientesPanel'),objects=d.getElementById('chotaObjetosPanel');
  assert.deepEqual([...themes.querySelectorAll('[data-chota-item]')].map(x=>x.dataset.chotaItem),['original','forest','midnight','remote-style']);
  assert.deepEqual([...objects.querySelectorAll('[data-chota-item]')].map(x=>x.dataset.chotaItem),['ball','skate','vacuum','radio','chota-ps-portal']);
  assert.equal(themes.hidden,false);assert.equal(objects.hidden,true);
  const nodes=[...d.getElementById('chotaShopItems').querySelectorAll('*')],before=calls.length;
  const observer=new w.MutationObserver(()=>{});observer.observe(d.getElementById('chotaShopItems'),{childList:true,subtree:true});
  d.querySelector('[data-chota-tab="objetos"]').click();
  assert.equal(themes.hidden,true);assert.equal(objects.hidden,false);assert.equal(calls.length,before);
  assert.equal(observer.takeRecords().length,0);observer.disconnect();
  assert.deepEqual([...d.getElementById('chotaShopItems').querySelectorAll('*')],nodes);
  assert.equal(d.getElementById('chotaObjetosTab').getAttribute('aria-selected'),'true');
  assert.equal(d.getElementById('chotaObjetosTab').tabIndex,0);assert.equal(d.getElementById('chotaAmbientesTab').tabIndex,-1);
  assert.equal(d.getElementById('chotaObjetosTab').getAttribute('aria-controls'),objects.id);
 }finally{dom.window.close();}
});
test('selection survives refresh, purchase and equip; account changes restore Ambientes',async()=>{
 const {dom,w,d,calls,setActor}=setup();try{
  await w.ChotaShop.refresh();const objects=d.getElementById('chotaObjetosPanel'),themes=d.getElementById('chotaAmbientesPanel');
  const image=d.querySelector('[data-chota-item="chota-ps-portal"] img');
  d.getElementById('chotaObjetosTab').click();await w.ChotaShop.refresh(true);
  assert.equal(objects.hidden,false);assert.equal(d.getElementById('chotaObjetosPanel'),objects);
  d.querySelector('[data-chota-buy="chota-ps-portal"]').click();assert.equal(objects.hidden,false);await tick();assert.equal(objects.hidden,false);
  assert.equal(d.querySelector('[data-chota-item="chota-ps-portal"] img'),image);
  d.getElementById('chotaAmbientesTab').click();d.querySelector('[data-chota-equip="forest"]').click();await tick();
  assert.equal(themes.hidden,false);assert.equal(d.getElementById('chotaAmbientesPanel'),themes);
  assert.equal(calls.filter(x=>x.name==='buy_chota_item').length,1);assert.equal(calls.filter(x=>x.name==='equip_chota_room_style').length,1);
  d.getElementById('chotaObjetosTab').click();setActor('b');await w.ChotaShop.refresh(true);
  assert.equal(d.getElementById('chotaAmbientesPanel').hidden,false);assert.equal(d.getElementById('chotaObjetosPanel').hidden,true);
 }finally{dom.window.close();}
});
test('arrow keys wrap, Home/End activate and focus tabs with roving tabindex',async()=>{
 const {dom,w,d,calls}=setup();try{
  await w.ChotaShop.refresh();let raf=0;w.requestAnimationFrame=()=>raf++;
  const press=(id,key)=>d.getElementById(id).dispatchEvent(new w.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
  press('chotaAmbientesTab','ArrowRight');assert.equal(d.activeElement.id,'chotaObjetosTab');
  press('chotaObjetosTab','ArrowRight');assert.equal(d.activeElement.id,'chotaAmbientesTab');
  press('chotaAmbientesTab','ArrowLeft');assert.equal(d.activeElement.id,'chotaObjetosTab');
  press('chotaObjetosTab','Home');assert.equal(d.activeElement.id,'chotaAmbientesTab');
  press('chotaAmbientesTab','End');assert.equal(d.activeElement.id,'chotaObjetosTab');
  assert.equal(d.getElementById('chotaObjetosTab').getAttribute('aria-selected'),'true');assert.equal(calls.length,1);assert.equal(raf,0);
 }finally{dom.window.close();}
});
