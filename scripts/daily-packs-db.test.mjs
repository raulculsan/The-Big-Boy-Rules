import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const migration=readFileSync(new URL('../supabase-daily-packs.sql',import.meta.url),'utf8');
const db=new PGlite();
const alice='00000000-0000-0000-0000-000000000001',bob='00000000-0000-0000-0000-000000000002',hidden='00000000-0000-0000-0000-000000000003';
const query=async(sql,params=[]) => (await db.query(sql,params)).rows;
async function asUser(user,fn) {
  await db.exec('set role authenticated');
  await query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
  try{return await fn();}finally{await db.exec('reset role');}
}
const claim=user=>asUser(user,async()=>(await query('select public.claim_daily_card_pack() as result'))[0].result);
before(async()=>{
  await db.exec(`create role anon;create role authenticated;create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;
    alter default privileges in schema public grant all on tables to anon,authenticated;
    alter default privileges in schema public grant all on sequences to anon,authenticated;
    alter default privileges in schema public grant execute on functions to anon,authenticated;
    create table profiles(id uuid primary key,is_hidden boolean not null default false);
    insert into profiles values('${alice}',false),('${bob}',false),('${hidden}',true);`);
  await db.exec(migration);
});
beforeEach(()=>db.exec('truncate public.card_packs restart identity'));
after(()=>db.close());
test('first authenticated visit grants exactly one pack and repeated visits do not duplicate it',async()=>{
  const first=await claim(alice),second=await claim(alice);
  assert.equal(first.available,1);assert.equal(first.total,1);assert.equal(first.credited,true);
  assert.equal(second.available,1);assert.equal(second.credited,false);
  const [{day}]=await query("select (statement_timestamp() at time zone 'Europe/Madrid')::date::text as day");
  assert.equal(first.day,day);
});
test('daily uniqueness is enforced in the database independently of application retries',async()=>{
  await claim(alice);
  await assert.rejects(query("insert into card_packs(user_id,earned_day) select user_id,earned_day from card_packs"),/unique|duplicate/);
  const results=await asUser(alice,()=>Promise.all(Array.from({length:8},()=>query('select claim_daily_card_pack() as result'))));
  assert.ok(results.every(r=>r[0].result.available===1&&!r[0].result.credited));
});
test('past saved packs accumulate without a streak, historical backfill or lost days',async()=>{
  await claim(alice);
  await query('update card_packs set earned_day=earned_day-5');
  const next=await claim(alice);assert.equal(next.available,2);assert.equal(next.credited,true);
  assert.equal((await query('select count(*)::int as n from card_packs'))[0].n,2);
});
test('inventory is private and authenticated clients cannot mint, edit, open or delete packs',async()=>{
  await claim(alice);await claim(bob);
  const rows=await asUser(alice,()=>query('select * from card_packs'));assert.equal(rows.length,1);assert.equal(rows[0].user_id,alice);
  for(const sql of ["insert into card_packs(user_id,earned_day) values('"+alice+"',current_date+1)",
    'update card_packs set opened_at=now()', 'delete from card_packs', "select nextval('card_packs_id_seq')"]) {
    await assert.rejects(asUser(alice,()=>query(sql)),/permission denied/);
  }
});
test('hidden/missing users and anonymous callers cannot get packs or impersonate another user',async()=>{
  await assert.rejects(claim(hidden),/acceso/);
  await assert.rejects(claim('00000000-0000-0000-0000-000000000099'),/acceso/);
  await assert.rejects(asUser(alice,()=>query('select claim_daily_card_pack($1)',[bob])),/does not exist/);
  await db.exec('set role anon');
  try{await assert.rejects(query('select claim_daily_card_pack()'),/permission denied/);await assert.rejects(query('select * from card_packs'),/permission denied/);}
  finally{await db.exec('reset role');}
});
test('opened inventory cannot be replenished by repeating the same daily visit',async()=>{
  await claim(alice);await query('update card_packs set opened_at=now()');
  const state=await claim(alice);assert.equal(state.available,0);assert.equal(state.total,1);assert.equal(state.credited,false);
});
test('reset time is server midnight in Madrid including DST, not a client timestamp',async()=>{
  const state=await claim(alice);
  const [{expected}]=await query("select ((((statement_timestamp() at time zone 'Europe/Madrid')::date+1)::timestamp at time zone 'Europe/Madrid')) as expected");
  assert.equal(Date.parse(state.next_reset_at),new Date(expected).getTime());
  const rows=await query("select extract(epoch from (('2026-03-30'::timestamp at time zone 'Europe/Madrid')-('2026-03-29'::timestamp at time zone 'Europe/Madrid')))/3600 as hours");
  assert.equal(Number(rows[0].hours),23);
});
test('reapplying the installer preserves saved packs and does not grant another daily pack',async()=>{
  await claim(alice);await db.exec(migration);const result=await claim(alice);assert.equal(result.available,1);assert.equal(result.credited,false);
});
