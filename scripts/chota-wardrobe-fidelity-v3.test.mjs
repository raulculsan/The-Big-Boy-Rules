import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {loadSharp} from '../artwork/chota/wardrobe-rig-v1/load-sharp.mjs';
const root=path.resolve(import.meta.dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'artwork/chota/wardrobe-fidelity-v3/manifest.json')));
test('all 14 garments retain their 67 animation cells and exact original occlusion alpha',async()=>{
 const sharp=await loadSharp();assert.equal(manifest.runtime.length,70);assert.equal(manifest.totalFrames,938);
 const totals=new Map();let bytes=0;
 for(const asset of manifest.runtime){
  const current=await sharp(path.join(root,asset.path)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const previous=await sharp(path.join(root,asset.path.replace(/-v3\.webp$/,'-v2.webp'))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(current.info.width,previous.info.width,asset.path);assert.equal(current.info.height,previous.info.height,asset.path);
  for(let i=3;i<current.data.length;i+=4)assert.equal(current.data[i],previous.data[i],`${asset.path} occlusion at ${i}`);
  totals.set(asset.id,(totals.get(asset.id)||0)+asset.count);bytes+=asset.bytes;
 }
 assert.equal(totals.size,14);for(const [id,count] of totals)assert.equal(count,67,id);
 assert.ok(bytes<8*1024*1024,'garment atlases should stay below 8 MB in total');
});
test('catalogue has a transparent garment-only 384px image for every built-in model',async()=>{
 const sharp=await loadSharp(),products=JSON.parse(fs.readFileSync(path.join(root,'icons/shop/garments-v3/manifest.json'))).items;
 assert.equal(products.length,14);assert.equal(new Set(products.map(p=>p.key)).size,14);
 for(const item of products){assert.match(item.image,/^icons\/shop\/garments-v3\/[a-z-]+\.webp$/);const meta=await sharp(path.join(root,item.image)).metadata();assert.equal(meta.width,384);assert.equal(meta.height,384);assert.equal(meta.hasAlpha,true);}
});
