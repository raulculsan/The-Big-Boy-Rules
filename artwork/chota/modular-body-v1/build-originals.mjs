// Extract the three original garments, never modify a source or neutral body.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {loadSharp} from '../wardrobe-rig-v1/load-sharp.mjs';
const sharp=await loadSharp(),root=path.resolve(import.meta.dirname,'../../..'),out=import.meta.dirname,dir=path.join(root,'icons/mascot/chota-v2/wardrobe-originals');fs.mkdirSync(dir,{recursive:true});
const poses=JSON.parse(fs.readFileSync(path.join(root,'artwork/chota/wardrobe-rig-v1/poses.json')));
const sources={base:['chota-poses.webp',6,4,24],directional:['chota-directional-v1.webp',5,4,20],contextual:['chota-contextual-v1.webp',4,4,16],room:['chota-room-life-v1.webp',4,1,4],talk:['chota-talk.webp',3,1,3]};
const keys={topwear:'original-stussy',bottomwear:'original-jeans',footwear:'original-jordan-chicago'},manifest={version:1,cell:256,poseCount:67,runtime:[],defaults:{},sources:[],frames:[]},qa=[];
const load=async p=>sharp(path.join(root,p)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
function polygon(x,y,points){let yes=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const[a,b]=points[i],[c,d]=points[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)yes=!yes;}return yes;}
function distances(mask,r=3){const result=new Float32Array(65536).fill(99);for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(mask[y*256+x])for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const xx=x+dx,yy=y+dy;if(xx<0||xx>255||yy<0||yy>255)continue;const d=Math.hypot(dx,dy),k=yy*256+xx;if(d<result[k])result[k]=d;}return result;}
for(const[sheet,[file,cols,rows,count]]of Object.entries(sources)){
 const filename='icons/mascot/chota-v2/'+file,source=await load(filename),top=await load(`icons/mascot/chota-v2/wardrobe-topwear/supreme-negra-${sheet}-v3.webp`),bottom=await load(`icons/mascot/chota-v2/wardrobe-bottomwear/carhartt-marron-${sheet}-v3.webp`),atlases=Object.fromEntries(Object.keys(keys).map(slot=>[slot,Buffer.alloc(source.data.length)]));
 manifest.sources.push({path:filename,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,filename))).digest('hex')});
 for(let frame=0;frame<count;frame++){
  const left=frame%cols*256,offsetY=Math.floor(frame/cols)*256,p=poses.find(p=>p.sheet===sheet&&p.frame===frame),[cx,cy,w,h,angle]=p.body,rad=angle*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad),raw=Buffer.alloc(65536*4),seeds={topwear:new Uint8Array(65536),bottomwear:new Uint8Array(65536),footwear:new Uint8Array(65536)},fur=new Uint8Array(65536),head=new Uint8Array(65536),red=[];
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
   const k=y*256+x,at=((y+offsetY)*source.info.width+x+left)*4,[r,g,b,a]=source.data.subarray(at,at+4),v=-(x-cx)*s+(y-cy)*c;
   source.data.copy(raw,k*4,at,at+4);seeds.topwear[k]=top.data[at+3]>64?1:0;seeds.bottomwear[k]=bottom.data[at+3]>64?1:0;
   head[k]=p.headPolygon?polygon(x+.5,y+.5,p.headPolygon):x>=p.head[0]&&x<p.head[2]&&y>=p.head[1]&&y<p.head[3];
   fur[k]=a>0&&((r-g>24&&g-b>20&&g>55)||(r-b>30&&g-b>18&&r>180))?1:0;
   if(a>96&&!head[k]&&v>h*.60&&r>125&&r>g*1.8&&r>b*1.3&&g<105&&b>g*.78)red.push(k);
  }
  if(red.length<8)throw Error(`Missing Chicago seeds: ${sheet} ${frame} (${red.length})`);
  // Spatial red components retain both shoes without following a connected black
  // contour up the trousers or around the tail. Blue cuff pixels never belong to shoes.
  const unseen=new Set(red),bounds=[];
  while(unseen.size){const first=unseen.values().next().value,queue=[first];unseen.delete(first);let x0=256,y0=256,x1=-1,y1=-1;
   for(let j=0;j<queue.length;j++){const k=queue[j],x=k%256,y=k>>8;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);for(let dy=-6;dy<=6;dy++)for(let dx=-6;dx<=6;dx++){const xx=x+dx,yy=y+dy,n=yy*256+xx;if(xx>=0&&xx<256&&yy>=0&&yy<256&&unseen.delete(n))queue.push(n);}}
   if(queue.length>=3)bounds.push([Math.max(0,x0-11),Math.max(0,y0-11),Math.min(255,x1+11),Math.min(255,y1+8)]);
  }
  const skinEdge=distances(fur,1),shirtDistance=distances(seeds.topwear),pantsDistance=distances(seeds.bottomwear),redMask=new Uint8Array(65536);for(const k of red)redMask[k]=1;const redDistance=distances(redMask,12);
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
   const k=y*256+x,[r,g,b,a]=raw.subarray(k*4,k*4+4);if(a===0||head[k]||fur[k])continue;
   const denim=b-r>10&&g-r>2&&b-g>0,neutral=Math.max(r,g,b)-Math.min(r,g,b)<70,dark=Math.max(r,g,b)<100;
   if(bounds.some(b=>x>=b[0]&&x<=b[2]&&y>=b[1]&&y<=b[3])&&!denim&&!seeds.topwear[k]&&!seeds.bottomwear[k]&&skinEdge[k]>.9&&redDistance[k]<=10.5&&(pantsDistance[k]>3.1||redMask[k]||(Math.min(r,g,b)>135&&Math.max(r,g,b)-Math.min(r,g,b)<45)))seeds.footwear[k]=1;
   let slot=null;
   if(seeds.footwear[k])slot='footwear';
   else if((seeds.topwear[k]||(shirtDistance[k]<=2.1&&(neutral||dark)))&&!denim&&(shirtDistance[k]<=pantsDistance[k]||!seeds.bottomwear[k]))slot='topwear';
   else if(seeds.bottomwear[k]||(pantsDistance[k]<=1.5&&(denim||dark)))slot='bottomwear';
   if(slot){const target=((y+offsetY)*source.info.width+x+left)*4;raw.copy(atlases[slot],target,k*4,k*4+4);}
  }
  // Isolated antialias samples and legacy outline crumbs are not garment parts.
  for(const slot of Object.keys(keys)){const seen=new Uint8Array(65536);for(let start=0;start<65536;start++){
   const sx=start%256,sy=start>>8,at=((sy+offsetY)*source.info.width+sx+left)*4;if(seen[start]||!atlases[slot][at+3])continue;const queue=[start];seen[start]=1;
   for(let j=0;j<queue.length;j++){const k=queue[j],x=k%256,y=k>>8;for(const[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){const xx=x+dx,yy=y+dy,n=yy*256+xx;if(xx<0||xx>255||yy<0||yy>255||seen[n])continue;const i=((yy+offsetY)*source.info.width+xx+left)*4;if(atlases[slot][i+3]){seen[n]=1;queue.push(n);}}}
   if(queue.length<9)for(const k of queue){const i=(((k>>8)+offsetY)*source.info.width+(k%256)+left)*4;atlases[slot].fill(0,i,i+4);}
  }}
  const counts={};for(const slot of Object.keys(keys)){let pixels=0;for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(atlases[slot][((y+offsetY)*source.info.width+x+left)*4+3])pixels++;counts[slot]=pixels;if(pixels<(slot==='footwear'?80:90))throw Error(`Incomplete ${slot} ${sheet}:${frame} (${pixels}px)`);}
  manifest.frames.push({sheet,frame,pixels:counts});
  if(sheet==='base'&&[0,6,20,22].includes(frame)){
   const col=[0,6,20,22].indexOf(frame),tile=[];
   for(const[slot,key]of Object.entries(keys)){const png=await sharp(atlases[slot],{raw:source.info}).extract({left,top:offsetY,width:256,height:256}).png().toBuffer();fs.writeFileSync(path.join(out,key+'-base-'+frame+'.png'),png);tile.push({input:png,left:col*256,top:Object.keys(keys).indexOf(slot)*288});}
   qa.push(...tile);
  }
 }
 for(const[slot,key]of Object.entries(keys)){const relative=`icons/mascot/chota-v2/wardrobe-originals/${key}-${sheet}-v1.webp`;await sharp(atlases[slot],{raw:source.info}).webp({lossless:true,exact:true,effort:6}).toFile(path.join(root,relative));manifest.runtime.push({slot,key,sheet,path:relative,cell:256,cols,rows,count,bytes:fs.statSync(path.join(root,relative)).size});}
 // This is a cache of the complete original outfit, never the neutral body.
 const normalized=Buffer.from(source.data);for(let k=0;k<normalized.length;k+=4)if(normalized[k+3]===0)normalized.fill(0,k,k+3);
 const cache=`icons/mascot/chota-v2/wardrobe-originals/default-composed-${sheet}-v1.webp`;await sharp(normalized,{raw:source.info}).webp({lossless:true,exact:true,effort:6}).toFile(path.join(root,cache));manifest.defaults[sheet]=cache;
}
await sharp({create:{width:1024,height:864,channels:4,background:'#66666c'}}).composite(qa).png().toFile(path.join(out,'originals-qa.png'));
fs.writeFileSync(path.join(out,'originals-manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({atlases:manifest.runtime.length,frames:manifest.frames.length,bytes:manifest.runtime.reduce((sum,item)=>sum+item.bytes,0)}));
