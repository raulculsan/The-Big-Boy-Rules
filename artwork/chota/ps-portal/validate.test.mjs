import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {PGlite} from '@electric-sql/pglite';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const item=JSON.parse(read('./catalog.json'));
test('v2 validates and guarded visual update preserves identity, admin price, activation and ownership',async()=>{
 const db=new PGlite();
 try {
  // Use the existing validators verbatim; no deployed database or credentials.
  await db.exec(read('../../../supabase/migrations/20261027191500_remote_shop_catalog.sql').split('alter table public.profile_banner_catalog')[0]+'commit;');
  assert.equal((await db.query("select public.valid_shop_presentation($1,'chota') valid",[item.presentation])).rows[0].valid,true);
  await db.exec('create table public.chota_item_catalog(id text primary key,name text,description text,art_key text unique,price integer,active boolean,sort_order integer,presentation jsonb check(public.valid_shop_presentation(presentation,\'chota\')));');
  await db.exec(read('./publish.sql'));
  await db.exec("update public.chota_item_catalog set price=42,active=false,sort_order=99 where id='chota-ps-portal'; create table owned(user_id text,item_id text,paid_price integer);insert into owned values('member','chota-ps-portal',35);create table wallet(balance integer);insert into wallet values(65);");
  await db.exec(read('./update-placement-v2.sql'));
  const rows=(await db.query('select * from public.chota_item_catalog')).rows;
  assert.equal(rows.length,1);assert.equal(rows[0].id,'chota-ps-portal');assert.equal(rows[0].art_key,'ps-portal');assert.equal(rows[0].price,42);assert.equal(rows[0].active,false);assert.equal(rows[0].sort_order,99);assert.deepEqual(rows[0].presentation,item.presentation);
  assert.deepEqual((await db.query('select * from owned')).rows,[{user_id:'member',item_id:'chota-ps-portal',paid_price:35}]);assert.equal((await db.query('select balance from wallet')).rows[0].balance,65);
  await db.exec("update public.chota_item_catalog set description='admin edit' where id='chota-ps-portal';");await db.exec(read('./update-placement-v2.sql'));
  assert.equal((await db.query('select description from public.chota_item_catalog')).rows[0].description,'admin edit','rerun must not overwrite a post-v2 edit');
  const sql=read('./update-placement-v2.sql');assert.match(sql,/AND presentation->>'path' = 'chota\/ps-portal-v1.png'/);assert.doesNotMatch(sql,/SET\s+(price|active|id|art_key)|\b(INSERT|DELETE|ALTER|CREATE)\b/i);
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
  assert.ok(d.querySelector('[data-chota-item="chota-ps-portal"] img').src.endsWith('/shop-media/chota/ps-portal-v2.png'));
  assert.equal(d.querySelectorAll('[data-chota-room-item]').length,0);
  d.querySelector('[data-chota-tab="objetos"]').click();d.querySelector('[data-chota-buy="chota-ps-portal"]').click();await new Promise(setImmediate);
  function check(){for(const [i,room] of rooms.entries()){
   const prop=room.querySelector('[data-chota-room-item="chota-ps-portal"]');assert.ok(prop);
   assert.equal(prop.style.left,`${item.presentation.placement.x}%`);assert.equal(prop.style.top,`${item.presentation.placement.y}%`);assert.equal(prop.style.width,`${item.presentation.placement.width}%`);assert.equal(prop.style.transform,'rotate(0deg)');assert.equal(prop.style.zIndex,'2');
   assert.equal(prop.querySelector('[data-chota-motion]').dataset.chotaMotion,'none');
   assert.equal(room.querySelector('.clubhouse-seasonal'),seasonal[i]);
  }}
  check();assert.equal(calls.length,2);assert.equal(calls[1][1].expected_price,35);
  Object.defineProperty(w.navigator,'onLine',{value:false,configurable:true});w.ChotaShop.reset();rooms.forEach(w.ChotaShop.mountRoom);check();
  await w.ChotaShop.refresh();assert.equal(calls.length,2);assert.equal(raf,0);
  assert.equal(d.querySelector('[data-chota-buy="chota-ps-portal"]').textContent,'Comprado');
 } finally {dom.window.close();}
});
test('an already purchased v1 cache revalidates to v2 in both views without another purchase',async()=>{
 const old=JSON.parse(read('./catalog-v1.json'));
 const dom=new JSDOM('<div id="chotaShopItems"></div><div class="clubhouse-room"></div><div class="chota-viewer-room-scene"></div>',{url:'https://local.test/',runScripts:'outside-only'}),w=dom.window,d=w.document,calls=[];
 w.BIG_BOY_CONFIG={supabaseUrl:'https://fixture.invalid'};w.matchMedia=()=>({matches:true,addEventListener(){}});w.eval(read('../../../shop-catalog-media.js'));w.eval(read('../../../chota-shop.js'));
 w.localStorage.setItem('bb:chota-room:v1:https://fixture.invalid:existing',JSON.stringify({owner:'existing',balance:65,items:[{...old,owned:true}]}));
 w.ChotaShop.initialize({session:()=> 'existing',cacheNamespace:'https://fixture.invalid',rpc:async name=>{calls.push(name);return {data:{balance:65,items:[{...item,owned:true}]}};}});
 try{
  const rooms=[...d.querySelectorAll('.clubhouse-room,.chota-viewer-room-scene')];rooms.forEach(w.ChotaShop.mountRoom);
  for(const room of rooms)assert.ok(room.querySelector('[data-chota-room-item] img').src.endsWith('ps-portal-v1.png'));
  await w.ChotaShop.refresh(true);
  for(const room of rooms)assert.ok(room.querySelector('[data-chota-room-item] img').src.endsWith('ps-portal-v2.png'));
  assert.deepEqual(calls,['get_chota_shop_state']);assert.equal(JSON.parse(w.localStorage.getItem('bb:chota-room:v1:https://fixture.invalid:existing')).items[0].owned,true);
 }finally{dom.window.close();}
});
