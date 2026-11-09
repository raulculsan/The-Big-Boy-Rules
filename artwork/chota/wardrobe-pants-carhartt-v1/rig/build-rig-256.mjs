// Standalone preparation: never edits the app, database or original sprite sheets.
import fs from'node:fs';import path from'node:path';import crypto from'node:crypto';import{loadSharp}from'../../wardrobe-rig-v1/load-sharp.mjs';
const sharp=await loadSharp(),root=path.resolve(import.meta.dirname,'../../../..'),out='/private/tmp/claude-501/-Users-raulculsan-Documents-Codex-2026-07-29-co-work-The-Big-Boy-Rules/e03939fd-6420-4c6c-a52c-8c6d6c1807be/scratchpad/rig256/pants',assets=path.join(root,'icons/mascot/chota-v2/wardrobe-bottomwear');
const sources={base:['chota-poses.webp',6,4,24],directional:['chota-directional-v1.webp',5,4,20],contextual:['chota-contextual-v1.webp',4,4,16],room:['chota-room-life-v1.webp',4,1,4],talk:['chota-talk.webp',3,1,3]};
const poses=JSON.parse(fs.readFileSync(path.join(root,'artwork/chota/wardrobe-rig-v1/poses.json'),'utf8')),variants={marron:{base:'#8b5834',shadow:'#533723',thread:'#c29868'},'azul-oscuro':{base:'#172944',shadow:'#101b30',thread:'#506987'}},num=x=>Math.round(x*100)/100;
fs.mkdirSync(path.join(out,'editable'),{recursive:true});fs.mkdirSync(assets,{recursive:true});const manifest=[],runtime=[],hashes=[];let symbols='';
function runs(mask,width=256){let d='';for(let y=0;y<256;y++){let start=-1;for(let x=0;x<=256;x++){const on=x<256&&mask[y*width+x];if(on&&start<0)start=x;if(!on&&start>=0){d+=`M${start} ${y}h${x-start}v1h-${x-start}Z`;start=-1;}}}return d;}
function rgb(hex){return hex.slice(1).match(/../g).map(x=>parseInt(x,16));}function color(hex,f){return'#'+rgb(hex).map(x=>Math.round(Math.min(255,x*f)).toString(16).padStart(2,'0')).join('');}
for(const[sheet,[filename,cols,rows,count]]of Object.entries(sources)){
 const source=path.join(root,'icons/mascot/chota-v2',filename),sourceBytes=fs.readFileSync(source),{data,info}=await sharp(sourceBytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});hashes.push({file:'icons/mascot/chota-v2/'+filename,sha256:crypto.createHash('sha256').update(sourceBytes).digest('hex')});
 const composites=Object.fromEntries(Object.keys(variants).map(key=>[key,[]])),qa=[];
 for(let frame=0;frame<count;frame++){
  const pose=poses.find(p=>p.sheet===sheet&&p.frame===frame),angle=pose.body[4],a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),[cx,cy,w,h]=pose.body,left=frame%cols*256,top=Math.floor(frame/cols)*256,mask=new Uint8Array(256*256),bins=Array.from({length:12},()=>new Uint8Array(256*256)),points=[];
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
   const at=((top+y)*info.width+left+x)*4,[r,g,b,alpha]=data.subarray(at,at+4),ly=-(x-cx)*s+(y-cy)*c;
   if(alpha<128||b-r<13||g-r<4||b-g<1||ly<h*.62)continue;
   const key=y*256+x,lum=r*.2126+g*.7152+b*.0722;mask[key]=1;bins[Math.min(11,Math.floor(lum/15))][key]=1;points.push({x,y,u:(x-cx)*c+(y-cy)*s,v:ly});
  }
  if(points.length<80)throw Error('Insufficient denim region: '+sheet+' '+frame+' ('+points.length+')');
  const minU=Math.min(...points.map(p=>p.u)),maxU=Math.max(...points.map(p=>p.u)),minV=Math.min(...points.map(p=>p.v)),maxV=Math.max(...points.map(p=>p.v)),pw=maxU-minU,ph=maxV-minV,clip=runs(mask),id=sheet+'-'+frame;
  const panel=(u,v,width,height)=>`<rect x="${num(minU+pw*u)}" y="${num(minV+ph*v)}" width="${num(pw*width)}" height="${num(ph*height)}" rx="1.2" fill="var(--panel)" fill-opacity=".22" stroke="var(--panel)" stroke-opacity=".45" stroke-width=".75"/>`;
  const details=`<g clip-path="url(#pants-${id})"><g transform="translate(${cx} ${cy}) rotate(${angle})">${panel(.08,.33,.32,.46)}${panel(.58,.33,.32,.46)}${panel(.82,.10,.16,.29)}<path d="M${num(minU+pw*.84)} ${num(minV+ph*.16)}h${num(pw*.11)}" fill="none" stroke="var(--thread)" stroke-width=".9"/><g transform="translate(${num(minU+pw*.80)} ${num(minV+ph*.11)})"><rect x="0" y="0" width="6" height="6.5" rx=".7" fill="#dbc59d" stroke="#785f3b" stroke-width=".65"/><path d="M4.6 1.2C1 0.5 .4 5.7 4.7 5.3L4.7 4.1C2.1 4.8 1.9 2.3 4.5 2.4Z" fill="#aa823e"/></g></g></g>`;
  const art=`<defs><clipPath id="pants-${id}"><path shape-rendering="crispEdges" d="${clip}"/></clipPath></defs>`+bins.map((bin,i)=>`<path shape-rendering="crispEdges" d="${runs(bin)}" fill="var(--shade-${i})"/>`).join('')+details;
  const template=`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">${art}</svg>`;const paint=(template,palette)=>{let svg=template.replaceAll('var(--panel)',palette.shadow).replaceAll('var(--thread)',palette.thread);for(let i=0;i<12;i++)svg=svg.replaceAll(`var(--shade-${i})`,color(palette.base,.43+i*.105));return svg;};
  fs.writeFileSync(path.join(out,'editable',id+'.svg'),paint(template,variants.marron));
  symbols+=`<symbol id="bottomwear-${id}" viewBox="0 0 256 256">${paint(art,variants.marron)}</symbol>`;
  let variantIndex=0;
  for(const[key,palette]of Object.entries(variants)){
   const svg=paint(template,palette);
   const overlay=await sharp(Buffer.from(svg)).png().toBuffer();composites[key].push({input:overlay,left:frame%cols*256,top:Math.floor(frame/cols)*256});
   const original=await sharp(sourceBytes).extract({left,top,width:256,height:256}).png().toBuffer(),full=await sharp(original).composite([{input:await sharp(overlay).resize(256,256,{kernel:'nearest'}).png().toBuffer()}]).png().toBuffer();
   qa.push({input:full,left:frame%cols*256,top:(Math.floor(frame/cols)*2+variantIndex)*280});
   const caption=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="24"><text x="8" y="17" fill="white" font-family="Arial" font-size="13">${sheet} ${frame} · ${key}</text></svg>`);qa.push({input:caption,left:frame%cols*256,top:(Math.floor(frame/cols)*2+variantIndex)*280+256});
   if((sheet==='base'&&[0,6,7,15,19,20,21,22,23].includes(frame))||sheet==='room')fs.writeFileSync(path.join(out,`${key}-${sheet}-${frame}.png`),full);
   variantIndex++;
  }
  manifest.push({sheet,frame,angle,pixels:points.length,bounds:[num(minU),num(minV),num(pw),num(ph)],mask:'editable/'+id+'.svg'});
 }
 for(const[key,layers]of Object.entries(composites)){
  const relative=`icons/mascot/chota-v2/wardrobe-bottomwear/carhartt-${key}-${sheet}-v2.webp`;await sharp({create:{width:cols*256,height:rows*256,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).webp({lossless:true,effort:6}).toFile(path.join(root,relative));runtime.push({variant:key,sheet,cols,rows,count,cell:128,path:relative,bytes:fs.statSync(path.join(root,relative)).size});
 }
 await sharp({create:{width:cols*256,height:rows*560,channels:4,background:'#22282b'}}).composite(qa).png().toFile(path.join(out,'qa-'+sheet+'.png'));
}
fs.writeFileSync(path.join(out,'rig-editable.svg'),`<svg xmlns="http://www.w3.org/2000/svg"><defs>${symbols}</defs></svg>`);
fs.writeFileSync(path.join(out,'poses.json'),JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({slot:'bottomwear',rig_version:'chota-bottomwear-overlay-v1',rig_ready:true,qa_status:'reviewed_67_poses_two_variants',animated_runtime_ready:false,compatible_with_current_renderer:false,integration_required:'Multi-slot garment renderer + server ownership/equip for bottomwear. Current runtime only supports outerwear.',cell:128,poseCount:67,price_coins:null,variants,sources:hashes,runtime},null,2)+'\n');console.log(JSON.stringify({poses:manifest.length,atlases:runtime.length,bytes:runtime.reduce((n,a)=>n+a.bytes,0)},null,2));
