// Fit audit for every tailored garment in all 67 poses. It catches, before a
// release, the defects the member used to find by eye: holes when a garment
// comes off, garments that do not share one silhouette, fur recoloured as
// cloth, and logos swallowed by a pose. See docs/chota/ROPA.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {loadSharp} from '../artwork/chota/wardrobe-rig-v1/load-sharp.mjs';

const root = path.resolve(import.meta.dirname, '..'), dir = path.join(root, 'icons/mascot/chota-v2');
const sharp = await loadSharp();
const poses = JSON.parse(fs.readFileSync(path.join(root, 'artwork/chota/wardrobe-rig-v1/poses.json'), 'utf8'));
const grids = {base: ['chota-poses.webp', 6], directional: ['chota-directional-v1.webp', 5], contextual: ['chota-contextual-v1.webp', 4], room: ['chota-room-life-v1.webp', 4], talk: ['chota-talk.webp', 3]};
const tops = ['original-stussy', 'carhartt-crudo', 'carhartt-oliva', 'supreme-negra', 'supreme-roja', 'stussy-blanca', 'stussy-azul', 'supreme-negra-flip', 'supreme-roja-flip'];
const bottoms = ['original-jeans', 'carhartt-marron', 'carhartt-azul-oscuro', 'carhartt-marron-flip', 'carhartt-azul-oscuro-flip'];
const cache = new Map();
async function sheet(file) {
  if (!cache.has(file)) cache.set(file, await sharp(path.join(dir, file)).ensureAlpha().raw().toBuffer({resolveWithObject: true}));
  return cache.get(file);
}
// Visits every pixel of every pose once: fn(pose, pixelIndexInSheet, x, y).
function eachPose(sheetName, fn) {
  const cols = grids[sheetName][1];
  for (const pose of poses.filter(p => p.sheet === sheetName)) {
    const ox = pose.frame % cols * 256, oy = Math.floor(pose.frame / cols) * 256;
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) fn(pose, ((oy + y) * cols * 256 + ox + x) * 4, x, y);
  }
}
const on = (image, i) => image.data[i + 3] >= 128;

test('every drawn pixel has exactly one owner: body or one of the three original garments', async () => {
  for (const name of Object.keys(grids)) {
    const source = await sheet(grids[name][0]), parts = await Promise.all(['anatomy', 'original-stussy', 'original-jeans', 'original-jordan-chicago'].map(key => sheet(`tailored-v5/${key}-${name}.webp`)));
    let missing = 0, shared = 0, extra = 0;
    eachPose(name, (pose, i) => { const owners = parts.filter(part => on(part, i)).length; if (on(source, i)) { if (!owners) missing++; if (owners > 1) shared++; } else if (owners) extra++; });
    assert.deepEqual({missing, shared, extra}, {missing: 0, shared: 0, extra: 0}, name);
  }
});

test('all shirts share one silhouette per pose, and so do all trousers', async () => {
  for (const name of Object.keys(grids)) for (const family of [tops, bottoms]) {
    const reference = await sheet(`tailored-v5/${family[0]}-${name}.webp`);
    for (const key of family.slice(1)) {
      const garment = await sheet(`tailored-v5/${key}-${name}.webp`);
      let different = 0;
      eachPose(name, (pose, i) => { if (on(reference, i) !== on(garment, i)) different++; });
      assert.equal(different, 0, `${key} ${name}`);
    }
  }
});

test('taking a garment off leaves fur, never a hole inside the body', async () => {
  const holes = [];
  for (const name of Object.keys(grids)) {
    const layers = await Promise.all(['anatomy', 'bare-topwear', 'bare-bottomwear', 'bare-footwear'].map(key => sheet(`tailored-v5/${key}-${name}.webp`)));
    const source = await sheet(grids[name][0]);
    const cols = grids[name][1];
    for (const pose of poses.filter(p => p.sheet === name)) {
      const ox = pose.frame % cols * 256, oy = Math.floor(pose.frame / cols) * 256, solid = new Uint8Array(65536), seen = new Uint8Array(65536);
      for (let k = 0; k < 65536; k++) { const i = ((oy + (k >> 8)) * cols * 256 + ox + k % 256) * 4; solid[k] = layers.some(layer => on(layer, i)) ? 1 : 0; }
      let enclosed = 0;
      for (let start = 0; start < 65536; start++) {
        if (solid[start] || seen[start]) continue;
        const queue = [start]; seen[start] = 1; let edge = false;
        for (let j = 0; j < queue.length; j++) { const k = queue[j], x = k % 256, y = k >> 8; if (!x || !y || x === 255 || y === 255) edge = true; for (const n of [x ? k - 1 : -1, x < 255 ? k + 1 : -1, y ? k - 256 : -1, y < 255 ? k + 256 : -1]) if (n >= 0 && !solid[n] && !seen[n]) { seen[n] = 1; queue.push(n); } }
        // A gap the artist left open (arm akimbo) is not a hole; a drawn pixel gone missing is.
        if (!edge) enclosed += queue.filter(k => on(source, ((oy + (k >> 8)) * cols * 256 + ox + k % 256) * 4)).length;
      }
      holes.push([name, pose.frame, enclosed]);
    }
  }
  assert.deepEqual(holes.filter(([, , size]) => size > 0), []);
});

test('fur and paw pads are never part of a shirt or trousers', async () => {
  for (const name of Object.keys(grids)) {
    const source = await sheet(grids[name][0]), tee = await sheet(`tailored-v5/original-stussy-${name}.webp`), jeans = await sheet(`tailored-v5/original-jeans-${name}.webp`);
    const perPose = new Map();
    eachPose(name, (pose, i) => { if (!on(tee, i) && !on(jeans, i)) return; const r = source.data[i], g = source.data[i + 1], b = source.data[i + 2]; if (r > 150 && r - b > 30 && g > 90 && r >= g) perPose.set(pose.frame, (perPose.get(pose.frame) || 0) + 1); });
    assert.deepEqual([...perPose], [], `${name}: warm fur pixels labelled as cloth`);
  }
});

test('the Supreme box stays readable in every front pose, mirrored variant included', async () => {
  for (const key of ['supreme-roja', 'supreme-roja-flip']) for (const name of Object.keys(grids)) {
    const garment = await sheet(`tailored-v5/${key}-${name}.webp`), letters = new Map();
    eachPose(name, (pose, i) => { if (on(garment, i) && garment.data[i] > 215 && garment.data[i + 1] > 200 && garment.data[i + 2] > 200) letters.set(pose.frame, (letters.get(pose.frame) || 0) + 1); });
    for (const pose of poses.filter(p => p.sheet === name && !p.back)) assert.ok((letters.get(pose.frame) || 0) >= 20, `${key} ${name} ${pose.frame}: only ${letters.get(pose.frame) || 0} px of lettering`);
  }
});

test('the Carhartt patch is on the trousers in every standing, walking and seated pose', async () => {
  for (const key of ['carhartt-marron', 'carhartt-marron-flip']) for (const name of Object.keys(grids)) {
    const garment = await sheet(`tailored-v5/${key}-${name}.webp`), patch = new Map();
    eachPose(name, (pose, i) => { if (on(garment, i) && garment.data[i] > 190 && garment.data[i + 1] > 170 && garment.data[i + 2] > 130) patch.set(pose.frame, (patch.get(pose.frame) || 0) + 1); });
    // Lying down and asleep (base 21–23) the hip is hidden under him.
    for (const pose of poses.filter(p => p.sheet === name && !(name === "base" && p.frame >= 21))) assert.ok((patch.get(pose.frame) || 0) >= 4, `${key} ${name} ${pose.frame}: patch missing`);
  }
});
