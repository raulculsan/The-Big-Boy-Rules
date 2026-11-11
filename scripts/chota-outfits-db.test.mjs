import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const sql = fs.readFileSync(new URL('../supabase/migrations/20261111180000_chota_outfits.sql', import.meta.url), 'utf8');
const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b';
async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
    create table public.profiles(id uuid primary key); insert into public.profiles values ('${A}'),('${B}');
    create function public.lock_banner_shop_actor() returns uuid language sql as $$select auth.uid()$$;
    create function public.assert_account_security() returns void language sql as $$select$$;
    create table public.member_coin_wallets(user_id uuid primary key, balance int not null default 0);
    insert into public.member_coin_wallets values ('${A}',100),('${B}',0);
    create table public.chota_item_catalog(id text primary key, item_kind text, slot text, rig_version text);
    insert into public.chota_item_catalog values ('coat','clothing','outerwear','v'),('tee','clothing','topwear','v'),('jeans','clothing','bottomwear','v'),
      ('jordan','clothing','footwear','v'),('orig-top','clothing','topwear','v');
    create function public.chota_clothing_supported(s text, r text) returns boolean language sql as $$select true$$;
    create function public.chota_original_item(s text) returns text language sql as $$select case when s='topwear' then 'orig-top' end$$;
    create table public.member_owned_chota_items(user_id uuid, item_id text, paid_price int, balance_after int, primary key(user_id,item_id));
    insert into public.member_owned_chota_items values ('${A}','coat',50,50),('${A}','tee',10,40),('${A}','jordan',100,0);
    create table public.member_chota_clothing(user_id uuid, slot text, item_id text, updated_at timestamptz default now(), primary key(user_id,slot));
    create table public.member_chota_wardrobe_preferences(user_id uuid primary key, removed_original_slots text[] not null default '{}', updated_at timestamptz default now());
    create function public.get_chota_shop_state() returns jsonb language sql as $$
      select jsonb_build_object('clothing',(select coalesce(jsonb_object_agg(slot,item_id),'{}') from public.member_chota_clothing where user_id=auth.uid()),
        'removed',(select removed_original_slots from public.member_chota_wardrobe_preferences where user_id=auth.uid()))$$;`);
  await db.exec(sql);
  return db;
}
const as = (db, who) => db.exec(`select set_config('test.actor','${who}',false)`);
const one = async (db, q, args = []) => Object.values((await db.query(q, args)).rows[0])[0];

test('outfits: save the current look, change clothes, then wear it back exactly', async () => {
  const db = await setup();
  try {
    await as(db, A);
    await db.exec(`insert into public.member_chota_clothing(user_id,slot,item_id) values ('${A}','outerwear','coat'),('${A}','footwear','jordan');
      insert into public.member_chota_wardrobe_preferences values ('${A}','{bottomwear}')`);
    const saved = await one(db, `select public.save_chota_outfit(2,'  Domingo  ')`);
    assert.deepEqual(saved, [{position: 2, name: 'Domingo', items: {outerwear: 'coat', footwear: 'jordan'}, removed_original_slots: ['bottomwear']}]);
    await db.exec(`delete from public.member_chota_clothing where user_id='${A}'; insert into public.member_chota_clothing values ('${A}','topwear','tee');
      update public.member_chota_wardrobe_preferences set removed_original_slots='{}' where user_id='${A}'`);
    const state = await one(db, `select public.wear_chota_outfit(2)`);
    assert.deepEqual(state, {clothing: {outerwear: 'coat', footwear: 'jordan'}, removed: ['bottomwear']});
    await one(db, `select public.save_chota_outfit(2,'Fiesta')`);
    assert.equal((await one(db, `select public.get_chota_outfits()`))[0].name, 'Fiesta', 'saving over a slot replaces it');
    assert.deepEqual(await one(db, `select public.delete_chota_outfit(2)`), []);
  } finally { await db.close(); }
});

test('outfits: four slots, names required, and a garment you no longer own blocks wearing', async () => {
  const db = await setup();
  try {
    await as(db, A);
    await assert.rejects(db.query(`select public.save_chota_outfit(5,'x')`), /cuatro huecos/);
    await assert.rejects(db.query(`select public.save_chota_outfit(1,'   ')`), /nombre/);
    await assert.rejects(db.query(`select public.save_chota_outfit(1,$1)`, ['x'.repeat(25)]), /24 letras/);
    await db.exec(`insert into public.member_chota_clothing values ('${A}','outerwear','coat')`);
    await one(db, `select public.save_chota_outfit(1,'Abrigo')`);
    await db.exec(`delete from public.member_chota_clothing where user_id='${A}'; delete from public.member_owned_chota_items where user_id='${A}' and item_id='coat'`);
    await assert.rejects(db.query(`select public.wear_chota_outfit(1)`), /ya no tienes/);
    await assert.rejects(db.query(`select public.wear_chota_outfit(3)`), /ya no existe/);
    await as(db, B);
    assert.deepEqual(await one(db, `select public.get_chota_outfits()`), [], 'outfits are private');
    await db.exec(`set role authenticated`);
    await assert.rejects(db.query(`select * from public.member_chota_outfits`), /permission denied/);
  } finally { await db.close(); }
});
