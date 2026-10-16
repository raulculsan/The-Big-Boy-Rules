/* Static member tiles use small, complete compositions; active artwork stays original.
   Regeneration requires Python with Pillow (BANNER_IMAGE_PYTHON can select it).
   Checked-in posters are reused without an image tool when sources are unchanged. */
import {readFile, writeFile, mkdir, stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = resolve(root, 'icons/banners/posters');
const definitions = [
  {name:'alberto-galicia-v1.webp', sources:['alberto-galicia-anime-preview-v1.png']},
  {name:'miguel-basket-v1.webp', sources:['miguel-basket-bano-v1.png']},
  {name:'miguel-moto-v1.webp', sources:['miguel-moto-city-v1.png','miguel-moto-rider-v2.png']}
];
const renderer = `
import json, sys
from pathlib import Path
from PIL import Image, ImageOps
root = Path(sys.argv[1])
for item in json.loads(sys.argv[2]):
    images = [Image.open(root / 'icons/banners' / name).convert('RGBA') for name in item['sources']]
    # Work at twice the exported resolution for the layered motorbike edges.
    size = (1440, 480)
    result = ImageOps.fit(images[0], size, method=Image.Resampling.LANCZOS)
    if len(images) > 1:
        rider = images[1]
        height = round(size[1] * 1.01)
        width = round(height * rider.width / rider.height)
        rider = rider.resize((width, height), Image.Resampling.LANCZOS)
        # Mirrors the static rider group's original CSS: left 29%, width 57%,
        # height 101%, bottom -4%, with its artwork centred in that group.
        x = round(size[0] * .575 - width / 2)
        y = round(size[1] * 1.04 - height)
        result.alpha_composite(rider, (x, y))
    result = result.convert('RGB').resize((720, 240), Image.Resampling.LANCZOS)
    result.save(root / 'icons/banners/posters' / item['name'], 'WEBP', quality=82, method=6)
`;
function render(items) {
  return new Promise((accept, reject) => {
    const child = spawn(process.env.BANNER_IMAGE_PYTHON || 'python3', ['-c', renderer, root, JSON.stringify(items)], {stdio:['ignore','ignore','pipe']});
    let errors='';
    child.stderr.on('data', data => {errors += data;});
    child.once('error', reject);
    child.once('exit', code => code === 0 ? accept() : reject(new Error(`Banner poster generation needs Python + Pillow; set BANNER_IMAGE_PYTHON if needed. ${errors}`)));
  });
}
export async function buildBannerPosters() {
  await mkdir(directory, {recursive:true});
  const manifestPath = resolve(directory, 'manifest.json');
  let previous={};
  try {previous=JSON.parse(await readFile(manifestPath,'utf8'));} catch {}
  const manifest={}, pending=[];
  let originalBytes=0, posterBytes=0;
  for (const item of definitions) {
    const digest=createHash('sha256').update('v1:720:240:82');
    for (const source of item.sources) {
      const bytes=await readFile(resolve(root,'icons/banners',source));
      digest.update(bytes);originalBytes+=bytes.length;
    }
    manifest[item.name]=digest.digest('hex');
    let exists=true;
    try {await stat(resolve(directory,item.name));} catch {exists=false;}
    if (!exists || previous[item.name]!==manifest[item.name]) pending.push(item);
  }
  if(pending.length) await render(pending);
  for(const item of definitions) posterBytes+=(await stat(resolve(directory,item.name))).size;
  const json=JSON.stringify(manifest,null,2)+'\n';
  if(JSON.stringify(previous,null,2)+'\n'!==json) await writeFile(manifestPath,json);
  console.log(`Banner posters: ${definitions.length} assets, ${pending.length} generated; ${(originalBytes/1e6).toFixed(2)} MB originals → ${(posterBytes/1e3).toFixed(0)} KB static tiles.`);
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) await buildBannerPosters();
