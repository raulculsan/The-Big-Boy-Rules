// Reproducible Lottie assets. Original pack/card bitmaps remain unmodified.
import {writeFile,readFile,mkdir} from 'node:fs/promises';
const root=new URL('../icons/cards/',import.meta.url);
const fixed=k=>({a:0,k});
const keys=points=>({a:1,k:points.map(([t,s],i)=>({t,s:Array.isArray(s)?s:[s],...(i<points.length-1?{e:Array.isArray(points[i+1][1])?points[i+1][1]:[points[i+1][1]],o:{x:[.2],y:[0]},i:{x:[.2],y:[1]}}:{})}))});
const transform=(p=[0,0,0])=>({o:fixed(100),r:fixed(0),p:fixed(p),a:fixed([0,0,0]),s:fixed([100,100,100])});
const rect=(x,y,w,h,r=0)=>({ty:'rc',p:fixed([x,y]),s:fixed([w,h]),r:fixed(r)});
const fill=(opacity=100)=>({ty:'fl',c:fixed([.85,.69,.38,1]),o:fixed(opacity),r:1});
const base=(name,w,h,op)=>({v:'5.13.0',fr:60,ip:0,op,w,h,nm:name,ddd:0,assets:[],layers:[]});
const shape=(name,shapes,op)=>({ddd:0,ty:4,nm:name,sr:1,ks:transform(),ao:0,shapes,ip:0,op,st:0,bm:0});
const path=vertices=>({c:true,v:vertices,i:vertices.map(()=>[0,0]),o:vertices.map(()=>[0,0])});
const shine=base('Los nuestros · foil táctil',400,700,61);
for(const [width,opacity] of [[100,5],[32,9],[3,18]]) {
  const layer=shape('Reflejo '+width,[rect(0,350,width,1000),fill(opacity)],61);
  layer.ks.p=keys([[0,[-250,0,0]],[60,[850,0,0]]]);layer.ks.r=fixed(24);
  shine.layers.push(layer);
}
// Vector-only foil variants, scrubbed by the same 0–60 gesture timeline.
// No member photos, filters or raster textures: small and editable in Creator.
const tint=(color,opacity)=>({ty:'fl',c:fixed([...color,1]),o:fixed(opacity),r:1});
function sweep(target,name,width,color,opacity,offset=0,angle=24,reverse=false) {
  const layer=shape(name,[rect(0,350,width,1100),tint(color,opacity)],61);
  layer.ks.p=keys([[0,[reverse?850+offset:-250+offset,0,0]],[60,[reverse?-250+offset:850+offset,0,0]]]);
  // The finger is the timeline: a linear sweep avoids racing past the card centre.
  layer.ks.p.k[0].o={x:[1/3],y:[1/3]};layer.ks.p.k[0].i={x:[2/3],y:[2/3]};
  layer.ks.r=fixed(angle);target.layers.push(layer);
}
const special=base('Los nuestros · Especial · nácar',400,700,61);
sweep(special,'Nácar violeta',76,[.66,.51,1],10,-48);
sweep(special,'Nácar azul hielo',54,[.40,.88,1],14,16);
sweep(special,'Luz perlada',14,[.92,.98,1],22,42);
sweep(special,'Velo frío',164,[.64,.76,1],4);
const legendary=base('Los nuestros · Legendaria · oro facetado',400,700,61);
// Small four-point facets light at separate gesture positions, not flashing loops.
for(const [i,x,y,t] of [[0,34,135,17],[1,365,360,30],[2,55,575,43]]) {
  const glint=shape('Faceta dorada '+(i+1),[
    {ty:'sh',ks:fixed(path([[0,-11],[2,-2],[8,0],[2,2],[0,11],[-2,2],[-8,0],[-2,-2]]))},
    tint([1,.90,.64],65)
  ],61);
  glint.ks.p=fixed([x,y,0]);
  glint.ks.o=keys([[0,0],[t-7,0],[t,100],[t+7,0],[60,0]]);
  legendary.layers.push(glint);
}
sweep(legendary,'Luz de oro blanco',12,[1,.96,.79],27,34,24);
sweep(legendary,'Oro cepillado',62,[1,.77,.35],16,0,24);
sweep(legendary,'Contrarreflejo champán',20,[1,.88,.59],15,-250,-18,true);
sweep(legendary,'Contrarreflejo petróleo',80,[.27,.65,.67],6,-270,-18,true);
sweep(legendary,'Velo dorado',146,[.98,.72,.32],4,0,24);
const retro=base('Los nuestros · Retro · cobre envejecido',400,700,61);
// Restrained copper foil and short engraved edge marks recall an old collector print.
// The portrait stays readable; the gesture controls every highlight without loops.
for(const [i,x,y,t] of [[0,30,154,18],[1,370,340,31],[2,30,530,43]]) {
  const engraving=shape('Grabado de latón '+(i+1),[
    rect(0,0,2,18,1),rect(5,0,1,11,.5),tint([1,.78,.48],36)
  ],61);
  engraving.ks.p=fixed([x,y,0]);
  engraving.ks.o=keys([[0,0],[t-9,0],[t,100],[t+9,0],[60,0]]);
  retro.layers.push(engraving);
}
sweep(retro,'Luz de latón antiguo',10,[1,.83,.60],20,30,18);
sweep(retro,'Cobre satinado',58,[.91,.49,.29],12,0,18);
sweep(retro,'Contrarreflejo carmesí',46,[.68,.18,.16],7,-245,-14,true);
sweep(retro,'Pátina ámbar',134,[.77,.48,.23],3,0,18);
const foils=[['card-touch',shine],['card-touch-special',special],['card-touch-legendary',legendary],['card-touch-retro',retro]];
for(const [,json] of foils)json.layers.forEach((l,i)=>l.ind=i+1);
await Promise.all(foils.map(([name,json])=>writeFile(new URL(name+'.json',root),JSON.stringify(json))));
console.log('Lottie: común, especial (nácar), legendaria (oro facetado) y retro (cobre envejecido)');
if(process.argv.includes('--foil-only'))process.exit(0);
const pack=base('Los nuestros · apertura · vista previa',480,640,145);
pack.assets=[{id:'pack',w:1024,h:1536,u:'',p:'sobre-los-nuestros-v1.png',e:0},{id:'reverse',w:948,h:1659,u:'',p:'jose-enrique-fernandez-cruz-normal-86-reverso-v1.png',e:0}];
const bitmap=(id,name,p,scale)=>({ddd:0,ty:2,nm:name,refId:id,sr:1,ks:{...transform(p),s:fixed([scale,scale,100])},ao:0,ip:0,op:145,st:0,bm:0});
const mask=(x,y,w,h)=>({inv:false,mode:'a',pt:fixed(path([[x,y],[x+w,y],[x+w,y+h],[x,y+h]])),o:fixed(100),x:fixed(0)});
// Lottie draws the first layer on top. Seal separates before the sleeve drops.
const lid=bitmap('pack','Sello superior',[35,20,0],40);
lid.masksProperties=[mask(125,100,770,91)];
lid.hasMask=true;
lid.ks.p=keys([[0,[35,20,0]],[26,[35,20,0]],[54,[10,-24,0]],[82,[-35,-125,0]]]);
lid.ks.r=keys([[0,0],[26,0],[82,-16]]);lid.ks.o=keys([[0,100],[58,100],[82,0]]);
pack.layers.push(lid);
const body=bitmap('pack','Envoltorio',[35,20,0],40);
body.masksProperties=[mask(125,191,770,1245)];
body.hasMask=true;
body.ks.p=keys([[0,[35,20,0]],[55,[35,20,0]],[122,[35,540,0]]]);
body.ks.o=keys([[0,100],[84,100],[120,0]]);pack.layers.push(body);
const card=bitmap('reverse','Carta aún sin revelar',[102,140,0],29);
card.ks.p=keys([[0,[102,140,0]],[48,[102,140,0]],[112,[102,70,0]]]);
card.ks.o=keys([[0,0],[32,0],[50,100]]);pack.layers.push(card);
for(let n=0;n<18;n++) {
  const angle=n*Math.PI*2/18, start=38+n%4*3;
  const dot=shape('Partícula '+n,[rect(0,0,n%3?2:4,n%3?6:4,1),fill()],145);
  dot.ks.p=keys([[0,[240,210,0]],[start,[240,210,0]],[112,[240+Math.cos(angle)*(150+n%3*15),270+Math.sin(angle)*190,0]]]);
  dot.ks.o=keys([[0,0],[start,0],[start+5,80],[108,0]]);
  dot.ks.r=keys([[0,0],[112,n*37]]);pack.layers.push(dot);
}
const halo=shape('Halo de apertura',[{ty:'el',p:fixed([240,290]),s:fixed([310,390])},{ty:'st',c:fixed([.85,.69,.38,1]),o:fixed(25),w:fixed(1),lc:2,lj:2}],145);
halo.ks.o=keys([[0,0],[45,0],[66,100],[144,0]]);pack.layers.push(halo);
for(const data of [shine,pack]) data.layers.forEach((l,i)=>l.ind=i+1);
await Promise.all([writeFile(new URL('card-touch.json',root),JSON.stringify(shine)),writeFile(new URL('pack-opening.json',root),JSON.stringify(pack))]);
console.log('Lottie: card-touch.json + pack-opening.json');
// A portable Creator copy embeds only the approved pack and common reverse.
const portable=JSON.parse(JSON.stringify(pack));
for(const asset of portable.assets){asset.p='data:image/png;base64,'+(await readFile(new URL(asset.p,root))).toString('base64');asset.u='';asset.e=1;}
const exports=new URL('../docs/cartas/animaciones/',import.meta.url);
await mkdir(exports,{recursive:true});
await writeFile(new URL('pack-opening-creator.json',exports),JSON.stringify(portable));
