import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {loadSharp} from '../artwork/chota/wardrobe-rig-v1/load-sharp.mjs';
const root=path.resolve(import.meta.dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'artwork/chota/modular-body-v1/originals-manifest.json')));
test('three original slots contain all 67 cells and retain exact source colors without blue cuffs in footwear',async()=>{
 const sharp=await loadSharp(),sourceBySheet=Object.fromEntries(await Promise.all(manifest.sources.map(async item=>{const sheet=item.path.includes('directional')?'directional':item.path.includes('contextual')?'contextual':item.path.includes('room-life')?'room':item.path.includes('talk')?'talk':'base';return[sheet,await sharp(path.join(root,item.path)).ensureAlpha().raw().toBuffer({resolveWithObject:true})];}))),counts={};
 assert.equal(manifest.runtime.length,15);assert.equal(manifest.frames.length,67);
 for(const asset of manifest.runtime){const current=await sharp(path.join(root,asset.path)).ensureAlpha().raw().toBuffer({resolveWithObject:true}),original=sourceBySheet[asset.sheet];assert.equal(current.info.width,asset.cols*256);assert.equal(current.info.height,asset.rows*256);counts[asset.slot]=(counts[asset.slot]||0)+asset.count;
  for(let at=0;at<current.data.length;at+=4)if(current.data[at+3]){assert.deepEqual(current.data.subarray(at,at+4),original.data.subarray(at,at+4),`${asset.path} original pixel ${at/4}`);if(asset.slot==='footwear'){const[r,g,b]=current.data.subarray(at,at+3);assert.ok(!(b-r>10&&g-r>2&&b-g>0),'old blue cuffs must not be embedded in footwear');}}
 }
 assert.deepEqual(counts,{topwear:67,bottomwear:67,footwear:67});
 for(const frame of manifest.frames)for(const[slot,pixels]of Object.entries(frame.pixels))assert.ok(pixels>70,`${slot} empty at ${frame.sheet}:${frame.frame}`);
});
test('the cached default outfit is pixel-identical to the original; it is never labelled as a neutral body',async()=>{
 const sharp=await loadSharp();assert.equal(Object.keys(manifest.defaults).length,5);
 for(const[sheet,file]of Object.entries(manifest.defaults)){assert.match(file,/wardrobe-originals\/default-composed-/);const source=manifest.sources.find(item=>sheet==='base'?item.path.endsWith('chota-poses.webp'):sheet==='room'?item.path.includes('room-life'):item.path.includes(sheet));const original=await sharp(path.join(root,source.path)).ensureAlpha().raw().toBuffer(),cached=await sharp(path.join(root,file)).ensureAlpha().raw().toBuffer();assert.equal(cached.length,original.length);for(let at=0;at<cached.length;at+=4){assert.equal(cached[at+3],original[at+3]);if(original[at+3])assert.deepEqual(cached.subarray(at,at+3),original.subarray(at,at+3));else assert.equal(cached[at]+cached[at+1]+cached[at+2],0);}}
});
