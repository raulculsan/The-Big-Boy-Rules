import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const read = name => fs.readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const A = '00000000-0000-0000-0000-000000000001', ADMIN = '00000000-0000-0000-0000-0000000000aa';
test('admin error list: admins see grouped reports with names, members are refused', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
      create table public.profiles(id uuid primary key, display_name text, username text);
      insert into public.profiles values('${A}','Daniel','danielgmotos'),('${ADMIN}','Raúl','raul');
      create function public.current_user_is_club_admin() returns boolean language sql stable as $$select auth.uid() = '${ADMIN}'::uuid$$;`);
    await db.exec(read('20261111140000_client_error_reports.sql'));
    await db.exec(read('20261111160000_admin_client_errors.sql'));
    await db.exec(`select set_config('test.actor','${A}',false)`);
    for (let i = 0; i < 3; i++) await db.query(`select public.record_client_error($1::jsonb)`, [JSON.stringify({signature: 'x', kind: 'script', name: 'TypeError', message: 'boom', frames: ['app.js:1:2'], platform: 'android', area: 'sobres'})]);
    await assert.rejects(db.query(`select public.admin_client_errors()`), /Solo la administración/);
    await db.exec(`select set_config('test.actor','${ADMIN}',false)`);
    const [{list}] = (await db.query(`select public.admin_client_errors() as list`)).rows;
    assert.equal(list.length, 1);
    assert.deepEqual({member: list[0].member, occurrences: list[0].occurrences, name: list[0].name, area: list[0].area, frames: list[0].frames}, {member: 'Daniel', occurrences: 3, name: 'TypeError', area: 'sobres', frames: ['app.js:1:2']});
    await db.exec(`reset role; set role anon`);
    await assert.rejects(db.query(`select public.admin_client_errors()`), /permission denied/);
  } finally { await db.close(); }
});
