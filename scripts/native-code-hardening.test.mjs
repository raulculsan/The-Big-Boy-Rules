import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import vm from 'node:vm';
import {minifyNativeJavaScript,optimizeNativeCode} from './optimize-native-code.mjs';
import {androidBuildOptions,androidApkPath} from './build-android.mjs';
const root=resolve(import.meta.dirname,'..');

test('native minification preserves classic globals, DOM properties and native plugin method names',async()=>{
 const source='/* project implementation comment */ const sharedConfig={enabled:true}; function showProfile(memberName){const verboseLocalVariable=memberName.trim();return sharedConfig.enabled?verboseLocalVariable:"";} globalThis.NativeBridge={authenticate:async function authenticate(options){return options.callbackUrl;}};';
 const output=await minifyNativeJavaScript(source,'classic.js');
 assert.ok(output.length<source.length);assert.ok(!output.includes('project implementation comment'));assert.ok(!output.includes('sourceMappingURL'));
 const context=vm.createContext({});vm.runInContext(output,context);vm.runInContext('globalThis.crossFileResult=showProfile("  Raúl  ");',context);
 assert.equal(context.crossFileResult,'Raúl');assert.equal(await context.NativeBridge.authenticate({callbackUrl:'bigboyrules://auth/callback'}),'bigboyrules://auth/callback');
});

test('native pipeline changes only platform copies, removes maps and disables native inspection/logging',async()=>{
 const fixture=await mkdtemp(join(tmpdir(),'bigboy-native-test-'));
 try{
  const native=join(fixture,'android/app/src/main/assets');await mkdir(join(native,'public/vendor'),{recursive:true});await mkdir(join(fixture,'www'),{recursive:true});
  const source='// source mapping implementation\nfunction runAction(){ return window.Capacitor.registerPlugin("ClubAuth").authenticate({url:"https://example.test"}); }\n//# sourceMappingURL=app.js.map';
  await writeFile(join(native,'public/app.js'),source);await writeFile(join(fixture,'www/app.js'),source);
  await writeFile(join(native,'public/app.js.map'),'{}');await writeFile(join(native,'public/vendor/style.css.map'),'{}');
  await writeFile(join(native,'capacitor.config.json'),JSON.stringify({appId:'test',android:{zoomEnabled:false}}));
  const report=await optimizeNativeCode({root:fixture,platforms:['android']});assert.equal(report[0].scripts,1);assert.equal(report[0].removedSourceMaps,2);
  assert.equal(await readFile(join(fixture,'www/app.js'),'utf8'),source);assert.notEqual(await readFile(join(native,'public/app.js'),'utf8'),source);
  const config=JSON.parse(await readFile(join(native,'capacitor.config.json'),'utf8'));assert.equal(config.android.webContentsDebuggingEnabled,false);assert.equal(config.android.loggingBehavior,'none');assert.equal(config.android.zoomEnabled,false);
  await assert.rejects(readFile(join(native,'public/app.js.map')),/ENOENT/);
 }finally{await rm(fixture,{recursive:true,force:true});}
});

test('a parse failure aborts platform rewrites instead of packaging a partially minified app',async()=>{
 const fixture=await mkdtemp(join(tmpdir(),'bigboy-native-invalid-'));try{
 const directory=join(fixture,'android/app/src/main/assets/public');await mkdir(directory,{recursive:true});const source='function validFunction(){ return 7; }';
 await writeFile(join(directory,'a.js'),source);await writeFile(join(directory,'z.js'),'function { invalid');
 await assert.rejects(optimizeNativeCode({root:fixture,platforms:['android']}));assert.equal(await readFile(join(directory,'a.js'),'utf8'),source);
 }finally{await rm(fixture,{recursive:true,force:true});}
});

test('release build mode consumes its own flag and resolves the redirected signed APK',()=>{
 assert.deepEqual(androidBuildOptions(['--release','--offline','--no-watch-fs']),{variant:'release',task:'assembleRelease',args:['--offline','--no-watch-fs']});
 assert.equal(androidBuildOptions([]).task,'assembleDebug');assert.match(androidApkPath(root,'release',{GRADLE_USER_HOME:'/private/tmp/gradle-tests'}),/bigboy-generated\/[^/]+\/app\/outputs\/apk\/release\/app-release\.apk$/);
});

test('release config enables optimized R8 and resource shrinking without a debuggable APK',async()=>{
 const gradle=await readFile(join(root,'android/app/build.gradle'),'utf8'),rules=await readFile(join(root,'android/app/proguard-rules.pro'),'utf8');
 for(const expected of ['minifyEnabled true','shrinkResources true','debuggable false','jniDebuggable false','proguard-android-optimize.txt','signingConfig signingConfigs.debug'])assert.ok(gradle.includes(expected),expected);
 assert.match(rules,/@android\.webkit\.JavascriptInterface <methods>/);assert.ok(!rules.includes('-keep class **'));
 const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));assert.ok(pkg.scripts['capacitor:copy:after'].endsWith('node scripts/optimize-native-code.mjs'));assert.match(pkg.devDependencies.terser,/^\d+\.\d+\.\d+$/);
});
