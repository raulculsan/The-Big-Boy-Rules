import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {PGlite} from '@electric-sql/pglite';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const item=JSON.parse(read('./catalog.json'));
test('Portal validates server-side and insert-only publication is idempotent',async()=>{
 const db=new PGlite();
 try {
  // Use the existing validators verbatim; no deployed database or credentials.
  await db.exec(read('../../../supabase/migrations/20261027191500_remote_shop_catalog.sql').split('alter table public.profile_banner_catalog')[0]+'commit;');
  assert.equal((await db.query("select public.valid_shop_presentation($1,'chota') valid",[item.presentation])).rows[0].valid,true);
  await db.exec('create table public.chota_item_catalog(id text primary key,name text,description text,art_key text unique,price integer,active boolean,sort_order integer,presentation jsonb check(public.valid_shop_presentation(presentation,\'chota\')));');
  await db.exec(read('./publish.sql'));
  await db.exec("update public.chota_item_catalog set price=42 where id='chota-ps-portal';");
  await db.exec(read('./publish.sql'));
  const rows=(await db.query('select * from public.chota_item_catalog')).rows;
  assert.equal(rows.length,1);assert.equal(rows[0].price,42);assert.deepEqual(rows[0].presentation,item.presentation);
 } finally {await db.close();}
});
test('real catalog/shop render after purchase in both rooms and restore offline without extra RPC/RAF',async()=>{
 const dom=new JSDOM('<div id="chotaShopItems"></div><div id="chotaShopStatus"></div><div class="clubhouse-room"><div class="clubhouse-seasonal"></div></div><div class="chota-viewer-room-scene"><div class="clubhouse-seasonal"></div></div>',{url:'https://local.test/',runScripts:'outside-only'});
 const w=dom.window,d=w.document,calls=[];let raf=0;
 w.BIG_BOY_CONFIG={supabaseUrl:'https://fixture.invalid'};
 w.matchMedia=()=>({matches:false,addEventListener(){}});
 w.requestAnimationFrame=()=>{raf++;};
 w.eval(read('../../../shop-catalog-media.js'));w.eval(read('../../../chota-shop.js'));
 let current={balance:100,items:[{...item,owned:false}]};
 w.ChotaShop.initialize({session:()=> 'fixture',cacheNamespace:'https://fixture.invalid',rpc:async(name,args)=>{
  calls.push([name,args]);if(name==='buy_chota_item')current={balance:65,items:[{...item,owned:true}]};return {data:current};
 }});
 try {
  assert.equal(w.ShopCatalogMedia.presentation(item,'chota').type,'decoration');
  await w.ChotaShop.refresh();const rooms=[...d.querySelectorAll('.clubhouse-room,.chota-viewer-room-scene')];const seasonal=rooms.map(room=>room.firstElementChild);
  rooms.forEach(w.ChotaShop.mountRoom);
  assert.ok(d.querySelector('[data-chota-item="chota-ps-portal"] img').src.endsWith('/shop-media/chota/ps-portal-v1.png'));
  assert.equal(d.querySelectorAll('[data-chota-room-item]').length,0);
  d.querySelector('[data-chota-buy="chota-ps-portal"]').click();await new Promise(setImmediate);
  function check(){for(const [i,room] of rooms.entries()){
   const prop=room.querySelector('[data-chota-room-item="chota-ps-portal"]');assert.ok(prop);
   assert.equal(prop.style.left,'25.8%');assert.equal(prop.style.top,'59%');assert.equal(prop.style.width,'10%');assert.equal(prop.style.transform,'rotate(0deg)');assert.equal(prop.style.zIndex,'2');
   assert.equal(prop.querySelector('[data-chota-motion]').dataset.chotaMotion,'none');
   assert.equal(room.querySelector('.clubhouse-seasonal'),seasonal[i]);
  }}
  check();assert.equal(calls.length,2);assert.equal(calls[1][1].expected_price,35);
  Object.defineProperty(w.navigator,'onLine',{value:false,configurable:true});w.ChotaShop.reset();rooms.forEach(w.ChotaShop.mountRoom);check();
  await w.ChotaShop.refresh();assert.equal(calls.length,2);assert.equal(raf,0);
  assert.equal(d.querySelector('[data-chota-buy="chota-ps-portal"]').textContent,'Comprado');
 } finally {dom.window.close();}
});
