// Authored vector geometry + motion recipe shared by Creator scenes, SVG posters and Lottie.
// No raster assets, fonts, expressions or external images are needed at runtime.
import {mkdir, writeFile} from 'node:fs/promises';
const output = new URL('../icons/trophies/', import.meta.url);
const palettes = {
  bronze: ['#48261e','#815039','#c78a5b','#f1c797','#fff0d9'],
  silver: ['#263645','#637d96','#b2c7d8','#e6f2fc','#ffffff'],
  gold: ['#62431a','#b68126','#edbd4e','#ffe497','#fff6d4'],
  platinum: ['#243752','#486f9b','#86c9db','#c6f3f4','#f3ffff']
};
const labels = {bronze:'Bronce · Forjado',silver:'Plata · Órbita',gold:'Oro · Coronación',platinum:'Platino · Prisma'};
const color = hex => [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const M=(x,y)=>['M',x,y], L=(x,y)=>['L',x,y], C=(...v)=>['C',...v], Z=()=>['Z'];
const polygon = points => [M(...points[0]),...points.slice(1).map(p=>L(...p)),Z()];
function ellipse(cx,cy,rx,ry) {
  const k=.55228475;
  return [M(cx,cy-ry),C(cx+rx*k,cy-ry,cx+rx,cy-ry*k,cx+rx,cy),C(cx+rx,cy+ry*k,cx+rx*k,cy+ry,cx,cy+ry),C(cx-rx*k,cy+ry,cx-rx,cy+ry*k,cx-rx,cy),C(cx-rx,cy-ry*k,cx-rx*k,cy-ry,cx,cy-ry),Z()];
}
function bezier(commands) {
  const v=[],i=[],o=[];
  let closed=false;
  for (const [cmd,...a] of commands) {
    if(cmd==='Z') {closed=true;continue;}
    if(cmd==='C') {
      const prev=v.at(-1);
      o[o.length-1]=[a[0]-prev[0],a[1]-prev[1]];
      v.push(a.slice(4)); i.push([a[2]-a[4],a[3]-a[5]]); o.push([0,0]);
    } else {v.push(a);i.push([0,0]);o.push([0,0]);}
  }
  if(closed && v.length>1 && v[0][0]===v.at(-1)[0] && v[0][1]===v.at(-1)[1]) {i[0]=i.pop();v.pop();o.pop();}
  return {c:closed,v,i,o};
}
function design(tier) {
  const p=palettes[tier], trophy=[],halo=[],sparkles=[];
  const add=(list,name,commands,fill,stroke=null,width=1)=>list.push({name,commands,fill,stroke,width});
  const shape=(name,commands,fill,stroke=null,width=1)=>add(trophy,name,commands,fill,stroke,width);
  // Slender rings/rays behind the sculpture, never an opaque circular emoji badge.
  add(halo,'Outer orbit',ellipse(256,246,194,194),null,p[1],1.2);
  if(tier==='silver'||tier==='platinum') add(halo,'Elliptical orbit',ellipse(256,246,210,108),null,p[2],1.5);
  if(tier==='gold') for(let n=0;n<16;n++) {
    const a=n*Math.PI/8;
    add(halo,`Ray ${n}`, [M(256+Math.cos(a)*177,246+Math.sin(a)*177),L(256+Math.cos(a)*202,246+Math.sin(a)*202)],null,p[2],2);
  }
  shape('Contact shadow',ellipse(256,429,116,13),'#05070b');
  if(tier==='platinum') {
    shape('Wing left',polygon([[244,140],[135,206],[161,307],[236,340]]),p[1],p[2],1);
    shape('Wing left light',polygon([[244,140],[170,220],[161,307],[216,244]]),p[3]);
    shape('Wing right',polygon([[268,140],[377,206],[351,307],[276,340]]),p[0],p[2],1);
    shape('Wing right light',polygon([[268,140],[342,220],[351,307],[296,244]]),p[2]);
    shape('Crystal silhouette',polygon([[256,66],[321,149],[300,291],[256,348],[212,291],[191,149]]),'metal',p[4],1.5);
    shape('Crystal left facet',polygon([[256,66],[191,149],[236,163],[256,113]]),p[3]);
    shape('Crystal right facet',polygon([[256,66],[321,149],[276,163],[256,113]]),p[1]);
    shape('Crystal inner light',polygon([[256,113],[236,163],[239,280],[256,321],[274,280],[276,163]]),p[4]);
    shape('Crystal shadow facet',polygon([[321,149],[276,163],[274,280],[256,348],[300,291]]),p[0]);
    shape('Crystal lower facet',polygon([[191,149],[236,163],[239,280],[256,348],[212,291]]),p[2]);
  } else {
    const rim=tier==='silver'?126:tier==='gold'?148:158;
    const left=tier==='gold'?164:177, right=512-left;
    shape('Left handle',[M(left+8,rim+12),L(128,rim+12),C(118,rim+92,147,rim+126,203,288),L(208,271),C(164,rim+92,143,rim+70,148,rim+33),L(left+8,rim+33),Z()],'metal',p[1],1.5);
    shape('Right handle',[M(right-8,rim+12),L(384,rim+12),C(394,rim+92,365,rim+126,309,288),L(304,271),C(348,rim+92,369,rim+70,364,rim+33),L(right-8,rim+33),Z()],p[1],p[3],1.5);
    shape('Cup body',[M(left,rim),L(right,rim),L(right-10,222),C(right-14,278,293,312,256,318),C(219,312,left+14,278,left+10,222),Z()],'metal',p[3],1.5);
    shape('Cup edge shade',[M(right-24,rim+10),L(right,rim+10),L(right-10,222),C(right-14,278,293,312,256,318),C(295,288,307,232,right-24,rim+10),Z()],p[1]);
    shape('Brushed highlight',[M(left+18,rim+13),L(left+39,rim+13),C(left+30,216,left+35,255,233,291),C(205,270,left+18,229,left+18,rim+13),Z()],p[3]);
    shape('Rim bevel',polygon([[left-6,rim-6],[right+6,rim-6],[right+3,rim+9],[left-3,rim+9]]),p[4],p[1],1.5);
    shape('Rim inner', [M(left+4,rim+3),L(right-4,rim+3)],null,p[2],3);
    // An engraved star, not a font glyph: perfectly sharp at every scale.
    const star=[];
    for(let n=0;n<10;n++){const a=-Math.PI/2+n*Math.PI/5,r=n%2?10:23;star.push([256+Math.cos(a)*r,221+Math.sin(a)*r]);}
    shape('Engraved star',polygon(star),p[0]);
    shape('Stem',polygon([[246,312],[266,312],[273,358],[289,366],[289,379],[223,379],[223,366],[239,358]]),'metal',p[1],1);
    shape('Stem glint',[M(251,321),L(248,359)],null,p[4],3);
    if(tier==='gold') {
      shape('Crown',polygon([[211,114],[205,79],[233,99],[256,64],[279,99],[307,79],[301,114]]),'metal',p[4],1.5);
      shape('Crown band',polygon([[211,115],[301,115],[300,124],[212,124]]),p[1],p[2],1);
    }
  }
  if(tier==='platinum') shape('Crystal stem',polygon([[241,332],[271,332],[284,375],[228,375]]),'metal',p[3],1);
  shape('Plinth top',polygon([[202,376],[310,376],[331,391],[181,391]]),p[2],p[3],1);
  shape('Obsidian plinth',polygon([[181,391],[331,391],[342,422],[170,422]]),'#141c25',p[1],1.5);
  shape('Plinth bevel',polygon([[170,422],[342,422],[335,429],[177,429]]),p[0],p[2],1);
  shape('Plaque',polygon([[232,398],[280,398],[280,414],[232,414]]),p[1]);
  for(let n=0;n<({bronze:1,silver:2,gold:3,platinum:4}[tier]);n++) {
    const x=256+(n-({bronze:1,silver:2,gold:3,platinum:4}[tier]-1)/2)*9;
    shape('Rank engraving',polygon([[x,401],[x+3,406],[x,411],[x-3,406]]),p[4]);
  }
  const points=tier==='bronze'?[[147,127,9],[355,295,7]]:tier==='silver'?[[113,217,12],[366,124,14],[319,347,6]]:tier==='gold'?[[117,143,14],[383,184,12],[352,326,9],[183,75,6]]:[[127,153,12],[379,129,10],[388,319,12],[138,333,8]];
  points.forEach(([x,y,r],n)=>add(sparkles,`Glint ${n}`,polygon([[x,y-r],[x+r*.24,y-r*.24],[x+r,y],[x+r*.24,y+r*.24],[x,y+r],[x-r*.24,y+r*.24],[x-r,y],[x-r*.24,y-r*.24]]),p[4]));
  return {halo,trophy,sparkles};
}
const key=(frame,value)=>({frame,value});
const xy=(x,y)=>({x,y});
function motion(tier) {
  const common={halo:{opacity:[key(0,0),key(36,65),key(100,38),key(180,38)]},sparkles:{opacity:[key(0,0),key(35,0),key(48,100),key(63,25),key(79,100),key(112,0),key(180,0)],scale:[key(0,xy(85,85)),key(52,xy(112,112)),key(90,xy(100,100))]}};
  const trophy = tier==='bronze' ? {position:[key(0,xy(256,197)),key(26,xy(256,261)),key(38,xy(256,247)),key(50,xy(256,258)),key(62,xy(256,256))],rotation:[key(0,-9),key(26,3),key(45,-2),key(62,0)]}
    : tier==='silver' ? {scale:[key(0,xy(48,88)),key(32,xy(106,104)),key(55,xy(100,100))],rotation:[key(0,-18),key(32,7),key(55,0)],position:[key(0,xy(256,274)),key(55,xy(256,256))]}
    : tier==='gold' ? {position:[key(0,xy(256,316)),key(38,xy(256,242)),key(62,xy(256,256))],scale:[key(0,xy(80,80)),key(38,xy(106,106)),key(62,xy(100,100))]}
    : {scale:[key(0,xy(38,68)),key(28,xy(118,108)),key(54,xy(92,97)),key(80,xy(100,100))],rotation:[key(0,-28),key(28,12),key(54,-5),key(80,0)],position:[key(0,xy(256,274)),key(45,xy(256,244)),key(80,xy(256,256))]};
  common.trophy={...trophy,opacity:[key(0,0),key(10,100)]};
  if(tier==='silver') common.halo.rotation=[key(0,-70),key(135,80),key(180,80)];
  if(tier==='gold') common.halo.scale=[key(0,xy(40,40)),key(56,xy(110,110)),key(90,xy(100,100))];
  if(tier==='platinum') common.halo.rotation=[key(0,-100),key(145,110),key(180,110)];
  return common;
}
function svg(shapes,tier) {
  const p=palettes[tier];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs><linearGradient id="metal" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${p[1]}"/><stop offset=".3" stop-color="${p[3]}"/><stop offset=".52" stop-color="${p[2]}"/><stop offset=".75" stop-color="${p[4]}"/><stop offset="1" stop-color="${p[1]}"/></linearGradient></defs>${shapes.map(s=>`<path d="${s.commands.map(c=>c.join(' ')).join(' ')}" fill="${s.fill==='metal'?'url(#metal)':s.fill||'none'}"${s.stroke?` stroke="${s.stroke}" stroke-width="${s.width}" stroke-linejoin="round" stroke-linecap="round"`:''}/>`).join('')}</svg>`;
}
function property(keys,fallback) {
  if(!keys)return {a:0,k:fallback};
  return {a:1,k:keys.map(({frame,value},n)=>({t:frame,s:typeof value==='object'?[value.x,value.y]:[value],...(n<keys.length-1?{o:{x:.22,y:0},i:{x:.3,y:1}}:{})}))};
}
function lottie(groups,tracks,tier) {
  const p=palettes[tier];
  const layers=Object.entries(groups).map(([name,shapes],n)=>{
    const t=tracks[name]||{};
    const shapeGroups=shapes.map(s=>({ty:'gr',nm:s.name,it:[{ty:'sh',ks:{a:0,k:bezier(s.commands)}},...(s.fill?[s.fill==='metal'?{ty:'gf',t:1,o:{a:0,k:100},r:1,g:{p:5,k:{a:0,k:[0,...color(p[1]),.3,...color(p[3]),.52,...color(p[2]),.75,...color(p[4]),1,...color(p[1])] }},s:{a:0,k:[165,200]},e:{a:0,k:[346,200]}}:{ty:'fl',c:{a:0,k:color(s.fill)},o:{a:0,k:100},r:1}]:[]),...(s.stroke?[{ty:'st',c:{a:0,k:color(s.stroke)},o:{a:0,k:100},w:{a:0,k:s.width},lc:2,lj:2}]:[]),{ty:'tr',p:{a:0,k:[0,0]},a:{a:0,k:[0,0]},s:{a:0,k:[100,100]},r:{a:0,k:0},o:{a:0,k:100}}]}));
    // Lottie lists the front-most shape first; the authored SVG uses painter's order.
    return {ddd:0,ind:n+1,ty:4,nm:name,sr:1,ip:0,op:181,st:0,bm:0,ks:{o:property(t.opacity,100),r:property(t.rotation,0),p:property(t.position,[256,256]),a:{a:0,k:[256,256]},s:property(t.scale,[100,100])},shapes:shapeGroups.reverse()};
  }).reverse();
  return {v:'5.13.0',fr:60,ip:0,op:181,w:512,h:512,nm:labels[tier],ddd:0,assets:[],layers,markers:[{tm:0,cm:'reveal',dr:120},{tm:120,cm:'rest',dr:60}]};
}
await mkdir(output,{recursive:true});
const recipes={};
for(const tier of Object.keys(palettes)) {
  const groups=design(tier),tracks=motion(tier);
  const poster=svg(groups.trophy,tier);
  const animation=lottie(groups,tracks,tier);
  await writeFile(new URL(`${tier}.svg`,output),poster);
  await writeFile(new URL(`${tier}.json`,output),JSON.stringify(animation));
  recipes[tier]={name:labels[tier],tracks,layers:Object.fromEntries(Object.entries(groups).map(([name,shapes])=>[name,svg(shapes,tier)]))};
}
if(process.argv.includes('--recipe')) console.log(JSON.stringify(recipes));
else console.log('4 esculturas vectoriales y 4 animaciones Lottie generadas (512 × 512, 60 fps).');
