import {loadSharp}from '../../wardrobe-rig-v1/load-sharp.mjs';
const sharp=await loadSharp();
export const tops={'original-stussy':null,'carhartt-crudo':[235,220,195],'carhartt-oliva':[85,99,66],'supreme-negra':[35,37,42],'supreme-roja':[186,38,51],'stussy-blanca':[238,235,228],'stussy-azul':[40,81,140]};
export const bottoms={'original-jeans':null,'carhartt-marron':[126,83,48],'carhartt-azul-oscuro':[35,49,74]};
const markCache=new Map();
export async function loadMarks(root){for(const key of ['supreme-negra','supreme-roja']){const a=await sharp(root+`/artwork/chota/wardrobe-shirts-v1/${key}/front-master.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true}),r=key==='supreme-negra'?[327,195,156,50]:[339,216,150,52];markCache.set(key,await sharp(a.data,{raw:a.info}).extract({left:r[0],top:r[1],width:r[2],height:r[3]}).ensureAlpha().raw().toBuffer({resolveWithObject:true}));}}
export function blankInk(source,tee,p){const d=Buffer.from(source),ink=new Uint8Array(65536),[cx,cy,w,h,angle]=p.body,a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);if(p.back)return{data:d,ink};
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){const k=(y*256+x)*4,u=(x-cx)*c+(y-cy)*s,v=-(x-cx)*s+(y-cy)*c;if(!tee[k+3]||u<=-w*.36||u>=w*.43||v<=h*.10||v>=h*.65||Math.max(...source.subarray(k,k+3))>=220)continue;ink[y*256+x]=1;let choices=[];
  for(let r=1;r<=10&&!choices.length;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(Math.abs(dx)!==r&&Math.abs(dy)!==r)continue;const xx=x+dx,yy=y+dy;if(xx<0||xx>255||yy<0||yy>255)continue;const j=(yy*256+xx)*4;if(tee[j+3]>128&&Math.min(...source.subarray(j,j+3))>225)choices.push(j);}
  if(choices.length)for(let ch=0;ch<3;ch++)d[k+ch]=Math.round(choices.reduce((n,j)=>n+source[j+ch],0)/choices.length);
 }
 // Smooth only the removed letter strokes, not the artist's original folds.
 const before=Buffer.from(d);for(let y=1;y<255;y++)for(let x=1;x<255;x++)if(ink[y*256+x])for(let ch=0;ch<3;ch++){let n=0,total=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const j=((y+dy)*256+x+dx)*4;if(tee[j+3]>128){n++;total+=before[j+ch];}}if(n)d[(y*256+x)*4+ch]=Math.round(total/n);}
 return{data:d,ink};}
export async function render(source,tee,jeans,p,topKey='carhartt-crudo',bottomKey='carhartt-azul-oscuro',prepared){const result=Buffer.from(source),blank=prepared||blankInk(source,tee,p),top=tops[topKey],bottom=bottoms[bottomKey],[cx,cy,w,h,angle]=p.body,rad=angle*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad);
 for(let k=0;k<source.length;k+=4){
  if(top&&tee[k+3]){
   const keepOriginalMark=topKey==='stussy-blanca',material=keepOriginalMark?source:blank.data,light=(material[k]*.213+material[k+1]*.715+material[k+2]*.072)/235;
   for(let ch=0;ch<3;ch++)result[k+ch]=Math.max(0,Math.min(255,Math.round(top[ch]*light)));
   if(topKey==='stussy-azul'&&!p.back&&blank.ink[k>>2]){const strength=Math.max(0,Math.min(1,(220-Math.max(...source.subarray(k,k+3)))/195));for(let ch=0;ch<3;ch++)result[k+ch]=Math.round(result[k+ch]*(1-strength)+[248,241,218][ch]*strength);}
  }
  if(bottom&&jeans[k+3]){const light=(source[k]*.213+source[k+1]*.715+source[k+2]*.072)/102;for(let ch=0;ch<3;ch++)result[k+ch]=Math.max(0,Math.min(255,Math.round(bottom[ch]*Math.pow(light,.9))));}
 }
 if(topKey.startsWith('supreme-')&&!p.back){const mark=markCache.get(topKey),width=w*.46,height=width*mark.info.height/mark.info.width,lx=-w*.20,ly=h*.26;
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){const k=(y*256+x)*4;if(!tee[k+3])continue;const u=(x-cx)*c+(y-cy)*s,v=-(x-cx)*s+(y-cy)*c;if(u<lx||u>=lx+width||v<ly||v>=ly+height)continue;const mx=Math.min(mark.info.width-1,Math.floor((u-lx)/width*mark.info.width)),my=Math.min(mark.info.height-1,Math.floor((v-ly)/height*mark.info.height)),j=(my*mark.info.width+mx)*4,a=mark.data[j+3]/255;for(let ch=0;ch<3;ch++)result[k+ch]=Math.round(result[k+ch]*(1-a)+mark.data[j+ch]*a);}
 }
 if(topKey.startsWith('carhartt-')&&!p.back){const px=w*.16,py=h*.29,pw=w*.145,ph=h*.235,cloth=topKey==='carhartt-oliva'?['#5a6747','#35442e']:['#e4d2b5','#ae9878'];const decal=await sharp(Buffer.from(`<svg width="256" height="256"><g transform="translate(${cx} ${cy}) rotate(${angle})"><path d="M${px} ${py}h${pw}v${ph*.86}q-${pw/2} ${ph*.3}-${pw} 0Z" fill="${cloth[0]}" stroke="${cloth[1]}" stroke-width=".7"/><path d="M${px+.8} ${py+1.2}h${pw-1.6}" fill="none" stroke="${cloth[1]}" stroke-width=".5"/><rect x="${px+pw*.39}" y="${py+ph*.3}" width="${pw*.48}" height="${ph*.45}" fill="#d18a28"/><path d="M${px+pw*.79} ${py+ph*.36}q-${pw*.39}-.5-${pw*.39} ${ph*.15}q0 ${ph*.18} ${pw*.39} ${ph*.12}v-${ph*.12}q-${pw*.19} .3-${pw*.19}-.2q0-.5 ${pw*.19}-.4Z" fill="#fff0d3"/></g></svg>`)).ensureAlpha().raw().toBuffer();
  for(let k=0;k<result.length;k+=4)if(tee[k+3]&&decal[k+3]){const a=decal[k+3]/255;for(let ch=0;ch<3;ch++)result[k+ch]=Math.round(result[k+ch]*(1-a)+decal[k+ch]*a);}
 }
 if(bottomKey.startsWith('carhartt-')){const x=w*.27,y=h*1.16,size=Math.max(4,w*.085),mark=await sharp(Buffer.from(`<svg width="256" height="256"><g transform="translate(${cx} ${cy}) rotate(${angle})"><rect x="${x}" y="${y}" width="${size}" height="${size*1.1}" rx=".4" fill="#dfcfb5" stroke="#746448" stroke-width=".55"/><path d="M${x+size*.76} ${y+size*.23}q-${size*.6}-.3-${size*.6} ${size*.35}q0 ${size*.5} ${size*.6} ${size*.3}v-${size*.24}q-${size*.29} .15-${size*.29}-.1q0-.2 ${size*.29}-.1Z" fill="#bf852d"/></g></svg>`)).ensureAlpha().raw().toBuffer();for(let k=0;k<result.length;k+=4)if(jeans[k+3]&&mark[k+3]){const a=mark[k+3]/255;for(let ch=0;ch<3;ch++)result[k+ch]=Math.round(result[k+ch]*(1-a)+mark[k+ch]*a);}}
 return result;}
