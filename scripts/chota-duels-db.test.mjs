import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const sql = fs.readFileSync(new URL('../supabase/migrations/20261111190000_chota_arcade_duels.sql', import.meta.url), 'utf8');
const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b', C = '00000000-0000-0000-0000-00000000000c';
async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create schema club_arcade; create schema club_rewards;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
    create function public.assert_account_security() returns void language sql as $$select$$;
    create table public.profiles(id uuid primary key, display_name text, is_hidden boolean not null default false);
    insert into public.profiles values ('${A}','Ana',false),('${B}','Beto',false),('${C}','Cris',false);
    create table public.chota_item_catalog(id text primary key, art_key text); insert into public.chota_item_catalog values ('ball','football');
    create table public.member_owned_chota_items(user_id uuid, item_id text); insert into public.member_owned_chota_items values ('${A}','ball'),('${B}','ball');
    create table club_arcade.level_progress(user_id uuid, game text, highest_completed smallint); insert into club_arcade.level_progress values ('${B}','football',1);
    create table club_arcade.sessions(id uuid primary key default gen_random_uuid(), user_id uuid, game text, level smallint, score int, started_at timestamptz default now(), finished_at timestamptz);
    create table club_rewards.receipts(user_id uuid, reward_id text, coins int, primary key(user_id,reward_id));
    create function club_rewards.award_coins(actor uuid, reward_key text, reward_category text, amount integer, details jsonb default '{}') returns integer language plpgsql as $$
      begin insert into club_rewards.receipts values (actor, reward_key, amount*2) on conflict do nothing; if not found then return 0; end if; return amount*2; end $$;`);
  await db.exec(sql);
  return db;
}
const as = (db, who) => db.exec(`select set_config('test.actor','${who}',false)`);
const val = async (db, q, args = []) => Object.values((await db.query(q, args)).rows[0])[0];
const run = async (db, who, level, score, started = 'now()') => val(db, `insert into club_arcade.sessions(user_id,game,level,score,started_at) values ($1,'football',$2,$3,${started}) returning id`, [who, level, score]);
const finish = (db, id) => db.query(`update club_arcade.sessions set finished_at=now() where id=$1`, [id]);

test('duel: three attempts, best one counts, winner claims once', async () => {
  const db = await setup();
  try {
    const mine = await run(db, A, 2, 40); await finish(db, mine);
    await as(db, A);
    await assert.rejects(db.query(`select public.create_chota_duel($1,$2)`, [mine, C]), /todavía no tiene/);
    const duel = await val(db, `select public.create_chota_duel($1,$2)`, [mine, B]);
    await assert.rejects(db.query(`select public.create_chota_duel($1,$2)`, [mine, B]), /Ya tienes un reto abierto/);
    for (const score of [30, 45, 10]) { const s = await run(db, B, 2, score, "now() + interval '1 second'"); await finish(db, s); }
    const other = await run(db, B, 1, 999, "now() + interval '1 second'"); await finish(db, other); // other level: ignored
    await as(db, B);
    const {duels} = await val(db, `select public.get_chota_duels()`);
    assert.deepEqual([duels[0].status, duels[0].attempts, duels[0].rival_best, duels[0].can_claim, duels[0].other], ['won', 3, 45, true, 'Ana']);
    const claimed = await val(db, `select public.claim_chota_duel($1)`, [duel]);
    assert.equal(claimed.awarded_coins, 40);
    await assert.rejects(db.query(`select public.claim_chota_duel($1)`, [duel]), /no está disponible/);
    await as(db, A);
    await assert.rejects(db.query(`select public.claim_chota_duel($1)`, [duel]), /no está disponible/, 'the loser cannot claim');
  } finally { await db.close(); }
});

test('duel: locked levels, decline, expiry and the daily claim cap', async () => {
  const db = await setup();
  try {
    const high = await run(db, A, 4, 50); await finish(db, high);
    await as(db, A);
    await assert.rejects(db.query(`select public.create_chota_duel($1,$2)`, [high, B]), /no ha llegado a este nivel/);
    const low = await run(db, A, 1, 20); await finish(db, low);
    const duel = await val(db, `select public.create_chota_duel($1,$2)`, [low, B]);
    await as(db, B);
    const after = await val(db, `select public.decline_chota_duel($1)`, [duel]);
    assert.equal(after.duels[0].status, 'declined');
    assert.equal(after.duels[0].can_claim, false, 'declining gives nobody coins');
    await as(db, A);
    const again = await val(db, `select public.create_chota_duel($1,$2)`, [low, B]);
    await db.exec(`update public.chota_arcade_duels set expires_at = now() - interval '1 minute' where id='${again}'`);
    assert.equal((await val(db, `select public.get_chota_duels()`)).duels.find(d => d.id === again).status, 'expired');
    await db.exec(`insert into public.chota_arcade_duels(challenger_id,rival_id,game,level,target_score,status,resolved_at,claimed_at)
      select '${A}','${B}','football',1,10,'lost',now(),now() from generate_series(1,3)`);
    await db.exec(`insert into public.chota_arcade_duels(id,challenger_id,rival_id,game,level,target_score,status,resolved_at) values ('00000000-0000-0000-0000-0000000000dd','${A}','${B}','football',1,10,'lost',now())`);
    await assert.rejects(db.query(`select public.claim_chota_duel('00000000-0000-0000-0000-0000000000dd')`), /tres retos hoy/);
    await db.exec(`set role authenticated`);
    await assert.rejects(db.query(`select * from public.chota_arcade_duels`), /permission denied/);
  } finally { await db.close(); }
});
