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
