import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const migrationName=readdirSync(new URL('../supabase/migrations/',import.meta.url)).find(file=>file.endsWith('_first_login_pack_rewards.sql'));
const migration=read('supabase/migrations/'+migrationName);
const shop=read('supabase-banner-shop.sql');
const lock=shop.slice(shop.indexOf('create or replace function public.lock_banner_shop_actor()'),shop.indexOf('\ncreate or replace function public.get_banner_shop_state()',shop.indexOf('create or replace function public.lock_banner_shop_actor()')));
const users=Object.fromEntries(['old','fresh','hidden','denied','legacy','gifted','pending'].map((key,index)=>[key,`00000000-0000-0000-0000-${String(index+1).padStart(12,'0')}`]));
const db=new PGlite();
const query=async(sql,args=[])=>(await db.query(sql,args)).rows;
async function asUser(id,fn) {
  await query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
  await db.exec('set role authenticated');
  try{return await fn();}finally{await db.exec('reset role');}
}
const claim=id=>asUser(id,async()=>(await query('select public.claim_daily_card_pack() result'))[0].result);
const count=async(sql,args=[])=>(await query(sql,args))[0].n;

before(async()=>{
  await db.exec(`create role anon;create role authenticated;create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to anon,authenticated;
    create table auth.users(id uuid primary key,last_sign_in_at timestamptz);
    create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,is_hidden boolean not null default false);
    create table public.member_coin_wallets(user_id uuid primary key references profiles(id) on delete cascade,balance integer not null default 0);
    create table public.member_reward_pack_grants(user_id uuid not null references profiles(id) on delete cascade,event_key text not null,packs integer not null check(packs between 0 and 6),primary key(user_id,event_key));
    create table public.admin_removed_daily_pack_claims(user_id uuid not null references profiles(id) on delete cascade,earned_day date not null,primary key(user_id,earned_day));
    revoke all on public.member_reward_pack_grants,public.admin_removed_daily_pack_claims,public.member_coin_wallets from public,anon,authenticated;
    create function public.assert_account_security() returns void language plpgsql as $$begin if coalesce(current_setting('test.security',true),'')<>'ok' then raise exception 'Security gate' using errcode='42501';end if;end$$;`);
  await db.exec(read('supabase-daily-packs.sql'));
  await db.exec(lock);
});
beforeEach(async()=>{
  await db.exec('drop trigger if exists fail_test_welcome on public.card_packs;drop table if exists club_rewards.first_login_pack_rewards;truncate auth.users cascade;');
  await query("select set_config('test.security','ok',false),set_config('request.jwt.claim.sub','',false)");
  for(const [key,id] of Object.entries(users)) {
    await query('insert into auth.users values($1,$2)',[id,key==='old'?'2026-10-01T10:00:00Z':null]);
    if(key!=='pending')await query('insert into profiles values($1,$2)',[id,key==='hidden']);
  }
  await query("insert into card_packs(user_id,earned_day,source) values($1,current_date-1,'daily')",[users.legacy]);
  await query("insert into card_packs(user_id,earned_day,source) select $1,current_date,'admin' from generate_series(1,3)",[users.gifted]);
  await db.exec(migration);
});
after(()=>db.close());

test('first-ever approved sign-in credits twenty welcome packs plus the ordinary daily pack, exactly once',async()=>{
  const first=await claim(users.fresh),repeat=await claim(users.fresh);
  assert.equal(first.welcome_credited_packs,20);assert.equal(first.credited_packs,21);assert.equal(first.available,21);assert.equal(first.welcome_received,true);
  assert.equal(repeat.welcome_credited_packs,0);assert.equal(repeat.credited_packs,0);assert.equal(repeat.available,21);
  assert.equal(await count("select count(*)::int n from card_packs where user_id=$1 and source='welcome'",[users.fresh]),20);
});
test('snapshot excludes historical Auth sign-ins and daily history without giving retroactive welcome packs',async()=>{
  for(const id of [users.old,users.legacy]) {const result=await claim(id);assert.equal(result.welcome_credited_packs,0);assert.equal(result.welcome_received,false);}
  assert.equal(await count('select count(*)::int n from club_rewards.first_login_pack_rewards where awarded_packs=0'),2);
});
test('an admin gift to a never-signed-in account does not consume its first-login welcome',async()=>{
  const result=await claim(users.gifted);assert.equal(result.welcome_credited_packs,20);assert.equal(result.available,24);
});
test('parallel retries and different sessions cannot duplicate the account receipt or welcome inventory',async()=>{
  const results=await asUser(users.fresh,()=>Promise.all(Array.from({length:12},()=>query('select claim_daily_card_pack() result'))));
  assert.equal(results.reduce((n,r)=>n+r[0].result.welcome_credited_packs,0),20);
  const secondSession=await claim(users.fresh);assert.equal(secondSession.welcome_credited_packs,0);
  assert.equal(await count('select count(*)::int n from club_rewards.first_login_pack_rewards where user_id=$1',[users.fresh]),1);
});
test('opening/removing welcome packs and replacing the profile cannot reset the account receipt',async()=>{
  await claim(users.fresh);await query("update card_packs set opened_at=now() where user_id=$1 and source='welcome'",[users.fresh]);
  assert.equal((await claim(users.fresh)).welcome_credited_packs,0);
  await query("delete from card_packs where user_id=$1 and source='welcome'",[users.fresh]);
  assert.equal((await claim(users.fresh)).welcome_credited_packs,0);
  await query('delete from profiles where id=$1',[users.fresh]);await query('insert into profiles(id) values($1)',[users.fresh]);
  assert.equal((await claim(users.fresh)).welcome_credited_packs,0);
});
test('hidden, unapproved/missing profiles and failed account security cannot receive or consume a welcome',async()=>{
  for(const id of [users.hidden,users.pending])await assert.rejects(claim(id),/Inicia sesión/);
  await query("select set_config('test.security','blocked',false)");await assert.rejects(claim(users.denied),/Security gate/);
  assert.equal(await count('select count(*)::int n from club_rewards.first_login_pack_rewards where user_id=any($1::uuid[])',[[users.hidden,users.pending,users.denied]]),0);
  await query("select set_config('test.security','ok',false)");assert.equal((await claim(users.denied)).welcome_credited_packs,20);
});
test('receipt and packs roll back together if any welcome insertion fails',async()=>{
  await db.exec(`create or replace function public.fail_welcome_test() returns trigger language plpgsql as $$begin if new.source='welcome' then raise exception 'Simulated insertion failure';end if;return new;end$$;
    create trigger fail_test_welcome before insert on public.card_packs for each row execute function public.fail_welcome_test();`);
  await assert.rejects(claim(users.fresh),/Simulated insertion failure/);
  assert.equal(await count('select count(*)::int n from club_rewards.first_login_pack_rewards where user_id=$1',[users.fresh]),0);
  await db.exec('drop trigger fail_test_welcome on public.card_packs');assert.equal((await claim(users.fresh)).welcome_credited_packs,20);
});
test('an administrator removal of today’s daily reward remains respected while welcome is credited once',async()=>{
  await query("insert into admin_removed_daily_pack_claims values($1,(statement_timestamp() at time zone 'Europe/Madrid')::date)",[users.fresh]);
  const first=await claim(users.fresh);assert.equal(first.welcome_credited_packs,20);assert.equal(first.credited_packs,20);assert.equal(first.available,20);
  assert.equal((await claim(users.fresh)).credited_packs,0);
});
test('anonymous/member callers cannot read or mutate private receipts, mint packs or impersonate another account',async()=>{
  await db.exec('set role anon');try{await assert.rejects(db.query('select claim_daily_card_pack()'),/permission denied/);}finally{await db.exec('reset role');}
  for(const role of ['anon','authenticated']) {
    await db.exec('set role '+role);
    try{for(const sql of ['select * from club_rewards.first_login_pack_rewards',`insert into club_rewards.first_login_pack_rewards values('${users.fresh}',20,now())`,'delete from club_rewards.first_login_pack_rewards'])await assert.rejects(db.query(sql),/permission denied/);}
    finally{await db.exec('reset role');}
  }
  await assert.rejects(asUser(users.fresh,()=>query('select claim_daily_card_pack($1::uuid)',[users.old])),/does not exist/);
});
test('reapplying the migration neither duplicates a grant nor reclassifies a new account awaiting its first claim',async()=>{
  await claim(users.gifted);
  await query('update auth.users set last_sign_in_at=now() where id=$1',[users.fresh]);await db.exec(migration);
  assert.equal((await claim(users.gifted)).welcome_credited_packs,0);assert.equal((await claim(users.fresh)).welcome_credited_packs,20);
});
