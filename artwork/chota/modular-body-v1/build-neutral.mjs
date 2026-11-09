// Runtime atlas preparation from ImageGen neutral art, preserving source facial pixels.
// The original sheets and existing garment rigs are read-only inputs.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import{loadSharp}from'../wardrobe-rig-v1/load-sharp.mjs';
const sharp=await loadSharp(),root=path.resolve(import.meta.dirname,'../../..'),out=import.meta.dirname,dest=path.join(root,'icons/mascot/chota-v2/neutral');fs.mkdirSync(dest,{recursive:true});
const specs={base:['chota-poses.webp',6,4,24],directional:['chota-directional-v1.webp',5,4,20],contextual:['chota-contextual-v1.webp',4,4,16],room:['chota-room-life-v1.webp',4,1,4],talk:['chota-talk.webp',3,1,3]},poses=JSON.parse(fs.readFileSync(path.join(root,'artwork/chota/wardrobe-rig-v1/poses.json')));
const pixels=async file=>sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const inside=(x,y,poly)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i][1]>y)!==(poly[j][1]>y)&&x<(poly[j][0]-poly[i][0])*(y-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0])yes=!yes;return yes;};
function box(data,w,h,region=[0,0,w,h]){let x0=w,y0=h,x1=-1,y1=-1;for(let y=Math.max(0,Math.floor(region[1]));y<Math.min(h,Math.ceil(region[3]));y++)for(let x=Math.max(0,Math.floor(region[0]));x<Math.min(w,Math.ceil(region[2]));x++)if(data[(y*w+x)*4+3]>=128){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}if(x1<0)throw Error('Empty sprite');return{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};}
function removeIsolatedNoise(data){const seen=new Uint8Array(65536);for(let p=0;p<65536;p++){if(seen[p]||data[p*4+3]===0)continue;const queue=[p];seen[p]=1;for(let i=0;i<queue.length;i++){const v=queue[i],x=v%256,y=Math.floor(v/256);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,n=yy*256+xx;if(xx>=0&&xx<256&&yy>=0&&yy<256&&!seen[n]&&data[n*4+3]>0){seen[n]=1;queue.push(n);}}}if(queue.length<24)for(const i of queue)data.fill(0,i*4,i*4+4);}}
const manifest={version:1,poseCount:67,cell:256,neutral:{},sources:[],runtime:[],facialPixelsPreserved:0,generatedWith:'built-in imagegen',approved:false};const overview=[];
for(const[sheet,[sourceFile,cols,rows,count]]of Object.entries(specs)){
 const sourcePath=path.join(root,'icons/mascot/chota-v2',sourceFile),source=await pixels(sourcePath),generatedPath=path.join(out,'generated-sheets','neutral-'+(sheet==='base'?'base-clean':sheet)+'.png');
 manifest.sources.push({file:path.relative(root,sourcePath),sha256:crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex')});
 const master=await pixels(generatedPath),ratio=(master.info.width/master.info.height)/(cols/rows),sameRatio=Math.abs(ratio-1)<.025;
 const uniform=sameRatio?await sharp(master.data,{raw:master.info}).resize(cols*256,rows*256,{fit:'fill',kernel:'nearest'}).ensureAlpha().raw().toBuffer():null,layers=[];
 const cloth=await pixels(path.join(root,'icons/mascot/chota-v2/wardrobe-topwear/supreme-negra-'+sheet+'-v3.webp'));
 for(let frame=0;frame<count;frame++){
  const ox=frame%cols*256,oy=Math.floor(frame/cols)*256,pose=poses.find(p=>p.sheet===sheet&&p.frame===frame),original=await sharp(source.data,{raw:source.info}).extract({left:ox,top:oy,width:256,height:256}).raw().toBuffer();let neutral;
  if(uniform){neutral=Buffer.alloc(256*256*4);for(let y=0;y<256;y++)uniform.copy(neutral,y*256*4,((oy+y)*cols*256+ox)*4,((oy+y)*cols*256+ox+256)*4);}
  else{
   // A four-cell strip can be returned on a 3:1 canvas. Register complete sprites by
   // the original head, uniformly; never squash bodies to force a 4:1 aspect ratio.
   const gx=Math.round(frame%cols*master.info.width/cols),gy=Math.round(Math.floor(frame/cols)*master.info.height/rows),gw=Math.round((frame%cols+1)*master.info.width/cols)-gx,gh=Math.round((Math.floor(frame/cols)+1)*master.info.height/rows)-gy;
   const cell=await sharp(master.data,{raw:master.info}).extract({left:gx,top:gy,width:gw,height:gh}).raw().toBuffer(),b=box(cell,gw,gh),ob=box(original,256,256),head=box(cell,gw,gh,[0,b.y,gw,b.y+b.h*.54]),oh=box(original,256,256,pose.head),scale=ob.h/b.h,tx=oh.x+oh.w/2-(head.x+head.w/2)*scale,ty=ob.y-b.y*scale;
   neutral=Buffer.alloc(256*256*4);for(let y=0;y<256;y++)for(let x=0;x<256;x++){const sx=Math.round((x-tx)/scale),sy=Math.round((y-ty)/scale);if(sx>=0&&sx<gw&&sy>=0&&sy<gh)cell.copy(neutral,(y*256+x)*4,(sy*gw+sx)*4,(sy*gw+sx+1)*4);}
  }
  // Speech shares the idle body's geometry; only its original face/mouth changes.
  if(sheet==='talk')neutral=(await pixels(path.join(out,'qa/base-0.png'))).data;
  // The source alpha matte contains low-opacity colour noise outside characters.
  // Quantise the authored pixel-art matte for clean nearest-neighbour rendering.
  for(let i=0;i<neutral.length;i+=4){if(neutral[i+3]<128)neutral.fill(0,i,i+4);else neutral[i+3]=255;}
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
   const inHead=pose.headPolygon?inside(x,y,pose.headPolygon):(x>=pose.head[0]&&x<=pose.head[2]&&y>=pose.head[1]&&y<=pose.head[3])||(x>=pose.head[0]-12&&x<=pose.head[2]+12&&y>=pose.head[1]-8&&y<Math.min(pose.head[3],pose.body[1]-2));if(!inHead)continue;
   let isCloth=false;for(let dy=-2;dy<=2&&!isCloth;dy++)for(let dx=-2;dx<=2&&!isCloth;dx++){const px=x+dx,py=y+dy;if(px>=0&&py>=0&&px<256&&py<256&&cloth.data[((oy+py)*cloth.info.width+ox+px)*4+3]>80)isCloth=true;}
   if(isCloth)continue;
   const k=(y*256+x)*4;if(original[k+3]>=128){original.copy(neutral,k,k,k+4);neutral[k+3]=255;manifest.facialPixelsPreserved++;}else neutral.fill(0,k,k+4);
  }
  removeIsolatedNoise(neutral);
  const encoded=await sharp(neutral,{raw:{width:256,height:256,channels:4}}).png().toBuffer();layers.push({input:encoded,left:ox,top:oy});
  fs.mkdirSync(path.join(out,'qa'),{recursive:true});fs.writeFileSync(path.join(out,'qa',sheet+'-'+frame+'.png'),encoded);
  if((sheet==='base'&&[0,6,20,22].includes(frame))||sheet==='room')overview.push({input:encoded,left:overview.length%4*256,top:Math.floor(overview.length/4)*256});
 }
 const file='neutral-'+sheet+'-v1.webp',runtimePath='icons/mascot/chota-v2/neutral/'+file;
 await sharp({create:{width:cols*256,height:rows*256,channels:4,background:'#00000000'}}).composite(layers).webp({lossless:true,exact:true,effort:6}).toFile(path.join(dest,file));manifest.neutral[sheet]=runtimePath;manifest.runtime.push({sheet,file:runtimePath,cols,rows,count,cell:256,bytes:fs.statSync(path.join(dest,file)).size});
}
await sharp({create:{width:1024,height:Math.ceil(overview.length/4)*256,channels:4,background:'#303238'}}).composite(overview).png().toFile(path.join(out,'neutral-review.png'));
fs.writeFileSync(path.join(out,'neutral-build.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({poses:manifest.poseCount,atlases:manifest.runtime.length,preservedFacePixels:manifest.facialPixelsPreserved,approved:false}));
