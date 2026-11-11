import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const sql = fs.readFileSync(new URL('../supabase/migrations/20261111140000_client_error_reports.sql', import.meta.url), 'utf8');
const A = '00000000-0000-0000-0000-000000000001';
const report = (signature, extra = {}) => JSON.stringify({signature, kind: 'script', message: 'x is undefined', ...extra});

test('client errors: grouped by signature, capped per day, expire, never readable by members', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
      create table public.profiles(id uuid primary key); insert into public.profiles values('${A}');`);
    await db.exec(sql);
    await assert.rejects(db.query(`select public.record_client_error('{}'::jsonb)`), /Sesión requerida/);
    await db.exec(`select set_config('test.actor','${A}',false)`);
    for (let i = 0; i < 5; i++) await db.query(`select public.record_client_error($1::jsonb)`, [report('same', {area: `a${i}`})]);
    let rows = (await db.query(`select occurrences, payload->>'area' area from public.client_error_reports`)).rows;
    assert.deepEqual(rows, [{occurrences: 5, area: 'a4'}], 'repeats grouped with latest details');
    for (let i = 0; i < 40; i++) await db.query(`select public.record_client_error($1::jsonb)`, [report(`e${i}`)]);
    assert.equal((await db.query(`select count(*)::int n from public.client_error_reports`)).rows[0].n, 30, 'thirty new a day');
    await db.query(`select public.record_client_error($1::jsonb)`, [JSON.stringify({signature: 'big', blob: 'x'.repeat(5000)})]);
    assert.equal((await db.query(`select count(*)::int n from public.client_error_reports where signature='big'`)).rows[0].n, 0, 'oversized ignored');
    await db.exec(`update public.client_error_reports set first_seen = now() - interval '40 days', last_seen = now() - interval '40 days' where signature <> 'same'`);
    await db.query(`select public.record_client_error($1::jsonb)`, [report('fresh')]);
    rows = (await db.query(`select signature from public.client_error_reports order by signature`)).rows.map(row => row.signature);
    assert.deepEqual(rows, ['fresh', 'same'], 'old reports expire');
    await db.exec(`set role authenticated`);
    await assert.rejects(db.query(`select * from public.client_error_reports`), /permission denied/);
    await db.exec(`reset role; set role anon`);
    await assert.rejects(db.query(`select public.record_client_error('{}'::jsonb)`), /permission denied/);
  } finally { await db.close(); }
});
