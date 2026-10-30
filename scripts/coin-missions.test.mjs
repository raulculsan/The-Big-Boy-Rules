import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const files=readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(f=>f.endsWith('_club_coin_missions.sql')||f.endsWith('_club_coin_mission_validation.sql')).sort();
const db=new PGlite();
const uid='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002';
const q=async(sql,args=[])=>(await db.query(sql,args)).rows;
const scalar=async(sql,args=[])=>(await q(sql,args))[0].n;
async function as(id,fn){await q("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');try{return await fn();}finally{await db.exec('reset role');}}
const state=(id=uid)=>as(id,async()=>(await q('select public.get_club_coin_missions() n'))[0].n);
const claim=(id,reward)=>as(id,async()=>(await q('select public.claim_club_coin_reward($1) n',[reward]))[0].n);
async function session(game='football',level=1){return (await q("insert into club_arcade.sessions(id,user_id,game,level,started_at) values(gen_random_uuid(),$1,$2,$3,clock_timestamp()-interval '30 seconds') returning id",[uid,game,level]))[0].id;}
const submit=(id,score=10,completed=true,won=true)=>as(uid,async()=>(await q('select public.submit_chota_level_score($1,$2,$3,$4) n',[id,score,completed,won]))[0].n);
const wallet=()=>scalar('select balance n from member_coin_wallets where user_id=$1',[uid]);
async function photo(event=1,opts={}){
  await q("insert into group_events(id,title) values($1,$2) on conflict do nothing",[event,'Plan '+event]);
  if(opts.attended!==false)await q("insert into club_event_arrivals(event_id,occurrence,user_id,arrived_at) values($1,(now() at time zone 'Europe/Madrid')::date,$2,now()) on conflict do nothing",[event,uid]);
  const path=`${uid}/${event}/photo.jpg`;
  if(opts.stored!==false)await q("insert into storage.objects(bucket_id,name) values('club-memories',$1) on conflict do nothing",[path]);
  return as(uid,()=>q("insert into club_event_memories(event_id,occurrence,created_by,media_path,media_type) values($1,(now() at time zone 'Europe/Madrid')::date,$2,$3,'image') returning id",[event,uid,path]));
}
before(async()=>{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;create schema club_arcade;create schema club_social;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to anon,authenticated;
 create table auth.users(id uuid primary key);
 create table profiles(id uuid primary key references auth.users(id),is_hidden boolean default false);
 create table member_coin_wallets(user_id uuid primary key references profiles(id),balance bigint not null default 0);
 create table member_coin_ledger(id bigint generated always as identity,user_id uuid,delta bigint,balance_after bigint,reason text constraint member_coin_ledger_reason_check check(reason in('duplicate_discard','banner_purchase','admin_grant','admin_adjust','chota_purchase')),item_id text,copies integer);
 create table member_reward_pack_grants(user_id uuid,event_key text,packs integer,primary key(user_id,event_key));
 create table card_packs(id bigint generated always as identity,user_id uuid,earned_day date,source text);
 create table club_arcade.sessions(id uuid primary key,user_id uuid,game text,started_at timestamptz,finished_at timestamptz,score integer);
 create table club_arcade.best_scores(user_id uuid,game text,score integer,achieved_at timestamptz,primary key(user_id,game));
 create table group_events(id bigint primary key,title text);
 create table club_event_arrivals(event_id bigint,occurrence date,user_id uuid,arrived_at timestamptz,primary key(event_id,occurrence,user_id));
 create table club_event_memories(id uuid default gen_random_uuid(),event_id bigint,occurrence date,created_by uuid,created_at timestamptz default now(),moment_id bigint,media_path text,media_type text);
 create table storage.objects(bucket_id text,name text,primary key(bucket_id,name));
 create table moments(id bigint,user_id uuid,media_type text);
 create table achievement_card_catalog(id text primary key,collection_key text,edition text,kind text,active boolean default true);
 create table published_card_designs(id text primary key,published boolean default true);
 create table member_card_inventory(user_id uuid,card_id text,quantity integer,primary key(user_id,card_id));
 create function public.assert_account_security() returns void language plpgsql as $$begin if coalesce(current_setting('test.security',true),'')<>'ok' then raise exception 'Security gate' using errcode='42501';end if;end$$;
 create function public.submit_chota_game_score(uuid,integer) returns jsonb language sql as $$select '{}'::jsonb$$;
 create function public.start_chota_game(text) returns uuid language sql as $$select gen_random_uuid()$$;
 create function club_social.month_status(actor uuid) returns jsonb language sql as $$select jsonb_build_object('month',date_trunc('month',now() at time zone 'Europe/Madrid')::date,'ends_at',now()+interval '1 month','plans',2,'memories',5,'trades',3,'complete',coalesce(current_setting('test.club_complete',true),'')='yes','contributed',actor='${uid}'::uuid)$$;
 grant insert,select,delete on club_event_memories to authenticated;
 revoke all on member_coin_wallets,member_coin_ledger from anon,authenticated;`);
 const shop=read('supabase-banner-shop.sql'),start=shop.indexOf('create or replace function public.lock_banner_shop_actor()');
 await db.exec(shop.slice(start,shop.indexOf('\ncreate or replace function public.get_banner_shop_state()',start)));
 await db.exec(read('supabase/migrations/20261023103806_chota_arcade_daily_pack_rewards.sql'));
 await db.exec(read('supabase/migrations/20261024131207_discrete_arcade_levels.sql'));
 await q('insert into auth.users values($1),($2)',[uid,other]);await q('insert into profiles(id) values($1),($2)',[uid,other]);
 await q("insert into club_arcade.level_progress(user_id,game,highest_completed) values($1,'football',2)",[uid]);
 await q("insert into club_event_memories(event_id,occurrence,created_by) values(90,current_date,$1)",[uid]);
 for(const file of files)await db.exec(read('supabase/migrations/'+file));
});
beforeEach(async()=>{
 await db.exec('truncate member_coin_ledger,member_coin_wallets,card_packs,member_reward_pack_grants,club_arcade.sessions,club_arcade.best_scores,club_event_memories,club_event_arrivals,group_events,storage.objects,achievement_card_catalog,published_card_designs,member_card_inventory;delete from club_rewards.coin_receipts where coins>0;');
 await q("select set_config('test.security','ok',false),set_config('test.club_complete','',false),set_config('request.jwt.claim.sub','',false)");
 await q('update profiles set is_hidden=false');
});
after(()=>db.close());

test('old completed levels remain consumed without minting coins',async()=>{
 const s=await state();const old=s.missions.find(m=>m.id==='level:football:2');assert.equal(old.claimed,true);assert.equal(old.earned_coins,0);
 assert.equal((await claim(uid,old.id)).coins,0);assert.equal(await wallet(),0);
});
test('new validated level pays its fixed amount plus once-daily routine; retry pays nothing',async()=>{
 const id=await session('football',3),r=await submit(id,18);
 assert.equal(r.level_completed,true);assert.equal(r.awarded_coins,15);assert.equal(await wallet(),15);assert.equal((await state()).missions.find(m=>m.id==='level:football:3').earned_coins,10);
 assert.equal((await submit(id,18)).awarded_coins,0);assert.equal(await wallet(),15);
 assert.equal(await scalar('select count(*)::integer n from card_packs'),1);
});
test('failing a level can earn daily routine but not the level reward',async()=>{
 const r=await submit(await session('robot-vacuum',1),2,true,false);assert.equal(r.level_completed,false);assert.equal(r.awarded_coins,5);
 const r2=await submit(await session('robot-vacuum',1),2,true,false);assert.equal(r2.awarded_coins,0);
});
test('short or incomplete attempts and impossible scores cannot mint coins',async()=>{
 const id=await session('skateboard',1);await q("update club_arcade.sessions set started_at=clock_timestamp()-interval '2 seconds' where id=$1",[id]);
 await assert.rejects(submit(id,1000),/límites/);assert.equal((await submit(id,0,false,false)).awarded_coins,0);assert.equal(await wallet(),0);
});
test('claim rejects forged IDs and incomplete missions and cannot read another wallet',async()=>{
 await assert.rejects(claim(uid,'level:skateboard:5'),/Completa/);
 await assert.rejects(claim(uid,'daily:1900-01-01:football'),/Completa/);
 await assert.rejects(claim(uid,'admin:1000000'),/Completa/);
 await submit(await session('skateboard',1),8);
 const mine=await state(),theirs=await state(other);assert.equal(mine.balance,5);assert.equal(theirs.balance,0);
});
test('album pages match reserved member/location slots, never reward an empty page',async()=>{
 for(const [id,kind] of [['a','member'],['b','member'],['c','location'],['d','object']]){
   await q("insert into achievement_card_catalog values($1,'collection','common',$2,true)",[id,kind]);await q('insert into published_card_designs values($1,true)',[id]);
 }
 await q('insert into member_card_inventory values($1,\'a\',1),($1,\'b\',1),($1,\'c\',1)',[uid]);
 let s=await state();const pages=s.missions.filter(m=>m.id.startsWith('album-page:collection'));
 assert.equal(pages[0].title,'Común · Página 1');assert.deepEqual(pages.map(m=>[m.page,m.target,m.current]),[[1,2,2],[3,1,1],[4,1,0]]);
 assert.equal((await claim(uid,pages[0].id)).coins,10);assert.equal((await claim(uid,pages[0].id)).coins,0);
 await assert.rejects(claim(uid,'album-category:collection:common'),/Completa/);
 await q('insert into member_card_inventory values($1,\'d\',1)',[uid]);assert.equal((await claim(uid,'album-category:collection:common')).coins,30);
 await q('delete from member_card_inventory where card_id=\'a\'');assert.equal((await claim(uid,pages[0].id)).coins,0);
 assert.equal(await wallet(),40);
});
test('unpublished and inactive cards cannot create album rewards',async()=>{
 await db.exec("insert into achievement_card_catalog values('x','hidden','common','member',true),('y','inactive','common','member',false);insert into published_card_designs values('x',false),('y',true)");
 assert.equal((await state()).missions.filter(m=>m.category==='album').length,0);
});
test('photo pays once per attended plan, with real storage evidence, and survives deleting and reposting',async()=>{
 await photo(1);assert.equal(await wallet(),10);
 await as(uid,()=>q('delete from club_event_memories where event_id=1'));await photo(1);assert.equal(await wallet(),10);
 await photo(2,{stored:false});await photo(3,{attended:false});assert.equal(await wallet(),10);
});
test('photo grants are capped at three plans per Madrid day',async()=>{
 for(let i=1;i<=4;i++)await photo(i);
 assert.equal(await wallet(),30);assert.equal(await scalar("select count(*)::integer n from club_rewards.coin_receipts where user_id=$1 and category='memory' and coins>0",[uid]),3);
});
test('weekly reward needs three distinct activity types and is once per week',async()=>{
 let weekly=(await state()).missions.find(m=>m.category==='weekly');assert.equal(weekly.current,0);await assert.rejects(claim(uid,weekly.id),/Completa/);
 await submit(await session('football',3),18);await photo(1);
 weekly=(await state()).missions.find(m=>m.category==='weekly');assert.equal(weekly.current,3);assert.equal((await claim(uid,weekly.id)).coins,25);assert.equal((await claim(uid,weekly.id)).coins,0);
});
test('club reward requires completed collective goal and personal contribution',async()=>{
 let club=(await state()).missions.find(m=>m.category==='club');await assert.rejects(claim(uid,club.id),/Completa/);
 await q("select set_config('test.club_complete','yes',false)");assert.equal((await claim(uid,club.id)).coins,30);assert.equal((await claim(uid,club.id)).coins,0);
 await assert.rejects(claim(other,club.id),/Completa/);
});
test('anonymous, hidden, unverified and direct receipt access are denied',async()=>{
 await assert.rejects(as('',()=>q('select get_club_coin_missions()')),/Inicia sesión/);
 await q('update profiles set is_hidden=true where id=$1',[uid]);await assert.rejects(state(),/Inicia sesión/);
 await q('update profiles set is_hidden=false where id=$1',[uid]);await q("select set_config('test.security','blocked',false)");await assert.rejects(state(),/Security gate/);
 await assert.rejects(as(uid,()=>q('select * from club_rewards.coin_receipts')),/permission denied/);
 await assert.rejects(as(uid,()=>q("select club_rewards.award_coins($1,'forged','daily',30)",[uid])),/permission denied/);
});
test('ledger failure rolls back receipt, coins, packs and game completion together',async()=>{
 const id=await session('skateboard',2);
 await db.exec("create function fail_test_ledger() returns trigger language plpgsql as $$begin raise exception 'test ledger failure';end$$;create trigger fail_test_ledger before insert on member_coin_ledger for each row execute function fail_test_ledger();");
 try{await assert.rejects(submit(id,10),/test ledger failure/);assert.equal(await scalar("select count(*)::integer n from club_rewards.coin_receipts where reward_id='level:skateboard:2'"),0);assert.equal(await scalar('select count(*)::integer n from card_packs'),0);assert.equal((await q('select finished_at from club_arcade.sessions where id=$1',[id]))[0].finished_at,null);}
 finally{await db.exec('drop trigger fail_test_ledger on member_coin_ledger;drop function fail_test_ledger()');}
 assert.equal((await submit(id,10)).awarded_coins,8);
});

test('instant forged vacuum win cannot advance progress or unlock a manual coin claim',async()=>{
 const id=await session('robot-vacuum',1);await q("update club_arcade.sessions set started_at=clock_timestamp()-interval '2 seconds' where id=$1",[id]);
 const r=await submit(id,30,true,true);assert.equal(r.level_completed,false);assert.equal(r.awarded_coins,0);
 await assert.rejects(claim(uid,'level:robot-vacuum:1'),/Completa/);
});
