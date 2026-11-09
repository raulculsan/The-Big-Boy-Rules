import fs from 'node:fs';
import path from 'node:path';
import {loadSharp} from './load-sharp.mjs';
import crypto from 'node:crypto';
const sharp=await loadSharp();
const root=path.resolve(import.meta.dirname,'../../..');
const sources={base:['chota-poses.webp',6,4,24],directional:['chota-directional-v1.webp',5,4,20],contextual:['chota-contextual-v1.webp',4,4,16],room:['chota-room-life-v1.webp',4,1,4],talk:['chota-talk.webp',3,1,3]};
import {wardrobePoses} from './pose-data.mjs';
const poses=process.argv.includes('--fit')?{base:wardrobePoses.base.slice(0,3)}:wardrobePoses;
const palettes={negro:'#292c33',crema:'#c6bfa9',rojo:'#c61b31',azul:'#285ca9',oliva:'#626c44',morado:'#7651a1'};
const num=n=>+n.toFixed(2),pt=([x,y])=>`${num(x)} ${num(y)}`;
function sleeve(points){const puff=points[2][1]<points[0][1]-10?31:27;let d=`M${pt(points[0])}Q${pt(points[1])} ${pt(points[2])}`;let out=`<path d="${d}" fill="none" stroke="#18191d" stroke-width="${puff}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="var(--coat-color,#c61b31)" stroke-width="${puff-4}" stroke-linecap="round"/><path d="M${pt(points[0])}L${pt([points[0][0]+(points[1][0]-points[0][0])*.55,points[0][1]+(points[1][1]-points[0][1])*.55])}" fill="none" stroke="#282b32" stroke-width="${puff-4}" stroke-linecap="round"/>`;
 for(const t of [.37,.66,.9]){const p=[(1-t)**2*points[0][0]+2*(1-t)*t*points[1][0]+t*t*points[2][0],(1-t)**2*points[0][1]+2*(1-t)*t*points[1][1]+t*t*points[2][1]],v=[2*(1-t)*(points[1][0]-points[0][0])+2*t*(points[2][0]-points[1][0]),2*(1-t)*(points[1][1]-points[0][1])+2*t*(points[2][1]-points[1][1])],length=Math.hypot(...v),n=[-v[1]/length*9,v[0]/length*9];out+=`<path d="M${pt([p[0]-n[0],p[1]-n[1]])}Q${pt([p[0]+v[0]/length*2,p[1]+v[1]/length*2])} ${pt([p[0]+n[0],p[1]+n[1]])}" fill="none" stroke="#171a22" stroke-opacity=".7" stroke-width="1.4"/>`;}
 const w=points[2],e=points[1],l=Math.hypot(w[0]-e[0],w[1]-e[1]),n=[-(w[1]-e[1])/l*10,(w[0]-e[0])/l*8];out+=`<path d="M${pt([w[0]-n[0],w[1]-n[1]])}L${pt([w[0]+n[0],w[1]+n[1]])}" stroke="#292d34" stroke-width="5"/>`;return out;}
function torso(p){const [x,y,w,h,r]=p.body;return `<g transform="translate(${x} ${y}) rotate(${r}) scale(${w/55} ${h/50})"><path d="M-16 0Q-29 1-32 12L-32 40Q-33 47-24 49Q2 54 25 49L28 42 27 13Q25 6 15 2L7 5-7 3Z" fill="var(--coat-color,#c61b31)" stroke="#18191d" stroke-width="2.6" stroke-linejoin="round"/><path d="M-16 0Q-29 2-32 12L-32 19Q-13 22 2 20Q16 22 28 18L27 13Q23 5 15 2L7 5-7 3Z" fill="#252932"/><path d="M-18 0Q-3 5 14 1L18 7Q3 12-18 6Z" fill="#31353c" stroke="#17191d" stroke-width="1.5"/><path d="M-27 27Q0 32 27 27M-27 38Q0 43 27 38" fill="none" stroke="#131821" stroke-opacity=".75" stroke-width="1.5"/><path d="M-23 23Q-10 27-1 25M6 25Q18 27 23 23M-23 34Q-10 38-1 36M6 36Q18 38 23 34" fill="none" stroke="#ffffff" stroke-opacity=".12" stroke-width="2.8" stroke-linecap="round"/><path d="M-14 32L-18 44M18 33L22 44" stroke="#11151c" stroke-width="3.5"/><path d="M-14 32L-18 44M18 33L22 44" stroke="#ffffff" stroke-opacity=".14" stroke-width="1"/><path d="M2 9L4 51" stroke="#12161c" stroke-width="3.3"/><path d="M2 9L4 51" stroke="#c3c8cc" stroke-width="1" stroke-dasharray="1 1"/><rect x=".5" y="11" width="3.5" height="5" rx=".6" fill="#b6bdc3" stroke="#20242a" stroke-width=".8"/><g transform="translate(12 13)" fill="#f3f5f6"><text x="0" y="0" font-size="2.4" font-weight="700" font-family="Arial">THE</text><text x="-2" y="2.3" font-size="2.4" font-weight="700" font-family="Arial">NORTH</text><text x="0" y="4.6" font-size="2.4" font-weight="700" font-family="Arial">FACE</text><path d="M6-2Q12-2 12 5M6 0Q10 0 10 5M6 2Q8 2 8 5" fill="none" stroke="#f3f5f6" stroke-width="1"/></g></g>`;}
// Read-only pixel runs cut the original head and hands out of the garment overlay.
// No original raster is edited, resampled, composited or exported.
function insidePolygon(x,y,p){let inside=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const [a,b]=p[i],[c,d]=p[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;}return inside;}
function opaqueRuns(data,width,offset,box,pose,kind){let result='';const [x0,y0,x1,y1]=box.map(v=>Math.round(v));for(let y=y0;y<y1;y++){let start=-1;for(let x=x0;x<=x1;x++){const at=((offset[1]+y)*width+offset[0]+x)*4,[r,g,b,a]=data.subarray(at,at+4);const skin=(r-b>38&&r-g>12)||(r>240&&g>205&&b<210)||(Math.max(r,g,b)<100);let keep=kind==='hand'?skin:y<(pose.headSolidUntil??118)||skin;if(kind==='head'){if(pose.headPolygon)keep=insidePolygon(x+.5,y+.5,pose.headPolygon)&&(y<(pose.headSolidUntil??pose.body[1]-20)||skin);if(Math.abs(pose.body[4])<40&&y>pose.body[1]-3&&x<pose.body[0]-36)keep=false;for(const arm of pose.arms)for(let j=0;j<30;j++){const t=j/29,px=(1-t)**2*arm[0][0]+2*(1-t)*t*arm[1][0]+t*t*arm[2][0],py=(1-t)**2*arm[0][1]+2*(1-t)*t*arm[1][1]+t*t*arm[2][1];if(Math.hypot(x-px,y-py)<17&&arm[2][1]<arm[0][1]-10)keep=false;}}if(kind==='hand'&&pose.handPolygons)keep=pose.handPolygons.some(p=>insidePolygon(x+.5,y+.5,p));const visible=x<x1&&a>96&&keep;if(visible&&start<0)start=x;if(!visible&&start>=0){result+=`M${start} ${y}h${x-start}v1h-${x-start}Z`;start=-1;}}}return result;}

function coverageBacker(data,width,offset,pose){
 const [cx,top,w,h]=pose.body,x0=Math.max(0,Math.floor(cx-70)),x1=Math.min(255,Math.ceil(cx+52)),y0=Math.max(0,Math.floor(top-4)),y1=Math.min(255,Math.ceil(top+h+7)),white=new Set();
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const at=((offset[1]+y)*width+offset[0]+x)*4,[r,g,b,a]=data.subarray(at,at+4);if(a>128&&Math.min(r,g,b)>115&&Math.max(r,g,b)-Math.min(r,g,b)<34)white.add(y*256+x);}
 const components=[];while(white.size){const first=white.values().next().value,queue=[first],component=[];white.delete(first);for(let n=0;n<queue.length;n++){const key=queue[n],x=key%256,y=Math.floor(key/256);component.push([x,y]);for(const dx of [-1,0,1])for(const dy of [-1,0,1]){const next=(y+dy)*256+x+dx;if(white.delete(next))queue.push(next);}}if(component.length>=12)components.push(component);}
 const selected=components.filter(c=>c.some(([x,y])=>Math.abs(x-cx)<w*.48&&y>top+3&&y<top+h+2)||c.some(([x,y])=>pose.arms.some(arm=>Math.hypot(x-arm[0][0],y-arm[0][1])<30)));
 const pixels=new Set(selected.flat().map(([x,y])=>y*256+x));let upper='',lower='';for(let y=y0;y<=y1;y++){let start=-1;for(let x=x0;x<=x1+1;x++){if(pixels.has(y*256+x)){if(start<0)start=x;}else if(start>=0){const run='M'+start+' '+y+'h'+(x-start)+'v1h-'+(x-start)+'Z';if(y<top+20)upper+=run;else lower+=run;start=-1;}}}
 return '<path d="'+upper+'" fill="#252932" stroke="#1b1c21" stroke-width="2.5" stroke-linejoin="round"/><path d="'+lower+'" fill="var(--coat-color,#c61b31)" stroke="#1b1c21" stroke-width="2.5" stroke-linejoin="round"/>';
}

let symbols='',manifest=[],runtime=[];
fs.mkdirSync('/private/tmp/claude-501/-Users-raulculsan-Documents-Codex-2026-07-29-co-work-The-Big-Boy-Rules/e03939fd-6420-4c6c-a52c-8c6d6c1807be/scratchpad/rig256/coats/editable',{recursive:true});
for(const [sheet,entries]of Object.entries(poses)){
 const [file,cols,rows]=sources[sheet],sourcePath=path.join(root,'icons/mascot/chota-v2',file),{data,info}=await sharp(sourcePath).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const atlases=Object.fromEntries(Object.keys(palettes).map(color=>[color,[]])),qa=[];
 for(let i=0;i<entries.length;i++){
  const pose=entries[i],offset=[i%cols*256,Math.floor(i/cols)*256],id=`coat-${sheet}-${i}`;
  let cut=opaqueRuns(data,info.width,offset,pose.head,pose,'head');for(const [x,y,r]of pose.hands)cut+=opaqueRuns(data,info.width,offset,[x-r,y-r,x+r,y+r],pose,'hand');
  let body=torso(pose);
  if(pose.back)body=body.replace(/<path d="M-14 32[^]*?<g transform="translate\(12 13\)"/,'<g transform="translate(12 13)"');
  const art=`<defs><mask id="mask-${sheet}-${i}" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256"><rect width="256" height="256" fill="white"/><path d="${cut}" fill="black"/></mask></defs><g mask="url(#mask-${sheet}-${i})">${coverageBacker(data,info.width,offset,pose)}${sleeve(pose.arms[1])}${body}${sleeve(pose.arms[0])}</g>`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">${art}</svg>`;
  fs.writeFileSync(`/private/tmp/claude-501/-Users-raulculsan-Documents-Codex-2026-07-29-co-work-The-Big-Boy-Rules/e03939fd-6420-4c6c-a52c-8c6d6c1807be/scratchpad/rig256/coats/editable/${sheet}-${String(i).padStart(2,'0')}.svg`,svg);
  symbols+=`<symbol id="${id}" viewBox="0 0 256 256">${art}</symbol>`;
  for(const [color,hex]of Object.entries(palettes)){
   const pixel=await sharp(Buffer.from(svg.replaceAll('var(--coat-color,#c61b31)',hex))).png().toBuffer();
   atlases[color].push({input:pixel,left:i%cols*256,top:Math.floor(i/cols)*256});
   if(color==='rojo'){
    if(sheet==='base'&&i<3)fs.writeFileSync(`/private/tmp/claude-501/-Users-raulculsan-Documents-Codex-2026-07-29-co-work-The-Big-Boy-Rules/e03939fd-6420-4c6c-a52c-8c6d6c1807be/scratchpad/rig256/coats/fit-base-${i}.png`,pixel);
    qa.push({input:await sharp(sourcePath).extract({left:offset[0],top:offset[1],width:256,height:256}).png().toBuffer(),left:i%cols*256,top:Math.floor(i/cols)*280});
    qa.push({input:await sharp(pixel).resize(256,256,{kernel:'nearest'}).png().toBuffer(),left:i%cols*256,top:Math.floor(i/cols)*280});
    const caption=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="24"><text x="10" y="18" fill="#ffffff" font-family="Arial" font-size="14">${sheet} ${i}</text></svg>`);qa.push({input:caption,left:i%cols*256,top:Math.floor(i/cols)*280+256});
   }
  }
  manifest.push({sheet,frame:i,...pose});
 }
 for(const [color,layers]of Object.entries(atlases)){
  const asset=`icons/mascot/chota-v2/wardrobe/tnf-${color}-${sheet}-v2.webp`;
  await sharp({create:{width:cols*256,height:rows*256,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).webp({lossless:true,effort:6}).toFile(path.join(root,asset));
  runtime.push({color,sheet,asset,cols,rows,count:entries.length,cell:256,bytes:fs.statSync(path.join(root,asset)).size});
 }
 await sharp({create:{width:cols*256,height:rows*280,channels:4,background:'#24282b'}}).composite(qa).png().toFile(`/private/tmp/claude-501/-Users-raulculsan-Documents-Codex-2026-07-29-co-work-The-Big-Boy-Rules/e03939fd-6420-4c6c-a52c-8c6d6c1807be/scratchpad/rig256/coats/qa-${sheet}.png`);
}
fs.writeFileSync('/private/tmp/claude-501/-Users-raulculsan-Documents-Codex-2026-07-29-co-work-The-Big-Boy-Rules/e03939fd-6420-4c6c-a52c-8c6d6c1807be/scratchpad/rig256/coats/rig-editable.svg',`<svg xmlns="http://www.w3.org/2000/svg"><defs>${symbols}</defs></svg>`);
fs.writeFileSync('/private/tmp/claude-501/-Users-raulculsan-Documents-Codex-2026-07-29-co-work-The-Big-Boy-Rules/e03939fd-6420-4c6c-a52c-8c6d6c1807be/scratchpad/rig256/coats/poses.json',JSON.stringify(manifest,null,2));
fs.writeFileSync('/private/tmp/claude-501/-Users-raulculsan-Documents-Codex-2026-07-29-co-work-The-Big-Boy-Rules/e03939fd-6420-4c6c-a52c-8c6d6c1807be/scratchpad/rig256/coats/runtime-manifest.json',JSON.stringify({cell:128,poseCount:manifest.length,palettes,sources:Object.values(sources).map(([file])=>({file:'icons/mascot/chota-v2/'+file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'icons/mascot/chota-v2',file))).digest('hex')})),runtime},null,2));
console.log('Built',manifest.length,'poses × 6 colors,',runtime.reduce((n,row)=>n+row.bytes,0),'runtime bytes');
