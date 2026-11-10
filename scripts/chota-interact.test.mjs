import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
function load() {
  const context = {globalThis: null, performance: {now: () => 0}, setTimeout, Date, Number, Math, Object, Infinity};
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'chota-interact.js'), 'utf8'), context);
  return context.ChotaInteract;
}
const I = load();

test('a tap on the room resolves to the furniture under it, the floor or nothing', () => {
  assert.equal(I.zoneAt(.9, .2), 'window');
  assert.equal(I.zoneAt(.1, .62), 'sofa');
  assert.equal(I.zoneAt(.5, .8), 'floor');
  assert.equal(I.zoneAt(.5, .2), null, 'the wall is not a destination');
  assert.equal(I.zoneAt(.5, .99), null, 'below the walkable floor');
  assert.equal(I.zoneAt(.4, .3, {board: {x0: .3, y0: .2, x1: .6, y1: .45}}), 'board');
  assert.equal(I.zoneAt(NaN, .5), null);
});

test('he reacts to where he is touched, and insistence wins over place', () => {
  assert.equal(I.touchReaction({part: .2, taps: 1}), 'happy');
  assert.equal(I.touchReaction({part: .6, taps: 1}), 'greet');
  assert.equal(I.touchReaction({part: .95, taps: 2}), 'shoes');
  assert.equal(I.touchReaction({part: .2, taps: 4}), 'annoyed');
  assert.equal(I.touchReaction(), 'greet');
});

test('only recent taps count as insistence', () => {
  assert.equal(I.tapCount([0, 500, 1000, 1500], 1600), 4);
  assert.equal(I.tapCount([0, 500, 9000], 9100), 1);
  assert.equal(I.tapCount([], 100), 0);
});

test('one welcome per visit, warmer after days away, sleepy late', () => {
  const now = Date.UTC(2026, 10, 10, 12), minute = 60000, day = 24 * 60 * minute;
  assert.equal(I.welcomeKind({lastVisit: now - 2 * minute, now, hour: 13}), null, 'just here: no repeat');
  assert.equal(I.welcomeKind({lastVisit: now - 3 * 60 * minute, now, hour: 13}), 'greet');
  assert.equal(I.welcomeKind({lastVisit: now - 4 * day, now, hour: 13}), 'excited');
  assert.equal(I.welcomeKind({lastVisit: now - 3 * 60 * minute, now, hour: 23}), 'sleepy');
  assert.equal(I.welcomeKind({lastVisit: null, now, hour: 13}), 'greet', 'first visit ever is a plain hello');
});

test('the season sets his mood; missing data leaves him calm', () => {
  assert.equal(I.moodFrom({money: 50, fame: 50, energy: 20, trouble: 80}), 'tired', 'exhaustion comes first');
  assert.equal(I.moodFrom({money: 50, fame: 50, energy: 60, trouble: 80}), 'restless');
  assert.equal(I.moodFrom({money: 80, fame: 70, energy: 60, trouble: 20}), 'happy');
  assert.equal(I.moodFrom({money: 50, fame: 50, energy: 50, trouble: 15}), 'calm');
  assert.equal(I.moodFrom(null), 'calm');
  assert.equal(I.moodFrom({}), 'calm');
});

test('a mood only nudges his routine and calm adds nothing', () => {
  assert.equal(I.moodAction('calm', 0), null);
  assert.equal(I.moodAction('tired', .1), 'rest');
  assert.equal(I.moodAction('tired', .7), 'sofa');
  assert.equal(I.moodAction('tired', .95), null);
  assert.equal(I.moodAction('restless', .1), 'pace');
  assert.equal(I.moodAction('happy', .1), 'jump');
  assert.equal(I.moodAction('happy', .99), null);
});

test('the module ships everywhere and never introduces a yellow highlight', () => {
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8'), worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8'), build = fs.readFileSync(path.join(root, 'scripts/build-web.mjs'), 'utf8');
  assert.match(index, /chota-interact\.js\?v=/);
  assert.match(worker, /chota-interact\.js\?v=/);
  assert.match(build, /"chota-interact\.js"/);
  assert.ok(index.indexOf('chota-interact.js') < index.indexOf('<script defer src="app.js'), 'loads before the engine');
  const css = fs.readFileSync(path.join(root, 'clubhouse.css'), 'utf8').match(/\.chota-go-mark[^}]*}/g)?.join('') || '';
  assert.ok(css, 'the go mark is styled');
  assert.doesNotMatch(css, /gold|yellow|orange/i);
  for (const [, hex] of css.matchAll(/#([0-9a-f]{6})(?:[0-9a-f]{2})?\b/gi)) {
    const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 12, `#${hex} is not a neutral tone`);
  }
});
