import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const read = name => readFileSync(new URL('../'+name, import.meta.url),'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
function setup() {
  const dom = new JSDOM(read('index.html'), {url:'https://club.test/',runScripts:'outside-only',pretendToBeVisual:true});
  const w = dom.window;
  w.matchMedia = () => ({matches:false,addEventListener(){}});
  const observers=[];
  w.IntersectionObserver = class {constructor(callback){this.callback=callback;observers.push(this);} observe(){} unobserve(){} disconnect(){}};
  w.eval(read('banner-shop.js'));
  const requests=[];
  w.BannerShop.initialize({session:()=> 'owner',rpc:async(name,args)=>{requests.push({name,args});return {data:args.target_user_ids.map(id=>({user_id:id,banner:{id:'galicia',name:'Galicia',art_key:'alberto-galicia-anime-v1'}}))};}});
  const members=w.document.createElement('div');
  members.innerHTML=['a','b','c'].map(id=>`<div data-member-banner-user="${id}"><div class="club-member-banner"></div></div>`).join('');
  w.document.body.append(members);
  return {dom,w,members,requests,observers};
}
test('members use one batch and mount animated SVG only in visible cards',async()=>{
  const h=setup(); h.w.BannerShop.mountMembers(h.members);await flush();
  assert.equal(h.requests.length,1);assert.equal(h.requests[0].name,'get_member_profile_banners');
  assert.equal(h.members.querySelectorAll('svg').length,0);
  assert.equal(h.members.querySelectorAll('img').length,3);
  assert.match(h.members.querySelector('img').style.objectFit,/contain/);
  const tile=h.members.firstElementChild;
  h.observers[0].callback([{target:tile,isIntersecting:true}]);
  assert.equal(h.members.querySelectorAll('.banner-galicia-scene').length,1);
  assert.equal(tile.querySelector('svg').getAttribute('viewBox'),'0 0 2172 724');
  h.w.BannerShop.mountMembers(h.members);await flush();assert.equal(h.requests.length,1,'cached members do not refetch');
  h.dom.window.close();
});
test('Spotify polls only while visible and never overlaps getState calls',async()=>{
  const dom=new JSDOM('<div id="player"></div>',{url:'https://club.test/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
  const timers=[];let observer,states=0,resolveState;
  w.setInterval=fn=>{timers.push(fn);};
  w.IntersectionObserver=class{constructor(fn){observer=fn;}observe(){}disconnect(){}};
  w.Capacitor={getPlatform:()=> 'ios',registerPlugin:()=>({addListener:async()=>{},configure:async()=>({configured:true,linked:true}),getState:()=>{states++;return new Promise(r=>{resolveState=r;});}})};
  w.eval(read('spotify-player.js'));
  await w.ClubSpotify.mount(w.document.getElementById('player'),'spotify:playlist:abc','owner');
  timers[1]();assert.equal(states,0);
  observer([{isIntersecting:true}]);assert.equal(states,1);
  timers[1]();assert.equal(states,1);
  resolveState({linked:true});await flush();
  observer([{isIntersecting:false}]);timers[1]();assert.equal(states,1);
  dom.window.close();
});

test('batch RPC preserves visible-profile access and bounds request size',async()=>{
  const {PGlite}=await import('@electric-sql/pglite');
  const db=new PGlite();
  const owner='00000000-0000-0000-0000-000000000001', hidden='00000000-0000-0000-0000-000000000002';
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated,anon;
      create table profiles(id uuid primary key,is_hidden boolean);
      create table profile_banner_catalog(id text primary key,name text,description text,art_key text);
      create table member_equipped_banners(user_id uuid, banner_id text);
      insert into profiles values ('${owner}',false),('${hidden}',true);
      insert into profile_banner_catalog values ('galicia','Galicia','Campo','alberto-galicia-anime-v1');
      insert into member_equipped_banners values ('${owner}','galicia'),('${hidden}','galicia');`);
    await db.exec(read('supabase-member-banner-batch.sql'));
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${owner}';`);
    const records=(await db.query('select get_member_profile_banners($1::uuid[]) as result',[[owner,hidden]])).rows[0].result;
    assert.equal(records.length,1);assert.equal(records[0].user_id,owner);assert.equal(records[0].banner.id,'galicia');
    await assert.rejects(db.query('select get_member_profile_banners($1::uuid[])', [Array(201).fill(owner)]),/Demasiados/);
    await db.exec(`set request.jwt.claim.sub='${hidden}';`);
    await assert.rejects(db.query('select get_member_profile_banners($1::uuid[])', [[owner]]),/visible/);
    await db.exec('reset role;set role anon;');
    await assert.rejects(db.query('select get_member_profile_banners($1::uuid[])', [[owner]]),/permission denied/);
  } finally {await db.close();}
});
