// Geometry only: remove the separately animated tail, ears and paw from the idle
// atlas layer. Keep the mask on ::before so the live child parts stay visible.
import path from 'node:path';
import {loadSharp} from '../wardrobe-rig-v1/load-sharp.mjs';
const sharp=await loadSharp(),root=path.resolve(import.meta.dirname,'../../..'),base=path.join(root,'icons/mascot/chota-v2'),mask=Buffer.alloc(256*256*4,255);
for(const [file,radius] of [['chota-idle-tail-v1.webp',2],['wardrobe-topwear/idle-paw-v1.svg',1],['chota-idle-ear-left-v1.webp',1],['chota-idle-ear-right-v1.webp',1]]){
 const pixels=await sharp(path.join(base,file)).resize(256,256).ensureAlpha().raw().toBuffer();
 for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(pixels[(y*256+x)*4+3]>32)for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<256&&yy>=0&&yy<256)mask[(yy*256+xx)*4+3]=0;}
}
await sharp(mask,{raw:{width:256,height:256,channels:4}}).png().toFile(path.join(base,'neutral/idle-core-mask-v1.png'));
