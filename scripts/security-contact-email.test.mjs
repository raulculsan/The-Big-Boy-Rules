import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const migration = readFileSync(new URL('../supabase/migrations/20261102220000_permanent_contact_email.sql', import.meta.url), 'utf8');
const temp = '00000000-0000-0000-0000-000000000001', real = '00000000-0000-0000-0000-000000000002';

async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema club_security;
    create table club_security.configuration(singleton boolean primary key default true);
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb default '{}',banned_until timestamptz);
    create table auth.identities(user_id uuid,provider text,identity_data jsonb);
    create table public.profiles(id uuid primary key);
    create table public.account_identity_tokens(token_hash text primary key,email text,used_at timestamptz);
    insert into auth.users(id,email,email_confirmed_at) values('${temp}','carlos@yopmail.com',now()),('${real}','ana@gmail.com',now());
    insert into public.profiles values('${temp}'),('${real}');
    insert into public.account_identity_tokens values('a','carlos@yopmail.com',null),('b','ana@gmail.com',null);`);
  await db.exec(migration);
  return db;
}
const one = async (db, sql, args) => Object.values((await db.query(sql, args)).rows[0])[0];

test('only permanent personal providers are accepted as contact', async () => {
  const db = await setup();
  for (const email of ['a@gmail.com', 'A.B+x@Hotmail.es', 'x@icloud.com', 'x@outlook.com', 'x@proton.me', 'x@yahoo.com.mx'])
    assert.equal(await one(db, `select public.contact_email_allowed($1)`, [email]), true, email);
  for (const email of ['a@yopmail.com', 'a@mailinator.com', 'a@temp-mail.org', 'a@gmail.com.evil.io', 'a@hotmail.xyz', 'a@bigboyrules.local', null])
    assert.equal(await one(db, `select public.contact_email_allowed($1)`, [email]), false, String(email));
});

test('a temporary inbox neither unlocks the account nor recovers it', async () => {
  const db = await setup();
  assert.equal(await one(db, `select public.account_has_verified_contact($1)`, [temp]), false);
  assert.equal(await one(db, `select public.account_has_verified_contact($1)`, [real]), true);
  assert.equal(await one(db, `select public.account_recovery_user('carlos@yopmail.com')`), null);
  assert.equal(await one(db, `select public.account_recovery_user('ana@gmail.com')`), real);
  const open = (await db.query(`select token_hash from public.account_identity_tokens where used_at is null`)).rows.map(r => r.token_hash);
  assert.deepEqual(open, ['b']);
});
