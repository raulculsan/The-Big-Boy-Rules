import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import{loadSharp}from'../../wardrobe-rig-v1/load-sharp.mjs';
const sharp=await loadSharp(),out='/private/tmp/claude-501/-Users-raulculsan-Documents-Codex-2026-07-29-co-work-The-Big-Boy-Rules/e03939fd-6420-4c6c-a52c-8c6d6c1807be/scratchpad/rig256/shirts',root=path.resolve(import.meta.dirname,'../../../..');
const sources={base:['chota-poses.webp',6,4,24],directional:['chota-directional-v1.webp',5,4,20],contextual:['chota-contextual-v1.webp',4,4,16],room:['chota-room-life-v1.webp',4,1,4],talk:['chota-talk.webp',3,1,3]};
const variants={'carhartt-crudo':{base:'#d7ceba',brand:'carhartt',mark:'#765637'},'carhartt-oliva':{base:'#596348',brand:'carhartt',mark:'#d5c5a5'},'supreme-negra':{base:'#23252a',brand:'supreme',mark:'#d72938'},'supreme-roja':{base:'#ba2633',brand:'supreme',mark:'#8f1926'},'stussy-blanca':{base:'#ece9e2',brand:'stussy',mark:'#171a20'},'stussy-azul':{base:'#285b8f',brand:'stussy',mark:'#eee9db'}};
const poses=JSON.parse(fs.readFileSync(path.join(root,'artwork/chota/wardrobe-rig-v1/poses.json'),'utf8')),num=x=>Math.round(x*100)/100;
fs.mkdirSync(path.join(out,'editable'),{recursive:true});fs.mkdirSync(path.join(root,'icons/mascot/chota-v2/wardrobe-topwear'),{recursive:true});
function runs(mask){let d='';for(let y=0;y<256;y++){let start=-1;for(let x=0;x<=256;x++){const on=x<256&&mask[y*256+x];if(on&&start<0)start=x;if(!on&&start>=0){d+=`M${start} ${y}h${x-start}v1h-${x-start}Z`;start=-1;}}}return d;}
function rgb(hex){return hex.slice(1).match(/../g).map(x=>parseInt(x,16))}function shade(hex,f){return'#'+rgb(hex).map(n=>Math.round(Math.min(255,n*f)).toString(16).padStart(2,'0')).join('')}
function componentMask(data,info,offset,pose){
 const[cx,cy,w,h,angle]=pose.body,a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),candidate=new Uint8Array(65536),selected=new Uint8Array(65536),seen=new Uint8Array(65536),local=(x,y)=>({u:(x-cx)*c+(y-cy)*s,v:-(x-cx)*s+(y-cy)*c});
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){const at=((offset[1]+y)*info.width+offset[0]+x)*4,[r,g,b,alpha]=data.subarray(at,at+4),{u,v}=local(x,y),body=Math.abs(u)<w*.8&&v>-4&&v<h+7,arm=pose.arms.some(p=>Math.hypot(x-p[0][0],y-p[0][1])<23);if(alpha>128&&Math.min(r,g,b)>85&&Math.max(r,g,b)-Math.min(r,g,b)<42&&(body||arm))candidate[y*256+x]=1;}
 for(let start=0;start<65536;start++){if(!candidate[start]||seen[start])continue;const q=[start];seen[start]=1;let touchesBody=false;for(let j=0;j<q.length;j++){const key=q[j],x=key%256,y=key>>8,{u,v}=local(x,y);if(Math.abs(u)<w*.58&&v>h*.1&&v<h*.97)touchesBody=true;for(const[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){const nx=x+dx,ny=y+dy,nk=ny*256+nx;if(nx>=0&&nx<256&&ny>=0&&ny<256&&candidate[nk]&&!seen[nk]){seen[nk]=1;q.push(nk);}}}if(touchesBody)for(const key of q)selected[key]=1;}
 // Fill enclosed lettering holes, never the open background or paws.
 const outside=new Uint8Array(65536),queue=[];for(let x=0;x<256;x++){queue.push(x,255*256+x)}for(let y=0;y<256;y++){queue.push(y*256,y*256+255)}
 for(let j=0;j<queue.length;j++){const key=queue[j];if(outside[key]||selected[key])continue;outside[key]=1;const x=key%256,y=key>>8;if(x>0&&!outside[key-1]&&!selected[key-1])queue.push(key-1);if(x<255&&!outside[key+1]&&!selected[key+1])queue.push(key+1);if(y>0&&!outside[key-256]&&!selected[key-256])queue.push(key-256);if(y<255&&!outside[key+256]&&!selected[key+256])queue.push(key+256);}
 // Close neutral lettering/crease gaps only inside real cloth row spans. Orange fur and blue denim are excluded.
 for(let y=0;y<256;y++){let first=256,last=-1;for(let x=0;x<256;x++)if(selected[y*256+x]){first=Math.min(first,x);last=x;}for(let x=first;x<=last;x++){const at=((offset[1]+y)*info.width+offset[0]+x)*4,[r,g,b,alpha]=data.subarray(at,at+4),{u,v}=local(x,y);if(alpha>128&&Math.abs(u)<w*.64&&v>h*.08&&v<h*.82&&(Math.max(r,g,b)-Math.min(r,g,b)<55||Math.max(r,g,b)<65))selected[y*256+x]=1;}}
 const bins=Array.from({length:12},()=>new Uint8Array(65536));let pixels=0;for(let key=0;key<65536;key++){const x=key%256,y=key>>8,at=((offset[1]+y)*info.width+offset[0]+x)*4,[r,g,b,alpha]=data.subarray(at,at+4),{u,v}=local(x,y);if(!selected[key]&&!outside[key]&&alpha>128&&Math.abs(u)<w*.75&&v>-4&&v<h+7)selected[key]=1;if(selected[key]){pixels++;const lum=r*.2126+g*.7152+b*.0722,oldPrint=u>-w*.32&&u<w*.38&&v>h*.08&&v<h*.56,index=oldPrint?10:lum<100?9:Math.max(0,Math.min(11,Math.round((lum-100)/14)));bins[index][key]=1;}}
 if(pixels<70)throw Error('Shirt mask too small: '+pixels);return{mask:selected,bins,pixels};
}
function brandMark(pose,brand,color){if(pose.back)return'';const[cx,cy,w,h,angle]=pose.body,x=num(w*.01),y=num(h*.18),scale=num(w/69);let mark='';
 if(brand==='carhartt')mark=`<path d="M1 0H15V12L8 16 1 12Z" fill="none" stroke="${color}" stroke-opacity=".7" stroke-width=".8"/><rect x="6" y="5" width="6.5" height="7" rx=".5" fill="#e3d1ac" stroke="#806541" stroke-width=".55"/><path d="M11.2 6.4C7.6 5.4 6.6 10.7 11.3 10.6V9.2C9 9.8 8.7 7.5 11.1 7.6Z" fill="#a58039"/>`;
 if(brand==='supreme')mark=`<rect x="-7" y="1" width="29" height="9" rx=".5" fill="${color}"/><text x="7.5" y="7.7" text-anchor="middle" font-size="6.5" font-family="Arial" font-style="italic" font-weight="700" fill="#ffffff">Supreme</text>`;
 if(brand==='stussy')mark=`<g stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M-7 3Q-1-2 3 0L-4 6Q3 4 4 8Q0 12-7 9M5-2 3 10M0 2 9 1M9 3 7 9 11 6 12 9 16 3M16 3Q21 0 22 3L16 7Q23 5 22 9L17 11M24 2Q30 0 29 3L24 7Q30 5 29 9L24 11M32 2 29 9 34 5 32 14"/></g>`;
 return`<g transform="translate(${cx} ${cy}) rotate(${angle}) translate(${x} ${y}) scale(${scale})">${mark}</g>`;
}
const runtime=[],poseEntries=[],hashes=[];let symbols='';
for(const[sheet,[file,cols,rows,count]]of Object.entries(sources)){
 const source=path.join(root,'icons/mascot/chota-v2',file),sourceBytes=fs.readFileSync(source),{data,info}=await sharp(sourceBytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});hashes.push({file:'icons/mascot/chota-v2/'+file,sha256:crypto.createHash('sha256').update(sourceBytes).digest('hex')});
 const atlases=Object.fromEntries(Object.keys(variants).map(key=>[key,[]]));
 for(let frame=0;frame<count;frame++){
  const pose=poses.find(p=>p.sheet===sheet&&p.frame===frame),offset=[frame%cols*256,Math.floor(frame/cols)*256],{mask,bins,pixels}=componentMask(data,info,offset,pose),id=sheet+'-'+frame,clip=runs(mask);
  const art=`<defs><clipPath id="shirt-${id}"><path shape-rendering="crispEdges" d="${clip}"/></clipPath></defs>`+bins.map((bin,i)=>`<path shape-rendering="crispEdges" d="${runs(bin)}" fill="var(--shade-${i})"/>`).join('');
  poseEntries.push({sheet,frame,pixels,angle:pose.body[4],mask:'editable/'+id+'.svg'});
  for(const[key,palette]of Object.entries(variants)){
   let base=art;for(let i=0;i<12;i++)base=base.replaceAll(`var(--shade-${i})`,shade(palette.base,.42+i*.057));
   const body=base+`<g clip-path="url(#shirt-${id})">${brandMark(pose,palette.brand,palette.mark)}</g>`,svg=`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">${body}</svg>`,raster=await sharp(Buffer.from(svg)).png().toBuffer(),overlay=raster;
   atlases[key].push({input:overlay,left:frame%cols*256,top:Math.floor(frame/cols)*256});
   if(key==='carhartt-crudo'){symbols+=`<symbol id="topwear-${id}" viewBox="0 0 256 256">${body}</symbol>`;fs.writeFileSync(path.join(out,'editable',id+'.svg'),svg);}
   if((sheet==='base'&&[0,2,6,20,22].includes(frame))||sheet==='room'){
    const original=await sharp(sourceBytes).extract({left:offset[0],top:offset[1],width:256,height:256}).png().toBuffer(),full=await sharp(original).composite([{input:await sharp(overlay).resize(256,256,{kernel:'nearest'}).png().toBuffer()}]).png().toBuffer();fs.writeFileSync(path.join(out,key+'-'+sheet+'-'+frame+'.png'),full);
   }
  }
 }
 for(const[key,layers]of Object.entries(atlases)){const relative=`icons/mascot/chota-v2/wardrobe-topwear/${key}-${sheet}-v2.webp`;await sharp({create:{width:cols*256,height:rows*256,channels:4,background:'#00000000'}}).composite(layers).webp({lossless:true,effort:6}).toFile(path.join(root,relative));runtime.push({variant:key,sheet,cols,rows,count,cell:256,path:relative,bytes:fs.statSync(path.join(root,relative)).size});}
}
fs.writeFileSync(path.join(out,'rig-editable.svg'),`<svg xmlns="http://www.w3.org/2000/svg"><defs>${symbols}</defs></svg>`);
fs.writeFileSync(path.join(out,'poses.json'),JSON.stringify(poseEntries,null,2)+'\n');fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({slot:'topwear',rig_version:'chota-topwear-overlay-v1',rig_ready:false,qa_status:'pending_visual_review',compatible_with_current_renderer:false,animated_runtime_ready:false,integration_required:'Add independent topwear ownership/equip/render slot; current runtime supports outerwear and bottomwear.',cell:128,poseCount:67,price_coins:null,variants,sources:hashes,runtime},null,2)+'\n');console.log(JSON.stringify({poses:poseEntries.length,atlases:runtime.length,bytes:runtime.reduce((n,a)=>n+a.bytes,0)}));
