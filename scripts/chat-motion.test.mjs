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
  assert.deepEqual(h.calls, [['prepare',false], ['animate',390], ['update'], ['cleanup']]);
});

test('desktop and reduced motion update without waiting on animation', async () => {
  for (const options of [{mobile:false}, {reduced:true}]) {
    const h = transitionHarness(options);
    await h.run({back:true});
    assert.deepEqual(h.calls, [['update'], ['cleanup']]);
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

test('chat motion assets are bundled, cached and served locally', () => {
  for (const path of ['index.html','service-worker.js','scripts/build-web.mjs','scripts/live-server.mjs','scripts/preview-club.mjs']) {
    const file = read(path);
    assert.ok(file.includes('chat-motion.js') && file.includes('chat.css'), path);
  }
});
