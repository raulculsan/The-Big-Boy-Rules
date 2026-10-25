import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {PGlite} from '@electric-sql/pglite';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const actor='11111111-1111-1111-1111-111111111111',friend='22222222-2222-2222-2222-222222222222';
const migration=read('supabase/migrations/20261025141628_club_room_progress_and_passport.sql');

test('server passport only counts finished evidence, protects writes and preserves earned details',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon; create role authenticated; create schema auth;
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth to authenticated,anon;
  create function public.assert_account_security() returns void language plpgsql as $$begin if coalesce(current_setting('test.security',true),'')<>'ok' then raise exception 'Security gate'; end if; end$$;
  create function public.account_security_satisfied() returns boolean language sql stable as $$select coalesce(current_setting('test.security',true),'')='ok'$$;
  create table profiles(id uuid primary key,is_hidden boolean not null default false);
  create table group_events(id bigint primary key,title text,location text,description text,starts_at timestamptz,ends_at timestamptz,annual boolean default false,event_type text default 'event');
  create table club_event_arrivals(event_id bigint,occurrence date,user_id uuid,arrived_at timestamptz default now());
  create table moments(id bigint primary key,media_url text,media_type text,caption text);
  create table club_event_memories(id uuid primary key,event_id bigint,occurrence date,created_by uuid,created_at timestamptz default now(),caption text,media_path text,media_type text,moment_id bigint,featured boolean default false);
  create table club_event_places(event_id bigint primary key,label text,latitude double precision,longitude double precision);
  insert into profiles values('${actor}',false),('${friend}',false);
  select set_config('request.jwt.claim.sub','${actor}',false),set_config('test.security','ok',false);
  `);
  await db.exec(migration);
  const empty=(await db.query('select get_club_room_passport() data')).rows[0].data;
  assert.equal(empty.plans,0);assert.deepEqual(empty.visits,[]);assert.deepEqual(empty.unlocks,[]);
  await db.exec(`insert into group_events(id,title,location,description,starts_at,ends_at) select n,'Plan '||n,'Sitio '||n,'',now()-interval '3 days',now()-interval '2 days' from generate_series(1,4) n;
  insert into group_events(id,title,location,description,starts_at,ends_at) values(5,'Futuro','No cuenta','',now()+interval '3 days',now()+interval '4 days'),(6,'Solo programado','No cuenta','',now()-interval '3 days',now()-interval '2 days');
  insert into club_event_arrivals select n,(now() at time zone 'Europe/Madrid'-interval '3 days')::date,u::uuid,now() from generate_series(1,3) n cross join unnest(array['${actor}','${friend}']) u;
  insert into club_event_arrivals values(5,(now() at time zone 'Europe/Madrid'+interval '3 days')::date,'${actor}',now()),(5,(now() at time zone 'Europe/Madrid'+interval '3 days')::date,'${friend}',now());
  insert into club_event_places select n,'Sitio '||n,40.4+n*.01,-3.7 from generate_series(1,6) n;
  insert into club_event_memories(id,event_id,occurrence,created_by,caption,media_path,media_type) select ('33333333-3333-3333-3333-'||lpad(n::text,12,'0'))::uuid,case when n=6 then 4 else 1 end,(now() at time zone 'Europe/Madrid'-interval '3 days')::date,'${actor}','Recuerdo',case when n=1 then '${actor}/1/photo.jpg' end,case when n=1 then 'image' end from generate_series(1,6) n;
  `);
  const data=(await db.query('select get_club_room_passport() data')).rows[0].data;
  assert.equal(data.plans,3);assert.equal(data.memories,6);assert.equal(data.places,4);assert.equal(data.visit_count,4);
  assert.equal(data.visits.some(v=>v.event_id===5||v.event_id===6),false);
  assert.equal(data.visits.find(v=>v.event_id===4).attendees.length,0,'A memory author is not reported as an arrival');
  assert.equal(data.visits.find(v=>v.event_id===4).contributors.length,1);
  assert.equal(data.visits.find(v=>v.event_id===1).photo.media_type,'image');
  assert.deepEqual(new Set(data.unlocks.map(u=>u.milestone)),new Set(['first_plan','memory_wall','places_souvenir']));
  await db.exec(`set role authenticated;`);
  await assert.rejects(db.exec(`insert into club_room_unlocks(milestone) values('club_trophy')`),/permission denied/);
  await db.exec('reset role; delete from club_event_arrivals; delete from club_event_memories;');
  const preserved=(await db.query('select get_club_room_passport() data')).rows[0].data;
  assert.equal(preserved.plans,0);assert.equal(preserved.unlocks.length,3);
  await db.exec('set role anon;');
  await assert.rejects(db.query('select get_club_room_passport()'),/permission denied/);
  await db.exec("reset role;select set_config('test.security','blocked',false);set role authenticated;");
  await assert.rejects(db.query('select get_club_room_passport()'),/Security gate/);
  await db.exec(`reset role;select set_config('test.security','ok',false);update profiles set is_hidden=true where id='${actor}';set role authenticated;`);
  await assert.rejects(db.query('select get_club_room_passport()'),/Inicia sesión/);
 }finally{await db.close();}
});

function client(data){
 const dom=new JSDOM('<button data-club-memory-map>Pasaporte</button><div class="clubhouse-room"><div class="clubhouse-memory"></div></div>',{url:'https://bigboy.test',runScripts:'outside-only'});
 const w=dom.window;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 let rpcCalls=0,proposal=null,owner=actor;
 const db={rpc(){rpcCalls++;return {abortSignal:async()=>({data})};},storage:{from(){return {createSignedUrls:async paths=>({data:paths.map(path=>({path,signedUrl:'https://private.test/'+path}))})};}},from(){const q={select(){return q;},eq(){return q;},order(){return q;},limit(){return q;},abortSignal:async()=>({data:[]})};return q;}};
 w.eval(read('club-live.js'));
 w.ClubLive.init({db,getUser:()=>owner?{id:owner}:null,getEvents:()=>[{id:1,title:'Retiro',startsAt:'2026-01-01T10:00:00Z'}],getMember:id=>({name:id===actor?'Raúl':'Kike'}),onProposePlace:d=>proposal=d});
 return {w,dom,db,get calls(){return rpcCalls;},get proposal(){return proposal;},set owner(v){owner=v;}};
}
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
const fixture={plans:1,memories:5,places:1,visit_count:2,unlocks:[{milestone:'first_plan',unlocked_at:'2026-01-01T12:00:00Z'}],visits:[{event_id:1,title:'Retiro <script>',place_key:'retiro',label:'El Retiro',latitude:40.4,longitude:-3.6,occurrence:'2026-01-02',attendees:[actor,friend],memories:2,photo:{media_path:'private/photo.jpg',media_type:'image',caption:'Foto'}},{event_id:2,title:'Otra visita',place_key:'retiro',label:'El Retiro',latitude:40.4,longitude:-3.6,occurrence:'2026-01-01',attendees:[],memories:1,photo:null}]};
test('passport groups repeated places, signs covers, shows actual attendees and creates a proposal draft',async()=>{
 const s=client(fixture);try{
  s.w.document.querySelector('[data-club-memory-map]').click();await settle();await settle();
  assert.equal(s.w.document.querySelectorAll('.club-passport-place').length,1);
  assert.equal(s.w.document.querySelector('.club-passport-place img').src,'https://private.test/private/photo.jpg');
  s.w.document.querySelector('.club-passport-place').click();
  assert.equal(s.w.document.querySelectorAll('.club-passport-visits article').length,2);
  assert.match(s.w.document.querySelector('.club-passport-visits').textContent,/Raúl.*Kike/);
  assert.match(s.w.document.querySelector('.club-passport-visits').textContent,/Sin llegadas registradas/);
  assert.equal(s.w.document.querySelector('script'),null);
  s.w.document.querySelector('[data-cl-repeat-place]').click();assert.equal(s.proposal.location,'El Retiro');
  await s.w.ClubLive.mountRoomDetails(s.w.document.querySelector('.clubhouse-room'));
  assert.equal(s.w.document.querySelectorAll('.clubhouse-earned-object').length,1);
  assert.equal(s.calls,1,'Passport and room share the bounded in-memory request cache');
  s.w.ClubLive.reset();assert.equal(s.w.document.querySelector('.clubhouse-earned-details'),null);
 }finally{s.dom.window.close();}
});
test('empty passport exposes plans and honest locked room milestones',async()=>{
 const s=client({plans:0,memories:0,places:0,visit_count:0,visits:[],unlocks:[]});try{
  await s.w.ClubLive.openMap();assert.match(s.w.document.querySelector('.club-passport-empty').textContent,/primer sitio/);
  s.w.document.querySelector('[data-cl-passport-tab="room"]').click();
  assert.equal(s.w.document.querySelectorAll('.club-room-milestones article').length,4);
  assert.equal(s.w.document.querySelectorAll('.is-earned').length,0);
  assert.equal(s.w.document.querySelectorAll('progress[value="0"]').length,4);
 }finally{s.dom.window.close();}
});
