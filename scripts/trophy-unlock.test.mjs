import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
const read = file => readFileSync(new URL('../'+file,import.meta.url),'utf8');
const source = read('trophy-unlock.js');
const context = vm.createContext({});
vm.runInContext(source,context);
const definitions = ['bronze','silver','gold','platinum'].map((tier,id)=>({id,tier,name:`Trofeo ${tier}`,description:'Bien conseguido'}));
const award = (id, achievementId=0, userId='me', awardedAt='2026-01-01') => ({id,achievementId,userId,awardedAt});
const storage = () => {const data=new Map();return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};};
const queue = store => context.TrophyUnlock.createQueue({storage:store,now:()=>Date.parse('2026-09-03')});

test('first load silently baselines old awards but celebrates awards issued during this launch',()=>{
  const q=queue(storage());q.observe('me',definitions,[award(1),award(2,1,'me','2026-09-03T00:00:01Z'),award(3,2,'other')]);
  assert.equal(q.size,1);assert.equal(q.take().id,1);assert.equal(q.size,0);
});
test('manual and automatic awards use the same detection; realtime repeats never duplicate celebrations',()=>{
  const q=queue(storage());q.observe('me',definitions,[]);
  for(let i=0;i<4;i++) q.observe('me',definitions,[award(4,3),award(3,2),award(2,1)]);
  assert.equal(q.size,3);assert.equal(q.take().tier,'silver');assert.equal(q.take().tier,'gold');assert.equal(q.take().tier,'platinum');
  q.observe('me',definitions,[award(4,3),award(3,2),award(2,1)]);assert.equal(q.size,0);
});
test('seen IDs persist across launches, with separate histories for each account',()=>{
  const s=storage(),q=queue(s);q.observe('me',definitions,[]);q.observe('me',definitions,[award(1)]);q.take();
  const next=queue(s);next.observe('me',definitions,[award(1),award(2,2)]);assert.equal(next.size,1);next.take();
  next.observe('other',definitions,[award(9,1,'other')]);assert.equal(next.size,0);
  next.observe('me',definitions,[award(1),award(2,2)]);assert.equal(next.size,0);
});
test('revoked queued awards are removed and unknown definitions can arrive on a later refresh',()=>{
  const q=queue(storage());q.observe('me',definitions,[]);q.observe('me',[],[award(1)]);assert.equal(q.size,0);
  q.observe('me',definitions,[award(1)]);assert.equal(q.size,1);q.observe('me',definitions,[]);assert.equal(q.size,0);
});
test('blocked storage still deduplicates in memory; reset clears all pending state',()=>{
  const q=queue({getItem(){throw Error();},setItem(){throw Error();}});q.observe('me',definitions,[]);
  q.observe('me',definitions,[award(1)]);q.take();q.observe('me',definitions,[award(1)]);assert.equal(q.size,0);
  q.observe('me',definitions,[award(2)]);q.reset();assert.equal(q.size,0);
});
function uiHarness() {
  const dom=new JSDOM('<body><button id="origin">Perfil</button><input></body>',{url:'https://club.test',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,timers=new Map(),mounts=[];let timerId=0,allowed=true,destroyed=0,detail;
  w.setTimeout=fn=>{timers.set(++timerId,fn);return timerId;};w.clearTimeout=id=>timers.delete(id);
  w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  w.TrophyMotion={createController:()=>({mount:(host,tier)=>mounts.push(tier),destroy:()=>destroyed++})};
  w.eval(source);w.TrophyUnlock.initialize({canShow:()=>allowed,openDetail:id=>detail=id});
  w.document.querySelector('#origin').focus();w.TrophyUnlock.observe('me',definitions,[]);
  return {w,dom,mounts,timers,get detail(){return detail;},get destroyed(){return destroyed;},setAllowed:v=>allowed=v,
    tick(){const jobs=[...timers.values()];timers.clear();jobs.forEach(fn=>fn());},
    unlock(){w.TrophyUnlock.observe('me',definitions,[award(1)]);}};
}
test('UI postpones while typing or another modal is open; dismiss restores focus without page scrolling',()=>{
  const h=uiHarness();h.w.document.querySelector('input').focus();h.unlock();h.tick();assert.equal(h.mounts.length,0);
  h.w.document.querySelector('#origin').focus();const other=h.w.document.createElement('dialog');other.open=true;h.w.document.body.append(other);
  h.tick();assert.equal(h.mounts.length,0);other.remove();h.tick();assert.deepEqual(h.mounts,['bronze']);
  h.w.document.querySelector('.trophy-unlock-continue').click();assert.equal(h.w.document.querySelector('.trophy-unlock-dialog').open,false);
  assert.equal(h.w.document.activeElement.id,'origin');assert.ok(h.destroyed>0);h.dom.window.close();
});
test('view trophy closes celebration before opening detail, and logout destroys active player',()=>{
  const h=uiHarness();h.unlock();h.tick();h.w.document.querySelector('.trophy-unlock-view').click();assert.equal(h.detail,0);
  h.w.TrophyUnlock.observe('me',definitions,[award(2,2)]);h.tick();assert.equal(h.mounts.at(-1),'gold');
  h.w.TrophyUnlock.reset();assert.equal(h.w.document.querySelector('.trophy-unlock-dialog').open,false);assert.equal(h.timers.size,0);h.dom.window.close();
});
test('switching account cannot leak the previous celebration or queue',()=>{
  const h=uiHarness();h.unlock();h.tick();h.w.TrophyUnlock.observe('other',definitions,[]);
  assert.equal(h.w.document.querySelector('.trophy-unlock-dialog').open,false);assert.equal(h.timers.size,0);h.dom.window.close();
});
test('unlock Lotties grow in duration and particle count and retain vector-only trophy art',()=>{
  let length=0,count=0;
  for(const {tier} of definitions) {
    const d=JSON.parse(read(`icons/trophies/${tier}-unlock.json`));
    const particles=d.layers.filter(l=>l.nm.startsWith('Metal spark')).length;
    assert.ok(d.op>length);assert.ok(particles>count);length=d.op;count=particles;
    assert.equal(d.fr,60);assert.equal(d.w,512);assert.equal(d.assets.length,0);
    assert.ok(d.layers.every(l=>l.ty===4));
    const original=JSON.parse(read(`icons/trophies/${tier}.json`));
    assert.deepEqual(d.layers.find(l=>l.nm==='trophy').shapes,original.layers.find(l=>l.nm==='trophy').shapes);
    assert.ok(Buffer.byteLength(JSON.stringify(d))<100000);
  }
});
test('all four unlock scenes render valid SVG with the actual bundled Lottie player', async()=>{
  const dom=new JSDOM('<div id="motion"></div>',{runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;
  w.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){}});
  w.eval(read('vendor/lottie-light.min.js'));
  try {
    for(const {tier} of definitions) {
      const data=JSON.parse(read(`icons/trophies/${tier}-unlock.json`));
      const animation=w.lottie.loadAnimation({container:w.document.querySelector('#motion'),renderer:'svg',loop:false,autoplay:false,animationData:data});
      await new Promise(resolve=>setTimeout(resolve,30));
      for(const frame of [0,20,45,75,data.op-1]) {
        animation.goToAndStop(frame,true);
        const svg=w.document.querySelector('svg');assert.ok(svg);assert.ok(svg.querySelectorAll('path').length>20);
        assert.ok(!/NaN|undefined/.test(svg.outerHTML),`${tier} frame ${frame}`);
      }
      animation.destroy();
    }
  } finally {dom.window.close();}
});
test('unlock resources are included in web, preview, offline cache and iOS bundle',()=>{
  for(const path of ['index.html','service-worker.js','scripts/build-web.mjs','scripts/live-server.mjs','scripts/preview-club.mjs']) assert.ok(read(path).includes('trophy-unlock.js'),path);
  for(const path of ['trophy-unlock.js',...definitions.map(d=>`icons/trophies/${d.tier}-unlock.json`)]) assert.equal(read(path),read('ios/App/App/public/'+path));
});
