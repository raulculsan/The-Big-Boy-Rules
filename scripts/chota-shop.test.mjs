import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {PGlite} from '@electric-sql/pglite';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const decorations = [
  ['chota-warm-lights','warm-lights',25],
  ['chota-club-neon','club-neon',45],
  ['chota-club-cushion','club-cushion',18],
  ['chota-vintage-radio','vintage-radio',30]
].map(([id,art_key,price]) => ({id,art_key,price,name:id,description:'Para la sede',active:true,owned:false}));

function setup(rpc) {
  const dom = new JSDOM('<div id="bannerShopBalance"></div><div id="chotaShopStatus"></div><span data-shop-chota-count></span><div id="chotaShopItems"></div><div class="clubhouse-room"><div class="clubhouse-seasonal"><img src="halloween.svg"></div></div><div class="chota-viewer-room-scene"><div class="clubhouse-seasonal"><img src="halloween.svg"></div></div>', {url:'https://club.test/',runScripts:'outside-only'});
  const w=dom.window;
  w.matchMedia=()=>({matches:false,addEventListener(){}});
  w.eval(read('chota-shop.js'));
  let actor='member-a';
  w.ChotaShop.initialize({session:()=>actor,rpc,cacheNamespace:'test'});
  return {dom,w,d:w.document,setActor:value=>{actor=value;}};
}

test('the server catalogue renders all four decorations and rejects unrecognised artwork',async()=>{
  const {dom,w,d}=setup(async()=>({data:{balance:100,items:[...decorations,{...decorations[0],id:'untrusted',art_key:'../../external'}]}}));
  try {
    await w.ChotaShop.refresh();
    assert.equal(d.querySelectorAll('[data-chota-buy]').length,4);
    assert.equal([...d.querySelectorAll('.chota-shop-kind')].filter(node=>node.textContent==='Decoración').length,4);
    assert.equal(d.querySelector('[data-chota-buy="untrusted"]'),null);
    assert.equal(d.querySelectorAll('.chota-room-prop').length,0);
  } finally {dom.window.close();}
});

test('a confirmed purchase paints both room views and preserves their seasonal layers',async()=>{
  const calls=[];
  const {dom,w,d}=setup(async(name,args)=>{
    calls.push({name,args});
    return {data:{balance:name==='buy_chota_item'?55:100,items:decorations.map(item=>({...item,owned:name==='buy_chota_item'&&item.id==='chota-club-neon'}))}};
  });
  try {
    await w.ChotaShop.refresh();
    d.querySelectorAll('.clubhouse-room,.chota-viewer-room-scene').forEach(room=>w.ChotaShop.mountRoom(room));
    d.querySelector('[data-chota-buy="chota-club-neon"]').click();
    await new Promise(resolve=>setTimeout(resolve,0));
    const purchase=calls.find(call=>call.name==='buy_chota_item');
    assert.deepEqual(JSON.parse(JSON.stringify(purchase.args)),{target_item_id:'chota-club-neon',expected_price:45});
    assert.equal(d.querySelectorAll('.chota-room-club-neon').length,2);
    assert.equal(d.querySelectorAll('.clubhouse-seasonal img').length,2);
    assert.equal(d.getElementById('bannerShopBalance').textContent,'55 monedas');
    assert.equal(d.querySelector('[data-chota-buy="chota-club-neon"]').disabled,true);
  } finally {dom.window.close();}
});

test('changing accounts clears purchased decorations before the new account loads',async()=>{
  const {dom,w,d,setActor}=setup(async()=>({data:{balance:100,items:decorations.map(item=>({...item,owned:true}))}}));
  try {
    await w.ChotaShop.refresh();
    const room=d.querySelector('.clubhouse-room');
    w.ChotaShop.mountRoom(room);
    assert.equal(room.querySelectorAll('.chota-room-prop--decoration').length,4);
    setActor(null);
    await w.ChotaShop.refresh();
    assert.equal(room.querySelectorAll('.chota-room-prop').length,0);
    assert.equal(room.querySelectorAll('.clubhouse-seasonal img').length,1);
  } finally {dom.window.close();}
});

test('decoration seeds can be repeated without resetting a price changed by administration',async()=>{
  const db=new PGlite();
  try {
    await db.exec('create table public.chota_item_catalog(id text primary key,name text,description text,art_key text,price integer,active boolean,sort_order integer)');
    const sql=read('supabase/migrations/20261027180741_chota_room_decorations.sql');
    await db.exec(sql);
    await db.exec("update public.chota_item_catalog set price=99 where id='chota-club-neon'");
    await db.exec(sql);
    const {rows}=await db.query('select count(*)::integer total,max(price)::integer highest from public.chota_item_catalog');
    assert.deepEqual(rows,[{total:4,highest:99}]);
  } finally {await db.close();}
});

const styles=[
 {id:'chota-room-midnight',art_key:'room-midnight',name:'Azul noche',description:'Estilo',price:60,active:true,owned:false},
 {id:'chota-room-forest',art_key:'room-forest',name:'Bosque',description:'Estilo',price:60,active:true,owned:true}
];

test('room style purchases apply to both views; original and acquired styles switch without another purchase',async()=>{
 const calls=[];
 let room_style=null,items=styles.map(item=>({...item}));
 const {dom,w,d}=setup(async(name,args)=>{
  calls.push({name,args});
  if(name==='buy_chota_item') {items[0].owned=true;room_style=items[0].id;}
  if(name==='equip_chota_room_style') room_style=args.target_item_id;
  return {data:{balance:items[0].owned?40:100,items,room_style}};
 });
 try {
  await w.ChotaShop.refresh();
  d.querySelectorAll('.clubhouse-room,.chota-viewer-room-scene').forEach(room=>w.ChotaShop.mountRoom(room));
  d.querySelector('[data-chota-buy="chota-room-midnight"]').click();
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.ok([...d.querySelectorAll('.clubhouse-room,.chota-viewer-room-scene')].every(room=>room.dataset.roomStyle==='room-midnight'));
  assert.equal(d.querySelectorAll('.clubhouse-room > .chota-room-style,.chota-viewer-room-scene > .chota-room-style').length,2);
  assert.equal(d.querySelectorAll('.chota-room-prop').length,0);
  assert.equal(d.querySelectorAll('.clubhouse-seasonal img').length,2);
  d.querySelector('[data-chota-equip="chota-room-forest"]').click();
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(d.querySelector('.clubhouse-room').dataset.roomStyle,'room-forest');
  d.querySelector('[data-chota-equip="original"]').click();
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(d.querySelector('.clubhouse-room').dataset.roomStyle,'original');
  assert.equal(calls.filter(call=>call.name==='buy_chota_item').length,1);
  assert.equal(calls.filter(call=>call.name==='equip_chota_room_style').length,2);
  assert.equal(calls.at(-1).args.target_item_id,null);
 }finally{dom.window.close();}
});

test('an unowned style from server cannot be equipped',async()=>{
 const {dom,w,d}=setup(async()=>({data:{balance:100,items:styles,room_style:'chota-room-midnight'}}));
 try{
  await w.ChotaShop.refresh();w.ChotaShop.mountRoom(d.querySelector('.clubhouse-room'));
  assert.equal(d.querySelector('.clubhouse-room').dataset.roomStyle,'original');
  assert.equal(d.querySelector('[data-chota-equip="chota-room-midnight"]'),null);
 }finally{dom.window.close();}
});

test('server purchases and style selection require ownership, charge once, and keep original free',async()=>{
 const db=new PGlite();
 const actor='11111111-1111-1111-1111-111111111111';
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create table public.profiles(id uuid primary key);
   create table public.chota_item_catalog(id text primary key,name text,description text,art_key text,price integer,active boolean,sort_order integer);
   create table public.member_owned_chota_items(user_id uuid,item_id text,paid_price integer,balance_after bigint,primary key(user_id,item_id));
   create table public.member_coin_wallets(user_id uuid primary key,balance bigint);
   create table public.member_coin_ledger(user_id uuid,delta bigint,balance_after bigint,reason text,item_id text,copies integer);
   create function public.lock_banner_shop_actor() returns uuid language plpgsql as $$ declare actor uuid:=current_setting('test.actor',true)::uuid;begin if actor is null then raise exception 'No session';end if;perform 1 from public.member_coin_wallets where user_id=actor for update;return actor;end;$$;
   create function public.assert_account_security() returns void language sql as 'select';
   insert into public.profiles values('${actor}');insert into public.member_coin_wallets values('${actor}',150);
   select set_config('test.actor','${actor}',false);`);
  await db.exec(read('supabase/migrations/20261027183507_chota_room_styles.sql'));
  await assert.rejects(db.query("select public.equip_chota_room_style('chota-room-midnight')"),/Primero debes comprar/);
  await assert.rejects(db.query("select public.buy_chota_item('chota-room-midnight',1)"),/precio cambió/);
  let {rows}=await db.query("select public.buy_chota_item('chota-room-midnight',60) as state");
  assert.equal(rows[0].state.balance,90);assert.equal(rows[0].state.room_style,'chota-room-midnight');
  await db.query("select public.buy_chota_item('chota-room-midnight',60)");
  ({rows}=await db.query('select balance from public.member_coin_wallets'));assert.equal(rows[0].balance,90);
  await db.query('select public.equip_chota_room_style(null)');
  ({rows}=await db.query('select public.get_chota_shop_state() as state'));assert.equal(rows[0].state.balance,90);assert.equal(rows[0].state.room_style,null);
  await db.query("select public.equip_chota_room_style('chota-room-midnight')");
  ({rows}=await db.query('select count(*)::int total from public.member_coin_ledger'));assert.equal(rows[0].total,1);
  ({rows}=await db.query("select relrowsecurity from pg_class where oid='public.member_chota_room_style'::regclass"));assert.equal(rows[0].relrowsecurity,true);
 }finally{await db.close();}
});

test('the same account restores its cached room style immediately on remount',async()=>{
 const {dom,w,d}=setup(async()=>({data:{balance:100,items:styles,room_style:'chota-room-forest'}}));
 try{
  await w.ChotaShop.refresh();const room=d.querySelector('.clubhouse-room');w.ChotaShop.mountRoom(room);
  assert.equal(room.dataset.roomStyle,'room-forest');
  w.ChotaShop.reset();assert.equal(room.dataset.roomStyle,'original');
  w.ChotaShop.mountRoom(room);assert.equal(room.dataset.roomStyle,'room-forest');
 }finally{dom.window.close();}
});
