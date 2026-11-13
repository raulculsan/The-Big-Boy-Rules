// TNF coats v4: the v3 coats left the tee showing at the shoulders and the
// arms bare in many poses (crouch, landing, sitting, walking, arms up), which
// broke ROPA.md ("los abrigos tienen que seguir al brazo"). This extends every
// v3 cell, pose by pose, over:
//   - the tee silhouette (all tees share it), so no white shows under the coat;
//   - each arm, from the shoulder along the rig's arm line down to the cuff,
//     inside the drawn body only and never over the paw (hand circle + 6 px).
// New pixels take the colour of the nearest drawn coat pixel, so the quilting
// and shading continue; the new edge gets the coat's own outline colour.
// Head and paws stay on top in the app (foreground layer), as before.
//
//   node artwork/chota/coat-fit-v4/build.mjs        → icons/mascot/chota-v2/wardrobe/tnf-*-v4.webp
import fs from 'node:fs';
import path from 'node:path';
import {loadSharp} from '../wardrobe-rig-v1/load-sharp.mjs';

const sharp = await loadSharp();
const root = path.resolve(import.meta.dirname, '../../..');
const poses = JSON.parse(fs.readFileSync(path.join(root, 'artwork/chota/wardrobe-rig-v1/poses.json')));
const grids = {base: [6, 4], directional: [5, 4], contextual: [4, 4], room: [4, 1], talk: [3, 1]};
const colors = ['negro', 'crema', 'rojo', 'azul', 'oliva', 'morado'];
const CELL = 256, SLEEVE = 12, PAW = 6, BULK = 3, HEAD = .95;
const wardrobe = path.join(root, 'icons/mascot/chota-v2/wardrobe'), tailored = path.join(root, 'icons/mascot/chota-v2/tailored-v5');

async function raw(file) {
  const {data, info} = await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  return {data, width: info.width, height: info.height};
}
const at = (img, sheet, frame, x, y) => {
  const [cols] = grids[sheet], ox = frame % cols * CELL, oy = Math.floor(frame / cols) * CELL;
  return ((oy + y) * img.width + ox + x) * 4;
};
function segmentDistance(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

export async function buildSheet(color, sheet) {
  const coat = await raw(path.join(wardrobe, `tnf-${color}-${sheet}-v3.webp`));
  const [tee, anatomy, foreground, jeans] = await Promise.all([
    raw(path.join(tailored, `original-stussy-${sheet}.webp`)),
    raw(path.join(tailored, `anatomy-${sheet}.webp`)),
    raw(path.join(tailored, `foreground-${sheet}.webp`)),
    raw(path.join(tailored, `original-jeans-${sheet}.webp`)),
  ]);
  const out = Buffer.from(coat.data), coatForeground = {...foreground, data: Buffer.from(foreground.data)};
  const report = [];
  for (const pose of poses.filter(p => p.sheet === sheet)) {
    const f = pose.frame, owned = new Uint8Array(CELL * CELL), added = new Uint8Array(CELL * CELL);
    // Distance to the drawn body (fur, tee, trousers). The v3 sleeves of a
    // raised arm hang where the arm used to be: half-transparent ghosts or
    // slabs off the body. Those go; the sleeve is rebuilt along the arm.
    const near = new Uint8Array(CELL * CELL).fill(255), ring = [];
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
      const solid = [anatomy, tee, jeans].some(img => img.data[at(img, sheet, f, x, y) + 3] > 127);
      if (solid) { near[y * CELL + x] = 0; ring.push(y * CELL + x); }
    }
    for (let q = 0; q < ring.length; q++) {
      const k = ring[q], x = k % CELL, y = k >> 8;
      if (near[k] >= BULK) continue;
      for (const n of [x > 0 ? k - 1 : -1, x < 255 ? k + 1 : -1, y > 0 ? k - CELL : -1, y < 255 ? k + CELL : -1])
        if (n >= 0 && near[n] === 255) { near[n] = near[k] + 1; ring.push(n); }
    }
    let outline = null, outlineLuma = 1e9;
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
      const i = at(coat, sheet, f, x, y), k = y * CELL + x;
      if (coat.data[i + 3] && (coat.data[i + 3] <= 127 || near[k] > BULK)) { out[i] = out[i + 1] = out[i + 2] = out[i + 3] = 0; continue; }
      if (coat.data[i + 3] > 127) {
        owned[y * CELL + x] = 1;
        const luma = coat.data[i] * .3 + coat.data[i + 1] * .59 + coat.data[i + 2] * .11;
        if (luma < outlineLuma) { outlineLuma = luma; outline = [coat.data[i], coat.data[i + 1], coat.data[i + 2]]; }
      }
    }
    if (!outline) { report.push({sheet, frame: f, added: 0}); continue; }
    const nearPaw = (x, y) => (pose.hands || []).some(([hx, hy, r]) => Math.hypot(x - hx, y - hy) < r + PAW);
    const inSleeve = (x, y, radius) => (pose.arms || []).some(arm => arm.slice(1).some((point, j) => segmentDistance(x, y, arm[j], point) <= radius));
    // A raised arm is drawn in the foreground (over the coat). Its forearm
    // fur leaves the coat's foreground so the sleeve can cover it; the paw stays.
    // The head always stays on top: an arm resting under the face (asleep,
    // leaning) must not take cheek or chin pixels out of the foreground.
    // Arms raised over or beside the head still get their sleeve.
    const [hx0, hy0, hx1, hy1] = pose.head || [0, 0, 0, 0];
    const inHead = (x, y) => hx1 > hx0 && y >= (hy0 + hy1) / 2 && ((x - (hx0 + hx1) / 2) / ((hx1 - hx0) / 2 * HEAD)) ** 2 + ((y - (hy0 + hy1) / 2) / ((hy1 - hy0) / 2 * HEAD)) ** 2 <= 1;
    const armFur = (x, y) => foreground.data[at(foreground, sheet, f, x, y) + 3] > 127 && !nearPaw(x, y) && !inHead(x, y) && inSleeve(x, y, SLEEVE);
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
      const k = y * CELL + x;
      if (armFur(x, y)) { const j = at(coatForeground, sheet, f, x, y); coatForeground.data[j + 3] = 0; }
      if (owned[k] || (foreground.data[at(foreground, sheet, f, x, y) + 3] > 127 && !armFur(x, y)) || nearPaw(x, y)) continue;
      const onTee = tee.data[at(tee, sheet, f, x, y) + 3] > 127;
      const onArm = (anatomy.data[at(anatomy, sheet, f, x, y) + 3] > 127 || armFur(x, y)) && inSleeve(x, y, SLEEVE);
      if (onTee || onArm) added[k] = 1;
    }
    // Nearest drawn coat colour, spread outwards from the v3 coat.
    const source = new Int32Array(CELL * CELL).fill(-1), queue = [];
    for (let k = 0; k < owned.length; k++) if (owned[k]) { source[k] = k; queue.push(k); }
    for (let q = 0; q < queue.length; q++) {
      const k = queue[q], x = k % CELL, y = k >> 8;
      for (const n of [x > 0 ? k - 1 : -1, x < 255 ? k + 1 : -1, y > 0 ? k - CELL : -1, y < 255 ? k + CELL : -1]) {
        if (n < 0 || source[n] >= 0 || !added[n]) continue;
        source[n] = source[k]; queue.push(n);
      }
    }
    let count = 0;
    for (let k = 0; k < added.length; k++) {
      if (!added[k] || source[k] < 0) continue;
      const x = k % CELL, y = k >> 8, s = source[k], o = at(coat, sheet, f, x, y), from = at(coat, sheet, f, s % CELL, s >> 8);
      const covered = n => n >= 0 && (owned[n] || (added[n] && source[n] >= 0));
      const edge = [x > 0 ? k - 1 : -1, x < 255 ? k + 1 : -1, y > 0 ? k - CELL : -1, y < 255 ? k + CELL : -1]
        .some(n => n < 0 || (!covered(n) && anatomy.data[at(anatomy, sheet, f, n % CELL, n >> 8) + 3] <= 127 && tee.data[at(tee, sheet, f, n % CELL, n >> 8) + 3] <= 127));
      const [r, g, b] = edge ? outline : [coat.data[from], coat.data[from + 1], coat.data[from + 2]];
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255; count++;
    }
    report.push({sheet, frame: f, added: count});
  }
  await sharp(out, {raw: {width: coat.width, height: coat.height, channels: 4}}).webp({lossless: true}).toFile(path.join(wardrobe, `tnf-${color}-${sheet}-v5.webp`));
  if (color === colors[0]) await sharp(coatForeground.data, {raw: {width: foreground.width, height: foreground.height, channels: 4}}).webp({lossless: true}).toFile(path.join(tailored, `foreground-coat-${sheet}-v5.webp`));
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const summary = [];
  for (const color of colors) for (const sheet of Object.keys(grids)) summary.push(...(await buildSheet(color, sheet)).map(r => ({color, ...r})));
  const negro = summary.filter(r => r.color === 'negro');
  console.log(`${summary.length} cells; pixels added per pose (negro):`, negro.map(r => `${r.sheet[0]}${r.frame}:${r.added}`).join(' '));
}
