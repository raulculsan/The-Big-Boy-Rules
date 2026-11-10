import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const migration = fs.readFileSync(new URL('../supabase/migrations/20261110120000_pack_luck.sql', import.meta.url), 'utf8');
const A = '00000000-0000-0000-0000-000000000001', B = '00000000-0000-0000-0000-000000000002';
const TOP = ['legendary', 'full_art', 'vice_city', 'halloween'], BOOST = ['epic', ...TOP];
async function fixture() {
  const db = new PGlite();
  await db.exec(`
create role anon; create role authenticated; create role service_role; create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
create table public.profiles(id uuid primary key, is_hidden boolean default false);
create table public.member_coin_wallets(user_id uuid primary key, balance bigint not null default 0);
create table public.card_packs(id bigint generated always as identity primary key, user_id uuid not null references public.profiles(id) on delete cascade,
  earned_day date not null, collection_key text not null default 'los-nuestros-01', created_at timestamptz default now(), opened_at timestamptz, source text not null default 'daily');
create table public.achievement_card_catalog(id text primary key, kind text not null, edition text not null, active boolean not null default true);
create table public.member_pack_card_awards(pack_id bigint, draw_index integer, user_id uuid, card_id text, primary key(pack_id, draw_index));
create table public.member_card_inventory(user_id uuid, card_id text, quantity integer not null, primary key(user_id, card_id));
create table public.club_economy_configuration(singleton boolean primary key default true, rarity_weights jsonb not null);
insert into public.club_economy_configuration values(true,'{"common":5400,"special":1500,"retro":1200,"epic":900,"legendary":500,"full_art":200,"vice_city":200,"halloween":100}');
create function public.card_pack_rarity_weights() returns table(edition text, weight integer) language sql stable security definer set search_path='' as $$
  select e.key, e.value::integer from public.club_economy_configuration c, lateral jsonb_each_text(c.rarity_weights) e where c.singleton$$;
create function public.lock_banner_shop_actor() returns uuid language plpgsql security definer set search_path='' as $$declare actor uuid := auth.uid();
  begin if actor is null then raise exception 'Sesión requerida' using errcode='42501'; end if; return actor; end$$;
insert into public.profiles(id) values('${A}'),('${B}'); insert into public.member_coin_wallets values('${A}',10),('${B}',10);
insert into public.achievement_card_catalog(id,kind,edition)
  select k||'-'||e||'-'||n, k, e from (values('member'),('object'),('location')) kinds(k),
    (values('common'),('special'),('retro'),('epic'),('legendary')) editions(e), generate_series(1,6) n;
insert into public.achievement_card_catalog(id,kind,edition) select 'member-'||e||'-'||n,'member',e from (values('full_art'),('vice_city'),('halloween')) x(e), generate_series(1,4) n;
create function public.open_owned_card_pack(target_pack_id bigint default null) returns jsonb language sql as $$select '{}'::jsonb$$;
grant execute on function public.open_owned_card_pack(bigint) to authenticated;
`);
  await db.exec(migration);
  return db;
}
const as = (db, user) => db.exec(`select set_config('test.actor','${user}',false)`);
const give = (db, user, count = 1, variant = 'standard') => db.exec(`insert into public.card_packs(user_id,earned_day,variant) select '${user}', current_date, '${variant}' from generate_series(1,${count})`);
const open = async db => (await db.query('select public.open_owned_card_pack() value')).rows[0].value;
const luck = async db => (await db.query('select public.get_pack_luck() value')).rows[0].value;
function shape(result) {
  assert.equal(result.cards.length, 6);
  assert.deepEqual(result.cards.map(card => card.kind), ['member', 'member', 'member', 'object', 'object', 'location']);
  assert.equal(new Set(result.cards.map(card => card.card_id)).size, 6, 'six distinct cards');
  for (const card of result.cards) if (card.edition === 'halloween') assert.equal(card.kind, 'member');
}

test('a normal pack keeps its shape, advances both counters and resets the drought on a top card', async () => {
  const db = await fixture(); try {
    await as(db, A); await give(db, A, 40);
    let expected = 0;
    for (let n = 1; n <= 11; n++) {
      const result = await open(db); shape(result);
      assert.equal(result.luck.guaranteed, false); assert.equal(result.luck.boosted, false);
      expected = result.cards.some(card => TOP.includes(card.edition)) ? 0 : expected + 1;
      assert.equal(result.luck.since_top, expected); assert.equal(result.luck.opened, n);
      assert.equal(result.luck.pity_in, 12 - expected); assert.equal(result.luck.boost_in, 25 - n);
    }
  } finally { await db.close(); }
});

test('after twelve dry packs the next one always holds a legendary-or-better card, then the count restarts', async () => {
  const db = await fixture(); try {
    await as(db, A); await give(db, A, 60);
    for (let round = 0; round < 40; round++) {
      await db.exec(`insert into public.member_pack_luck(user_id,packs_since_top) values('${A}',12) on conflict(user_id) do update set packs_since_top=12`);
      assert.equal((await luck(db)).guaranteed_next, true);
      const result = await open(db); shape(result);
      assert.equal(result.luck.guaranteed, true);
      const flagged = result.cards.filter(card => card.guaranteed);
      assert.equal(flagged.length, 1); assert.ok(TOP.includes(flagged[0].edition), flagged[0].edition);
      assert.equal(result.luck.since_top, 0); assert.equal(result.luck.pity_in, 12);
    }
  } finally { await db.close(); }
});

test('the drought never passes twelve: with top rarities almost impossible the thirteenth pack still pays', async () => {
  const db = await fixture(); try {
    await db.exec(`update public.club_economy_configuration set rarity_weights='{"common":100000000,"special":1,"retro":1,"epic":1,"legendary":1,"full_art":1,"vice_city":1,"halloween":1}'`);
    await as(db, A); await give(db, A, 13);
    for (let n = 1; n <= 12; n++) assert.equal((await open(db)).luck.since_top, n);
    const result = await open(db);
    assert.equal(result.luck.guaranteed, true); assert.ok(result.cards.some(card => TOP.includes(card.edition)));
    assert.equal(result.luck.since_top, 0);
  } finally { await db.close(); }
});

test('every twenty-fifth opening grants one boosted pack, which always holds an epic-or-better card', async () => {
  const db = await fixture(); try {
    await as(db, A); await give(db, A, 50);
    for (let n = 1; n <= 50; n++) {
      const result = await open(db);
      assert.equal(result.luck.granted_boosted, n % 25 === 0, `opening ${n}`);
    }
    const waiting = await db.query(`select variant, source from public.card_packs where user_id='${A}' and opened_at is null`);
    assert.deepEqual(waiting.rows, [{variant: 'boosted', source: 'opening_streak'}, {variant: 'boosted', source: 'opening_streak'}]);
    const state = await luck(db);
    assert.equal(state.boosted_waiting, 2); assert.equal(state.next_boosted, true); assert.equal(state.opened, 50); assert.equal(state.boost_in, 25);
    for (let n = 0; n < 2; n++) {
      const result = await open(db); shape(result);
      assert.equal(result.luck.boosted, true);
      const flagged = result.cards.filter(card => card.guaranteed && !TOP.includes(card.edition) || card.guaranteed);
      assert.ok(flagged.length >= 1 && flagged.every(card => BOOST.includes(card.edition)));
    }
  } finally { await db.close(); }
});

test('a boosted pack on a drought pays both guarantees in different slots', async () => {
  const db = await fixture(); try {
    await as(db, A);
    for (let round = 0; round < 20; round++) {
      await give(db, A, 1, 'boosted');
      await db.exec(`insert into public.member_pack_luck(user_id,packs_since_top) values('${A}',12) on conflict(user_id) do update set packs_since_top=12`);
      const result = await open(db); shape(result);
      const flagged = result.cards.filter(card => card.guaranteed);
      assert.equal(flagged.length, 2);
      assert.ok(flagged.some(card => TOP.includes(card.edition)) && flagged.every(card => BOOST.includes(card.edition)));
    }
  } finally { await db.close(); }
});

test('luck is per member, private, and a failed opening changes nothing', async () => {
  const db = await fixture(); try {
    await as(db, A); await give(db, A, 2); await open(db);
    await as(db, B);
    const other = await luck(db);
    assert.equal(other.opened, 0); assert.equal(other.since_top, 0); assert.equal(other.pity_in, 12);
    await assert.rejects(open(db), /No tienes ese sobre/);
    assert.equal((await luck(db)).opened, 0, 'no pack, no progress');
    await db.exec(`set role authenticated`);
    await as(db, B);
    assert.equal((await db.query('select count(*)::int n from public.member_pack_luck')).rows[0].n, 0, 'RLS hides other members');
    await assert.rejects(db.exec(`update public.member_pack_luck set packs_since_top=12`), /permission denied/);
    await db.exec(`reset role; set role anon`);
    await assert.rejects(db.query('select public.get_pack_luck()'), /permission denied/);
    await db.exec('reset role');
    await as(db, '');
    await assert.rejects(luck(db), /Sesión requerida/);
  } finally { await db.close(); }
});
