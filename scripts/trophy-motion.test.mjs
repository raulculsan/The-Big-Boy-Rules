import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../trophy-motion.js', import.meta.url), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
function target() {
  const listeners = new Map();
  return {listeners, addEventListener(type, fn) {listeners.set(type, fn);}, removeEventListener(type) {listeners.delete(type);}, emit(type) {listeners.get(type)?.();}};
}
function harness({reduced = false, deferData = false, failData = false} = {}) {
  const host = {dataset:{},isConnected:true,querySelector:() => ({})};
  const label = {textContent:''};
  const button = {...target(),querySelector:() => label};
  const motion = {...target(),matches:reduced};
  const animations = [], scripts = [], requests = [], timers = new Map();
  let timerId=0, resolveData;
  const player = {loadAnimation(options) {
    const animation={...target(),options,plays:0,pauses:0,destroyed:false,
      goToAndPlay(frame) {this.plays++;this.frame=frame;},goToAndStop(frame) {this.frame=frame;this.pauses++;},
      play() {this.plays++;},pause() {this.pauses++;},destroy() {this.destroyed=true;}};
    animations.push(animation); return animation;
  }};
  const document = {...target(),hidden:false,createElement:() => ({remove(){this.removed=true;}}),
    head:{append(script) {scripts.push(script);queueMicrotask(() => {context.lottie=player;script.onload?.();});}}};
  const context = vm.createContext({document,matchMedia:() => motion,AbortController,JSON,Promise,Map,Set,
    setTimeout(fn) {const id=++timerId;timers.set(id,fn);return id;},clearTimeout(id) {timers.delete(id);},
    fetch(url) {
      requests.push(url);
      const response={ok:!failData,json:async() => ({layers:[],tier:url})};
      return deferData ? new Promise(resolve => {resolveData=()=>resolve(response);}) : Promise.resolve(response);
    }});
  vm.runInContext(source,context);
  return {api:context.TrophyMotion,host,button,label,motion,document,animations,scripts,requests,timers,
    finishData:()=>resolveData(),allowData:()=>{failData=false;},player};
}

test('player and JSON are not loaded while browsing the profile cards', () => {
  const h=harness(); assert.equal(h.scripts.length,0);assert.equal(h.requests.length,0);
});
test('detail loads one vector player and replay reuses it without fetching again', async () => {
  const h=harness(); h.api.mount(h.host,'gold',h.button);await flush();
  assert.equal(h.animations.length,1); const a=h.animations[0];
  assert.equal(a.options.renderer,'svg');assert.equal(a.options.loop,false);assert.equal(a.options.autoplay,false);
  assert.equal(h.host.dataset.motionState,'loading');
  a.emit('DOMLoaded');assert.equal(h.host.dataset.motionState,'playing');assert.equal(a.plays,1);
  a.emit('complete');assert.equal(h.host.dataset.motionState,'ready');
  h.button.emit('click');assert.equal(a.plays,2);assert.equal(h.requests.length,1);assert.equal(h.scripts.length,1);
  h.api.destroy();assert.ok(a.destroyed);assert.equal(h.button.listeners.size,0);assert.equal(h.document.listeners.size,0);assert.equal(h.motion.listeners.size,0);
});
test('closing before JSON arrives cannot attach an invisible background animation', async () => {
  const h=harness({deferData:true});h.api.mount(h.host,'silver',h.button);await flush();
  h.api.destroy();h.finishData();await flush();assert.equal(h.animations.length,0);assert.equal(h.host.dataset.motionState,'static');
});
test('opening another trophy destroys the previous animation; old callbacks are ignored', async () => {
  const h=harness();h.api.mount(h.host,'bronze',h.button);await flush();const old=h.animations[0];old.emit('DOMLoaded');
  h.api.mount(h.host,'platinum',h.button);await flush();const next=h.animations[1];
  assert.ok(old.destroyed);old.emit('DOMLoaded');old.emit('complete');assert.equal(h.host.dataset.motionState,'loading');
  next.emit('DOMLoaded');assert.equal(h.host.dataset.motionState,'playing');assert.equal(h.scripts.length,1);h.api.destroy();
});
test('reduced motion shows the sharp static poster without fetching until an explicit replay', async () => {
  const h=harness({reduced:true});h.api.mount(h.host,'platinum',h.button);await flush();
  assert.equal(h.requests.length,0);assert.equal(h.scripts.length,0);assert.equal(h.host.dataset.motionState,'static');
  h.button.emit('click');await flush();h.animations[0].emit('DOMLoaded');assert.equal(h.animations[0].plays,1);h.api.destroy();
});
test('visibility changes pause only a playing animation; reduced motion stops it at a visible frame', async () => {
  const h=harness();h.api.mount(h.host,'gold',h.button);await flush();const a=h.animations[0];a.emit('DOMLoaded');
  h.document.hidden=true;h.document.emit('visibilitychange');assert.equal(a.pauses,1);
  h.document.hidden=false;h.document.emit('visibilitychange');assert.equal(a.plays,2);
  h.motion.matches=true;h.motion.emit('change');assert.equal(a.frame,120);assert.equal(h.host.dataset.motionState,'ready');
  h.document.emit('visibilitychange');assert.equal(a.plays,2);h.api.destroy();
});
test('failed data keeps the vector poster and allows a clean retry', async () => {
  const h=harness({failData:true});h.api.mount(h.host,'gold',h.button);await flush();
  assert.equal(h.host.dataset.motionState,'fallback');assert.equal(h.animations.length,0);
  h.allowData();h.button.emit('click');await flush();assert.equal(h.requests.length,2);
  h.animations[0].emit('DOMLoaded');assert.equal(h.host.dataset.motionState,'playing');h.api.destroy();
});
test('render errors and missing DOMLoaded restore the poster and ignore late events', async () => {
  for (const failure of ['error','timeout']) {
    const h=harness();h.api.mount(h.host,'silver',h.button);await flush();const a=h.animations[0];
    if(failure==='error') a.emit('error'); else [...h.timers.values()].forEach(fn=>fn());
    assert.ok(a.destroyed);assert.equal(h.host.dataset.motionState,'fallback');
    a.emit('DOMLoaded');a.emit('complete');assert.equal(h.host.dataset.motionState,'fallback');h.api.destroy();
  }
});
test('unknown tiers cannot request arbitrary assets', async () => {
  const h=harness();h.api.mount(h.host,'../../invalid',h.button);await flush();assert.equal(h.requests.length,0);
});
test('unlock controller uses dedicated assets and cannot destroy the detail player', async () => {
  const h=harness();h.api.mount(h.host,'gold',h.button);await flush();const detail=h.animations[0];detail.emit('DOMLoaded');
  const celebration=h.api.createController({unlock:true});
  const host={dataset:{},isConnected:true,querySelector:()=>({})};
  celebration.mount(host,'platinum');await flush();const unlock=h.animations[1];unlock.emit('DOMLoaded');
  assert.ok(h.requests.at(-1).includes('platinum-unlock.json'));assert.equal(unlock.plays,1);assert.equal(detail.destroyed,false);
  celebration.destroy();assert.equal(unlock.destroyed,true);assert.equal(detail.destroyed,false);h.api.destroy();
});

test('all four animations are distinct self-contained vector scenes, with a visible final frame', async () => {
  const motions=new Set(), designs=new Set();
  for (const tier of ['bronze','silver','gold','platinum']) {
    const svg=await readFile(new URL(`../icons/trophies/${tier}.svg`,import.meta.url),'utf8');
    const data=JSON.parse(await readFile(new URL(`../icons/trophies/${tier}.json`,import.meta.url),'utf8'));
    assert.ok(svg.includes('viewBox="0 0 512 512"'));assert.ok(!/<image|<text|base64/.test(svg));
    assert.equal(data.fr,60);assert.equal(data.w,512);assert.equal(data.h,512);assert.equal(data.op,181);assert.equal(data.assets.length,0);
    const trophy=data.layers.find(layer=>layer.nm==='trophy');
    assert.equal(trophy.ks.o.k.at(-1).s[0],100);assert.equal(trophy.shapes[0].nm,'Rank engraving');
    assert.equal(trophy.shapes.at(-1).nm,'Contact shadow');
    motions.add(JSON.stringify(trophy.ks));designs.add(svg);
    for (const layer of data.layers) for (const group of layer.shapes) {
      const path=group.it.find(item=>item.ty==='sh').ks.k;
      assert.equal(path.v.length,path.i.length);assert.equal(path.v.length,path.o.length);
      assert.ok([...path.v,...path.i,...path.o].flat().every(Number.isFinite));
    }
  }
  assert.equal(motions.size,4);assert.equal(designs.size,4);
});

test('all trophy resources have matching offline URLs and reach the native bundle', async () => {
  const root=new URL('../',import.meta.url);
  const shellContext=vm.createContext({self:{addEventListener(){}}});
  vm.runInContext(await readFile(new URL('service-worker.js',root),'utf8')+';globalThis.shell=APP_SHELL;',shellContext);
  const html=await readFile(new URL('index.html',root),'utf8');
  assert.ok(html.indexOf('trophy-motion.js') < html.indexOf('<script src="app.js'));
  assert.ok(!html.includes('<script src="vendor/lottie-light'));
  const resources=['trophy-motion.js?v=20260904-150','vendor/lottie-light.min.js?v=5.13.0',
    ...['bronze','silver','gold','platinum'].flatMap(tier=>['svg','json'].map(ext=>`icons/trophies/${tier}.${ext}?v=20260903-132`))];
  for (const url of resources) {
    assert.ok(shellContext.shell.includes('./'+url),url);
    const path=url.split('?')[0];
    assert.deepEqual(await readFile(new URL(path,root)),await readFile(new URL('ios/App/App/public/'+path,root)),path);
  }
});
