import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const sql = fs.readFileSync(new URL('../supabase/migrations/20261111100000_pack_opening_diagnostics.sql', import.meta.url), 'utf8');
const A = '00000000-0000-0000-0000-000000000001';
test('opening diagnostics: own rows only, capped per day and per member, never readable by members', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
      create table public.profiles(id uuid primary key); insert into public.profiles values('${A}');`);
    await db.exec(sql);
    await assert.rejects(db.query(`select public.record_pack_opening_diagnostic('{}'::jsonb)`), /Sesión requerida/);
    await db.exec(`select set_config('test.actor','${A}',false)`);
    for (let i = 0; i < 15; i++) await db.query(`select public.record_pack_opening_diagnostic($1::jsonb)`, [JSON.stringify({cards: 6, phases: {tear: {frames: 40, median: 16.7}}})]);
    assert.equal((await db.query(`select count(*)::int n from public.pack_opening_diagnostics`)).rows[0].n, 12, 'twelve a day');
    await db.query(`select public.record_pack_opening_diagnostic($1::jsonb)`, [JSON.stringify({big: 'x'.repeat(5000)})]);
    await db.exec(`update public.pack_opening_diagnostics set created_at = now() - interval '2 days'`);
    await db.query(`select public.record_pack_opening_diagnostic('{"cards":6}'::jsonb)`);
    assert.equal((await db.query(`select count(*)::int n from public.pack_opening_diagnostics`)).rows[0].n, 13, 'oversized payload ignored');
    await db.exec(`set role authenticated`);
    await assert.rejects(db.query(`select * from public.pack_opening_diagnostics`), /permission denied/);
  } finally { await db.close(); }
});
