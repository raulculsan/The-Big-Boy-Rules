import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const context = {Math, Object, Number};
context.globalThis = context;
vm.runInNewContext(fs.readFileSync(path.join(root, 'chota-cloth.js'), 'utf8'), context);
const C = context.ChotaCloth, rest = {x: 0, y: 0, vx: 0, vy: 0};
const run = (state, frames, dx = 0, dy = 0) => { for (let i = 0; i < frames; i++) state = C.step(state, dx, dy); return state; };

test('cloth trails the body, overshoots when it stops and always comes to rest', () => {
  let state = run(rest, 12, 2, 0);
  assert.ok(state.x < -.5, 'moving right leaves the hem behind, to the left');
  let overshoot = false;
  for (let i = 0; i < 60; i++) { state = C.step(state); if (state.x > .05) overshoot = true; }
  assert.ok(overshoot, 'it swings past centre after the stop');
  assert.ok(C.resting(run(state, 120)), 'and settles');
});

test('the spring is bounded however violent the motion', () => {
  let state = rest;
  for (let i = 0; i < 300; i++) { state = C.step(state, i % 7 ? 40 : -90, i % 5 ? -60 : 80); assert.ok(Math.abs(state.x) <= 7 && Math.abs(state.y) <= 7); }
  assert.ok(Number.isFinite(state.vx) && Number.isFinite(state.vy));
});

test('resting cloth is exactly the sprite: no lean, no stretch', () => {
  const {lean, stretch} = C.pose(rest);
  assert.equal(lean, 0); assert.equal(stretch, 1);
  assert.equal(C.pose(rest).transform, 'skewX(0.00deg) scaleY(1.0000)');
});

test('the lean stays subtle and flips with a mirrored Chota', () => {
  const far = {x: -7, y: 7, vx: 0, vy: 0}, normal = C.pose(far), mirrored = C.pose(far, true);
  assert.ok(Math.abs(normal.lean) < 6, 'under six degrees');
  assert.ok(normal.stretch <= 1.06 && normal.stretch >= .94);
  assert.equal(mirrored.lean, -normal.lean);
  assert.ok(normal.lean < 0, 'hem to the left of the neck leans left');
});

test('every pose of the five sheets has a torso centre, and pose changes give bounded impulses', () => {
  const counts = {base: 24, directional: 20, contextual: 16, room: 4, talk: 3};
  for (const [sheet, count] of Object.entries(counts)) {
    assert.equal(C.CENTERS[sheet].length, count, sheet);
    for (const centre of C.CENTERS[sheet]) assert.ok(centre[0] > 40 && centre[0] < 216 && centre[1] > 60 && centre[1] < 230);
  }
  assert.deepEqual([...C.poseDelta('base', 0, 'talk', 0)], [0, 0], 'changing sheet is not a movement');
  const [dx, dy] = C.poseDelta('base', 12, 'base', 14);
  assert.ok(Math.abs(dx) <= 14 && Math.abs(dy) <= 14);
  assert.ok(dy < 0, 'the jump frame lifts the torso');
});

test('the module ships with the app and loads before the wardrobe', () => {
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(index, /chota-cloth\.js\?v=/);
  assert.ok(index.indexOf('chota-cloth.js') < index.indexOf('chota-wardrobe.js?v='));
  assert.match(fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8'), /chota-cloth\.js\?v=/);
  assert.match(fs.readFileSync(path.join(root, 'scripts/build-web.mjs'), 'utf8'), /"chota-cloth\.js"/);
  assert.match(fs.readFileSync(path.join(root, 'chota-wardrobe.css'), 'utf8'), /prefers-reduced-motion:reduce\)\{\.chota-cloth/);
});
