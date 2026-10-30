import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {PGlite} from '@electric-sql/pglite';
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const backend='https://project.supabase.co';
const banner={id:'new-banner',name:'Novedad',art_key:'never-bundled',price:25,owned:true,equipped:true,presentation:{type:'video',path:'banners/new-v1/animation.mp4',poster_path:'banners/new-v1/poster.webp',width:1440,height:480}};
const decor={id:'new-lamp',name:'Lámpara',art_key:'never-bundled-lamp',price:10,owned:true,active:true,presentation:{type:'decoration',path:'chota/lamp-v1.webp',width:400,height:600,placement:{x:20,y:45,width:12,rotation:-5,z:2},motion:'sway'}};
const style={id:'new-style',name:'Lavanda',art_key:'never-bundled-palette',price:30,owned:true,active:true,presentation:{type:'room_style',colors:{wall:'#554477',floor:'#886655',rug:'#665588'}}};
function helper(w){w.BIG_BOY_CONFIG={supabaseUrl:backend};w.eval(read('shop-catalog-media.js'));}

test('remote metadata accepts only controlled Storage paths and bounded scene values',()=>{
 const dom=new JSDOM('<div/>',{runScripts:'outside-only'}),w=dom.window;helper(w);
 try{
  assert.equal(w.ShopCatalogMedia.presentation(banner).type,'video');
  for(const path of ['https://evil.test/file.mp4','banners/../secret.mp4','banners/a.mp4?x=1','banners/a\".mp4','chota/a.mp4'])assert.equal(w.ShopCatalogMedia.presentation({...banner,presentation:{...banner.presentation,path}}),null);
  assert.equal(w.ShopCatalogMedia.presentation({...banner,presentation:{...banner.presentation,poster_path:null}}),null);
  assert.equal(w.ShopCatalogMedia.presentation({...banner,presentation:{type:'image',path:'banners/untrusted.svg',width:1440,height:480}}),null,'SVG cannot bypass the storage MIME ban through metadata');
  assert.equal(w.ShopCatalogMedia.presentation({...decor,presentation:{...decor.presentation,placement:{...decor.presentation.placement,x:101}}},'chota'),null);
  assert.equal(w.ShopCatalogMedia.presentation({...style,presentation:{...style.presentation,colors:{...style.presentation.colors,wall:'red;position:fixed'}}},'chota'),null);
  assert.match(w.ShopCatalogMedia.banner(banner),/https:\/\/project.supabase.co\/storage\/v1\/object\/public\/shop-media\/banners\/new-v1\/animation.mp4/);
 }finally{dom.window.close();}
});

test('a previously unknown banner appears in shop, profile, picker and member artwork and survives member cache',async()=>{
 const dom=new JSDOM(read('index.html'),{url:'https://club.test/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
 helper(w);w.matchMedia=()=>({matches:true,addEventListener(){}});w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.eval(read('banner-shop.js'));
 const state={balance:100,cards:[],available_packs:[],vouchers:[],daily_banner_ids:[banner.id],equipped_banner_id:banner.id,banners:[banner]};
 w.BannerShop.initialize({session:()=> 'owner',cacheNamespace:backend,rpc:async name=>({data:name==='get_member_profile_banners'?[{user_id:'other',banner}]:state})});
 try{
  d.getElementById('bannerShopDialog').open=true;await w.BannerShop.refresh();
  assert.ok(d.querySelector('#bannerShopItems .banner-remote img').src.includes('/shop-media/banners/new-v1/poster.webp'));
  const profile=d.createElement('div');profile.innerHTML='<div class="club-profile-identity"><img class="club-profile-avatar"></div>';d.body.append(profile);
  w.BannerShop.mountProfile(profile,'owner',true);assert.ok(profile.querySelector('.profile-banner.banner-remote'));
  w.BannerShop.openEditor(true);await flush();assert.ok(d.querySelector('#profileBannerOptions .banner-remote'));
  const members=d.createElement('div');members.innerHTML='<div data-member-banner-user="other"><div class="club-member-banner"></div></div>';d.body.append(members);
  w.BannerShop.mountMembers(members);await flush();await flush();assert.ok(members.querySelector('.banner-remote'));
  assert.ok(w.BannerShop.memberArtwork('other').includes('/shop-media/banners/new-v1/poster.webp'));
  const cached=w.localStorage.getItem(`bb:member-banner-posters:v1:${backend}:owner`);assert.ok(cached.includes('presentation'));assert.ok(cached.includes('new-v1'));
 }finally{dom.window.close();}
});

test('new decorations and palettes render in both room views, restore cache and update from metadata without bundle changes',async()=>{
 const dom=new JSDOM('<div id="chotaShopStatus"></div><div id="chotaShopItems"></div><div class="clubhouse-room"><div class="clubhouse-seasonal"></div></div><div class="chota-viewer-room-scene"><div class="clubhouse-seasonal"></div></div>',{url:'https://club.test/',runScripts:'outside-only'}),w=dom.window,d=w.document;
 helper(w);w.matchMedia=()=>({matches:false,addEventListener(){}});w.eval(read('chota-shop.js'));
 let current={balance:100,items:[decor,style],room_style:style.id};
 w.ChotaShop.initialize({session:()=> 'owner',cacheNamespace:backend,rpc:async()=>({data:current})});
 try{
  await w.ChotaShop.refresh();const rooms=[...d.querySelectorAll('.clubhouse-room,.chota-viewer-room-scene')];rooms.forEach(room=>w.ChotaShop.mountRoom(room));
  assert.ok(d.querySelector('[data-chota-item="new-lamp"] img').src.includes('/shop-media/chota/lamp-v1.webp'));
  for(const room of rooms){assert.equal(room.dataset.roomStyle,'remote');assert.equal(room.style.getPropertyValue('--room-wall'),'#554477');const prop=room.querySelector('[data-chota-room-item="new-lamp"]');assert.equal(prop.style.left,'20%');assert.equal(prop.style.width,'12%');assert.equal(prop.querySelector('[data-chota-motion]').dataset.chotaMotion,'sway');assert.ok(room.querySelector('.clubhouse-seasonal'));}
  w.ChotaShop.reset();w.ChotaShop.mountRoom(rooms[0]);assert.equal(rooms[0].style.getPropertyValue('--room-wall'),'#554477');
  current={...current,items:[{...decor,presentation:{...decor.presentation,path:'chota/lamp-v2.webp'}},style]};await w.ChotaShop.refresh(true);
  assert.ok(rooms[0].querySelector('[data-chota-room-item="new-lamp"] img').src.endsWith('/chota/lamp-v2.webp'));
 }finally{dom.window.close();}
});

test('remote catalogue migration validates files and permits purchased new palettes without hardcoded IDs',async()=>{
 const db=new PGlite(),actor='11111111-1111-1111-1111-111111111111';
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
   create table public.profiles(id uuid primary key);
   create table public.profile_banner_catalog(id text primary key,name text,description text,art_key text,price integer,active boolean);
   create table public.chota_item_catalog(id text primary key,name text,description text,art_key text,price integer,active boolean,sort_order integer);
   create table public.member_owned_chota_items(user_id uuid,item_id text,paid_price integer,balance_after bigint,primary key(user_id,item_id));
   create table public.member_coin_wallets(user_id uuid primary key,balance bigint);
   create table public.member_coin_ledger(user_id uuid,delta bigint,balance_after bigint,reason text,item_id text,copies integer);
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(bucket_id text);alter table storage.objects enable row level security;
   create function public.current_user_is_superadmin() returns boolean language sql as 'select false';
   create function public.lock_banner_shop_actor() returns uuid language plpgsql as $$declare actor uuid:=current_setting('test.actor',true)::uuid;begin if actor is null then raise exception 'No session';end if;perform 1 from public.member_coin_wallets where user_id=actor for update;return actor;end;$$;
   create function public.assert_account_security() returns void language sql as 'select';
   insert into public.profiles values('${actor}');insert into public.member_coin_wallets values('${actor}',150);select set_config('test.actor','${actor}',false);`);
  await db.exec(read('supabase/migrations/20261027183507_chota_room_styles.sql'));
  await db.exec(read('supabase/migrations/20261027191500_remote_shop_catalog.sql'));
  await db.query('insert into public.chota_item_catalog values($1,$2,$3,$4,$5,true,90,$6)',[style.id,style.name,'',style.art_key,style.price,style.presentation]);
  await assert.rejects(db.query('select public.equip_chota_room_style($1)',[style.id]),/Primero debes comprar/);
  let result=await db.query('select public.buy_chota_item($1,$2) as state',[style.id,style.price]);assert.equal(result.rows[0].state.room_style,style.id);assert.deepEqual(result.rows[0].state.items.find(item=>item.id===style.id).presentation,style.presentation);
  await db.query('select public.equip_chota_room_style(null)');result=await db.query('select public.equip_chota_room_style($1) as state',[style.id]);assert.equal(result.rows[0].state.room_style,style.id);
  await assert.rejects(db.query('insert into public.profile_banner_catalog values($1,$2,$3,$4,10,true,$5)',['bad','Bad','','bad',{...banner.presentation,path:'banners/../private.mp4'}]),/check constraint/);
  await assert.rejects(db.query('insert into public.profile_banner_catalog values($1,$2,$3,$4,10,true,$5)',['bad','Bad','','bad',{type:'image',path:'banners/a.webp'}]),/check constraint/);
  result=await db.query("select public.valid_shop_presentation($1,'banner') valid",[banner.presentation]);assert.equal(result.rows[0].valid,true);
 }finally{await db.close();}
});
