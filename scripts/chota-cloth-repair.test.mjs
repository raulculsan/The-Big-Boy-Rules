import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {loadSharp} from '../artwork/chota/wardrobe-rig-v1/load-sharp.mjs';
import {repairGarment,expandClothCoverage} from '../artwork/chota/wardrobe-fidelity-v3/garment-mask-v4.mjs';
const root=path.resolve(import.meta.dirname,'..'),assetRoot=path.join(root,'icons/mascot/chota-v2');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'artwork/chota/wardrobe-fidelity-v4/manifest.json')));
const grids={base:['chota-poses.webp',6,4,24],directional:['chota-directional-v1.webp',5,4,20],contextual:['chota-contextual-v1.webp',4,4,16],room:['chota-room-life-v1.webp',4,1,4],talk:['chota-talk.webp',3,1,3]};
test('repaired originals preserve artist pixels, close source-visible cloth holes and remove disconnected shoe crumbs in all 67 poses',async()=>{
 const sharp=await loadSharp();let removed=0,filled=0;
 for(const [sheet,[filename,cols,,count]] of Object.entries(grids)){
  const source=await sharp(path.join(assetRoot,filename)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(const key of ['original-stussy','original-jeans']){
   const previous=await sharp(path.join(assetRoot,`wardrobe-originals/${key}-${sheet}-v1.webp`)).ensureAlpha().raw().toBuffer();
   const current=await sharp(path.join(assetRoot,`wardrobe-originals/${key}-${sheet}-v2.webp`)).ensureAlpha().raw().toBuffer();
   for(let frame=0;frame<count;frame++){
    const offset={left:frame%cols*256,top:Math.floor(frame/cols)*256,width:256,height:256};
    const src=await sharp(source.data,{raw:source.info}).extract(offset).raw().toBuffer(),old=await sharp(previous,{raw:source.info}).extract(offset).raw().toBuffer(),now=await sharp(current,{raw:source.info}).extract(offset).raw().toBuffer();
    const repaired=repairGarment(src,expandClothCoverage(src,old,key==='original-stussy'?'shirt':'pants')),audit=manifest.originalRepairs.find(a=>a.key===key&&a.sheet===sheet&&a.frame===frame);
    assert.deepEqual(now,repaired.data,`${key} ${sheet}:${frame} must match bounded source-pixel repair`);
    assert.equal(audit.filled,repaired.filled);assert.equal(audit.removed,repaired.removed);
    // Repeating a repair cannot keep eroding a cuff or expanding a seam.
    assert.deepEqual(repairGarment(src,now).data,now,`${key} ${sheet}:${frame} must be stable`);
    removed+=repaired.removed;filled+=repaired.filled;
    for(let k=0;k<now.length;k+=4){if(!now[k+3])continue;assert.ok(src[k+3]>0,'never invent cloth outside the source');assert.deepEqual(now.subarray(k,k+4),src.subarray(k,k+4),'retained/fill colors stay source-exact')}
   }
  }
 }
 assert.ok(filled>100,'exercise real missing interior pixels');assert.ok(removed>1000,'exercise actual detached outline/shoe debris');
});
test('all eight new garments cover every repaired cloth pixel in all 536 cells, with no detached fragments or missing alpha',async()=>{
 const sharp=await loadSharp();assert.equal(manifest.version,4);assert.equal(manifest.runtime.length,40);assert.equal(manifest.totalFrames,536);
 const totals=new Map();
 for(const asset of manifest.runtime){
  const current=await sharp(path.join(root,asset.path)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const mask=await sharp(path.join(assetRoot,`wardrobe-originals/${asset.kind==='pants'?'original-jeans':'original-stussy'}-${asset.sheet}-v2.webp`)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(current.info.width,mask.info.width);assert.equal(current.info.height,mask.info.height);
  for(let k=3;k<current.data.length;k+=4)assert.equal(current.data[k],mask.data[k],`${asset.id} ${asset.sheet} must completely cover the approved repaired cloth at pixel ${k>>2}`);
  totals.set(asset.id,(totals.get(asset.id)||0)+asset.count);
 }
 assert.equal(totals.size,8);for(const[id,count]of totals)assert.equal(count,67,id);
});
test('built-in wardrobe resolves tailored v5 assets for legacy and modular states without changing server IDs or coat assets',()=>{
 const source=fs.readFileSync(path.join(root,'chota-wardrobe.js'),'utf8');
 assert.match(source,/tailored-v5\/\$\{key\.replace\(\/-v1\$\/,''\)\}-\$\{sheet\}\.webp/);
 assert.match(source,/wardrobe\/tnf-\$\{color\}-\$\{sheet\}-v4.webp/);
});

test('legacy overlays cover source tee and denim components through the anatomical neckline in every pose',async()=>{
 const sharp=await loadSharp(),poses=JSON.parse(fs.readFileSync(path.join(root,'artwork/chota/wardrobe-rig-v1/poses.json')));
 let expectedShirt=0,expectedPants=0;
 for(const [sheet,[filename,cols,,count]]of Object.entries(grids)){
  const source=await sharp(path.join(assetRoot,filename)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const footwear=await sharp(path.join(assetRoot,`wardrobe-originals/original-jordan-chicago-${sheet}-v1.webp`)).ensureAlpha().raw().toBuffer();
  const overlays={shirt:await sharp(path.join(assetRoot,`wardrobe-topwear/supreme-negra-${sheet}-v4.webp`)).ensureAlpha().raw().toBuffer(),pants:await sharp(path.join(assetRoot,`wardrobe-bottomwear/carhartt-marron-${sheet}-v4.webp`)).ensureAlpha().raw().toBuffer()};
  for(let frame=0;frame<count;frame++){
   const p=poses.find(p=>p.sheet===sheet&&p.frame===frame),[cx,cy,w,h,degrees]=p.body,angle=degrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),offset={left:frame%cols*256,top:Math.floor(frame/cols)*256,width:256,height:256};
   const src=await sharp(source.data,{raw:source.info}).extract(offset).raw().toBuffer();
   const foot=await sharp(footwear,{raw:source.info}).extract(offset).raw().toBuffer(),shoeRegion=new Uint8Array(65536);
   // Gray-blue leather highlights also satisfy a denim RGB threshold. Protect
   // the independently extracted shoe footprint, including its contour gaps.
   for(let k=0;k<65536;k++)if(foot[k*4+3]>128){const x=k%256,y=k>>8;for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<256&&yy>=0&&yy<256)shoeRegion[yy*256+xx]=1}}
   for(const kind of ['shirt','pants']){
    const overlay=await sharp(overlays[kind],{raw:source.info}).extract(offset).raw().toBuffer(),seen=new Uint8Array(65536);
    // This independently labels the visible source material, seeded by the rig's
    // torso/waist rather than by the generated garment mask or a head rectangle.
    const material=k=>{const[r,g,b,a]=src.subarray(k*4,k*4+4),x=k%256,y=k>>8,hand=p.hands.some(([hx,hy,radius])=>Math.hypot(x-hx,y-hy)<radius+2),warmFur=r-b>30&&g-b>18&&r>180;return a>240&&(kind==='shirt'?!hand&&!warmFur&&Math.min(r,g,b)>100&&Math.max(r,g,b)-Math.min(r,g,b)<42:!shoeRegion[k]&&b-r>25&&b>r*1.25&&g-r>5&&b-g>3)};
    let covered=0;
    for(let start=0;start<65536;start++)if(!seen[start]&&material(start)){
     const queue=[start];seen[start]=1;let seeded=false;
     for(let j=0;j<queue.length;j++){
      const k=queue[j],x=k%256,y=k>>8,u=(x-cx)*c+(y-cy)*s,v=-(x-cx)*s+(y-cy)*c;
      if(Math.abs(u)<w*.38&&(kind==='shirt'?v>h*.25&&v<h*.75:v>h*.95&&v<h*1.65))seeded=true;
      for(const n of [x>0?k-1:-1,x<255?k+1:-1,y>0?k-256:-1,y<255?k+256:-1])if(n>=0&&!seen[n]&&material(n)){seen[n]=1;queue.push(n)}
     }
     if(seeded)for(const k of queue){assert.ok(overlay[k*4+3]>240,`${kind} source leaks at ${sheet}:${frame} (${k%256},${k>>8})`);covered++}
    }
    assert.ok(covered>40,`${kind} ${sheet}:${frame} must have an independently identified source cloth region`);
    if(kind==='shirt')expectedShirt+=covered;else expectedPants+=covered;
   }
  }
 }
 assert.ok(expectedShirt>50000);assert.ok(expectedPants>50000);
});
