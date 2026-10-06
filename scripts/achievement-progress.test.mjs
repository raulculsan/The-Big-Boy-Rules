import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';

const read = name => readFileSync(new URL('../'+name,import.meta.url),'utf8');
const model=vm.createContext({Intl}); vm.runInContext(read('achievement-progress.js'),model);
const M=model.AchievementProgress, app=read('app.js');
const escapeHtml=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const rule={metric:'group_messages',target:10};
test('collection objectives describe exploration separately from earning packs',()=>{
  assert.equal(M.objective({metric:'cards_explored',target:3}),'Explora 3 cartas distintas');
  assert.equal(M.objective({metric:'special_cards_explored',target:1}),'Explora 1 carta especial');
  assert.equal(M.objective({metric:'legendary_cards_explored',target:2}),'Explora 2 cartas legendarias distintas');
  assert.equal(M.objective({metric:'locations_explored',target:1}),'Explora 1 ubicación');
  assert.equal(M.objective({metric:'daily_packs_earned',target:7}),'Consigue 7 sobres diarios');
  assert.equal(M.validTarget('packs_opened',1),false,'preview is not a real opening');
  assert.equal(M.validTarget('cards_owned',1),false,'catalog is not an inventory');
});
function extract(name,next) {
  const start=app.indexOf(`function ${name}(`), end=app.indexOf(`\n${next}`,start);
  assert.ok(start>=0&&end>start);return app.slice(start,end);
}

test('objectives accept only supported metrics and integer, bounded goals',()=>{
  for(const value of [1,10,100000]) assert.ok(M.validTarget('group_messages',value));
  for(const value of [0,-1,1.5,100001,Infinity,NaN,'',null]) assert.equal(M.validTarget('group_messages',value),false);
  assert.equal(M.validTarget('unknown',10),false);
  assert.equal(M.validTarget('profile_completed',2),false);
  assert.ok(M.validTarget('profile_completed',1));
  assert.match(M.objective({metric:'group_active_days',target:5}),/5 días distintos/);
  assert.match(M.objective({metric:'group_messages',target:1}),/1 día · máximo 1 al día/);
  assert.match(M.objective({metric:'group_active_days',target:5}),/Entra en la app/);
});

test('server progress is clamped, never invented from local interactions; pending excludes earned and manual',()=>{
  assert.deepEqual({...M.progress(rule,{value:3})},{value:3,target:10,percent:30,complete:false});
  assert.equal(M.progress(rule,{value:100}).value,10);
  assert.equal(M.progress(rule,{value:-1}).value,0);
  assert.equal(M.progress(rule,{value:NaN}).value,0);
  assert.equal(M.progress(rule).value,0);
  assert.equal(M.progress(null),null);
  const definitions=[{id:1,rule},{id:2,rule},{id:3}];
  assert.deepEqual(Array.from(M.pending(definitions,[{achievementId:1,userId:'alice'}],'alice'),a=>a.id),[2]);
  assert.equal(M.pending(definitions,[],null).length,0);
});
test('pending objectives are ordered by closest completion without mutating the source',()=>{
  const definitions=[
    {id:1,name:'Ochenta',tier:'gold',rule:{metric:'group_messages',target:100}},
    {id:2,name:'Noventa',tier:'silver',rule:{metric:'group_messages',target:10}},
    {id:3,name:'Una acción',tier:'bronze',rule:{metric:'profile_completed',target:1}},
    {id:4,name:'Diez acciones',tier:'platinum',rule:{metric:'group_active_days',target:10}},
  ];
  const before=definitions.map(item=>item.id);
  const ordered=M.orderedPending(definitions,[],[{achievementId:1,value:80},{achievementId:2,value:9}],'alice');
  assert.deepEqual(Array.from(ordered,item=>item.id),[2,1,3,4]);
  assert.deepEqual(definitions.map(item=>item.id),before);
});

test('daily visits include restored sessions, coalesce calls and recognize the next day without logging out',async()=>{
  let date='2026-09-03',calls=0,visible=true;
  const tracker=M.createDailyVisitRecorder({session:()=> 'alice',visible:()=>visible,day:()=>date,rpc:async()=>{calls++;return {data:date};}});
  await Promise.all([tracker.record(),tracker.record(),tracker.record()]);
  assert.equal(calls,1);
  assert.equal(await tracker.record(),false);assert.equal(calls,1);
  visible=false;date='2026-09-04';assert.equal(await tracker.record(),false);
  visible=true;assert.equal(await tracker.record(),true);assert.equal(calls,2);
  await tracker.record({force:true});assert.equal(calls,3,'reconnection/new objectives can recheck; SQL deduplicates');
});
test('offline visits retry and late results after logout or account changes cannot cache another user',async()=>{
  let user='alice',calls=0,fail=true,release;
  const tracker=M.createDailyVisitRecorder({session:()=>user,visible:()=>true,day:()=> '2026-09-03',rpc:async()=>{calls++;return fail?{error:{message:'offline'}}:{data:'2026-09-03'};}});
  assert.equal(await tracker.record(),false);fail=false;assert.equal(await tracker.record(),true);assert.equal(calls,2);
  tracker.reset();user=null;assert.equal(await tracker.record(),false);assert.equal(calls,2);
  user='bob';assert.equal(await tracker.record(),true);assert.equal(calls,3);
  const late=M.createDailyVisitRecorder({session:()=>user,visible:()=>true,rpc:()=>new Promise(r=>release=r)});
  const pending=late.record();late.reset();user='alice';release({data:'2026-09-03'});
  assert.equal(await pending,false);
});

test('visit hooks cover auth restoration, foreground return, reconnection and foreground midnight',()=>{
  assert.match(app,/await dailyParticipation.record\(\);\s*if \(!isCurrent\(\)\) return/);
  assert.match(app,/if \(!document.hidden && currentAuthUser\) void refreshDailyParticipation\(true\)/);
  assert.match(app,/window.addEventListener\("online", \(\) => \{ void refreshDailyParticipation\(true\)/);
  assert.match(app,/setInterval\(\(\) => \{ if \(!document.hidden\) void refreshDailyParticipation\(\); \}, 60000\)/);
  assert.match(app,/dailyParticipation.reset\(\)/);
});

function profileContext() {
  const context=vm.createContext({Intl,AchievementProgress:M,escapeHtml,currentAuthUser:{id:'alice'},
    achievementProgressStatus:'ready',achievementProgressUserId:'alice',achievementProgress:[{achievementId:1,value:3}],
    achievements:[{id:1,name:'Voz <del> club',tier:'gold',rule}],achievementAwards:[],
    achievementTier:()=>({label:'Oro'}),achievementTrophyIcon:()=>'<span>Trofeo</span>'});
  vm.runInContext(extract('renderPersonalAchievementProgress','function renderAchievementDetail'),context);
  return context;
}
test('pending progress is private and disappearing after award does not affect public trophies',()=>{
  const c=profileContext();
  const own=c.renderPendingAchievements({authId:'alice'});
  assert.match(own,/3 \/ 10 · 30%/);assert.match(own,/Voz &lt;del&gt; club/);
  assert.match(own,/data-open-achievement="1"/);
  assert.equal(c.renderPendingAchievements({authId:'bob'}),'');
  assert.equal(c.renderPendingAchievements({authId:'alice',hidden:true}),'');
  c.achievementAwards=[{achievementId:1,userId:'alice'}];
  assert.match(c.renderPendingAchievements({authId:'alice'}),/Todo conquistado/);
});
test('profile uses one private-goals icon beside the earned counter and no longer inserts goals below trophies',()=>{
  const c=profileContext();
  const source=extract('renderAchievementChallengeTrigger','let achievementChallengesReturnFocus');
  vm.runInContext(source,c);
  const trigger=c.renderAchievementChallengeTrigger({authId:'alice'});
  assert.match(trigger,/data-open-achievement-challenges/);assert.match(trigger,/>1<\/span>/);
  assert.equal(c.renderAchievementChallengeTrigger({authId:'bob'}),'');
  assert.match(app,/club-profile-achievement-summary[^]*club-profile-earned[^]*renderAchievementChallengeTrigger\(member\)/);
  const profile=extract('renderProfile','function spotifyEmbedUrl');
  assert.doesNotMatch(profile,/renderPendingAchievements\(member\)/);
  const html=read('index.html');
  assert.match(html,/id="achievementChallengesDialog"[^>]*aria-labelledby="achievementChallengesPanelTitle"/);
  assert.match(html,/id="closeAchievementChallenges"[^>]*aria-label="Cerrar próximos logros"/);
});
test('unknown, offline or previous-account progress never renders a misleading zero or someone else’s count',()=>{
  const c=profileContext();c.achievementProgressStatus='error';
  assert.doesNotMatch(c.renderPendingAchievements({authId:'alice'}),/<progress/);
  assert.match(c.renderPendingAchievements({authId:'alice'}),/Actualizar progreso/);
  c.achievementProgressStatus='ready';c.achievementProgressUserId='bob';
  assert.doesNotMatch(c.renderPersonalAchievementProgress(c.achievements[0]),/3 \/ 10|<progress/);
  c.achievementProgressStatus='unavailable';
  assert.equal(c.renderPendingAchievements({authId:'alice'}),'');
});

function adminUI() {
  const dom=new JSDOM(read('index.html'),{runScripts:'outside-only',url:'https://preview.test/'});
  const {window}=dom,$=id=>window.document.getElementById(id);
  window.eval(read('achievement-progress.js'));window.eval(read('achievement-admin.js'));
  const state={status:'ready',page:'admin-logros',calls:[],error:null,defs:[],awards:[]};
  const ui=window.AchievementAdmin.create({members:()=>[{authId:'alice',name:'Alice',username:'alice'}],achievements:()=>state.defs,awards:()=>state.awards,
    canManage:()=>true,escape:escapeHtml,avatar:()=>'<span>A</span>',trophy:()=>'<span>T</span>',tier:()=>({label:'Oro'}),
    navigate:p=>state.page=p,progressStatus:()=>state.status,refresh:async()=>ui.render(),
    createAward:async payload=>{state.calls.push({type:'manual',payload});return {error:state.error};},
    createAutomatic:async payload=>{state.calls.push({type:'automatic',payload});return {error:state.error};},assignAward:async()=>({})});
  ui.render();
  const input=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new window.Event('input',{bubbles:true}));};
  const tick=()=>new Promise(resolve=>setImmediate(resolve));
  return {dom,window,$,state,ui,input,tick};
}
test('automatic creation requires no recipient selection and sends the exact metric/goal atomically',async()=>{
  const c=adminUI();try {
    c.ui.openCreate();c.input('achievementName','La voz del club');
    c.$('achievementAutomaticMode').click();c.input('achievementMetric','group_active_days');c.input('achievementTarget','7');
    assert.equal(c.$('achievementManualRecipients').hidden,true);
    assert.equal(c.$('achievementAutomaticFields').hidden,false);
    assert.match(c.$('achievementCreatePreview').textContent,/7 días distintos/);
    c.$('achievementForm').requestSubmit();await c.tick();
    assert.equal(c.state.calls.length,1);assert.equal(c.state.calls[0].type,'automatic');
    assert.equal(c.state.calls[0].payload.new_target,7);assert.equal(c.state.calls[0].payload.new_metric,'group_active_days');
    assert.equal(c.state.calls[0].payload.target_user_ids,undefined);assert.equal(c.state.page,'admin-logros');
  } finally {c.dom.window.close();}
});
test('collection creation exposes all categories, caps catalog goals and explains a missing server update',async()=>{
  const c=adminUI();try {
    c.window.CardCollection={catalog:[{edition:'Común'},{edition:'Especial',kind:'Ubicación'},{edition:'Legendaria',kind:'Ubicación'}]};
    for(const metric of ['daily_packs_earned','cards_explored','special_cards_explored','legendary_cards_explored','locations_explored']) {
      assert.ok(c.$('achievementMetric').querySelector(`option[value="${metric}"]`));
    }
    c.ui.openCreate();c.input('achievementName','Primera leyenda');c.$('achievementAutomaticMode').click();
    c.input('achievementTarget','10');c.input('achievementMetric','legendary_cards_explored');
    assert.equal(c.$('achievementTarget').value,'1');assert.equal(c.$('achievementTarget').max,'1');
    assert.match(c.$('achievementMetricHint').textContent,/Disponibles en el catálogo: 1/);
    assert.match(c.$('achievementCreatePreview').textContent,/Explora 1 carta legendaria/);
    c.state.error={message:'El objetivo no es válido.'};
    c.$('achievementForm').requestSubmit();await c.tick();
    assert.match(c.$('achievementFeedback').textContent,/supabase-collection-achievements.sql/);
    assert.equal(c.$('achievementName').value,'Primera leyenda');
    c.input('achievementMetric','daily_packs_earned');assert.equal(c.$('achievementTarget').max,'100000');
  } finally {c.dom.window.close();}
});
test('legacy manual creation still selects members; profile objective fixes target to one',async()=>{
  const c=adminUI();try {
    c.ui.openCreate();c.input('achievementName','Reconocimiento');
    assert.equal(c.$('achievementMetric').disabled,true);assert.equal(c.$('achievementTarget').disabled,true);
    c.$('achievementMembers').querySelector('input').click();
    c.$('achievementForm').requestSubmit();await c.tick();
    assert.equal(c.state.calls[0].type,'manual');assert.equal(c.state.calls[0].payload.target_user_ids[0],'alice');
    c.ui.openCreate();c.$('achievementAutomaticMode').click();c.input('achievementMetric','profile_completed');
    assert.equal(c.$('achievementTarget').value,'1');assert.equal(c.$('achievementTarget').disabled,true);
  } finally {c.dom.window.close();}
});
test('failed writes and realtime refresh preserve the objective draft; unavailable migration blocks automatic only',async()=>{
  const c=adminUI();try {
    c.ui.openCreate();c.input('achievementName','Un objetivo');c.$('achievementAutomaticMode').click();c.input('achievementTarget','40');
    c.state.error={message:'Sin conexión'};
    c.$('achievementForm').requestSubmit();await c.tick();c.ui.render();
    assert.equal(c.$('achievementName').value,'Un objetivo');assert.equal(c.$('achievementTarget').value,'40');
    assert.ok(c.$('achievementAutomaticMode').checked);assert.equal(c.$('achievementFeedback').textContent,'Sin conexión');
    c.state.status='unavailable';c.ui.render();
    assert.ok(c.$('achievementAutomaticMode').disabled);assert.match(c.$('achievementAutomationStatus').textContent,/Supabase/);
    c.$('achievementForm').requestSubmit();await c.tick();assert.equal(c.state.calls.length,1);
    c.ui.openCreate();assert.equal(c.$('achievementManualRecipients').hidden,false);
    assert.equal(c.$('achievementForm').querySelector('input[value="manual"]').disabled,false);
  } finally {c.dom.window.close();}
});
test('catalog distinguishes automatic objectives and never offers manual assignment for them',()=>{
  const c=adminUI();try {
    c.state.defs=[{id:1,tier:'gold',name:'Auto',rule},{id:2,tier:'bronze',name:'Manual'}];c.ui.render();
    assert.equal(c.$('adminAchievementsList').querySelector('[data-manage-achievement="1"]'),null);
    assert.ok(c.$('adminAchievementsList').querySelector('[data-manage-achievement="2"]'));
    c.ui.openAssignments(1);assert.equal(c.state.page,'admin-logros');
    assert.match(c.$('adminAchievementsList').textContent,/Escribe en el grupo 10 días distintos/);
  } finally {c.dom.window.close();}
});

function loader() {
  const gates=[],calls=[];
  const c=vm.createContext({currentAuthUser:{id:'alice'},backendReady:true,achievementsRequest:null,achievementsLoading:false,achievementsLoaded:false,
    achievementProgressUserId:null,achievementProgressStatus:'loading',achievementProgress:[],achievements:[],achievementAwards:[],activeProfileId:null,
    renderAdminAchievements(){},renderAchievementDetail(){},dailyParticipation:{record:async()=>false},canManageSite:()=>false,document:{getElementById:()=>null},
    db:{from(table){const batch=Math.floor(calls.length/4);calls.push(table);return {select(){return this;},order(){return this;},eq(key,id){assert.equal(key,'user_id');this.userId=id;return this;},then(resolve,reject){gates[batch].promise.then(results=>results[table]).then(resolve,reject);}};}}});
  vm.runInContext(extract('loadAchievements','async function deleteAchievement'),c);
  const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);gates.push({promise,resolve});return resolve;};
  const data=(value,error)=>({achievements:{data:[{id:1,name:'Auto',tier:'gold'}]},achievement_awards:{data:[]},
    achievement_rules:error?{error}:{data:[{achievement_id:1,metric:'group_messages',target_count:10}]},
    achievement_progress:error?{error}:{data:[{achievement_id:1,current_value:value}]}});
  return {c,gate,data,calls};
}
test('late requests from a previous account cannot populate the next account’s progress',async()=>{
  const {c,gate,data}=loader();const releaseAlice=gate();const old=c.loadAchievements();
  await new Promise(resolve=>setImmediate(resolve));
  c.currentAuthUser={id:'bob'};const releaseBob=gate();const current=c.loadAchievements();
  releaseBob(data(2));await current;assert.equal(c.achievementProgressUserId,'bob');assert.equal(c.achievementProgress[0].value,2);
  releaseAlice(data(9));await old;assert.equal(c.achievementProgressUserId,'bob');assert.equal(c.achievementProgress[0].value,2);
});
test('a refresh during loading waits for a follow-up read, and schema absence preserves manual trophies',async()=>{
  const {c,gate,data,calls}=loader();const first=gate(),second=gate();
  const request=c.loadAchievements();assert.equal(c.loadAchievements(),request);
  first(data(1));await new Promise(resolve=>setImmediate(resolve));second(data(4));await request;
  assert.equal(calls.length,8);assert.equal(c.achievementProgress[0].value,4);
  const missing=gate();const pending=c.loadAchievements();missing(data(0,{code:'PGRST205'}));await pending;
  assert.equal(c.achievementProgressStatus,'unavailable');assert.equal(c.achievements.length,1);
  assert.equal(c.achievements[0].rule.metric,'group_messages','failed schema reads cannot relabel known automatic trophies as manual');
});
test('progress ships everywhere, refreshes after sleep, and does not reset the trophy animation',()=>{
  for(const file of ['index.html','service-worker.js','scripts/build-web.mjs','scripts/live-server.mjs','scripts/preview-club.mjs']) assert.ok(read(file).includes('achievement-progress.js'),file);
  assert.ok(read('index.html').indexOf('<script src="achievement-progress.js') < read('index.html').indexOf('<script src="achievement-admin.js'));
  assert.match(app,/table: "achievement_progress", filter: `user_id=eq\.\$\{currentAuthUser.id\}`/);
  assert.match(app,/status === "SUBSCRIBED"\) \{[^]*?refreshDailyParticipation\(true\)/);
  assert.match(app,/previousVisual\?\.dataset.visualKey === visualKey/);
  assert.match(app,/if \(document\.getElementById\("achievementChallengesDialog"\)\?\.open\) renderAchievementChallengesDialog\(\)/);
});
