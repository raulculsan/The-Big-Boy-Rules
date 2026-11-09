import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {PGlite} from '@electric-sql/pglite';
const A='00000000-0000-0000-0000-000000000001',B='00000000-0000-0000-0000-000000000002';
const read=name=>fs.readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
async function fixture(){const db=new PGlite();await db.exec(`
 create role anon;create role authenticated;create role service_role;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
 create table public.profiles(id uuid primary key,is_hidden boolean default false);
 create table public.member_coin_wallets(user_id uuid primary key references public.profiles(id),balance bigint not null default 0 check(balance>=0));
 create table public.member_coin_ledger(id bigint generated always as identity primary key,user_id uuid,delta bigint,balance_after bigint check(balance_after>=0),reason text,item_id text,copies integer);
 create table public.chota_item_catalog(id text primary key,name text,description text,art_key text,price integer check(price>=0),active boolean default true,sort_order integer default 0,presentation jsonb);
 create table public.member_owned_chota_items(user_id uuid references public.profiles(id),item_id text references public.chota_item_catalog(id),paid_price integer,balance_after bigint,purchased_at timestamptz default now(),primary key(user_id,item_id));
 create table public.member_chota_room_style(user_id uuid primary key,item_id text,updated_at timestamptz default now());
 create function public.chota_item_is_room_style(art text,p jsonb) returns boolean language sql immutable as $$select art like 'room-%'$$;
 create function public.assert_account_security() returns void language plpgsql as $$begin if auth.uid() is null or current_setting('test.mfa',true)='false' then raise exception 'Seguridad requerida' using errcode='42501';end if;end;$$;
 create function public.lock_banner_shop_actor() returns uuid language plpgsql security definer set search_path='' as $$declare actor uuid:=auth.uid();begin if actor is null or not exists(select 1 from public.profiles where id=actor and not is_hidden) then raise exception 'Inicia sesión' using errcode='42501';end if;insert into public.member_coin_wallets(user_id)values(actor)on conflict do nothing;perform 1 from public.member_coin_wallets where user_id=actor for update;return actor;end;$$;
 insert into public.profiles(id)values('${A}'),('${B}');insert into public.member_coin_wallets values('${A}',400),('${B}',300);
 `);for(const file of ['20261108142153_chota_store_outerwear.sql','20261108144204_chota_clothing_manifest_cell_type.sql','20261108190000_chota_bottomwear.sql','20261109120000_chota_topwear.sql','20261109180000_chota_modular_originals.sql'])await db.exec(read(file));await db.query("select set_config('test.actor',$1,false)",[A]);return db;}
const rpc=async(db,name,args=[])=>{const result=await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) value`,args);return result.rows[0].value;};
test('free originals default historical empty slots, explicit removals persist, purchases and wallet stay independent',async()=>{const db=await fixture();try{
 let state=await rpc(db,'get_chota_shop_state');assert.equal(state.wardrobe_version,1);assert.equal(state.topwear,'chota-original-stussy-v1');assert.equal(state.bottomwear,'chota-original-jeans-v1');assert.equal(state.footwear,'chota-original-jordan-chicago-v1');
 assert.equal(state.items.filter(item=>item.id.startsWith('chota-original-')&&item.owned&&item.price===0).length,3);
 state=await rpc(db,'buy_chota_item',['chota-carhartt-marron-v1',100]);assert.equal(state.bottomwear,'chota-carhartt-marron-v1');
 state=await rpc(db,'equip_chota_clothing',['footwear',null]);assert.equal(state.footwear,null);assert.equal(state.bottomwear,'chota-carhartt-marron-v1');assert.equal((await rpc(db,'get_chota_shop_state')).footwear,null);
 state=await rpc(db,'equip_chota_clothing',['topwear',null]);assert.equal(state.topwear,null);assert.equal(state.footwear,null);
 state=await rpc(db,'equip_chota_clothing',['footwear','chota-original-jordan-chicago-v1']);assert.equal(state.footwear,'chota-original-jordan-chicago-v1');assert.equal(state.topwear,null);assert.equal(state.balance,300);
 assert.equal((await db.query('select count(*)::int n from public.member_coin_ledger')).rows[0].n,1,'only the actual purchase enters the coin ledger');
 await assert.rejects(rpc(db,'equip_chota_clothing',['footwear','chota-original-stussy-v1']),/Primero debes conseguir/);
 await assert.rejects(rpc(db,'equip_chota_clothing',['topwear','chota-shirt-supreme-negra-v1']),/Primero debes conseguir/);
 await db.query("select set_config('test.actor',$1,false)",[B]);state=await rpc(db,'get_chota_shop_state');assert.equal(state.topwear,'chota-original-stussy-v1');assert.equal(state.bottomwear,'chota-original-jeans-v1');assert.equal(state.balance,300);
 await db.query("select set_config('test.mfa','false',false)");await assert.rejects(rpc(db,'equip_chota_clothing',['footwear',null]),/Seguridad requerida/);
 }finally{await db.close();}});
test('removal preferences have own-user RLS and cannot be written directly by a client',async()=>{const db=await fixture();try{
 await rpc(db,'equip_chota_clothing',['topwear',null]);await db.query("select set_config('test.actor',$1,false)",[B]);await db.exec('set role authenticated');
 assert.equal((await db.query('select * from public.member_chota_wardrobe_preferences')).rows.length,0);
 await assert.rejects(db.query('insert into public.member_chota_wardrobe_preferences(user_id) values($1)',[B]),/permission denied/);
 await db.exec('reset role');const r=await db.query("select relrowsecurity from pg_class where oid='public.member_chota_wardrobe_preferences'::regclass");assert.equal(r.rows[0].relrowsecurity,true);
 }finally{await db.close();}});
