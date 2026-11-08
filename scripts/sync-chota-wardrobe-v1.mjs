// Selective local wardrobe packaging. No build, Capacitor sync, cleanup or publishing.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parse} from 'acorn';
import {minify} from 'terser';
import {minifyNativeJavaScript} from './optimize-native-code.mjs';
const root=path.resolve(import.meta.dirname,'..'),apply=process.argv.includes('--apply'),version=582,query='20261108-chota-wardrobe-582';
const read=file=>fs.readFileSync(path.join(root,file),'utf8'),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const fn=code=>{const node=parse(code,{ecmaVersion:'latest',sourceType:'script',allowAwaitOutsideFunction:true}).body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='createTigretonMotion');if(!node)throw new Error('Missing motion controller');return {...node,code:code.slice(node.start,node.end)};};
const updated=fn(read('app.js')).code,baseline=updated.split('\n').filter(line=>!line.includes('globalThis.ChotaWardrobe?.')).join('\n');
const canonical=async code=>(await minify(code,{keep_fnames:true,keep_classnames:true,toplevel:false,compress:{defaults:false,dead_code:true,drop_debugger:true,evaluate:true,booleans:true,conditionals:true},mangle:{toplevel:false,keep_fnames:true,properties:false,nth_identifier:{get:n=>'local'+n,reset(){},sort(){},consider(){}}},format:{comments:false}})).code;
const beforeCanonical=await canonical(baseline),afterCanonical=await canonical(updated),changes=[],checks=[];
function prepare(file,bytes,kind){const target=path.join(root,file),before=fs.existsSync(target)?fs.readFileSync(target):null,after=Buffer.from(bytes);if(before?.equals(after))return;changes.push({file,before,after,kind});}
const assets=fs.readdirSync(path.join(root,'icons/mascot/chota-v2/wardrobe')).filter(file=>/^tnf-(negro|crema|rojo|azul|oliva|morado)-(base|directional|contextual|room|talk)-v1\.webp$/.test(file)||['idle-body-mask.svg','sleep-static-mask.svg'].includes(file)).map(file=>'icons/mascot/chota-v2/wardrobe/'+file);
if(assets.length!==32)throw new Error('Expected 30 garment atlases and two masks');
for(const directory of ['www','ios/App/App/public','android/app/src/main/assets/public']){
 const file=directory+'/app.js',text=read(file),old=fn(text),fingerprint=await canonical(old.code);
 if(fingerprint!==beforeCanonical&&fingerprint!==afterCanonical)throw new Error('Independent motion changes: '+file);
 checks.push({file,baselineEquivalent:fingerprint===beforeCanonical,alreadyCurrent:fingerprint===afterCanonical});
 const replacement=directory==='www'?updated:(await minifyNativeJavaScript(updated,file)).trim();
 const next=text.slice(0,old.start)+replacement+text.slice(old.end);if(await canonical(fn(next).code)!==afterCanonical)throw new Error('Post-copy mismatch: '+file);
 prepare(file,next,'replace only createTigretonMotion after alpha-equivalence verification');
 prepare(directory+'/chota-wardrobe.js',directory==='www'?read('chota-wardrobe.js'):await minifyNativeJavaScript(read('chota-wardrobe.js'),'chota-wardrobe.js'),'new local wardrobe module');
 prepare(directory+'/chota-wardrobe.css',read('chota-wardrobe.css'),'new garment layer stylesheet');
 for(const asset of assets)prepare(directory+'/'+asset,fs.readFileSync(path.join(root,asset)),'garment-only asset');
}
for(const directory of ['','www','ios/App/App/public','android/app/src/main/assets/public']){
 const prefix=directory?directory+'/':'';let html=read(prefix+'index.html');
 if(!html.includes('chota-wardrobe.css'))html=html.replace(/(<link[^>]+href="clubhouse\.css[^>]+>)/,'$1\n  <link rel="stylesheet" href="chota-wardrobe.css?v='+query+'" />');
 if(!html.includes('chota-wardrobe.js'))html=html.replace(/(<script[^>]+src="app\.js[^>]+>)/,'<script defer src="chota-wardrobe.js?v='+query+'"></script>\n  $1');
 html=html.replace(/(app\.js\?v=)[^"']+/g,'$1'+query).replace(/(chota-wardrobe\.(?:js|css)\?v=)[^"']+/g,'$1'+query);
 if(!html.includes('chota-wardrobe.js?v='+query)||!html.includes('chota-wardrobe.css?v='+query))throw new Error('Index injection failed '+prefix);
 prepare(prefix+'index.html',html,'add module/stylesheet and update app asset key only');
 let sw=read(prefix+'service-worker.js');sw=sw.replace(/(const CACHE_NAME\s*=\s*["'])big-boy-rules-v\d+(["'])/,'$1big-boy-rules-v'+version+'$2').replace(/(\.\/app\.js\?v=)[^"']+/g,'$1'+query);
 // Only code and tiny masks enter the shell. Color atlases load solely on explicit equip.
 for(const asset of ['chota-wardrobe.js?v='+query,'chota-wardrobe.css?v='+query,...assets.filter(file=>file.endsWith('.svg'))])if(!sw.includes('./'+asset))sw=sw.replace(/(const APP_SHELL\s*=\s*\[)/,'$1"./'+asset+'",');
 parse(sw,{ecmaVersion:'latest'});prepare(prefix+'service-worker.js',sw,'cache v582, one app key, wardrobe code and two masks; no eager color atlases');
}
for(const [file,prefix]of [['ios/App/App/web-assets.xcfilelist','$(SRCROOT)/App/public/'],['ios/App/App/web-assets-output.xcfilelist','$(TARGET_BUILD_DIR)/$(UNLOCALIZED_RESOURCES_FOLDER_PATH)/public/']]){
 let text=read(file);for(const asset of ['chota-wardrobe.js','chota-wardrobe.css',...assets]){const line=prefix+asset;if(!text.split('\n').includes(line))text+=(!text.endsWith('\n')?'\n':'')+line+'\n';}prepare(file,text,'append 34 wardrobe resources only; preserve all existing lines');
}
let build=read('scripts/build-web.mjs');if(!build.includes('"chota-wardrobe.js"'))build=build.replace('  "clubhouse.css",','  "clubhouse.css",\n  "chota-wardrobe.js",\n  "chota-wardrobe.css",');prepare('scripts/build-web.mjs',build,'register the two new files for future builds without running a build');
const receipt={mode:apply?'applied':'dry-run',version,query,createdAt:new Date().toISOString(),checks,assets,files:changes.map(({file,before,after,kind})=>({file,kind,before:before?sha(before):null,after:sha(after),beforeBytes:before?.length??0,afterBytes:after.length}))};
if(apply&&changes.length){for(const change of changes){const file=path.join(root,change.file),now=fs.existsSync(file)?fs.readFileSync(file):null;if(!((now===null&&change.before===null)||now?.equals(change.before)))throw new Error('Concurrent change '+change.file);}const backup='/tmp/chota-wardrobe-sync-'+Date.now();for(const change of changes){if(change.before){const p=path.join(backup,change.file);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,change.before);}const p=path.join(root,change.file);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,change.after);}receipt.backup=backup;fs.writeFileSync(path.join(root,'artwork/chota/wardrobe-rig-v1/sync-receipt.json'),JSON.stringify(receipt,null,2)+'\n');}
console.log(JSON.stringify({mode:receipt.mode,version,verifiedControllers:checks.length,garmentAssets:assets.length,changedFiles:changes.length,files:receipt.files.map(({file,kind})=>({file,kind}))},null,2));
