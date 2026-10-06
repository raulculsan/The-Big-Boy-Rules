import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const source=read('daily-packs.js');
const context=vm.createContext({Intl,Date,AbortController,setTimeout,clearTimeout});vm.runInContext(source,context);
const now=Date.parse('2026-09-03T12:00:00Z');
const response=(count=1)=>({data:{available:count,total:count,credited:true,day:'2026-09-03',next_reset_at:'2026-09-03T22:00:00Z'}});
const make=options=>context.DailyPacks.createStore({session:()=> 'alice',rpc:async()=>response(),now:()=>now,...options});
test('restored session earns a server pack once and normal refreshes are cached until the next server reset',async()=>{
  let calls=0,time=now;const s=make({rpc:async()=>{calls++;return response();},now:()=>time});
  await s.refresh();assert.equal(s.snapshot().data.available,1);await s.refresh();assert.equal(calls,1);
  time=Date.parse('2026-09-03T22:00:01Z');await s.refresh();assert.equal(calls,2);
});
test('rapid requests coalesce; a forced foreground refresh can refresh the same day balance',async()=>{
  let resolve,calls=0;const s=make({rpc:()=>{calls++;return new Promise(r=>resolve=r);}});
  const a=s.refresh(),b=s.refresh(true);assert.equal(calls,1);resolve(response());await Promise.all([a,b]);
  const c=s.refresh(true);assert.equal(calls,2);resolve(response(2));await c;assert.equal(s.snapshot().data.available,2);
});
test('anonymous or background sessions cannot earn a pack',async()=>{
  let calls=0;await make({session:()=>null,rpc:()=>calls++}).refresh();await make({visible:()=>false,rpc:()=>calls++}).refresh();assert.equal(calls,0);
});
test('late responses after logout or account change cannot populate another account balance',async()=>{
  let user='alice';const resolves=[];
  const s=make({session:()=>user,rpc:()=>new Promise(r=>resolves.push(r))});
  const first=s.refresh();user='bob';const next=s.refresh();resolves[0](response(99));await first;assert.equal(s.snapshot().data,null);
  resolves[1](response(2));await next;assert.equal(s.snapshot().data.available,2);
  s.reset();assert.equal(s.snapshot().data,null);
});
test('missing migration is explicit, never a fictional balance; errors retry without losing last known packs',async()=>{
  let result={error:{code:'PGRST202'}};const s=make({rpc:async()=>result});await s.refresh();assert.equal(s.snapshot().status,'unavailable');
  assert.equal(context.DailyPacks.presentation(s.snapshot()).count,'—');
  result=response(3);await s.refresh(true);result={error:{message:'Offline'}};await s.refresh(true);
  assert.equal(s.snapshot().status,'error');assert.equal(s.snapshot().data.available,3);
  assert.match(context.DailyPacks.presentation(s.snapshot()).label,/última sincronización/);
});
test('network timeout aborts a request without blocking app use; malformed totals never become inventory',async()=>{
  let signal;const s=make({timeoutMs:5,rpc:s=>{signal=s;return new Promise(()=>{});}});await s.refresh();assert.equal(s.snapshot().status,'error');assert.equal(signal.aborted,true);
  const bad=make({rpc:async()=>({data:{available:-3}})});await bad.refresh();assert.equal(bad.snapshot().data,null);assert.equal(bad.snapshot().status,'error');
});
test('page shows server-backed counts and retry updates without replacing artwork or user focus',async()=>{
  const dom=new JSDOM(read('index.html'),{url:'https://club.test',runScripts:'outside-only'}),w=dom.window;
  w.eval(source);let value=response(7);
  w.DailyPacks.initialize({session:()=> 'alice',rpc:async()=>value});
  const art=w.document.querySelector('.packs-art');await w.DailyPacks.refresh();assert.equal(w.document.getElementById('packsCount').textContent,'7');
  assert.equal(w.document.getElementById('packsDailyProgress').value,1);assert.match(w.document.getElementById('packsNextReset').textContent,/4 de septiembre/);
  value={error:{code:'PGRST202'}};await w.DailyPacks.refresh(true);assert.match(w.document.getElementById('packsStatusTitle').textContent,/no está activada/);
  assert.equal(w.document.querySelector('.packs-art'),art);w.DailyPacks.reset();assert.equal(w.document.getElementById('packsCount').textContent,'—');dom.window.close();
});
test('packs keep the four main tabs and are reachable from home, with a working back target and daily lifecycle hooks',()=>{
  const html=read('index.html'),app=read('app.js');const dom=new JSDOM(html),d=dom.window.document;
  assert.equal(d.querySelectorAll('.floating-tab-bar .app-tab').length,4);
  assert.ok(d.querySelector('#inicio [data-go="sobres"]'));assert.ok(d.querySelector('#sobres [data-go="inicio"]'));
  assert.match(app,/function refreshDailyParticipation[\s\S]*?DailyPacks\?\.refresh\(force\)/);
  assert.match(app,/function loadAchievements[\s\S]*?DailyPacks\?\.refresh\(\)/);
  assert.match(app,/function logoutCurrentUser[\s\S]*?DailyPacks\?\.reset\(\)/);
  assert.ok(app.includes('sectionId === "sobres" ? "inicio"'));dom.window.close();
});
test('page assets and original pack artwork reach web, offline shell and the stable iOS build',()=>{
  for(const file of ['index.html','service-worker.js','scripts/build-web.mjs','scripts/live-server.mjs','scripts/preview-club.mjs']) {
    assert.ok(read(file).includes('daily-packs.js'),file);assert.ok(read(file).includes('packs.css'),file);
  }
  for(const file of ['daily-packs.js','packs.css','icons/cards/sobre-los-nuestros-v1.png']) {
    assert.deepEqual(readFileSync(new URL('../'+file,import.meta.url)),readFileSync(new URL('../ios/App/App/public/'+file,import.meta.url)));
  }
});
