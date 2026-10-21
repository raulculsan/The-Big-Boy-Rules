import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function replyFixture() {
  const listeners = new Map(), frames = new Map(), timers = new Map(), styles = new Map(), classes = new Set();
  const calls = [];
  let serial = 0, capture = false, reads = 0;
  const bubble = {
    isConnected: true, dataset: {messageKind: 'group', messageId: '12'},
    style: {setProperty: (name, value) => styles.set(name, value), removeProperty: name => styles.delete(name)},
    classList: {add: name => classes.add(name), remove: (...names) => names.forEach(name => classes.delete(name)),
      toggle(name, active) { if (active) classes.add(name); else classes.delete(name); }},
    getBoundingClientRect() { reads++; return {width: 240}; },
    setPointerCapture() { capture = true; }, hasPointerCapture() { return capture; },
    releasePointerCapture() { capture = false; calls.push('release'); },
    closest(selector) { return selector === '[data-message-bubble]' ? bubble : null; }
  };
  const listen = (type, callback) => { const list = listeners.get(type) || []; list.push(callback); listeners.set(type, list); };
  const context = vm.createContext({
    document: {addEventListener: listen, getElementById: () => ({disabled: false})},
    window: {addEventListener: listen}, performance: {now: () => 10},
    requestAnimationFrame: callback => { frames.set(++serial, callback); return serial; },
    cancelAnimationFrame: id => frames.delete(id), setTimeout: callback => { timers.set(++serial, callback); return serial; },
    clearTimeout: id => timers.delete(id), messageMenuTarget: null, messageClickSuppression: null,
    cancelMessageHold() {}, selectChatReply(target) { calls.push(['reply', target.id, capture]); }
  });
  vm.runInContext(source.slice(source.indexOf('let messageReplyGesture = null;'), source.indexOf('// Message actions use a stationary hold')), context);
  const fire = (type, overrides = {}) => {
    const event = {target: bubble, button: 0, buttons: 1, isPrimary: true, pointerId: 1, clientX: 0, clientY: 0, cancelable: true, preventDefault() {}, ...overrides};
    for (const listener of listeners.get(type) || []) listener(event);
  };
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); };
  return {bubble, context, fire, flush, frames, timers, styles, classes, calls, get reads() { return reads; }};
}

test('reply coalesces high-frequency drag samples and releases capture before selecting', () => {
  const f = replyFixture();
  f.fire('pointerdown');
  for (let i = 12; i < 212; i++) f.fire('pointermove', {clientX: i});
  assert.equal(f.reads, 1);
  assert.equal(f.frames.size, 1);
  assert.equal(f.styles.size, 0, 'no per-event style writes before animation frame');
  f.flush();
  assert.ok(Number(f.styles.get('--message-reply-scale')) > 1.2, 'bubble visibly deforms');
  f.fire('pointerup', {clientX: 211});
  assert.deepEqual(f.calls, ['release', ['reply', '12', false]]);
  assert.ok(f.classes.has('is-reply-springing'));
  assert.equal(f.frames.size, 0);
  for (const callback of f.timers.values()) callback();
  assert.equal(f.classes.has('is-reply-springing'), false);
  assert.equal(f.styles.size, 0);
});

test('vertical scrolling and backward drags never select a reply', () => {
  for (const coordinates of [{clientX: 3, clientY: 30}, {clientX: -20}]) {
    const f = replyFixture(); f.fire('pointerdown'); f.fire('pointermove', coordinates); f.fire('pointerup');
    assert.equal(f.calls.length, 0); assert.equal(f.frames.size, 0);
  }
});

test('cancel, lost capture, detached message and second finger clean up without replying', () => {
  for (const cancel of ['pointercancel', 'lostpointercapture', 'detached', 'multitouch']) {
    const f = replyFixture(); f.fire('pointerdown'); f.fire('pointermove', {clientX: 90});
    if (cancel === 'detached') { f.bubble.isConnected = false; f.fire('pointermove', {clientX: 95}); }
    else if (cancel === 'multitouch') f.fire('pointerdown', {isPrimary: false, pointerId: 2});
    else f.fire(cancel);
    f.fire('pointerup');
    assert.equal(f.calls.filter(call => Array.isArray(call)).length, 0, cancel);
    assert.equal(f.frames.size, 0, cancel);
    assert.equal(f.classes.has('is-reply-dragging'), false, cancel);
  }
});

test('unrelated pointer release cannot commit the current reply', () => {
  const f = replyFixture(); f.fire('pointerdown'); f.fire('pointermove', {clientX: 80});
  f.fire('pointerup', {pointerId: 2}); assert.equal(f.calls.length, 0);
  f.fire('pointerup', {clientX: 80}); assert.equal(f.calls.filter(call => Array.isArray(call)).length, 1);
});

test('realtime refresh replaces pending scroll work instead of accumulating media callbacks', () => {
  const frames = new Map(), timers = new Map(), listeners = [];
  let serial = 0;
  const addEventListener = (type, callback, options) => listeners.push({type, callback, signal: options.signal, removed: false});
  const pendingImage = {tagName: 'IMG', complete: false, addEventListener};
  const container = {
    isConnected: true, dataset: {}, scrollTop: 0, scrollHeight: 900, clientHeight: 400,
    querySelectorAll: () => [pendingImage], addEventListener,
    removeEventListener(type, callback) { listeners.filter(item => item.type === type && item.callback === callback).forEach(item => {item.removed = true;}); }
  };
  const context = vm.createContext({AbortController,
    requestAnimationFrame: callback => { frames.set(++serial, callback); return serial; },
    cancelAnimationFrame: id => frames.delete(id), setTimeout: callback => { timers.set(++serial, callback); return serial; },
    clearTimeout: id => timers.delete(id)
  });
  vm.runInContext(source.slice(source.indexOf('const chatLatestScrollWork = new WeakMap();'), source.indexOf('\nfunction renderChatChannels()')), context);
  for (let i = 0; i < 1000; i++) context.scrollConversationToLatest(container);
  assert.equal(frames.size, 1); assert.equal(timers.size, 1);
  assert.equal(listeners.filter(item => !item.removed && !item.signal.aborted).length, 2, 'only latest scroll listener and pending image listener remain');
  container.scrollTop = 0;
  listeners.findLast(item => item.type === 'scroll').callback();
  assert.equal(frames.size, 0); assert.equal(timers.size, 0);
  assert.equal(listeners.filter(item => !item.removed && !item.signal.aborted).length, 0);
});
