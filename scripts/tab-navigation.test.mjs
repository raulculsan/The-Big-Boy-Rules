import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const app = read('app.js');
const extract = name => app.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))[0];
function clock() {
  const jobs = new Map();
  let id = 0;
  return {jobs, set: fn => {jobs.set(++id, fn); return id;}, clear: key => jobs.delete(key),
    flush() {const queued=[...jobs.values()]; jobs.clear(); queued.forEach(fn=>fn());}};
}
function interaction() {
  const timer = clock(), selected = [], menus = [];
  const links = ['inicio','chat','calendario','perfil'].map(section => Object.assign(new EventTarget(), {dataset:{section},setPointerCapture(){}}));
  const context = vm.createContext({setTimeout:timer.set,clearTimeout:timer.clear});
  vm.runInContext(read('tab-navigation.js'), context);
  context.bindTabNavigation(links, {navigate: section=>selected.push(section),openProfileMenu:()=>menus.push(true)});
  const fire = (index,type,options={}) => {
    const event = Object.assign(new Event(type,{cancelable:true}), {pointerId:1,isPrimary:true,button:0,clientX:10,clientY:10,detail:1,...options});
    links[index].dispatchEvent(event);
    return event;
  };
  return {timer,selected,menus,fire};
}

test('80 taps commit immediately without waiting for click or animation', () => {
  const {fire,selected} = interaction();
  for (let i=0;i<80;i++) {
    assert.ok(fire(i%4,'pointerdown').defaultPrevented, 'default focus cannot scroll the page');
    fire(i%4,'pointerup');
    assert.equal(selected.length,i+1);
    fire(i%4,'click');
    assert.equal(selected.length,i+1, 'compatibility click never selects twice');
  }
  assert.equal(selected.at(-1),'perfil');
});

test('a late click cannot override a newer tap; keyboard remains available', () => {
  const {fire,selected} = interaction();
  fire(0,'pointerdown'); fire(0,'pointerup');
  fire(2,'pointerdown'); fire(2,'pointerup');
  fire(0,'click');
  assert.deepEqual(selected,['inicio','calendario']);
  fire(0,'click',{detail:0});
  assert.equal(selected.at(-1),'inicio');
});

test('long press opens the profile menu once and never swallows the next tap', () => {
  const {fire,timer,menus,selected} = interaction();
  fire(3,'pointerdown'); timer.flush(); fire(3,'pointerup'); fire(3,'click');
  assert.equal(menus.length,1);
  assert.equal(selected.length,0);
  fire(3,'pointerdown'); fire(3,'pointerup'); fire(3,'click');
  assert.deepEqual(selected,['perfil']);
});

test('scroll gestures, cancelled touches and superseded pointers never select a tab', () => {
  const {fire,timer,menus,selected} = interaction();
  fire(3,'pointerdown'); fire(3,'pointermove',{clientY:50}); timer.flush(); fire(3,'pointerup'); fire(3,'click');
  fire(0,'pointerdown'); fire(0,'pointercancel'); fire(0,'pointerup'); fire(0,'click');
  fire(3,'pointerdown'); fire(1,'pointerdown',{pointerId:2});
  fire(3,'pointerup'); fire(3,'click'); fire(1,'pointerup',{pointerId:2});
  timer.flush();
  assert.deepEqual(selected,['chat']);
  assert.equal(menus.length,0);
});

function navigation() {
  const frame = clock(), timer = clock(), history = [], anchors = [], scrolls = [];
  const node = id => {
    const classes = new Set();
    return {id,inert:false,classList:{contains:key=>classes.has(key),add:key=>classes.add(key),remove:key=>classes.delete(key),toggle(key,on){on?classes.add(key):classes.delete(key);}},
      scrollTo:options=>scrolls.push({id,...options}),scrollIntoView:()=>anchors.push(id),setAttribute(){}};
  };
  const sections = ['inicio','chat','calendario','perfil','privados','ayuda','administracion'].map(node);
  sections[0].classList.add('active');
  const elements = Object.fromEntries([...sections,node('miembros'),node('noticias')].map(n=>[n.id,n]));
  const body = node('body'), root = node('app');
  const context = vm.createContext({
    navigationGeneration:0,navigationFrame:null,navigationWorkTimer:null,sections,navLinks:[],currentUser:{id:1},achievementsLoaded:true,
    requestAnimationFrame:frame.set,cancelAnimationFrame:frame.clear,clearTimeout:timer.clear,
    window:{setTimeout:timer.set,scrollTo:options=>scrolls.push({id:'window',...options})},
    document:{body,getElementById:id=>elements[id],querySelector:()=>root},HTMLElement:class {},
    history:{replaceState:(_,__,hash)=>history.push(hash)},pageTitle:{},
    closeProfileQuickMenu(){},showMobileHeader(){},updateFloatingTabIndicator(){},syncChatInboxAccessibility(){},syncMobileViewport(){},loadNews(){},loadHelpCenter(){},loadAchievements(){}
  });
  vm.runInContext(extract('resetSectionScroll')+'\n'+extract('goTo'),context);
  return {context,frame,timer,history,anchors,scrolls,sections};
}

test('superseded section callbacks cannot scroll or rewrite the destination', () => {
  const {context,frame,timer,history,anchors,sections,scrolls} = navigation();
  context.goTo('miembros');
  const staleFrame = [...frame.jobs.values()][0];
  context.goTo('perfil'); frame.flush();
  const staleWork = [...timer.jobs.values()][0];
  context.goTo('chat');
  staleFrame(); staleWork(); frame.flush(); timer.flush();
  assert.deepEqual(anchors,[]);
  assert.deepEqual(history,['#chat']);
  assert.deepEqual(sections.filter(s=>s.classList.contains('active')).map(s=>s.id),['chat']);
  assert.ok(scrolls.length>0 && scrolls.every(s=>s.top===0 && s.behavior==='instant'));
});

test('rapid tab switches coalesce background work and preserve explicit home anchors', () => {
  const {context,frame,timer,history,anchors} = navigation();
  for(let i=0;i<100;i++) {context.goTo(['perfil','chat','calendario','inicio'][i%4]); frame.flush();}
  timer.flush();
  assert.deepEqual(history,['#inicio']);
  context.goTo('miembros'); frame.flush(); timer.flush();
  assert.deepEqual(anchors,['miembros']);
  assert.equal(history.at(-1),'#miembros');
});

test('history quota cannot interrupt navigation or background data refresh', () => {
  const {context,frame,timer,sections} = navigation();
  let refreshed=false;
  context.history.replaceState=()=>{throw Object.assign(new Error('Rate limited'),{name:'SecurityError'});};
  context.loadHelpCenter=()=>{refreshed=true;};
  context.goTo('ayuda'); frame.flush(); timer.flush();
  assert.equal(sections.find(s=>s.classList.contains('active')).id,'ayuda');
  assert.equal(refreshed,true);
});

test('profile DOM is retained for repeated taps and refreshed when member data changes', () => {
  let renders=0;
  const member={id:1,name:'Kike',username:'kike',tags:[]};
  const content={set innerHTML(value){renders++;}};
  const context=vm.createContext({profileRender:null,currentUser:member,getMember:()=>member,achievementsForMember:()=>[],memberDisplayNumber:()=>1,
    getAvatar:m=>`avatar:${m.avatarUrl||''}`,escapeHtml:s=>s,renderMemberAchievements:()=>'',renderAchievementChallengeTrigger:()=>'',goTo(){},openProfileEditor(){},
    document:{querySelector:()=>({hidden:false}),getElementById:id=>id==='profileContent'?content:null}});
  vm.runInContext(extract('renderProfile'),context);
  for(let i=0;i<20;i++) context.renderProfile(1);
  assert.equal(renders,1);
  member.avatarUrl='new-avatar'; context.renderProfile(1,false);
  assert.equal(renders,2);
});

test('tap controller is bundled before app initialization and is available offline', () => {
  const html=read('index.html');
  assert.ok(html.indexOf('src="tab-navigation.js')<html.indexOf('src="app.js'));
  for (const file of ['service-worker.js','scripts/build-web.mjs','scripts/preview-club.mjs','scripts/live-server.mjs']) {
    assert.ok(read(file).includes('tab-navigation.js'),file);
  }
  assert.match(read('club.css'), /html\.auth-session-hint \{ scroll-behavior: auto; overflow-anchor: none; \}/);
});

test('mobile screens own independent scroll areas; the dock cannot start a page drag', () => {
  const css=read('club.css');
  assert.match(css, /html\.auth-session-hint \{ height: 100%; overflow: hidden; overscroll-behavior: none; \}/);
  assert.match(css, /body\.authenticated \.app \{[^}]*position: fixed;[^}]*height: 100%;[^}]*overflow: hidden;/);
  assert.match(css, /body\.authenticated \.app > \.page-section \{[^}]*min-height: 0;[^}]*overflow: hidden auto;[^}]*overscroll-behavior-y: contain;/);
  assert.match(css, /body\.authenticated \.app > \.topbar \{[^}]*flex: 0 0 auto; transform: none; pointer-events: auto;/);
  assert.match(css, /body\.authenticated \.floating-tab-bar \.app-tab \{ touch-action: none;/);
  assert.match(app, /section\.addEventListener\("scroll", \(\) => \{\s*if \(section\.classList\.contains\("active"\)\) scheduleMobileHeaderSync\(\);/);
});

test('dock compaction follows the active mobile page, never a stale document or hidden page', () => {
  let mobile=true;
  const pages=[{scrollTop:400,classList:{contains:()=>false}},{scrollTop:0,classList:{contains:()=>true}}];
  const context=vm.createContext({sections:pages,isMobileSidebar:()=>mobile,window:{scrollY:800}});
  vm.runInContext(extract('activePageScrollY'),context);
  assert.equal(context.activePageScrollY(),0);
  pages[1].scrollTop=180;
  assert.equal(context.activePageScrollY(),180);
  pages[1].scrollTop=-20;
  assert.equal(context.activePageScrollY(),0, 'iOS elastic overscroll is clamped');
  mobile=false;
  assert.equal(context.activePageScrollY(),800, 'desktop keeps document scrolling');
});
