// Every visible source pixel has one owner. No whole clothed actor sits beneath
// another shirt/trouser/shoe layer, and independent originals use this same rig.
export function partition(source,tee,jeans,shoes,p){const labels=new Uint8Array(65536),seeds=[tee,jeans,shoes],distance=new Uint16Array(65536).fill(65535),nearest=new Uint8Array(65536),queue=new Int32Array(65536);let end=0;
 for(let k=0;k<65536;k++){const i=k*4;if(source[i+3]<128)continue;const[r,g,b]=source.subarray(i,i+3);labels[k]=shoes[i+3]?3:tee[i+3]?1:jeans[i+3]?2:0;if(tee[i+3]&&jeans[i+3])labels[k]=b-r>13&&g-r>4?2:1;}
 // Recover true red leather highlights omitted by the original fur-color
 // heuristic. Restrict this to the original shoe neighborhood, never a paw/tail.
 const angle=p.body[4]*Math.PI/180;
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){const k=y*256+x,i=k*4,[r,g,b,a]=source.subarray(i,i+4),v=-(x-p.body[0])*Math.sin(angle)+(y-p.body[1])*Math.cos(angle);if(labels[k]||a<128||v<=p.body[3]*.65||!(r>120&&r>g*1.8&&r>b*1.3&&g<90&&g/r<.32&&b>g*.55))continue;let near=false;for(let dy=-5;dy<=5&&!near;dy++)for(let dx=-5;dx<=5;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<256&&yy>=0&&yy<256&&shoes[(yy*256+xx)*4+3]>128){near=true;break;}}if(near)labels[k]=3;}
 // Source shoe extraction omitted some dark lace/sole pixels. Complete the
 // opaque artist-drawn row spans, while retaining trousers and true warm fur.
 for(let y=0;y<256;y++){let lo=256,hi=-1;for(let x=0;x<256;x++)if(labels[y*256+x]===3){lo=Math.min(lo,x);hi=x;}for(let x=lo;x<=hi;x++){const k=y*256+x,i=k*4,[r,g,b,a]=source.subarray(i,i+4),fur=r>90&&g>55&&g/r>.32&&r-b>25&&g-b>15;if(a>=128&&!labels[k]&&!fur)labels[k]=3;}}
 for(let k=0;k<65536;k++)if(labels[k]){distance[k]=0;nearest[k]=labels[k];queue[end++]=k;}
 for(let j=0;j<end;j++){const k=queue[j],x=k%256,y=k>>8;if(distance[k]>=12)continue;for(const n of [x>0?k-1:-1,x<255?k+1:-1,y>0?k-256:-1,y<255?k+256:-1])if(n>=0&&distance[n]===65535){distance[n]=distance[k]+1;nearest[n]=nearest[k];queue[end++]=n;}}
 for(let k=0;k<65536;k++)if(!labels[k]&&distance[k]<=2){const i=k*4,[r,g,b,a]=source.subarray(i,i+4),fur=r>90&&g>55&&g/r>.32&&r-b>25&&g-b>15;if(a>=128&&!fur&&Math.max(r,g,b)<110)labels[k]=nearest[k];}
 // Claude 2026-11-09: paw fur resting on the tee/jeans was extracted with the
 // garment and then recoloured (a garment-coloured patch on the paw). Warm fur
 // inside a hand circle is anatomy whatever the garment masks said.
 for(let k=0;k<65536;k++){const l=labels[k];if(l!==1&&l!==2)continue;const x=k%256,y=k>>8,i=k*4,r=source[i],g=source[i+1],b=source[i+2],nearHand=(p.hands||[]).some(([hx,hy,rr])=>Math.hypot(x-hx,y-hy)<rr+6);
  // The old tee is neutral white and the jeans blue: warm fur/cream is never cloth.
  if((r>150&&r-b>30&&g>90&&r>=g)||(nearHand&&r>170&&r-b>12&&r>=g))labels[k]=0;}
 // Pale cream paw pads and the white collar band of the old tee: anything
 // near-neutral white left unlabelled right against the tee belongs to the tee
 // (it was the collar); warm cream inside a hand stays paw (rule above).
 {const near=new Uint16Array(65536).fill(65535),q=[];for(let k=0;k<65536;k++)if(labels[k]===1){near[k]=0;q.push(k);}for(let j=0;j<q.length;j++){const k=q[j],x=k%256,y=k>>8;if(near[k]>=8)continue;for(const n of [x>0?k-1:-1,x<255?k+1:-1,y>0?k-256:-1,y<255?k+256:-1])if(n>=0&&near[n]===65535){near[n]=near[k]+1;q.push(n);}}
  for(let k=0;k<65536;k++){if(labels[k]||near[k]>8||near[k]===0)continue;const i=k*4,r=source[i],g=source[i+1],b=source[i+2],a=source[i+3];if(a<128)continue;const x=k%256,y=k>>8;if((p.hands||[]).some(([hx,hy,rr])=>Math.hypot(x-hx,y-hy)<rr+6))continue;if((near[k]<=3&&Math.min(r,g,b)>190&&Math.max(r,g,b)-Math.min(r,g,b)<18)||(Math.min(r,g,b)>40&&Math.max(r,g,b)-Math.min(r,g,b)<40&&r-b<30))labels[k]=1;}}
 const anatomy=Buffer.alloc(source.length),parts=[null,Buffer.alloc(source.length),Buffer.alloc(source.length),Buffer.alloc(source.length)],foreground=Buffer.alloc(source.length);
 for(let k=0;k<65536;k++){const i=k*4;if(source[i+3]<128)continue;source.copy(labels[k]?parts[labels[k]]:anatomy,i,i,i+4);if(!labels[k]){const x=k%256,y=k>>8,head=p.headPolygon?inside(x,y,p.headPolygon):x>=p.head[0]-8&&x<=p.head[2]+8&&y>=p.head[1]-8&&y<=p.head[3];if(head||p.hands.some(([hx,hy,r])=>Math.hypot(x-hx,y-hy)<r+3))source.copy(foreground,i,i,i+4);}}
 return{labels,distance,nearest,anatomy,parts,foreground};}
function inside(x,y,poly){let result=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const[a,b]=poly[i],[c,d]=poly[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)result=!result;}return result;}
export function bareParts(raw,source,partition,p){const result=[null,Buffer.alloc(raw.length),Buffer.alloc(raw.length),Buffer.alloc(raw.length)],exclude=new Uint8Array(65536),seen=new Uint8Array(65536),white=k=>raw[k*4+3]>128&&raw[k*4]>175&&raw[k*4+1]>135&&raw[k*4+2]>80;
 // Neutral sheets were drawn independently. Suppress their displaced paws;
 // the authoritative source paws/forearms already belong to anatomy above.
 for(let start=0;start<65536;start++)if(!seen[start]&&white(start)){const q=[start];seen[start]=1;let sx=0,sy=0;for(let j=0;j<q.length;j++){const k=q[j],x=k%256,y=k>>8;sx+=x;sy+=y;for(const n of [x>0?k-1:-1,x<255?k+1:-1,y>0?k-256:-1,y<255?k+256:-1])if(n>=0&&!seen[n]&&white(n)){seen[n]=1;q.push(n)}}const center=[sx/q.length,sy/q.length];if(q.length<1300&&q.filter(k=>partition.labels[k]===3||partition.nearest[k]===3).length<q.length*.5&&p.hands.some(([x,y])=>Math.hypot(x-center[0],y-center[1])<26))for(const k of q){const x=k%256,y=k>>8;for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<256&&yy>=0&&yy<256)exclude[yy*256+xx]=1;}}}
 for(let k=0;k<65536;k++){const i=k*4;if(!raw[i+3]||partition.anatomy[i+3]||exclude[k])continue;const slot=partition.labels[k]||partition.nearest[k];if(slot&&partition.distance[k]<=12)raw.copy(result[slot],i,i,i+4);}
 return result;}
// Claude 2026-11-09: pale paw pixels that touched the original tee/jeans were
// labelled as cloth, so removing that garment left a paw-shaped hole (the dark
// rings seen on the bare body). Enclosed transparent gaps inside the all-bare
// actor are filled: warm paw/fur source pixels are kept as drawn, anything else
// takes the nearest surrounding fur colour. Open background is never touched.
export function fillBareHoles(source,partition,bare){
 const opaque=new Uint8Array(65536);
 for(let k=0;k<65536;k++){const i=k*4;if(partition.anatomy[i+3]>=128||bare[1][i+3]>=128||bare[2][i+3]>=128||bare[3][i+3]>=128)opaque[k]=1;}
 // Morphological closing (radius 7) of the bare actor: notches the neutral
 // torso left open towards the neck or a paw are gaps too, not background.
 const bfs=(seed,limit)=>{const d=new Uint16Array(65536).fill(65535),q=[];for(let k=0;k<65536;k++)if(seed(k)){d[k]=0;q.push(k);}for(let j=0;j<q.length;j++){const k=q[j],x=k%256,y=k>>8;if(d[k]>=limit)continue;for(const n of [x>0?k-1:-1,x<255?k+1:-1,y>0?k-256:-1,y<255?k+256:-1,x>0&&y>0?k-257:-1,x<255&&y>0?k-255:-1,x>0&&y<255?k+255:-1,x<255&&y<255?k+257:-1])if(n>=0&&d[n]===65535){d[n]=d[k]+1;q.push(n);}}return d;};
 const R=12,grown=bfs(k=>opaque[k],R),outside=bfs(k=>grown[k]>R,R+1),closed=new Uint8Array(65536);for(let k=0;k<65536;k++)closed[k]=!opaque[k]&&outside[k]>R?1:0;
 // Baggy trousers are wider than his legs, so only the pelvis (the top of the
 // trouser region) may be closed with fur; lower down the gap between legs stays.
 let top=256,bottom=-1;for(let k=0;k<65536;k++)if(partition.labels[k]===2){top=Math.min(top,k>>8);bottom=Math.max(bottom,k>>8);}
 const pelvis=bottom<0?0:top+(bottom-top)*.42;
 const seen=new Uint8Array(65536);let filled=0;
 for(let start=0;start<65536;start++){if(opaque[start]||seen[start])continue;const q=[start];seen[start]=1;let edge=false;
  for(let j=0;j<q.length;j++){const k=q[j],x=k%256,y=k>>8;if(x===0||y===0||x===255||y===255)edge=true;for(const n of [x>0?k-1:-1,x<255?k+1:-1,y>0?k-256:-1,y<255?k+256:-1])if(n>=0&&!opaque[n]&&!seen[n]){seen[n]=1;q.push(n);}}
  const gap=edge||q.length>900?q.filter(k=>{if(!closed[k]||source[k*4+3]<128)return false;const slot=partition.labels[k]||partition.nearest[k];return slot===1||(slot===2&&(k>>8)<pelvis);}):q;if(!gap.length)continue;if(gap!==q){q.length=0;q.push(...gap);}
  const hole=new Set(q),colour=new Map();let frontier=[];
  for(const k of q){const x=k%256,y=k>>8;for(const n of [x>0?k-1:-1,x<255?k+1:-1,y>0?k-256:-1,y<255?k+256:-1])if(n>=0&&!hole.has(n)&&opaque[n]){const i=n*4,src=[partition.anatomy,bare[1],bare[2],bare[3]].find(b=>b[i+3]>=128),c=src.subarray(i,i+4);if(Math.max(c[0],c[1],c[2])<110)continue;colour.set(k,c);frontier.push(k);break;}}
  if(!frontier.length)for(const k of q){const x=k%256,y=k>>8;for(const n of [x>0?k-1:-1,x<255?k+1:-1,y>0?k-256:-1,y<255?k+256:-1])if(n>=0&&!hole.has(n)&&opaque[n]){const i=n*4,src=[partition.anatomy,bare[1],bare[2],bare[3]].find(b=>b[i+3]>=128);colour.set(k,src.subarray(i,i+4));frontier.push(k);break;}}
  for(let j=0;j<frontier.length;j++){const k=frontier[j],x=k%256,y=k>>8;for(const n of [x>0?k-1:-1,x<255?k+1:-1,y>0?k-256:-1,y<255?k+256:-1])if(n>=0&&hole.has(n)&&!colour.has(n)){colour.set(n,colour.get(k));frontier.push(n);}}
  for(const k of q){const i=k*4,slot=partition.labels[k]||partition.nearest[k]||1,[r,g,b,a]=source.subarray(i,i+4),warm=a>=128&&r>150&&r-b>35&&g>90;
   const value=warm?source.subarray(i,i+4):colour.get(k);if(!value)continue;value.copy?value.copy(bare[slot],i,0,4):Buffer.from(value).copy(bare[slot],i);bare[slot][i+3]=255;filled++;}
 }
 return filled;}
