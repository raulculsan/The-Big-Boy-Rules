import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const migration = readFileSync(new URL('../supabase/migrations/20261102210000_member_abuse_guards.sql', import.meta.url), 'utf8');
const alice='00000000-0000-0000-0000-000000000001', bob='00000000-0000-0000-0000-000000000002';
const storage = 'https://nfvggpgeypkkqceivkaq.supabase.co/storage/v1/object/public';

async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('test.role',true),''),'authenticated')$$;
    create function public.current_user_can_manage() returns boolean language sql stable as $$select false$$;
    create function storage.foldername(name text) returns text[] language sql immutable as $$select string_to_array(name,'/')$$;
    create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;
    create policy "public avatar viewing" on storage.objects for select to public using (bucket_id='avatars');
    create table public.profiles(id uuid primary key,avatar_url text);insert into public.profiles values('${alice}',null),('${bob}',null);
    create table public.messages(id bigint generated always as identity primary key,user_id uuid,legacy_id smallint,channel_id bigint,body text,
      reply_to_id bigint,attachment_url text,attachment_name text,attachment_type text,attachment_size bigint,created_at timestamptz default now());
    create table public.private_messages(id bigint generated always as identity primary key,sender_id uuid,recipient_id uuid,body text,
      reply_to_id bigint,attachment_url text,attachment_name text,attachment_type text,attachment_size bigint,created_at timestamptz default now());
    create table public.achievement_rules(achievement_id bigint,metric text,target_count integer);
    create table public.achievement_progress(achievement_id bigint,user_id uuid,current_value integer,completed_at timestamptz,updated_at timestamptz,primary key(achievement_id,user_id));
    create table public.achievement_progress_events(achievement_id bigint,user_id uuid,event_key text,primary key(achievement_id,user_id,event_key));
    insert into public.achievement_rules values(1,'group_messages',100);
    create table public.push_dispatch_claims(actor_id uuid,kind text,entity_id text,created_at timestamptz default now());
    create function public.record_achievement_activity(actor_id uuid,metric_name text,activity_key text) returns void language plpgsql as $$
    begin insert into public.achievement_progress_events values(1,actor_id,activity_key) on conflict do nothing; if not found then return; end if;
      insert into public.achievement_progress as p values(1,actor_id,1,null,now()) on conflict(achievement_id,user_id) do update set current_value=p.current_value+1; end $$;`);
  await db.exec(migration);
  // Production already attaches the counting trigger; the migration only redefines its function.
  await db.exec(`create trigger track_group_achievement_activity after insert on public.messages for each row execute function public.track_group_achievement_activity()`);
  return db;
}
const as = (db, uid) => db.exec(`select set_config('test.uid','${uid}',false);select set_config('test.role','authenticated',false)`);
const send = (db, user, extra = '') => db.query(`insert into public.messages(user_id,legacy_id,channel_id,body${extra ? ',attachment_url,attachment_type' : ''}) values($1,1,1,'hola'${extra}) returning id,created_at`, [user]);

test('only club storage images and shared news links are accepted', async () => {
  const db = await setup();
  await as(db, alice);
  await assert.rejects(db.query(`update public.profiles set avatar_url='https://evil.example/pixel.png' where id=$1`, [alice]));
  await db.query(`update public.profiles set avatar_url=$2 where id=$1`, [alice, `${storage}/avatars/${alice}/a.webp?v=1`]);
  await assert.rejects(send(db, alice, `,'https://evil.example/pixel.png','image/png'`));
  await assert.rejects(send(db, alice, `,'https://evil.example/Fotos.pdf','application/pdf'`));
  await send(db, alice, `,'${storage}/group-media/${alice}/chat/a.jpg','image/jpeg'`);
  await send(db, alice, `,'https://news.example/story','text/news-link'`);
  await assert.rejects(db.query(`insert into public.private_messages(sender_id,recipient_id,body,attachment_url,attachment_type) values($1,$2,'x','https://evil.example/x.png','image/png')`, [alice, bob]));
  await db.query(`insert into public.private_messages(sender_id,recipient_id,body,attachment_url,attachment_type) values($1,$2,'x','storage://private-chat/${alice}/a.jpg','image/jpeg')`, [alice, bob]);
});

test('members cannot backdate, move or redirect messages, and edits are marked', async () => {
  const db = await setup();
  await as(db, alice);
  const {rows: [sent]} = await db.query(`insert into public.messages(user_id,legacy_id,channel_id,body,created_at) values($1,1,1,'hola','2020-01-01') returning id,created_at`, [alice]);
  assert.ok(new Date(sent.created_at).getFullYear() > 2020);
  await assert.rejects(db.query(`update public.messages set created_at='2020-01-01' where id=$1`, [sent.id]));
  await assert.rejects(db.query(`update public.messages set channel_id=2 where id=$1`, [sent.id]));
  await db.query(`update public.messages set body='hola editado' where id=$1`, [sent.id]);
  assert.ok((await db.query(`select edited_at from public.messages where id=$1`, [sent.id])).rows[0].edited_at);
  const {rows: [dm]} = await db.query(`insert into public.private_messages(sender_id,recipient_id,body) values($1,$2,'hola') returning id`, [alice, bob]);
  await assert.rejects(db.query(`update public.private_messages set recipient_id=$2 where id=$1`, [dm.id, alice]));
});

test('message bursts are stopped at twenty a minute per member', async () => {
  const db = await setup();
  await as(db, alice);
  for (let index = 0; index < 20; index += 1) await send(db, alice);
  await assert.rejects(send(db, alice), /demasiado rápido/);
  await assert.rejects(db.query(`insert into public.private_messages(sender_id,recipient_id,body) values($1,$2,'x')`, [alice, bob]), /demasiado rápido/);
  await as(db, bob);
  await send(db, bob);
});

test('deleted messages give back unfinished achievement progress and daily counting is capped', async () => {
  const db = await setup();
  await as(db, alice);
  const ids = [];
  for (let index = 0; index < 5; index += 1) ids.push((await send(db, alice)).rows[0].id);
  assert.equal((await db.query(`select current_value from public.achievement_progress`)).rows[0].current_value, 5);
  await db.query(`delete from public.messages where id = any($1::bigint[])`, [ids.slice(0, 3)]);
  assert.equal((await db.query(`select current_value from public.achievement_progress`)).rows[0].current_value, 2);
  assert.equal((await db.query(`select count(*)::int n from public.achievement_progress_events`)).rows[0].n, 2);
  await db.exec(`select set_config('test.role','service_role',false)`);
  await db.exec(`insert into public.messages(user_id,legacy_id,channel_id,body,created_at) select '${alice}',1,1,'old',now()-interval '2 hours' from generate_series(1,40)`);
  await as(db, alice);
  const before = (await db.query(`select current_value from public.achievement_progress`)).rows[0].current_value;
  await send(db, alice);
  assert.equal((await db.query(`select current_value from public.achievement_progress`)).rows[0].current_value, before);
});

test('avatars cannot be listed by anyone; members list only their own folder', async () => {
  const db = await setup();
  const policies = (await db.query(`select policyname, roles::text from pg_policies where tablename='objects'`)).rows;
  assert.deepEqual(policies.map(p => p.policyname), ['members list own avatar']);
  assert.equal(policies[0].roles, '{authenticated}');
});
