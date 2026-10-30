import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import vm from 'node:vm';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const name=readdirSync(new URL('../supabase/migrations/',import.meta.url)).find(f=>f.endsWith('_gemini_audit_hardening.sql'));
const db=new PGlite(),uid='00000000-0000-0000-0000-000000000001';
const q=async(sql,args=[])=>(await db.query(sql,args)).rows;
before(async()=>{
 await db.exec(`create schema auth;create schema storage;create role anon;create role authenticated;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
 create function public.assert_account_security() returns void language plpgsql as $$begin if coalesce(current_setting('test.security',true),'')<>'ok' then raise exception 'Security gate';end if;end$$;
 create function auth.role() returns text language sql stable as $$select nullif(current_setting('test.role',true),'')$$;
 create function public.current_user_is_superadmin() returns boolean language sql stable as $$select nullif(current_setting('test.admin',true),'')::boolean$$;
 create table profiles(id uuid primary key,legacy_id integer,username text,role text,is_hidden boolean,name text);
 create table storage.buckets(id text,allowed_mime_types text[]);
 insert into storage.buckets values('shop-media',array['image/svg+xml']);
 create table profile_banner_catalog(id text primary key,name text,description text,art_key text,presentation jsonb);
 create table member_equipped_banners(user_id uuid,banner_id text);
 insert into profile_banner_catalog values('test','Test','Preview','test',null);
 insert into member_equipped_banners values('${uid}','test');
 create trigger guard_profile before update on profiles for each row execute function suppress_redundant_updates_trigger();`);
 await db.exec(read('supabase/migrations/'+name));
 await db.exec('drop trigger guard_profile on profiles;create trigger guard_profile before update on profiles for each row execute function protect_profile_identity();');
});
beforeEach(async()=>{
 await db.exec('truncate profiles;');
 await q(`select set_config('test.actor','${uid}',false),set_config('test.security','ok',false),set_config('test.role','authenticated',false),set_config('test.admin','false',false),set_config('app.authorized_role_change','',false)`);
 await q("insert into profiles values($1,null,'raul','member',false,'Raúl')",[uid]);
});
after(()=>db.close());
test('nullable identity cannot be assigned or cleared by an ordinary account',async()=>{
 await assert.rejects(q('update profiles set legacy_id=12'),/identidad/);
 await q("select set_config('test.role','service_role',false)");await q('update profiles set legacy_id=12');await q("select set_config('test.role','authenticated',false)");
 await assert.rejects(q('update profiles set legacy_id=null'),/identidad/);
 await assert.rejects(q('update profiles set username=null'),/identidad/);
 await assert.rejects(q('update profiles set role=null'),/identidad/);
 await assert.rejects(q('update profiles set is_hidden=null'),/identidad/);
});
test('a missing admin lookup does not bypass immutable identity protection',async()=>{
 await q("select set_config('test.admin','',false)");await assert.rejects(q('update profiles set legacy_id=12'),/identidad/);
 await q("update profiles set name='Otro nombre'");assert.equal((await q('select name from profiles'))[0].name,'Otro nombre');
});
test('trusted service role and superadmin retain profile administration',async()=>{
 await q("select set_config('test.role','service_role',false)");await q("update profiles set legacy_id=12,username='nuevo',role='admin',is_hidden=true");
 await q("select set_config('test.role','authenticated',false),set_config('test.admin','true',false)");await q("update profiles set legacy_id=null,username='raul',role='member',is_hidden=false");
 assert.equal((await q('select legacy_id from profiles'))[0].legacy_id,null);
});
test('authorized role workflow cannot also alter the account identity',async()=>{
 await q("select set_config('app.authorized_role_change','true',false)");await q("update profiles set role='admin'");
 await assert.rejects(q("update profiles set role='member',legacy_id=99"),/identidad/);
});
test('catalogue paths match raster/video MIME whitelist, refusing SVG and traversal',async()=>{
 for(const file of ['banners/a.png','banners/a.jpg','banners/a.avif','banners/room/poster.webp'])assert.equal((await q('select valid_shop_media_path($1,\'banners\') ok',[file]))[0].ok,true);
 for(const file of ['banners/a.svg','banners/../a.png','banners//a.png','https://evil/a.png','banners/a.png?x=1'])assert.equal((await q('select valid_shop_media_path($1,\'banners\') ok',[file]))[0].ok,false);
 assert.equal((await q("select valid_shop_media_path('banners/a.mp4','banners',true) ok"))[0].ok,true);
 assert.equal((await q("select valid_shop_media_path('banners/a.mp4','banners') ok"))[0].ok,false);
});
test('sign-out between scheduling and executing idle startup does not throw or block future work',()=>{
 const app=read('app.js'),start=app.indexOf('const idleStartupQueue = []'),end=app.indexOf('\nfunction debounce(',start),callbacks=[];
 const context=vm.createContext({performance:{now:()=>0},document:{hidden:false,activeElement:null,addEventListener(){}},navigator:{},isEditableAppTarget:()=>false,window:{requestIdleCallback:fn=>callbacks.push(fn)},requestAnimationFrame:fn=>fn(),setTimeout:fn=>fn()});
 vm.runInContext(app.slice(start,end)+'\nglobalThis.queue=idleStartupQueue;',context);
 let ran=0;context.runWhenIdle(()=>ran++);context.queue.length=0;assert.doesNotThrow(()=>callbacks.shift()());assert.equal(ran,0);
 context.runWhenIdle(()=>ran++);callbacks.shift()();assert.equal(ran,1);
});

test('banner RPCs reject anonymous, hidden and unverified viewers, filtering hidden targets',async()=>{
 await q("select set_config('test.actor','',false)");await assert.rejects(q('select get_member_profile_banner($1)',[uid]),/visible/);
 await q("select set_config('test.actor',$1,false)",[uid]);await q("select set_config('test.security','blocked',false)");await assert.rejects(q('select get_member_profile_banner($1)',[uid]),/Security gate/);
 await q("select set_config('test.security','ok',false)");assert.equal((await q('select get_member_profile_banner($1) n',[uid]))[0].n.id,'test');
 await q("select set_config('test.role','service_role',false)");await q('update profiles set is_hidden=true');await q("select set_config('test.role','authenticated',false)");
 await assert.rejects(q('select get_member_profile_banners($1) n',[[uid]]),/visible/);
 const mimes=(await q("select allowed_mime_types from storage.buckets where id='shop-media'"))[0].allowed_mime_types;assert.ok(!mimes.includes('image/svg+xml'));
});
