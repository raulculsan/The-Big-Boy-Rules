/* Runs after Capacitor copies the shared app. Source files/www stay untouched. */
import {readFile, writeFile, readdir, unlink, lstat} from 'node:fs/promises';
import {resolve, dirname, join, extname, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {minify} from 'terser';
import {writeIOSAssetManifest} from './generated-assets.mjs';
const projectRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');

export async function minifyNativeJavaScript(source, filename='app.js') {
  const output=await minify({[filename]:source},{
    module:false,toplevel:false,keep_fnames:true,keep_classnames:true,
    // Preserve cross-file globals, DOM/native API properties and callback names.
    // No eval-based wrappers, property mangling, unsafe transforms or source maps.
    mangle:{toplevel:false,keep_fnames:true,properties:false},
    compress:{defaults:false,dead_code:true,drop_debugger:true,evaluate:true,booleans:true,conditionals:true},
    format:{comments:/@license|@preserve|^!/,semicolons:true},
    sourceMap:false,
  });
  if(typeof output.code!=='string')throw new Error(`No se pudo preparar ${filename}.`);
  return output.code+'\n';
}
async function filesIn(directory) {
  const files=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    if(entry.isSymbolicLink())throw new Error(`No se admiten enlaces en los archivos nativos generados: ${entry.name}`);
    const path=join(directory,entry.name);
    if(entry.isDirectory())files.push(...await filesIn(path));else if(entry.isFile())files.push(path);
  }
  return files;
}
export async function optimizeNativeCode({root=projectRoot,platforms=['ios','android'],writeManifest=true}={}) {
  const report=[];
  for(const platform of platforms){
    if(!['ios','android'].includes(platform))throw new Error('Plataforma nativa no válida.');
    const native=resolve(root,platform==='android'?'android/app/src/main/assets':'ios/App/App');
    const directory=join(native,'public');
    try{if(!(await lstat(directory)).isDirectory())continue;}catch(error){if(error.code==='ENOENT')continue;throw error;}
    const files=await filesIn(directory),rewrites=[];let before=0,after=0,maps=0;
    // Parse/minify every script first. Syntax failures leave this platform's
    // copied app untouched and abort the package instead of shipping half a build.
    for(const path of files){
      if(!['.js','.mjs','.cjs'].includes(extname(path)))continue;
      const source=await readFile(path,'utf8');const output=await minifyNativeJavaScript(source,relative(directory,path));
      rewrites.push([path,output]);before+=Buffer.byteLength(source);after+=Buffer.byteLength(output);
    }
    for(const [path,output] of rewrites)await writeFile(path,output);
    for(const path of files)if(extname(path)==='.map'){await unlink(path);maps++;}
    const configPath=join(native,'capacitor.config.json');
    try{
      const config=JSON.parse(await readFile(configPath,'utf8'));
      config.loggingBehavior='none';
      if(platform==='android')config.android={...config.android,webContentsDebuggingEnabled:false,loggingBehavior:'none'};
      await writeFile(configPath,JSON.stringify(config,null,2)+'\n');
    }catch(error){if(error.code!=='ENOENT')throw error;}
    if(platform==='ios'&&writeManifest)await writeIOSAssetManifest(directory);
    report.push({platform,scripts:rewrites.length,before,after,removedSourceMaps:maps});
  }
  return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const requested=process.env.CAPACITOR_PLATFORM_NAME;
  if(requested&&!['ios','android'].includes(requested))process.exit(0);
  const report=await optimizeNativeCode({platforms:requested?[requested]:['ios','android']});
  for(const row of report)console.log(`Native ${row.platform}: ${row.scripts} scripts, ${(row.before/1024).toFixed(0)} → ${(row.after/1024).toFixed(0)} KiB; ${row.removedSourceMaps} source maps removed.`);
}
