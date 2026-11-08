import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const migration=fs.readFileSync(new URL('../supabase/migrations/20261108142153_chota_store_outerwear.sql',import.meta.url),'utf8');
const A='00000000-0000-0000-0000-000000000001',B='00000000-0000-0000-0000-000000000002';
async function fixture(){const db=new PGlite();await db.exec(`
create role anon;create role authenticated;create role service_role;create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
create table public.profiles(id uuid primary key,is_hidden boolean default false);
create table public.member_coin_wallets(user_id uuid primary key references public.profiles(id),balance bigint not null default 0 check(balance>=0));
create table public.member_coin_ledger(id bigint generated always as identity primary key,user_id uuid,delta bigint,balance_after bigint check(balance_after>=0),reason text,item_id text,copies integer);
create table public.chota_item_catalog(id text primary key,name text,description text,art_key text,price integer check(price>=0),active boolean default true,sort_order integer default 0,presentation jsonb);
create table public.member_owned_chota_items(user_id uuid references public.profiles(id),item_id text references public.chota_item_catalog(id),paid_price integer,balance_after bigint,purchased_at timestamptz default now(),primary key(user_id,item_id));
create table public.member_chota_room_style(user_id uuid primary key,item_id text,updated_at timestamptz default now());
alter table public.chota_item_catalog enable row level security;alter table public.member_owned_chota_items enable row level security;
revoke all on public.chota_item_catalog,public.member_owned_chota_items from public,anon,authenticated;
create function public.chota_item_is_room_style(art text,p jsonb) returns boolean language sql immutable as $$select art like 'room-%'$$;
create function public.assert_account_security() returns void language plpgsql as $$begin if auth.uid() is null or current_setting('test.mfa',true)='false' then raise exception 'Seguridad requerida' using errcode='42501';end if;end;$$;
create function public.lock_banner_shop_actor() returns uuid language plpgsql security definer set search_path='' as $$declare actor uuid:=auth.uid();begin if actor is null or not exists(select 1 from public.profiles where id=actor and not is_hidden) then raise exception 'Inicia sesión' using errcode='42501';end if;insert into public.member_coin_wallets(user_id)values(actor)on conflict do nothing;perform 1 from public.member_coin_wallets where user_id=actor for update;return actor;end;$$;
insert into public.profiles(id)values('${A}'),('${B}');insert into public.member_coin_wallets values('${A}',250),('${B}',300);
insert into public.chota_item_catalog values('football','Pelota','','football',10,true,1,null),('forest','Bosque','','room-forest',60,true,2,null);
`);await db.exec(migration);await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261108144204_chota_clothing_manifest_cell_type.sql',import.meta.url),'utf8'));await db.query("select set_config('test.actor',$1,false)",[A]);return db;}
const rpc=async(db,name,args=[])=>{const row=await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) value`,args);return row.rows[0].value;};
test('six coats cost 100 and buy/debit/ownership/equipment are atomic and idempotent',async()=>{const db=await fixture();try{
 let state=await rpc(db,'get_chota_shop_state');assert.equal(state.items.filter(i=>i.item_kind==='clothing').length,6);assert.ok(state.items.filter(i=>i.item_kind==='clothing').every(i=>i.price===100));assert.equal(state.items.find(i=>i.id==='football').price,10);
 state=await rpc(db,'buy_chota_item',['chota-tnf-rojo-v1',100]);assert.equal(state.balance,150);assert.equal(state.outerwear,'chota-tnf-rojo-v1');assert.equal(state.purchased,true);
 state=await rpc(db,'buy_chota_item',['chota-tnf-rojo-v1',100]);assert.equal(state.balance,150);assert.equal(state.purchased,false);assert.equal((await db.query('select count(*)::integer n from public.member_coin_ledger')).rows[0].n,1);
 await assert.rejects(rpc(db,'buy_chota_item',['chota-tnf-azul-v1',1]),/precio cambió/);assert.equal((await rpc(db,'get_chota_shop_state')).balance,150);
 await rpc(db,'buy_chota_item',['chota-tnf-azul-v1',100]);await assert.rejects(rpc(db,'buy_chota_item',['chota-tnf-crema-v1',100]),/suficientes monedas/);assert.equal((await rpc(db,'get_chota_shop_state')).balance,50);
 await rpc(db,'equip_chota_outerwear',['chota-tnf-rojo-v1']);assert.equal((await rpc(db,'get_chota_shop_state')).outerwear,'chota-tnf-rojo-v1');await rpc(db,'equip_chota_outerwear',[null]);assert.equal((await rpc(db,'get_chota_shop_state')).outerwear,null);
 }finally{await db.close();}});
test('ownership, account security, unsupported slots and direct writes cannot bypass purchase',async()=>{const db=await fixture();try{
 await rpc(db,'buy_chota_item',['chota-tnf-rojo-v1',100]);await db.query("select set_config('test.actor',$1,false)",[B]);await assert.rejects(rpc(db,'equip_chota_outerwear',['chota-tnf-rojo-v1']),/Primero debes comprar/);
 await db.exec("select set_config('test.mfa','false',false)");await assert.rejects(rpc(db,'buy_chota_item',['chota-tnf-crema-v1',100]),/Seguridad requerida/);await db.exec("select set_config('test.mfa','true',false)");
 await db.exec('set role authenticated');await assert.rejects(db.query('select * from public.member_chota_clothing'),/permission denied/);await assert.rejects(db.query("update public.member_coin_wallets set balance=9999"),/permission denied/);await db.exec('reset role');
 assert.equal((await rpc(db,'get_chota_shop_state')).balance,300);
 }finally{await db.close();}});
test('catalog accepts future compatible remote coats without a six-item cap and rejects unsafe manifests',async()=>{const db=await fixture();try{
 const atlases=Object.fromEntries(['base','directional','contextual','room','talk'].map(k=>[k,'chota/wardrobe/future-'+k+'.webp'])),garment={type:'atlas',cell:128,atlases};
 for(const bad of [{...garment,cell:'128'},{type:'builtin'},{...garment,type:undefined},{...garment,atlases:{...atlases,base:'https://evil.test/a.webp'}},{...garment,atlases:{...atlases,base:'chota/wardrobe/../escape.webp'}}])assert.equal((await db.query('select public.valid_chota_clothing_manifest($1,$2,$3) valid',[JSON.stringify(bad),'outerwear','chota-overlay-v1'])).rows[0].valid,false);
 await db.query(`insert into public.chota_item_catalog(id,name,art_key,price,item_kind,slot,rig_version,garment)values('future-coat','Futuro','future-coat',75,'clothing','outerwear','chota-overlay-v1',$1)`,[garment]);const state=await rpc(db,'buy_chota_item',['future-coat',75]);assert.equal(state.balance,175);assert.equal(state.outerwear,'future-coat');
 await db.query(`insert into public.chota_item_catalog(id,name,art_key,price,item_kind,slot,rig_version,garment)values('future-hat','Futuro','future-hat',50,'clothing','headwear','chota-hat-v2',$1)`,[garment]);await assert.rejects(rpc(db,'buy_chota_item',['future-hat',50]),/versión compatible/);assert.equal((await rpc(db,'get_chota_shop_state')).balance,175);
 }finally{await db.close();}});
