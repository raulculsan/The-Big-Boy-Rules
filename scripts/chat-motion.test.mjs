import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import '../chat-motion.js';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const {position, duration} = globalThis.ChatMotion;
const source = read('app.js');

test('chat and inbox share continuous, clamped positions in both directions', () => {
  assert.deepEqual(position(0, 390), {offset:0, listOffset:-24});
  assert.deepEqual(position(195, 390), {offset:195, listOffset:-12});
  assert.deepEqual(position(390, 390), {offset:390, listOffset:0});
  assert.deepEqual(position(-30, 390), position(0, 390));
  assert.deepEqual(position(900, 390), position(390, 390));
  assert.ok(Number.isFinite(position(0, 0).listOffset));
});

test('full movement matches 15 Lottie frames and short releases settle sooner', () => {
  assert.equal(duration(390, 390), 15 / 60 * 1000);
  assert.ok(duration(60, 390) < duration(195, 390));
  assert.equal(duration(0, 390), 0);
  assert.equal(duration(390, 390, true), 0);
  assert.equal(duration(900, 390), 250);
});

function transitionHarness({mobile = true, reduced = false} = {}) {
  const calls = [];
  let release;
  const finished = new Promise(resolve => { release = resolve; });
  const context = vm.createContext({
    isMobileSidebar: () => mobile,
    window: {matchMedia: () => ({matches:reduced})},
    document: {body:{classList:{contains:cls => cls === 'chat-inbox-view'}}, querySelector: () => ({})},
    prepareChatBackScene: (panel, options) => {
      calls.push(['prepare', options.entering]);
      return {width:390, panel:{classList:{add:() => {}}}};
    },
    settleChatBackScene: (scene, target) => { calls.push(['animate',target]); return finished; },
    dismissChatComposerKeyboard: async options => calls.push(['keyboard', options.navigation]),
    cleanupChatBackScene: () => calls.push(['cleanup'])
  });
  const fn = source.match(/async function transitionMessageView\(update, \{back = false\} = \{\}\) \{[\s\S]*?\n\}/)[0];
  vm.runInContext(`let messageViewTransitioning = false; ${fn}`, context);
  return {calls, release, run: options => context.transitionMessageView(() => calls.push(['update']), options)};
}

test('opening composes chat before animating and ignores overlapping taps', async () => {
  const h = transitionHarness();
  const pending = h.run();
  await h.run();
  assert.deepEqual(h.calls, [['update'], ['prepare',true], ['animate',0]]);
  h.release();
  await pending;
  assert.deepEqual(h.calls.at(-1), ['cleanup']);
});

test('back commits the inbox only after the live panel has moved away', async () => {
  const h = transitionHarness();
  const pending = h.run({back:true});
  assert.deepEqual(h.calls, [['prepare',false], ['animate',390]]);
  h.release();
  await pending;
  assert.deepEqual(h.calls, [['prepare',false], ['animate',390], ['keyboard',true], ['update'], ['cleanup']]);
});

test('desktop and reduced motion update without waiting on animation', async () => {
  for (const options of [{mobile:false}, {reduced:true}]) {
    const h = transitionHarness(options);
    await h.run({back:true});
    assert.deepEqual(h.calls, [['keyboard',true], ['update'], ['cleanup']]);
  }
});

test('global header is hidden and inbox geometry is not transition-dependent', () => {
  assert.match(read('club.css'), /body\.authenticated\.chat-focus \.topbar \{ display: none; \}/);
  const css = read('chat.css');
  assert.match(css, /body\.authenticated:is\(\.chat-inbox-view, \.chat-focus\) #chat \.chat-inbox/);
  assert.match(css, /height: calc\(var\(--chat-viewport-height, 100dvh\) - var\(--pwa-safe-top/);
  assert.doesNotMatch(read('styles.css'), /chat-back-list-preview|chat-back-group-preview/);
  assert.doesNotMatch(source.match(/function prepareChatBackScene[\s\S]*?\n\}/)[0], /cloneNode|innerHTML|offsetHeight/);
});

test('keyboard return keeps outgoing geometry fixed and cancellation restores inline sizes', () => {
  const style = initial => ({height:initial,setProperty(){},removeProperty(name){if(name==='height')this.height='';}});
  const classes = new Set(['chat-keyboard-open']);
  const panel = {style:style(''),classList:{add(){},remove(){}},
    closest:()=>null,getBoundingClientRect:()=>({width:390,height:463,top:47})};
  const preview = {style:style('100%'),getBoundingClientRect:()=>({top:47})};
  const context=vm.createContext({
    ChatMotion:globalThis.ChatMotion,mobileViewportBaseline:844,window:{innerWidth:390},
    document:{body:{classList:{contains:name=>classes.has(name),add:name=>classes.add(name),remove:name=>classes.delete(name)}},querySelector:()=>preview}
  });
  const functions=['prepareChatBackScene','updateChatBackScene','cleanupChatBackScene']
    .map(name=>source.match(new RegExp(`function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?\\n\\}`))[0]).join('\n');
  vm.runInContext(`let activeChatMotionScene=null;${functions}`,context);
  const scene=context.prepareChatBackScene(panel);
  assert.equal(panel.style.height,'463px');
  assert.equal(preview.style.height,'797px');
  context.cleanupChatBackScene(scene);
  assert.equal(panel.style.height,'');
  assert.equal(preview.style.height,'100%');
  assert.equal(classes.has('chat-back-transition-active'),false);
});

test('chat motion assets are bundled, cached and served locally', () => {
  for (const path of ['index.html','service-worker.js','scripts/build-web.mjs','scripts/live-server.mjs','scripts/preview-club.mjs']) {
    const file = read(path);
    assert.ok(file.includes('chat-motion.js') && file.includes('chat.css'), path);
  }
});

function gestureHarness({kind = 'private', sceneAvailable = true} = {}) {
  const calls = [];
  const frames = new Map();
  let nextFrame = 0;
  const panel = {
    closest: selector => selector === '#privados' && kind === 'private' ? {} : null,
    setPointerCapture: () => calls.push(['capture']),
    hasPointerCapture: () => true,
    releasePointerCapture: () => calls.push(['release'])
  };
  const target = {closest: selector => selector.includes('message-form') ? null : selector.includes('.conversation') ? panel : {}};
  const context = vm.createContext({
    performance: {now: () => 0},
    isMobileSidebar: () => true,
    activePrivateMemberId: 1,
    activeChatChannelId: 'general',
    requestAnimationFrame: callback => {frames.set(++nextFrame, callback); return nextFrame;},
    cancelAnimationFrame: id => frames.delete(id),
    prepareChatBackScene: () => sceneAvailable ? {width:390, kind} : null,
    updateChatBackScene: (_, x) => calls.push(['offset', x]),
    settleChatBackScene: async (_, x) => {calls.push(['settle', x]);},
    cleanupChatBackScene: () => calls.push(['cleanup']),
    completeChatBackDestination: kind => calls.push(['destination', kind]),
    window: {setTimeout: callback => callback()},
    document: {addEventListener: (_, callback) => {context.cancel = callback;}}
  });
  const names = ['resetChatBackGesture', 'startChatBackGesture', 'sampleChatBackGesture', 'moveChatBackGesture', 'finishChatBackGesture'];
  const functions = names.map(name => source.match(new RegExp(`(?:async )?function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?\\n\\}`))[0]).join('\n');
  const constants = source.match(/const CHAT_BACK_GESTURE = Object.freeze\(\{[\s\S]*?\n\}\);/)[0];
  const cancelListener = source.match(/document.addEventListener\("pointercancel", event => \{[\s\S]*?\n\}, \{passive: true\}\);/)[0];
  vm.runInContext(`${constants}\nlet chatBackGesture = null, messageViewTransitioning = false, suppressChatGestureClick = false;\n${functions}\n${cancelListener}`, context);
  const event = (x, y, time, extra = {}) => ({pointerId:1, pointerType:'touch', isPrimary:true, clientX:x, clientY:y, timeStamp:time, target, cancelable:true, preventDefault:() => calls.push(['preventDefault']), ...extra});
  return {
    calls,
    start: (extra = {}) => context.startChatBackGesture(event(20, 200, 0, extra)),
    move: (x, y, time) => context.moveChatBackGesture(event(x, y, time)),
    finish: (x, y, time) => context.finishChatBackGesture(event(x, y, time)),
    cancel: pointerId => context.cancel({pointerId}),
    state: () => vm.runInContext('({active:!!chatBackGesture, transitioning:messageViewTransitioning, suppressed:suppressChatGestureClick})', context),
    completed: () => calls.some(call => call[0] === 'destination')
  };
}

for (const kind of ['private', 'group']) {
  test(`${kind}: horizontal intent stays locked through diagonal drift and final release coordinates`, async () => {
    const h = gestureHarness({kind});
    h.start();
    h.move(42, 204, 40);
    h.move(82, 265, 170);
    await h.finish(115, 280, 300);
    assert.equal(h.completed(), true);
    assert.ok(h.calls.some(call => call[0] === 'offset' && call[1] === 95));
    assert.deepEqual(h.calls.filter(call => call[0] === 'destination'), [['destination', kind]]);
    assert.equal(h.state().transitioning, false);
  });

  test(`${kind}: short horizontal flick uses recent speed, despite a noisy last move`, async () => {
    const h = gestureHarness({kind});
    h.start();
    h.move(45, 202, 35);
    h.move(75, 206, 65);
    h.move(76, 206, 70);
    await h.finish(76, 206, 75);
    assert.equal(h.completed(), true);
  });
}

test('tap, vertical scroll, initial left drag, and tiny fast drag cannot navigate', async () => {
  for (const [x, y, time] of [[22,200,1], [28,235,40], [-10,200,40], [32,200,10]]) {
    const h = gestureHarness();
    h.start();
    h.move(x, y, time);
    await h.finish(x, y, time + 1);
    assert.equal(h.completed(), false);
    assert.equal(h.state().transitioning, false);
  }
});

test('slow partial drag and a paused short flick settle back with no stale velocity', async () => {
  for (const releaseTime of [180, 400]) {
    const h = gestureHarness();
    h.start();
    h.move(40, 201, 30);
    h.move(75, 205, releaseTime === 400 ? 70 : 150);
    await h.finish(75, 205, releaseTime);
    assert.equal(h.completed(), false);
    assert.ok(h.calls.some(call => call[0] === 'settle' && call[1] === 0));
    await Promise.resolve();
    assert.equal(h.state().transitioning, false);
  }
});

test('deliberately pulling back cancels after crossing completion distance', async () => {
  const h = gestureHarness();
  h.start();
  h.move(150, 210, 100);
  h.move(120, 214, 150);
  await h.finish(120, 214, 160);
  assert.equal(h.completed(), false);
  assert.ok(h.calls.some(call => call[0] === 'settle' && call[1] === 0));
});

test('OS cancellation cleans up and unrelated pointer cancellation preserves the active drag', async () => {
  const h = gestureHarness();
  h.start();
  h.move(90, 204, 50);
  h.cancel(2);
  assert.equal(h.state().active, true);
  h.cancel(1);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(h.state().active, false);
  assert.equal(h.state().transitioning, false);
  assert.equal(h.completed(), false);
  assert.ok(h.calls.some(call => call[0] === 'cleanup'));
});

test('interactive controls, mouse gestures, and unavailable scenes do not block chat', () => {
  for (const extra of [{pointerType:'mouse'}, {isPrimary:false}, {target:{closest:() => ({})}}]) {
    const h = gestureHarness();
    h.start(extra);
    assert.equal(h.state().active, false);
  }
  const h = gestureHarness({sceneAvailable:false});
  h.start();
  h.move(45, 202, 40);
  assert.equal(h.state().active, false);
  assert.equal(h.state().transitioning, false);
});
