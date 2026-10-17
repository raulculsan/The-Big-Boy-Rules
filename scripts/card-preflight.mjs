/* Release preflight, not a visual approval: reports measurable layout defects. */
import {readFile, writeFile, mkdir, stat} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import {inflateSync} from 'node:zlib';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const editions = {Común:'common', Retro:'retro', Especial:'special', Épica:'epic', Legendaria:'legendary', 'Full Art':'full_art', 'Vice City':'vice_city'};
const backNames = {common:'comun',retro:'retro',special:'especial',epic:'especial',legendary:'legendar',full_art:'full-art',vice_city:'vice-city'};
const legacyFormats = new Map([['raul-culsan-gonzalez-full-art','985x1597'],['hospital-12-de-octubre-comun','986x1596'],['caonabo-alberto-full-art','985x1597'],['carlos-gonzalez-motos-full-art','985x1596'],['mario-salvatierra-medina-full-art','985x1597'],['cuba-epica','985x1596'],['titulacion-comun','985x1597'],['satisfyer-comun','986x1596']]);
function png(data) {
  if (data.length < 33 || data.toString('hex',0,8) !== '89504e470d0a1a0a') throw new Error('Archivo PNG inválido');
  return {width:data.readUInt32BE(16),height:data.readUInt32BE(20),depth:data[24],type:data[25]};
}
function margins(data, info) {
  if (info.depth !== 8 || ![2,6].includes(info.type) || data[28] !== 0) return null;
  const chunks = [];
  for (let i=8;i+12<=data.length;) { const size=data.readUInt32BE(i), type=data.toString('ascii',i+4,i+8); if(type==='IDAT') chunks.push(data.subarray(i+8,i+8+size)); i+=size+12; }
  const raw=inflateSync(Buffer.concat(chunks)), channels=info.type===6?4:3, stride=info.width*channels;
  let previous=Buffer.alloc(stride), minX=info.width,minY=info.height,maxX=-1,maxY=-1;
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<info.height;y++) {
    const offset=y*(stride+1),filter=raw[offset],row=Buffer.from(raw.subarray(offset+1,offset+1+stride));
    for(let x=0;x<stride;x++){const a=x>=channels?row[x-channels]:0,b=previous[x],c=x>=channels?previous[x-channels]:0;row[x]=(row[x]+([0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter]??0))&255;}
    for(let x=0;x<info.width;x++){
      const pixel=x*channels;
      // Transparent or near-white exterior padding is measurable; dark card borders are preserved.
      const content=channels===4?row[pixel+3]>24:Math.min(row[pixel],row[pixel+1],row[pixel+2])<247;
      if(content){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    }
    previous=row;
  }
  return maxX<0?{empty:true}:{left:minX/info.width,right:(info.width-1-maxX)/info.width,top:minY/info.height,bottom:(info.height-1-maxY)/info.height};
}
export async function preflightCards({strict=false}={}) {
  const source=await readFile(resolve(root,'card-collection.js'),'utf8');
  const cards=[...source.slice(0,source.indexOf('].map(card')).matchAll(/Object\.freeze\(\{([\s\S]*?)\}\)/g)].map(match=>runInNewContext(`({${match[1]}})`,Object.create(null),{timeout:100}));
  const thumbnails=await readFile(resolve(root,'card-thumbnails.js'),'utf8');
  const mapping=JSON.parse(thumbnails.slice(thumbnails.indexOf('Object.freeze(')+14,thumbnails.lastIndexOf(');')));
  const errors=[],warnings=[],ids=new Set(),assets=new Map();
  const issue=(list,card,message)=>list.push(`${card.id||'(sin id)'}: ${message}`);
  for(const card of cards){
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(card.id||'')||ids.has(card.id))issue(errors,card,'ID ausente, inválido o duplicado.'); ids.add(card.id);
    if(!card.name?.trim()||!card.collection)issue(errors,card,'Falta nombre o colección.');
    const rarity=editions[card.edition];
    if(!rarity || card.rarity && card.rarity!==rarity)issue(errors,card,'La edición y la rareza no coinciden.');
    const kind=card.kind||'Miembro';
    if(!['Miembro','Personaje','Objeto','Ubicación'].includes(kind))issue(errors,card,'Tipo de carta desconocido.');
    if(['Miembro','Personaje'].includes(kind)&&(!Number.isInteger(card.score)||card.score<0||card.score>100))issue(errors,card,'La media debe estar entre 0 y 100.');
    if(!Number.isFinite(card.width)||!Number.isFinite(card.height))issue(errors,card,'Faltan dimensiones del catálogo.');
    for(const face of ['front','back']){
      const path=card[face];
      if(typeof path!=='string'||!/^icons\/cards\/[^/]+\.png$/.test(path)){issue(errors,card,`${face}: ruta local PNG inválida.`);continue;}
      try {
        if(!assets.has(path)){const data=await readFile(resolve(root,path));const info=png(data);assets.set(path,{...info,margins:margins(data,info),bytes:data.length});}
        const info=assets.get(path);
        if(info.width<700||info.height<1100)issue(errors,card,`${face}: resolución insuficiente (${info.width}×${info.height}).`);
        if(face==='front'&&(Math.abs(info.width-card.width)>2||Math.abs(info.height-card.height)>2))issue(errors,card,`Dimensiones declaradas ${card.width}×${card.height}, imagen ${info.width}×${info.height}. Corrige el catálogo.`);
        if(Math.abs(info.width/info.height-948/1660)>0.025)issue(face==='front' && legacyFormats.get(card.id)===`${info.width}x${info.height}` ? warnings : errors,card,`${face}: proporción ${info.width}×${info.height} diferente del formato común 948×1660; revisar encuadre.`);
        if(info.margins?.empty)issue(errors,card,`${face}: imagen vacía/transparente.`);
        else if(info.margins&&Object.values(info.margins).some(value=>value>0.035))issue(errors,card,`${face}: margen exterior >3,5%; la carta podría verse más pequeña. Revisa el arte, no estires la imagen.`);
      }catch(error){issue(errors,card,`${face}: ${error.message}`);}
    }
    if(rarity&&!card.back?.includes(backNames[rarity]))issue(errors,card,'El reverso no corresponde a la rareza.');
    const thumb=mapping[card.front];
    if(!thumb)issue(errors,card,'Falta miniatura; ejecuta npm run cards:thumbnails.');
    else try{if(!(await stat(resolve(root,thumb))).size)throw new Error();}catch{issue(errors,card,`Miniatura ausente o vacía: ${thumb}.`);}
  }
  const report={generatedAt:new Date().toISOString(),cards:cards.length,assets:assets.size,errors,warnings,limitations:'No interpreta caras, texto impreso ni marcos oscuros. Los márgenes detectan transparencia o blanco exterior; requiere aprobación visual del diseño.'};
  await mkdir(resolve(root,'reports'),{recursive:true});
  await writeFile(resolve(root,'reports/card-preflight.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`Card preflight: ${cards.length} cartas, ${errors.length} errores, ${warnings.length} avisos. Informe: reports/card-preflight.json`);
  for(const message of errors)console.error(`ERROR ${message}`);
  for(const message of warnings)console.warn(`AVISO ${message}`);
  if(errors.length||strict&&warnings.length)throw new Error('Preflight de cartas bloqueado. Corrige el informe antes de publicar.');
  return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await preflightCards({strict:process.argv.includes('--strict')});
