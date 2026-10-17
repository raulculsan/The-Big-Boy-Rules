/* Delivery copies only: source art and resolution are never changed. */
import {readdir, readFile, writeFile, stat, unlink} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {join, extname, basename} from 'node:path';

const textTypes = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg']);
const run = (command, args) => new Promise((accept, reject) => {
  const child = spawn(command, args, {stdio: ['ignore', 'ignore', 'pipe']});
  let error = '';
  child.stderr.on('data', chunk => { error += chunk; });
  child.once('error', reject);
  child.once('exit', code => code === 0 ? accept() : reject(new Error(`${command}: ${error || code}`)));
});
// PNG RGB/grayscale without tRNS are opaque. Keep alpha sprites unchanged.
function opaquePNG(data) {
  if (data.readUInt32BE(0) !== 0x89504e47 || ![0, 2].includes(data[25])) return false;
  for (let offset = 8; offset + 12 <= data.length;) {
    const type = data.toString('ascii', offset + 4, offset + 8);
    if (type === 'tRNS') return false;
    if (type === 'IDAT') return true;
    offset += data.readUInt32BE(offset) + 12;
  }
  return false;
}
async function files(directory) {
  const found = [];
  for (const item of await readdir(directory, {withFileTypes: true})) {
    const path = join(directory, item.name);
    if (item.isDirectory()) found.push(...await files(path));
    else if (item.isFile()) found.push(path);
  }
  return found;
}
export async function optimizePackagedCards(output) {
  const directory = join(output, 'icons/cards');
  const replacements = [];
  let before = 0, after = 0;
  const candidates = (await readdir(directory)).filter(name => name.endsWith('.png'));
  // Limit simultaneous image decoders so builds do not monopolise memory.
  let next = 0;
  await Promise.all(Array.from({length: 3}, async () => {
    while (next < candidates.length) {
      const name = candidates[next++], original = join(directory, name);
      const data = await readFile(original);
      if (!opaquePNG(data)) continue;
      const targetName = `${basename(name, '.png')}.jpg`, target = join(directory, targetName);
      if (process.platform === 'darwin') {
        await run('/usr/bin/sips', ['--setProperty', 'format', 'jpeg', '--setProperty', 'formatOptions', '90', original, '--out', target]);
      } else {
        await run('magick', [original, '-quality', '90', target]);
      }
      const size = (await stat(target)).size;
      // Do not trade fidelity for negligible savings.
      if (size > data.length * 0.8) { await unlink(target); continue; }
      before += data.length; after += size;
      replacements.push([`icons/cards/${name}`, `icons/cards/${targetName}`]);
    }
  }));
  // Rewrite the entire delivered shell (including SW, catalog and thumbnail
  // lookup keys) together so every generated reference resolves offline.
  for (const path of await files(output)) {
    if (!textTypes.has(extname(path))) continue;
    const original = await readFile(path, 'utf8');
    let text = original;
    for (const [from, to] of replacements) text = text.split(from).join(to);
    if (text !== original) await writeFile(path, text);
  }
  for (const [from] of replacements) await unlink(join(output, from));
  console.log(`Packaged card delivery: ${replacements.length} opaque images, original resolution, JPEG quality 90; ${(before / 1e6).toFixed(1)} MB → ${(after / 1e6).toFixed(1)} MB. Source PNGs preserved.`);
  return replacements;
}

// Called only after Capacitor copies the web build. Published web art stays intact.
export async function thinNativeCards(output) {
  const catalog = await readFile(join(output, 'card-collection.js'), 'utf8');
  const fronts = [...new Set([...catalog.matchAll(/front:\s*['"](icons\/cards\/[^'"]+)['"]/g)].map(match => match[1]))];
  const backs = new Set([...catalog.matchAll(/back:\s*['"](icons\/cards\/[^'"]+)['"]/g)].map(match => match[1]));
  const delivery = {};
  let removed = 0;
  for (const path of fronts) {
    if (backs.has(path) || path.includes('..') || !/^icons\/cards\/[^/]+\.(png|jpg|jpeg)$/.test(path)) continue;
    delivery[path] = path;
    try { removed += (await stat(join(output, path))).size; await unlink(join(output, path)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const runtime = join(output, 'card-media.js');
  let code = await readFile(runtime, 'utf8');
  code = code.replace(/^globalThis\.CardDelivery = [^\n]+;\n/, '');
  await writeFile(runtime, `globalThis.CardDelivery = ${JSON.stringify(delivery)};\n${code}`);
  console.log(`Native card delivery: ${fronts.length} full fronts on demand; ${(removed / 1e6).toFixed(2)} MB removed. Local thumbnails and shared backs retained; full art cache capped at 32 MiB.`);
  return {removed, count:fronts.length};
}
