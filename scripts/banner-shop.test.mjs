import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const read = file => readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const catalogue = [
  {id:'galicia',name:'Galicia',description:'Campo',art_key:'alberto-galicia-anime-v1',price:20,owned:true},
  {id:'moto',name:'Moto',description:'Ciudad',art_key:'miguel-moto-anime-v1',price:30,owned:true}
];
const snapshot = equipped => ({balance:100,cards:[],available_packs:[],vouchers:[],daily_banner_ids:['galicia','moto'],equipped_banner_id:equipped,banners:catalogue.map(banner=>({...banner,equipped:banner.id===equipped}))});
function setup(rpc) {
  const dom=new JSDOM(read('index.html'),{url:'https://club.test/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,d=w.document;
  w.matchMedia=()=>({matches:true,addEventListener(){}});
  w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.eval(read('banner-shop.js'));
  let actor='owner';
  w.BannerShop.initialize({session:()=>actor,rpc});
  d.getElementById('bannerShopDialog').open=true;
  return {dom,w,d,setActor:value=>{actor=value;}};
}

test('equipping a banner retains animated shop previews throughout confirmation, refresh and failure',async()=>{
  const equip=deferred(),refresh=deferred();
  let reads=0,equips=0,equipped='galicia',rejectNext=false;
  const h=setup(async(name,args)=>{
    if(name==='get_banner_shop_state') {reads++;return reads===3?refresh.promise:{data:snapshot(equipped)};}
    if(name==='equip_profile_banner') {equips++;if(rejectNext)return {error:{message:'No se pudo aplicar el banner.'}};return equip.promise;}
    throw new Error(`Unexpected RPC ${name}`);
  });
  try {
    await h.w.BannerShop.refresh();
    h.w.BannerShop.openEditor(true);
    await flush();
    const picker=h.d.getElementById('profileBannerPicker');picker.hidden=false;
    const shop=h.d.getElementById('bannerShopDialog'),list=h.d.getElementById('bannerShopItems');
    const previews=[...list.querySelectorAll('.shop-artwork > .banner-art')];
    const cards=[...list.children],options=[...h.d.querySelectorAll('[data-profile-banner]')];
    const button=list.querySelector('[data-banner-id="moto"]');
    shop.scrollTop=420;button.focus();
    button.click();button.dispatchEvent(new h.w.MouseEvent('click',{bubbles:true}));
    assert.equal(equips,1,'quick repeat tap cannot submit another equip');
    assert.equal(list.querySelector('[data-banner-id="moto"]'),button);
    assert.deepEqual([...list.querySelectorAll('.shop-artwork > .banner-art')],previews);
    equipped='moto';equip.resolve({data:{equipped_banner_id:equipped}});await flush();
    assert.equal(reads,3,'server snapshot is being revalidated');
    assert.equal(list.querySelector('.shop-empty'),null,'no empty placeholder during revalidation');
    assert.equal(button.textContent,'Equipado','confirmed selection is shown before refresh finishes');
    assert.deepEqual([...list.children],cards);
    assert.deepEqual([...list.querySelectorAll('.shop-artwork > .banner-art')],previews);
    assert.deepEqual([...h.d.querySelectorAll('[data-profile-banner]')],options);
    assert.equal(shop.scrollTop,420);
    refresh.resolve({data:snapshot(equipped)});await flush();await flush();
    assert.deepEqual([...list.querySelectorAll('.shop-artwork > .banner-art')],previews);
    assert.ok(h.d.getElementById('bannerShopStatus').classList.contains('is-passive'));
    rejectNext=true;
    list.querySelector('[data-banner-id="galicia"]').click();await flush();await flush();
    assert.deepEqual([...list.children],cards);
    assert.deepEqual([...list.querySelectorAll('.shop-artwork > .banner-art')],previews);
    assert.equal(button.textContent,'Equipado');
    assert.ok(h.d.getElementById('bannerShopStatus').classList.contains('is-error'));
    assert.ok(!h.d.getElementById('bannerShopStatus').classList.contains('is-passive'));
  } finally {h.dom.window.close();}
});

test('a late equip result cannot restore banners after the account is reset',async()=>{
  const equip=deferred();
  const h=setup(async name=>name==='get_banner_shop_state'?{data:snapshot('galicia')}:equip.promise);
  try {
    await h.w.BannerShop.refresh();
    h.d.querySelector('#bannerShopItems [data-banner-id="moto"]').click();
    h.setActor(null);h.w.BannerShop.reset();
    equip.resolve({data:{equipped_banner_id:'moto'}});await flush();
    assert.equal(h.d.getElementById('bannerShopDialog').open,false);
    assert.equal(h.d.getElementById('bannerShopBalance').textContent,'— monedas');
    assert.equal(h.d.getElementById('profileBannerOptions').children.length,0);
  } finally {h.dom.window.close();}
});

test('swiping a revealed duplicate up discards it and moves on; copy stays out of the way',async()=>{
  const packs=[{id:1}],draw=[{card_id:'repe',edition:'common',kind:'object',quantity:2},{card_id:'nueva',edition:'common',kind:'object',quantity:1}];
  let quantity=2;const discards=[];
  const h=setup(async(name,args)=>{
    if(name==='get_banner_shop_state')return {data:{...snapshot('galicia'),available_packs:packs,discard_rewards:{common:5},cards:[{card_id:'repe',quantity}]}};
    if(name==='open_owned_card_pack')return {data:{cards:draw}};
    if(name==='discard_duplicate_card'){discards.push(args);quantity=1;return {data:{quantity:1,balance:105,coins_earned:5}};}
    throw new Error(`Unexpected RPC ${name}`);
  });
  try {
    const {w,d}=h;
    w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
    w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
    w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.hasPointerCapture=()=>false;w.Element.prototype.releasePointerCapture=function(){};
    w.Element.prototype.getAnimations=()=>[];
    w.CardCollection={thumbnail:source=>source,catalog:[{id:'repe',name:'Repe',front:'a.jpg'},{id:'nueva',name:'Nueva',front:'b.jpg'}]};
    await h.w.BannerShop.refresh();
    d.getElementById('ownedPackOpen').disabled=false;d.getElementById('ownedPackOpen').click();
    for(let i=0;i<6;i++)await flush();
    const dialog=d.querySelector('.pack-reveal-dialog');
    assert.equal(dialog.querySelector('.pack-reveal-status').textContent,'');
    const pointer=(type,x,y)=>{const event=new w.Event(type,{bubbles:true});Object.assign(event,{pointerId:1,isPrimary:true,button:0,clientX:x,clientY:y});dialog.querySelector('.pack-reveal-stage').dispatchEvent(event);};
    const swipeUp=()=>{pointer('pointerdown',100,300);pointer('pointermove',100,270);pointer('pointermove',100,120);pointer('pointerup',100,120);};
    swipeUp();await flush();
    assert.equal(discards.length,0,'a hidden card cannot be discarded');
    pointer('pointerdown',100,300);pointer('pointerup',100,300);
    await new Promise(resolve=>setTimeout(resolve,20));
    assert.doesNotMatch(dialog.textContent,/Descartar|Pulsa la carta|Pulsa o desliza/);
    swipeUp();
    for(let i=0;i<8;i++)await flush();
    await new Promise(resolve=>setTimeout(resolve,20));
    assert.deepEqual(discards.map(item=>item.target_card_id),['repe']);
    assert.match(dialog.querySelector('.pack-reveal-header').textContent,/Carta 2 de 2/);
    assert.equal(dialog.querySelector('.pack-reveal-status').textContent,'');
    pointer('pointerdown',100,300);pointer('pointerup',100,300);
    await new Promise(resolve=>setTimeout(resolve,20));
    swipeUp();await flush();
    assert.equal(discards.length,1,'a card without copies cannot be discarded');
  } finally {h.dom.window.close();}
});
