/* Optimised delivery assets. Original PNG artwork stays available for authoring. */
import {readFile, writeFile, stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const paths = [
  ...['alberto-galicia-bg-v1','alberto-galicia-member-bg-v1','alberto-galicia-figures-v1','alberto-galicia-member-figures-v1','alberto-galicia-expression-v2','miguel-basket-bano-bg-v1','miguel-moto-city-v1','miguel-moto-rider-v2','miguel-moto-clouds-v1',
    ...['00','00a','01','01a','02','02a','03'].map(frame => `miguel-basket-miguel-${frame}-v1`)].map(name => `icons/banners/${name}.png`),
  'icons/mascot/chota-v2/chota-poses.png', 'icons/mascot/chota-v2/chota-talk.png'
];
const render = `
import json,sys
from pathlib import Path
from PIL import Image
root=Path(sys.argv[1])
for item in json.loads(sys.argv[2]):
    image=Image.open(root/item['source'])
    image.save(root/item['target'], 'WEBP', quality=90, method=6, lossless=item['lossless'], exact=True, alpha_quality=100)
    result=Image.open(root/item['target'])
    assert image.size==result.size
    if 'A' in image.getbands():
        assert image.getchannel('A').tobytes()==result.convert('RGBA').getchannel('A').tobytes()
`;
function generate(pending) {
  return new Promise((accept,reject) => {
    const child=spawn(process.env.ARTWORK_IMAGE_PYTHON || 'python3',['-c',render,root,JSON.stringify(pending)],{stdio:['ignore','ignore','pipe']});
    let error='';child.stderr.on('data',chunk=>{error+=chunk;});
    child.once('error',reject);child.once('exit',code=>code===0?accept():reject(new Error(`Runtime artwork generation requires Python + Pillow (ARTWORK_IMAGE_PYTHON). ${error}`)));
  });
}
export async function buildRuntimeArtwork() {
  const manifestPath=resolve(root,'icons/runtime-artwork.json');
  let previous={};try{previous=JSON.parse(await readFile(manifestPath,'utf8'));}catch{}
  const manifest={},pending=[];
  let before=0,after=0;
  for(const source of paths){
    const data=await readFile(resolve(root,source)),target=source.replace(/\.png$/,'.webp');
    const digest=createHash('sha256').update('v1:webp:90:alpha100:dimensions-original').update(data).digest('hex');
    const entry={source,target,lossless:source.includes('/mascot/'),digest};manifest[source]=entry;
    let exists=true;try{await stat(resolve(root,target));}catch{exists=false;}
    if(!exists||previous[source]?.digest!==digest)pending.push(entry);
    before+=data.length;
  }
  if(pending.length)await generate(pending);
  for(const entry of Object.values(manifest))after+=(await stat(resolve(root,entry.target))).size;
  const json=JSON.stringify(manifest,null,2)+'\n';
  if(JSON.stringify(previous,null,2)+'\n'!==json)await writeFile(manifestPath,json);
  console.log(`Runtime artwork: ${paths.length} assets, ${pending.length} generated; ${(before/1e6).toFixed(2)} MB → ${(after/1e6).toFixed(2)} MB. Dimensions and alpha preserved; mascot lossless.`);
  return paths;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildRuntimeArtwork();
