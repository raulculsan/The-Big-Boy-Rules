import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('app.js');
const extract = (name, end) => app.slice(app.indexOf(`function ${name}(`), app.indexOf(end, app.indexOf(`function ${name}(`)));
const alice='00000000-0000-0000-0000-000000000001', bob='00000000-0000-0000-0000-000000000002', eve='00000000-0000-0000-0000-000000000003';

test('attachment URLs reject executable, data and credential-bearing schemes',()=>{
  const ctx=vm.createContext({location:{href:'https://bigboy.example/'}});
  ctx.URL=URL;
  vm.runInContext(extract('safeAttachmentUrl','function renderMessageAttachment'),ctx);
  for(const value of ['javascript:alert(1)','data:text/html,x','file:///tmp/x','https://user:pass@example.org/a','storage://private-chat/x','']) assert.equal(ctx.safeAttachmentUrl(value),null);
  assert.equal(ctx.safeAttachmentUrl('https://example.org/a'),'https://example.org/a');
  assert.equal(ctx.safeAttachmentUrl('/image.jpg'),'https://bigboy.example/image.jpg');
});

test('private Storage RLS enforces participants and prevents forged references; push claim is atomic', async()=>{
  const db=new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function public.current_user_is_superadmin() returns boolean language sql stable as $$select false$$;
      create function storage.foldername(name text) returns text[] language sql immutable as $$select string_to_array(name,'/')$$;
      create table auth.users(id uuid primary key);insert into auth.users values('${alice}'),('${bob}'),('${eve}');
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      insert into storage.buckets values('group-media','group-media',true,104857600,array['image/jpeg']);
      create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;
      create table public.private_messages(id int primary key,sender_id uuid,recipient_id uuid,attachment_url text);
      alter table public.private_messages enable row level security;
      create policy participants on private_messages for select to authenticated using(sender_id=auth.uid() or recipient_id=auth.uid());
      create policy send on private_messages for insert to authenticated with check(sender_id=auth.uid());
      grant usage on schema public,auth,storage to authenticated,anon,service_role;
      grant all on storage.objects,private_messages to authenticated;
      grant select on storage.objects to anon;`);
    const migration=read('supabase/migrations/20261014120000_security_chat_push.sql');
    await db.exec(migration);await db.exec(migration); // deployment is idempotent
    const asUser=async(user,sql)=>{await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);try{return await db.query(sql);}finally{await db.exec('reset role');}};
    await asUser(alice,`insert into storage.objects values('private-chat','${alice}/file.jpg')`);
    assert.equal((await asUser(alice,'select * from storage.objects')).rows.length,0,'upload alone cannot authorize signing');
    await asUser(alice,`insert into private_messages values(1,'${alice}','${bob}','storage://private-chat/${alice}/file.jpg')`);
    assert.equal((await asUser(alice,'select * from storage.objects')).rows.length,1);
    assert.equal((await asUser(bob,'select * from storage.objects')).rows.length,1);
    assert.equal((await asUser(eve,'select * from storage.objects')).rows.length,0);
    await assert.rejects(asUser(eve,`insert into private_messages values(2,'${eve}','${bob}','storage://private-chat/${alice}/file.jpg')`),/private_attachment_owner_check/);
    await db.exec('set role anon');assert.equal((await db.query('select * from storage.objects')).rows.length,0);await db.exec('reset role');
    await db.exec('set role service_role');
    await db.query('insert into push_dispatch_claims(actor_id,kind,entity_id) values($1,$2,$3)',[alice,'group_message','1']);
    await assert.rejects(db.query('insert into push_dispatch_claims(actor_id,kind,entity_id) values($1,$2,$3)',[alice,'group_message','1']),/unique|duplicate/);
    await db.exec('reset role');await assert.rejects(asUser(alice,'select * from push_dispatch_claims'),/permission denied/);
  } finally {await db.close();}
});

function edge(path, createClient, extra={}) {
  const source=stripTypeScriptTypes(read(path).replace(/^import .*;\n/gm,''),{mode:'strip'}).replace('export default','globalThis.handler =');
  const ctx=vm.createContext({Response,Request,URL,Date,Set,crypto,console,Deno:{env:{get:name=>name==='SUPABASE_URL'?'https://project.supabase.co':'test-value'}},createClient,...extra});
  vm.runInContext(source,ctx);return ctx.handler;
}
const request=body=>new Request('https://example.org/function',{method:'POST',headers:{Authorization:'Bearer dummy'},body:JSON.stringify(body)});
test('club admins cannot rename/reset other admins; superadmin can manage visible admin',async()=>{
  for(const callerRole of ['admin','superadmin']) for(const action of ['rename','reset-password']) {
    let updates=0;
    const client={auth:{getUser:async()=>({data:{user:{id:alice}}}),admin:{getUserById:async()=>({data:{user:{app_metadata:{}}}}),updateUserById:async()=>{updates++;return {};}}},from(){let id;return {select(){return this},eq(key,value){id=value;return this},single:async()=>({data:id===alice?{role:callerRole,is_hidden:callerRole==='superadmin'}:{role:'admin',is_hidden:false,username:'old'}}),update(){updates++;return this},then(resolve){resolve({});}};}};
    const response=await edge('supabase/functions/admin-users/index.ts',()=>client).fetch(request({action,userId:bob,username:'newname',password:'password123'}));
    assert.equal(response.status,callerRole==='admin'?403:200);
    if(callerRole==='admin') assert.equal(updates,0);
  }
});
test('concurrent replayed push requests send once and exclude external avatar URLs',async()=>{
  let claims=new Set(), sent=[];
  const client={auth:{getUser:async()=>({data:{user:{id:alice}}})},from(table){return {select(){return this},eq(){return this},neq(){return this},in(){return this},single:async()=>({data:table==='profiles'?{display_name:'Alice',avatar_url:'https://tracker.example/icon'}:{user_id:alice,body:'Hi'}}),then(resolve){resolve({data:table==='profiles'?[{id:bob}]:[{id:'sub',endpoint:'https://push.example/',p256dh:'test',auth:'test'}]});},insert(value){const key=JSON.stringify(value);if(claims.has(key))return Promise.resolve({error:{code:'23505'}});claims.add(key);return Promise.resolve({});}};}};
  const handler=edge('supabase/functions/push-dispatch/index.ts',()=>client,{webpush:{setVapidDetails(){},async sendNotification(subscription,payload){sent.push(JSON.parse(payload));}}});
  const responses=await Promise.all(Array.from({length:8},()=>handler.fetch(request({kind:'group_message',entityId:'1'}))));
  assert.ok(responses.every(r=>r.status===200));assert.equal(sent.length,1);assert.equal(sent[0].icon,'');
  const invalid=await handler.fetch(request({kind:'group_message',entityId:{}}));assert.equal(invalid.status,400);
});
test('achievement calls coalesce, explicit change queues one refresh, and account switches ignore stale results',async()=>{
  let reads=0, release;
  const firstGate=new Promise(resolve=>{release=resolve});
  const ctx=vm.createContext({backendReady:true,currentAuthUser:{id:alice},achievementsRequest:null,achievementsLoading:false,achievementsLoaded:false,achievementProgressUserId:null,achievementProgressStatus:'loading',achievementProgress:[],achievementCardScopes:null,achievementVisitFailed:false,achievements:[],achievementAwards:[],activeProfileId:null,
    renderAdminAchievements(){},renderAchievementDetail(){},canManageSite:()=>false,document:{getElementById:()=>null},dailyParticipation:{record:async()=>{await firstGate;}},
    db:{from(){reads++;return {select(){return this},is(){return this},order(){return this},eq(){return this},then(resolve){resolve({data:[]});}}},rpc:async()=>{reads++;return {data:{collections:[]}};}}});
  vm.runInContext(extract('loadAchievements','async function deleteAchievement'),ctx);
  const first=ctx.loadAchievements();assert.equal(ctx.loadAchievements(),first);release();await first;assert.equal(reads,5);
  let releaseSecond;ctx.dailyParticipation.record=()=>new Promise(resolve=>{releaseSecond=resolve});
  const second=ctx.loadAchievements();assert.equal(ctx.loadAchievements({force:true}),second);
  releaseSecond();await new Promise(resolve=>setImmediate(resolve));releaseSecond();await second;assert.equal(reads,15);
  let releaseOld;ctx.dailyParticipation.record=()=>new Promise(resolve=>{releaseOld=resolve});
  const old=ctx.loadAchievements();ctx.currentAuthUser={id:bob};ctx.dailyParticipation.record=async()=>false;
  await ctx.loadAchievements();assert.equal(ctx.achievementProgressUserId,bob);
  releaseOld();await old;assert.equal(ctx.achievementProgressUserId,bob);
});
