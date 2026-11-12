import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b', C = '00000000-0000-0000-0000-00000000000c';

// Minimal schema around the story and the coin payouts.
const schema = `
create role anon; create role authenticated;
create schema auth; create schema club_rewards; create schema club_story;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.profiles(id uuid primary key, is_hidden boolean not null default false);
insert into public.profiles values ('${A}',false),('${B}',false),('${C}',false);
create table public.member_coin_wallets(user_id uuid primary key, balance bigint not null default 0);
create table public.member_coin_ledger(user_id uuid, delta integer, balance_after bigint not null, reason text, item_id text, copies integer);
create table club_rewards.coin_receipts(user_id uuid, reward_id text, category text, coins integer, metadata jsonb, primary key(user_id, reward_id));
create function public.assert_account_security() returns void language sql as $$select$$;
create function public.lock_banner_shop_actor() returns uuid language sql as $$select auth.uid()$$;
create function club_rewards.coin_multiplier() returns integer language sql immutable as $$select 2$$;
create table club_story.chapters(key text primary key, options jsonb not null);
create table club_story.seasons(id uuid primary key default gen_random_uuid(), money smallint default 50, fame smallint default 50, energy smallint default 50, trouble smallint default 50);
create table club_story.days(id uuid primary key default gen_random_uuid(), season_id uuid, day date, chapter_key text, next_key text, twist_by uuid, winner smallint, votes_total integer, resolved_at timestamptz);
create table club_story.votes(day_id uuid, user_id uuid, option smallint);
create table club_story.members(season_id uuid, user_id uuid, streak smallint default 0, best smallint default 0, twist_used boolean default false, primary key(season_id, user_id));
create function club_story.clamp(value integer) returns smallint language sql immutable as $$select greatest(0,least(100,value))::smallint$$;
create function public.finish_club_night(p_event bigint, p_occurrence date) returns void language plpgsql security definer set search_path='' as $f$
begin perform club_rewards.award_coins(p.id,'night','club',3) from (select '${A}'::uuid id) p; end $f$;
insert into club_story.chapters values ('hacienda','[{"label":"Pagar","money":-5,"fame":0,"energy":0,"trouble":-5},{"label":"Esconder","money":5,"fame":0,"energy":0,"trouble":10}]');
insert into club_story.seasons(id) values ('00000000-0000-0000-0000-0000000000f1');
insert into club_story.days(id, season_id, day, chapter_key) values ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000f1','2026-11-11','hacienda');
insert into club_story.votes values ('00000000-0000-0000-0000-0000000000d1','${A}',1),('00000000-0000-0000-0000-0000000000d1','${B}',1),('00000000-0000-0000-0000-0000000000d1','${C}',0);
`;

test('a day with several winning voters closes and pays each of them', async () => {
  const {PGlite} = await import('@electric-sql/pglite');
  const db = new PGlite();
  try {
    await db.exec(schema);
    await db.exec(read('supabase/migrations/20261112210000_shared_prizes.sql'));
    // The member who opens the app next (C) lost, yet the day still closes.
    await db.exec(`set request.jwt.claim.sub='${C}'`);
    await db.query(`select club_story.resolve('00000000-0000-0000-0000-0000000000d1')`);
    const day = (await db.query(`select winner, votes_total, resolved_at is not null closed from club_story.days`)).rows[0];
    assert.deepEqual(day, {winner: 1, votes_total: 2 + 1, closed: true});
    const paid = (await db.query(`select user_id, balance from public.member_coin_wallets order by user_id`)).rows;
    assert.deepEqual(paid, [{user_id: A, balance: 4}, {user_id: B, balance: 4}]);
    // Closing twice pays nothing more.
    await db.exec(`update club_story.days set resolved_at = null`);
    await db.query(`select club_story.resolve('00000000-0000-0000-0000-0000000000d1')`);
    assert.equal((await db.query(`select sum(balance)::int total from public.member_coin_wallets`)).rows[0].total, 8);
  } finally { await db.close(); }
});

test('members still cannot pay themselves on behalf of someone else', async () => {
  const {PGlite} = await import('@electric-sql/pglite');
  const db = new PGlite();
  try {
    await db.exec(schema);
    await db.exec(read('supabase/migrations/20261112210000_shared_prizes.sql'));
    await db.exec(`set request.jwt.claim.sub='${C}'`);
    await assert.rejects(db.query(`select club_rewards.award_coins('${A}','x','club',5)`), /Cuenta no válida/);
    assert.equal((await db.query(`select club_rewards.award_coins('${C}','x','club',5) coins`)).rows[0].coins, 10);
    // The games night now pays through the internal payout.
    const night = (await db.query(`select prosrc from pg_proc where proname = 'finish_club_night'`)).rows[0].prosrc;
    assert.match(night, /club_rewards\.grant_coins\(p\.id/);
    const grants = (await db.query(`select has_function_privilege('authenticated','club_rewards.grant_coins(uuid,text,text,integer,jsonb)','execute') ok`)).rows[0].ok;
    assert.equal(grants, false);
  } finally { await db.close(); }
});
