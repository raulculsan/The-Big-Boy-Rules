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
    assert.equal(d.querySelectorAll('.chota-shop-kind').length,4);
    assert.ok([...d.querySelectorAll('.chota-shop-kind')].every(node=>node.textContent==='Decoración'));
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
