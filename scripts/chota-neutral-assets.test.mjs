import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {loadSharp} from '../artwork/chota/wardrobe-rig-v1/load-sharp.mjs';
const root=path.resolve(import.meta.dirname,'..');
const build=JSON.parse(fs.readFileSync(path.join(root,'artwork/chota/modular-body-v1/neutral-build.json')));
const poses=JSON.parse(fs.readFileSync(path.join(root,'artwork/chota/wardrobe-rig-v1/poses.json')));
const contract=JSON.parse(fs.readFileSync(path.join(root,'icons/mascot/chota-v2/neutral/manifest-v1.json')));
test('the approved neutral body has 67 nonempty, clean-alpha poses and preserves the source sheets',async()=>{
 const sharp=await loadSharp();assert.equal(contract.approved,true);assert.equal(contract.poseCount,67);let count=0;
 for(const source of build.sources)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,source.file))).digest('hex'),source.sha256,'Original artwork must remain unchanged');
 for(const atlas of build.runtime){assert.equal(contract.neutral[atlas.sheet],atlas.file);const {data,info}=await sharp(path.join(root,atlas.file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.width,atlas.cols*256);assert.equal(info.height,atlas.rows*256);
  for(let frame=0;frame<atlas.count;frame++){const ox=frame%atlas.cols*256,oy=Math.floor(frame/atlas.cols)*256;let opaque=0,oldClothing=0;const pose=poses.find(p=>p.sheet===atlas.sheet&&p.frame===frame),head=pose.head;
   for(let y=0;y<256;y++)for(let x=0;x<256;x++){const at=((oy+y)*info.width+ox+x)*4,[r,g,b,a]=data.subarray(at,at+4);assert.ok(a===0||a===255,'Pixel-art matte must not contain faded cloth noise');if(!a){assert.equal(r+g+b,0);continue;}opaque++;if(b-r>28&&b-g>10&&!(x>=head[0]-12&&x<=head[2]+12&&y>=head[1]-8&&y<=head[3]+3))oldClothing++;}
   assert.ok(opaque>6000,`${atlas.sheet}:${frame} empty or incomplete`);assert.equal(oldClothing,0,`${atlas.sheet}:${frame} still contains blue original clothes`);count++;
  }
 }
 assert.equal(count,67);
});
test('all speech cells share the same neutral body beneath the original animated face',async()=>{
 const sharp=await loadSharp(),base=await sharp(path.join(root,contract.neutral.base)).extract({left:0,top:0,width:256,height:256}).raw().toBuffer(),talk=await sharp(path.join(root,contract.neutral.talk)).ensureAlpha().raw().toBuffer();
 for(let frame=0;frame<3;frame++)for(let y=154;y<256;y++)for(let x=0;x<256;x++){const a=(y*256+x)*4,b=(y*768+frame*256+x)*4;assert.deepEqual(talk.subarray(b,b+4),base.subarray(a,a+4),'Talking must not replace the lower body or clothes');}
});
