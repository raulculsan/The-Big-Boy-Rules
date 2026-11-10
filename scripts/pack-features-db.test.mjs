import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const luckSql = fs.readFileSync(new URL('../supabase/migrations/20261110120000_pack_luck.sql', import.meta.url), 'utf8');
const featuresSql = fs.readFileSync(new URL('../supabase/migrations/20261110150000_pack_features.sql', import.meta.url), 'utf8');
const A = '00000000-0000-0000-0000-000000000001', B = '00000000-0000-0000-0000-000000000002';
async function fixture() {
  const db = new PGlite();
  await db.exec(`
create role anon; create role authenticated; create role service_role; create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
create table public.profiles(id uuid primary key, is_hidden boolean default false);
create table public.member_coin_wallets(user_id uuid primary key, balance bigint not null default 0 check (balance >= 0));
create table public.member_coin_ledger(id bigint generated always as identity primary key, user_id uuid not null, delta bigint not null, balance_after bigint not null check (balance_after >= 0), reason text not null, item_id text not null, copies integer not null check (copies > 0), created_at timestamptz default now(),
  constraint member_coin_ledger_reason_check check (reason in ('duplicate_discard','banner_purchase')));
create table public.card_packs(id bigint generated always as identity primary key, user_id uuid not null references public.profiles(id) on delete cascade,
  earned_day date not null, collection_key text not null default 'los-nuestros-01', created_at timestamptz default now(), opened_at timestamptz, source text not null default 'daily');
create table public.achievement_card_catalog(id text primary key, kind text not null, edition text not null, active boolean not null default true);
create table public.member_pack_card_awards(pack_id bigint references public.card_packs(id) on delete cascade, draw_index integer check (draw_index between 1 and 6), user_id uuid, card_id text, created_at timestamptz default now(), primary key(pack_id, draw_index));
create table public.member_card_inventory(user_id uuid, card_id text references public.achievement_card_catalog(id), quantity integer not null check (quantity >= 1), primary key(user_id, card_id));
create table public.club_economy_configuration(singleton boolean primary key default true, rarity_weights jsonb not null);
insert into public.club_economy_configuration values(true,'{"common":5400,"special":1500,"retro":1200,"epic":900,"legendary":500,"full_art":200,"vice_city":200,"halloween":100}');
create function public.card_pack_rarity_weights() returns table(edition text, weight integer) language sql stable security definer set search_path='' as $$
  select e.key, e.value::integer from public.club_economy_configuration c, lateral jsonb_each_text(c.rarity_weights) e where c.singleton$$;
create function public.lock_banner_shop_actor() returns uuid language plpgsql security definer set search_path='' as $$declare actor uuid := auth.uid();
  begin if actor is null then raise exception 'Sesión requerida' using errcode='42501'; end if; insert into public.member_coin_wallets(user_id) values(actor) on conflict do nothing; return actor; end$$;
create function public.assert_account_security() returns void language plpgsql as $$begin if auth.uid() is null then raise exception 'Seguridad requerida' using errcode='42501'; end if; end$$;
insert into public.profiles(id) values('${A}'),('${B}'); insert into public.member_coin_wallets values('${A}',300),('${B}',50);
insert into public.achievement_card_catalog(id,kind,edition)
  select k||'-'||e||'-'||n, k, e from (values('member'),('object'),('location')) kinds(k), (values('common'),('special'),('epic'),('legendary')) editions(e), generate_series(1,6) n;
insert into public.achievement_card_catalog(id,kind,edition) select 'member-'||e||'-'||n,'member',e from (values('full_art'),('vice_city'),('halloween'),('retro')) x(e), generate_series(1,4) n;
insert into public.achievement_card_catalog(id,kind,edition) select 'location-retro-'||n,'location','retro' from generate_series(1,3) n;
create function public.open_owned_card_pack(target_pack_id bigint default null) returns jsonb language sql as $$select '{}'::jsonb$$;
grant execute on function public.open_owned_card_pack(bigint) to authenticated;
`);
  await db.exec(luckSql); await db.exec(featuresSql);
  return db;
}
const as = (db, user) => db.exec(`select set_config('test.actor','${user}',false)`);
const give = (db, user, count = 1, extra = '') => db.exec(`insert into public.card_packs(user_id,earned_day${extra ? ',' + extra.split('=')[0] : ''}) select '${user}', current_date${extra ? ",'" + extra.split('=')[1] + "'" : ''} from generate_series(1,${count})`);
const call = async (db, sql, args = []) => (await db.query(`select ${sql} value`, args)).rows[0].value;
const open = db => call(db, 'public.open_owned_card_pack()');
const luck = db => call(db, 'public.get_pack_luck()');

test('daily streak packs become choice packs: five cards now, the sixth is chosen from three', async () => {
  const db = await fixture(); try {
    await as(db, A); await give(db, A, 1, 'source=daily_streak');
    assert.equal((await db.query(`select variant from public.card_packs`)).rows[0].variant, 'choice');
    const result = await open(db);
    assert.equal(result.variant, 'choice'); assert.equal(result.cards.length, 5);
    assert.equal(result.choice.options.length, 3);
    const ids = new Set([...result.cards.map(c => c.card_id), ...result.choice.options.map(c => c.card_id)]);
    assert.equal(ids.size, 8, 'options never repeat a card of the pack');
    const kinds = ['member', 'member', 'member', 'object', 'object', 'location'];
    assert.ok(result.choice.options.every(o => o.kind === kinds[result.choice.draw_index - 1]));
    const pending = await luck(db); assert.equal(pending.pending_choice.pack_id, result.pack_id);
    await give(db, A, 1);
    await assert.rejects(open(db), /Elige antes/);
    await assert.rejects(call(db, 'public.choose_pack_card($1,$2)', [result.pack_id, 'member-common-1-not-an-option']), /no estaba entre las opciones/);
    const pick = result.choice.options[1].card_id;
    const chosen = await call(db, 'public.choose_pack_card($1,$2)', [result.pack_id, pick]);
    assert.equal(chosen.card.card_id, pick); assert.equal(chosen.card.draw_index, result.choice.draw_index);
    assert.equal((await db.query(`select count(*)::int n from public.member_pack_card_awards where pack_id=$1`, [result.pack_id])).rows[0].n, 6);
    await assert.rejects(call(db, 'public.choose_pack_card($1,$2)', [result.pack_id, pick]), /Ya elegiste/);
    assert.equal((await luck(db)).pending_choice, null);
    assert.equal((await open(db)).cards.length, 6, 'the next pack opens normally');
  } finally { await db.close(); }
});

test('themed packs cost 120 coins and always hold a card of their theme', async () => {
  const db = await fixture(); try {
    await as(db, A);
    await assert.rejects(call(db, 'public.buy_themed_pack($1,$2)', ['halloween', 100]), /precio ha cambiado/);
    await assert.rejects(call(db, 'public.buy_themed_pack($1,$2)', ['dragones', 120]), /no existe/);
    const bought = await call(db, 'public.buy_themed_pack($1,$2)', ['halloween', 120]);
    assert.equal(bought.balance, 180); assert.equal(bought.next_variant, 'themed'); assert.equal(bought.next_theme, 'halloween');
    const ledger = (await db.query(`select delta, reason, item_id from public.member_coin_ledger`)).rows;
    assert.deepEqual(ledger, [{delta: -120, reason: 'themed_pack', item_id: 'themed:halloween'}]);
    const result = await open(db);
    const themed = result.cards.filter(c => c.themed);
    assert.equal(themed.length, 1); assert.equal(themed[0].edition, 'halloween');
    for (const [theme, check] of [['objects', c => c.kind === 'object' && ['epic', 'legendary'].includes(c.edition)], ['locations', c => c.kind === 'location' && ['epic', 'legendary'].includes(c.edition)], ['retro', c => c.edition === 'retro']]) {
      await db.exec(`update public.member_coin_wallets set balance=balance+120 where user_id='${A}'`);
      await call(db, 'public.buy_themed_pack($1,$2)', [theme, 120]);
      const pack = await open(db); const slot = pack.cards.filter(c => c.themed);
      assert.equal(slot.length, 1, theme); assert.ok(check(slot[0]), `${theme}: ${slot[0].kind}/${slot[0].edition}`);
    }
    await as(db, B);
    await assert.rejects(call(db, 'public.buy_themed_pack($1,$2)', ['retro', 120]), /monedas suficientes/);
    assert.equal((await db.query(`select balance from public.member_coin_wallets where user_id='${B}'`)).rows[0].balance, 50);
  } finally { await db.close(); }
});

test('a target card fills with one fragment per pack and is granted at its rarity cost', async () => {
  const db = await fixture(); try {
    await as(db, A);
    await assert.rejects(call(db, 'public.set_card_target($1)', ['no-existe']), /no está disponible/);
    await db.exec(`insert into public.member_card_inventory values('${A}','object-common-1',1)`);
    await assert.rejects(call(db, 'public.set_card_target($1)', ['object-common-1']), /Ya tienes/);
    await db.exec(`update public.club_economy_configuration set rarity_weights='{"common":1}'`);
    await db.exec(`delete from public.achievement_card_catalog where edition<>'common' or id='member-common-6'`);
    await db.exec(`insert into public.achievement_card_catalog values('member-special-target','member','special',true)`);
    const set = await call(db, 'public.set_card_target($1)', ['member-special-target']);
    assert.deepEqual(set.target, {card_id: 'member-special-target', edition: 'special', cost: 15});
    await give(db, A, 15);
    for (let n = 1; n <= 14; n++) { const r = await open(db); assert.equal(r.target_completed, null); }
    assert.equal((await luck(db)).fragments, 14);
    const last = await open(db);
    assert.equal(last.target_completed.card_id, 'member-special-target'); assert.equal(last.target_completed.cost, 15);
    const state = await luck(db); assert.equal(state.fragments, 0); assert.equal(state.target, null);
    assert.equal((await db.query(`select quantity from public.member_card_inventory where user_id='${A}' and card_id='member-special-target'`)).rows[0].quantity, 1);
  } finally { await db.close(); }
});

test('getting the target another way clears it and keeps the fragments', async () => {
  const db = await fixture(); try {
    await as(db, A); await give(db, A, 3);
    await call(db, 'public.set_card_target($1)', ['member-legendary-1']);
    await open(db); await open(db);
    await db.exec(`insert into public.member_card_inventory values('${A}','member-legendary-1',1) on conflict do nothing`);
    const state = await luck(db);
    assert.equal(state.target, null); assert.equal(state.fragments, 2);
  } finally { await db.close(); }
});

test('finishes are recorded per copy and plain copies leave first', async () => {
  const db = await fixture(); try {
    await as(db, A); await give(db, A, 400);
    const rolled = {holo: 0, metal: 0, ink: 0, none: 0};
    for (let n = 0; n < 400; n++) for (const c of (await open(db)).cards) rolled[c.finish || 'none']++;
    const total = Object.values(rolled).reduce((a, b) => a + b, 0);
    assert.equal(total, 2400);
    assert.ok(rolled.holo > 30 && rolled.holo < 120, `holo ${rolled.holo}`);
    assert.ok(rolled.metal < 50 && rolled.ink < 20);
    const stored = (await db.query(`select coalesce(sum(quantity),0)::int n from public.member_card_finishes where user_id='${A}'`)).rows[0].n;
    assert.equal(stored, rolled.holo + rolled.metal + rolled.ink);
    await db.exec(`delete from public.member_card_finishes; update public.member_card_inventory set quantity=3 where user_id='${A}' and card_id='member-common-1'`);
    await db.exec(`insert into public.member_card_finishes values('${A}','member-common-1','holo',1),('${A}','member-common-1','ink',1)`);
    await db.exec(`update public.member_card_inventory set quantity=2 where user_id='${A}' and card_id='member-common-1'`);
    assert.equal((await db.query(`select count(*)::int n from public.member_card_finishes`)).rows[0].n, 2, 'a plain copy left first');
    await db.exec(`update public.member_card_inventory set quantity=1 where user_id='${A}' and card_id='member-common-1'`);
    assert.deepEqual((await db.query(`select finish from public.member_card_finishes`)).rows, [{finish: 'ink'}], 'the rarest finish stays');
    await db.exec(`delete from public.member_card_inventory where user_id='${A}' and card_id='member-common-1'`);
    assert.equal((await db.query(`select count(*)::int n from public.member_card_finishes`)).rows[0].n, 0);
    assert.deepEqual(await call(db, 'public.get_card_finishes()'), Object.fromEntries((await db.query(`select card_id, jsonb_object_agg(finish,quantity) f from public.member_card_finishes where user_id='${A}' group by 1`)).rows.map(r => [r.card_id, r.f])));
  } finally { await db.close(); }
});

test('an opened pack can be shared once by its owner and seen by any member', async () => {
  const db = await fixture(); try {
    await as(db, A); await give(db, A, 2);
    const opened = await open(db);
    const unopened = (await db.query(`select id from public.card_packs where opened_at is null`)).rows[0].id;
    await assert.rejects(call(db, 'public.share_pack_opening($1)', [unopened]), /ya abierto/);
    const shared = await call(db, 'public.share_pack_opening($1)', [opened.pack_id]);
    assert.equal(shared.token, `[[sobre:${opened.pack_id}]]`);
    await call(db, 'public.share_pack_opening($1)', [opened.pack_id]);
    assert.equal((await db.query(`select count(*)::int n from public.shared_pack_openings`)).rows[0].n, 1);
    await as(db, B);
    await assert.rejects(call(db, 'public.share_pack_opening($1)', [opened.pack_id]), /sobre tuyo/);
    const seen = await call(db, 'public.get_shared_pack($1)', [opened.pack_id]);
    assert.equal(seen.user_id, A); assert.equal(seen.cards.length, 6);
    assert.deepEqual(seen.cards.map(c => c.card_id), opened.cards.map(c => c.card_id));
    assert.ok(seen.cards.every(c => c.is_new === true), 'first copies are marked new');
    assert.equal(await call(db, 'public.get_shared_pack($1)', [999999]), null);
    await as(db, '');
    await assert.rejects(call(db, 'public.get_shared_pack($1)', [opened.pack_id]), /Sesión requerida/);
  } finally { await db.close(); }
});

test('the earlier pack luck rules still hold with the new opening', async () => {
  const db = await fixture(); try {
    await as(db, A); await give(db, A, 30);
    await db.exec(`insert into public.member_pack_luck(user_id,packs_since_top) values('${A}',12)`);
    const r = await open(db);
    assert.ok(r.cards.some(c => c.guaranteed && ['legendary', 'full_art', 'vice_city', 'halloween'].includes(c.edition)));
    for (let n = 2; n <= 25; n++) { const x = await open(db); assert.equal(x.luck.granted_boosted, n === 25); }
  } finally { await db.close(); }
});
