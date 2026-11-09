import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {loadSharp}from '../artwork/chota/wardrobe-rig-v1/load-sharp.mjs';
const root=path.resolve(import.meta.dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'icons/mascot/chota-v2/tailored-v5/manifest-v1.json'))),grids={base:['chota-poses.webp',6,4,24],directional:['chota-directional-v1.webp',5,4,20],contextual:['chota-contextual-v1.webp',4,4,16],room:['chota-room-life-v1.webp',4,1,4],talk:['chota-talk.webp',3,1,3]},poses=JSON.parse(fs.readFileSync(path.join(root,'artwork/chota/wardrobe-rig-v1/poses.json')));
const cache=new Map();async function pixels(file){if(!cache.has(file)){const sharp=await loadSharp();cache.set(file,await sharp(path.join(root,file)).ensureAlpha().raw().toBuffer({resolveWithObject:true}));}return cache.get(file);}
test('all 67 source poses reconstruct from disjoint garment-free anatomy and three removable originals, with exact visible source geometry/colors',async()=>{
 assert.equal(manifest.rigVersion,5);assert.equal(manifest.approved,true);assert.equal(manifest.files.length,80);assert.equal(Object.keys(manifest.garments).length,11);
 for(const[sheet,[filename,cols,rows,count]]of Object.entries(grids)){
  const source=await pixels('icons/mascot/chota-v2/'+filename),anatomy=await pixels(manifest.anatomy[sheet]),oldFootwear=await pixels(`icons/mascot/chota-v2/wardrobe-originals/original-jordan-chicago-${sheet}-v1.webp`),parts=await Promise.all(['original-stussy','original-jeans','original-jordan-chicago'].map(key=>pixels(manifest.garments[key][sheet])));
  assert.equal(anatomy.info.width,cols*256);assert.equal(anatomy.info.height,rows*256);
  for(let k=0;k<source.data.length;k+=4){const owners=[anatomy,...parts].filter(p=>p.data[k+3]>0);if(source.data[k+3]<128){assert.equal(owners.length,0);continue;}assert.equal(owners.length,1,`${sheet} source pixel ${k/4} has one owner`);assert.deepEqual(owners[0].data.subarray(k,k+4),source.data.subarray(k,k+4),'head, paws, soles and original cloth preserve source RGBA');}
  for(let f=0;f<count;f++){const p=poses.find(p=>p.sheet===sheet&&p.frame===f),angle=p.body[4]*Math.PI/180;let shoeRed=0;
   for(let y=0;y<256;y++)for(let x=0;x<256;x++){const k=(((f/cols|0)*256+y)*source.info.width+f%cols*256+x)*4,[r,g,b,a]=source.data.subarray(k,k+4),v=-(x-p.body[0])*Math.sin(angle)+(y-p.body[1])*Math.cos(angle);if(a>128&&v>p.body[3]*.65&&r>120&&r>g*1.8&&r>b*1.3&&g<90&&g/r<.32&&b>g*.55){let near=false;for(let dy=-5;dy<=5&&!near;dy++)for(let dx=-5;dx<=5;dx++){const xx=x+dx,yy=y+dy;if(xx<0||xx>=256||yy<0||yy>=256)continue;const j=(((f/cols|0)*256+yy)*source.info.width+f%cols*256+xx)*4;if(oldFootwear.data[j+3]>128){near=true;break;}}if(near){assert.equal(anatomy.data[k+3],0,`${sheet}:${f} may not retain a baked red sneaker at ${x},${y}`);shoeRed++;}}}
   assert.ok(shoeRed>5,`${sheet}:${f} exercises actual original sneaker pixels`);
  }
 }
});
test('every new shirt and trouser material follows the artist clothed silhouette exactly in all 67 poses, rather than a new foot/limb warp',async()=>{
 for(const sheet of Object.keys(grids)){
  for(const[original,keys]of [['original-stussy',['carhartt-crudo','carhartt-oliva','supreme-negra','supreme-roja','stussy-blanca','stussy-azul']],['original-jeans',['carhartt-marron','carhartt-azul-oscuro']]]){
   const source=await pixels(manifest.garments[original][sheet]);for(const key of keys){const material=await pixels(manifest.garments[key][sheet]);assert.equal(material.info.width,source.info.width);assert.equal(material.info.height,source.info.height);for(let k=3;k<source.data.length;k+=4)assert.equal(material.data[k],source.data[k],`${key} ${sheet} exact source coverage at ${k>>2}`);}
  }
 }
});
test('bare body parts contain fur only in unoccupied slots and remain disjoint from anatomy and each other',async()=>{
 let pixelsOfFur=0;
 for(const sheet of Object.keys(grids)){const anatomy=await pixels(manifest.anatomy[sheet]),bare=await Promise.all(['topwear','bottomwear','footwear'].map(slot=>pixels(manifest.bare[slot][sheet])));
  for(let k=0;k<anatomy.data.length;k+=4){const visible=bare.filter(p=>p.data[k+3]);assert.ok(visible.length<=1,'one bare part owns each fur pixel');if(visible.length){assert.equal(anatomy.data[k+3],0,'bare body cannot paint beneath retained source anatomy');pixelsOfFur++;}}
 }
 assert.ok(pixelsOfFur>100000,'all body families contain actual removable fur parts');
});
