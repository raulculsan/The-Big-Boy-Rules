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
`);await db.exec(migration);await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261108144204_chota_clothing_manifest_cell_type.sql',import.meta.url),'utf8'));await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261108190000_chota_bottomwear.sql',import.meta.url),'utf8'));await db.query("select set_config('test.actor',$1,false)",[A]);return db;}
const rpc=async(db,name,args=[])=>{const row=await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) value`,args);return row.rows[0].value;};

test('trousers are a second slot: bought for 100, worn with the coat, equipped and cleared on their own',async()=>{const db=await fixture();try{
 let state=await rpc(db,'get_chota_shop_state');const pants=state.items.filter(i=>i.slot==='bottomwear');assert.equal(pants.length,2);assert.ok(pants.every(i=>i.price===100&&i.rig_version==='chota-bottomwear-overlay-v1'));assert.equal(state.bottomwear,null);
 state=await rpc(db,'buy_chota_item',['chota-tnf-rojo-v1',100]);assert.equal(state.outerwear,'chota-tnf-rojo-v1');
 state=await rpc(db,'buy_chota_item',['chota-carhartt-marron-v1',100]);assert.equal(state.balance,50);assert.equal(state.bottomwear,'chota-carhartt-marron-v1');assert.equal(state.outerwear,'chota-tnf-rojo-v1');
 state=await rpc(db,'equip_chota_clothing',['bottomwear',null]);assert.equal(state.bottomwear,null);assert.equal(state.outerwear,'chota-tnf-rojo-v1');
 state=await rpc(db,'equip_chota_clothing',['bottomwear','chota-carhartt-marron-v1']);assert.equal(state.bottomwear,'chota-carhartt-marron-v1');
 state=await rpc(db,'equip_chota_clothing',['outerwear',null]);assert.equal(state.outerwear,null);assert.equal(state.bottomwear,'chota-carhartt-marron-v1');
 state=await rpc(db,'equip_chota_outerwear',['chota-tnf-rojo-v1']);assert.equal(state.outerwear,'chota-tnf-rojo-v1');assert.equal(state.bottomwear,'chota-carhartt-marron-v1');
}finally{await db.close();}});
test('trousers cannot be worn unbought, in the wrong slot, or through the coat RPC',async()=>{const db=await fixture();try{
 await assert.rejects(rpc(db,'equip_chota_clothing',['bottomwear','chota-carhartt-azul-oscuro-v1']),/Primero debes comprar/);
 await rpc(db,'buy_chota_item',['chota-carhartt-azul-oscuro-v1',100]);
 await assert.rejects(rpc(db,'equip_chota_clothing',['outerwear','chota-carhartt-azul-oscuro-v1']),/Primero debes comprar/);
 await assert.rejects(rpc(db,'equip_chota_outerwear',['chota-carhartt-azul-oscuro-v1']),/Primero debes comprar/);
 await assert.rejects(rpc(db,'equip_chota_clothing',['headwear',null]),/no válido/);
 await assert.rejects(rpc(db,'buy_chota_item',['chota-carhartt-marron-v1',1]),/precio cambió/);
 assert.equal((await rpc(db,'get_chota_shop_state')).balance,150);
}finally{await db.close();}});
