import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const sql = fs.readFileSync(new URL('../supabase/migrations/20261111170000_trade_lots.sql', import.meta.url), 'utf8');
const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b';
const offer = n => `00000000-0000-0000-0000-0000000001${String(n).padStart(2, '0')}`;

async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
    create table public.profiles(id uuid primary key, display_name text, is_hidden boolean not null default false);
    insert into public.profiles(id, display_name) values ('${A}','Ana'),('${B}','Beto');
    create table public.achievement_card_catalog(id text primary key, active boolean not null default true);
    insert into public.achievement_card_catalog(id) values ('a1'),('a2'),('a3'),('a4'),('b1'),('b2'),('b3');
    create table public.member_card_inventory(user_id uuid, card_id text, quantity int not null, primary key(user_id, card_id));
    insert into public.member_card_inventory values ('${A}','a1',2),('${A}','a2',3),('${A}','a3',2),('${A}','a4',1),('${B}','b1',2),('${B}','b2',2),('${B}','b3',2),('${B}','a1',1);
    create table public.member_coin_wallets(user_id uuid primary key);
    create function public.lock_banner_shop_actor() returns uuid language sql as $$select auth.uid()$$;
    create table public.card_trade_offers(id uuid primary key, sender_id uuid, recipient_id uuid, offered_card_id text, requested_card_id text,
      status text not null, created_at timestamptz default now(), expires_at timestamptz default now() + interval '7 days',
      resolved_at timestamptz, recipient_joined_at timestamptz, proposed_at timestamptz);
    create function public.invite_card_trade(offer_id uuid, target_user_id uuid, give_card_id text) returns uuid language sql as $$select offer_id$$;
    create function public.advance_card_trade(offer_id uuid, decision text, own_card_id text default null) returns text language sql as $$select 'x'$$;
    insert into public.card_trade_offers(id, sender_id, recipient_id, offered_card_id, status) values ('${offer(99)}','${A}','${B}','a1','accepted');`);
  await db.exec(sql);
  return db;
}
const as = (db, who) => db.exec(`select set_config('test.actor','${who}',false)`);
const qty = async (db, who, card) => (await db.query(`select quantity from public.member_card_inventory where user_id=$1 and card_id=$2`, [who, card])).rows[0]?.quantity ?? 0;

test('lot trade: 3 for 2 changes one copy of each card in one step', async () => {
  const db = await setup();
  try {
    assert.deepEqual((await db.query(`select offered_card_ids from public.card_trade_offers where id='${offer(99)}'`)).rows[0].offered_card_ids, ['a1'], 'old trades become lots of one');
    await as(db, A);
    await db.query(`select public.invite_card_trade($1,$2,null,$3)`, [offer(1), B, ['a1','a2','a3']]);
    await as(db, B);
    assert.equal((await db.query(`select public.advance_card_trade($1,'join') r`, [offer(1)])).rows[0].r, 'selecting');
    assert.equal((await db.query(`select public.advance_card_trade($1,'propose',null,$2) r`, [offer(1), ['b1','b2']])).rows[0].r, 'review');
    const [row] = (await db.query(`select public.get_card_trade_updates() u`)).rows[0].u;
    assert.deepEqual([row.offered_card_ids, row.requested_card_ids, row.offered_card_id, row.requested_card_id], [['a1','a2','a3'], ['b1','b2'], 'a1', 'b1']);
    await as(db, A);
    assert.equal((await db.query(`select public.advance_card_trade($1,'confirm') r`, [offer(1)])).rows[0].r, 'accepted');
    assert.deepEqual(await Promise.all([qty(db,A,'a1'),qty(db,A,'a2'),qty(db,A,'a3'),qty(db,A,'b1'),qty(db,A,'b2')]), [1,2,1,1,1]);
    assert.deepEqual(await Promise.all([qty(db,B,'a1'),qty(db,B,'a2'),qty(db,B,'a3'),qty(db,B,'b1'),qty(db,B,'b2'),qty(db,B,'b3')]), [2,1,1,1,1,2]);
  } finally { await db.close(); }
});

test('lot trade: rejects bad lots and becomes unavailable if a card stops being a duplicate', async () => {
  const db = await setup();
  try {
    await as(db, A);
    await assert.rejects(db.query(`select public.invite_card_trade($1,$2,null,$3)`, [offer(2), B, ['a1','a2','a3','a4']]), /entre una y tres/);
    await assert.rejects(db.query(`select public.invite_card_trade($1,$2,null,$3)`, [offer(2), B, ['a1','a1']]), /No repitas/);
    await assert.rejects(db.query(`select public.invite_card_trade($1,$2,null,$3)`, [offer(2), B, ['a4']]), /repetidas/);
    await db.query(`select public.invite_card_trade($1,$2,'a2')`, [offer(2), B]); // old single-card call
    await as(db, B);
    await db.query(`select public.advance_card_trade($1,'join')`, [offer(2)]);
    await assert.rejects(db.query(`select public.advance_card_trade($1,'propose',null,$2)`, [offer(2), ['b1','a2']]), /diferentes|repetidas/);
    await db.query(`select public.advance_card_trade($1,'propose','b3')`, [offer(2)]); // old single-card call
    await db.exec(`update public.member_card_inventory set quantity=1 where user_id='${B}' and card_id='b3'`);
    await as(db, A);
    assert.equal((await db.query(`select public.advance_card_trade($1,'confirm') r`, [offer(2)])).rows[0].r, 'unavailable');
    assert.equal(await qty(db, A, 'a2'), 3, 'nothing moved');
  } finally { await db.close(); }
});
