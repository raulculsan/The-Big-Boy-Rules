import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const source=await readFile(new URL('../app-update.js',import.meta.url),'utf8');
const policy={platform:'android',minimum_build:2,latest_build:2,latest_version:'1.1.0',download_url:'https://github.com/raulculsan/The-Big-Boy-Rules/releases/latest/download/BigBoy-Android.apk',message:'Actualiza para continuar.'};
function environment(row=policy,{fail=false}={}) {
 const dom=new JSDOM('<!doctype html><body><div id="admin"></div></body>',{url:'https://bigboy.example/',runScripts:'outside-only',pretendToBeVisual:true});
 const {window}=dom,topDialogs=[];window.HTMLDialogElement.prototype.showModal=function(){const old=topDialogs.indexOf(this);if(old>=0)topDialogs.splice(old,1);topDialogs.push(this);this.setAttribute('open','');};window.HTMLDialogElement.prototype.close=function(){const old=topDialogs.indexOf(this);if(old>=0)topDialogs.splice(old,1);this.removeAttribute('open');};window.eval(source);
 let saves=0,saved=null,queries=0,currentRow=row;
 const client={from(name){assert.equal(name,'app_release_policy');queries++;return {select(){return this;},eq(){return this;},maybeSingle(){const result=Promise.resolve(fail?{error:{message:'offline'}}:{data:currentRow});result.abortSignal=()=>result;return result;},upsert(value){saves++;saved=value;return {select(){return this;},single:async()=>({data:value})};}};}};
 return {dom,window,topDialogs,api:window.ClubAppUpdate,client,setRow:value=>currentRow=value,get saves(){return saves;},get saved(){return saved;},get queries(){return queries;},close(){window.close();}};
}
const bridge=build=>({getInfo:async()=>({platform:'android',build,version:build===2?'1.1.0':'1.0'}),openDownload:async()=>{}});
test('current and newer Android builds are accepted; an outdated build is blocked before account UI',async()=>{
 for(const build of [1,2,3]){const e=environment();const gate=e.api.start({client:e.client,platform:'android',bridge:bridge(build)});await gate.ready;assert.equal(gate.blocked(),build<2);assert.equal(Boolean(e.window.document.querySelector('dialog[open]')),build<2);if(build<2){const dialog=e.window.document.querySelector('dialog');const event=new e.window.Event('cancel',{cancelable:true});assert.equal(dialog.dispatchEvent(event),false);assert(dialog.textContent.includes('1.1.0 (2)'));}gate.destroy();e.close();}
});
test('a known mandatory policy persists offline, but a failed first fetch never invents a requirement',async()=>{
 for(const cached of [false,true]){const e=environment(null,{fail:true});if(cached)e.window.localStorage.setItem('bb-android-release-policy-v1',JSON.stringify(policy));const gate=e.api.start({client:e.client,platform:'android',bridge:bridge(1)});await gate.ready;assert.equal(gate.blocked(),cached);gate.destroy();e.close();}
});
test('unavailable native metadata does not guess a build and web/iOS do not query Android policy',async()=>{
 for(const platform of ['web','ios','android']){const e=environment();const gate=e.api.start({client:e.client,platform,bridge:{getInfo:async()=>{throw Error('unavailable');}}});await gate.ready;assert.equal(gate.blocked(),false);assert.equal(e.queries,0);gate.destroy();e.close();}
});
test('lowering the published minimum unblocks the same installation and closes the modal',async()=>{
 const e=environment();const gate=e.api.start({client:e.client,platform:'android',bridge:bridge(1)});await gate.ready;assert(gate.blocked());e.setRow({...policy,minimum_build:1});await gate.check(true);assert.equal(gate.blocked(),false);assert.equal(e.window.document.querySelector('dialog').open,false);assert.equal(e.window.document.documentElement.classList.contains('app-update-required'),false);gate.destroy();e.close();
});
test('a later account-security dialog cannot cover a mandatory update, and the observer detaches after unblock',async()=>{
 const e=environment();const gate=e.api.start({client:e.client,platform:'android',bridge:bridge(1)});await gate.ready;
 const update=e.window.document.querySelector('#appUpdateGate'),auth=e.window.document.createElement('dialog');auth.textContent='Verifica tu cuenta';e.window.document.body.append(auth);auth.showModal();
 await new Promise(setImmediate);assert.equal(e.topDialogs.at(-1),update);assert.equal(auth.open,true);assert.equal(auth.textContent,'Verifica tu cuenta');
 e.setRow({...policy,minimum_build:1});await gate.check(true);auth.close();auth.showModal();await new Promise(setImmediate);assert.equal(e.topDialogs.at(-1),auth);assert.equal(update.open,false);gate.destroy();e.close();
});
test('a slow first policy fetch does not delay cold start for five seconds',async()=>{
 const e=environment();const pending=new Promise(()=>{});pending.abortSignal=()=>pending;
 const client={from(){return{select(){return this;},eq(){return this;},maybeSingle(){return pending;}};}};
 const started=Date.now();const gate=e.api.start({client,platform:'android',bridge:bridge(2)});await gate.ready;assert(Date.now()-started<1800);assert.equal(gate.blocked(),false);gate.destroy();e.close();
});
test('published URL and version input is validated and text is never inserted as markup',async()=>{
 const e=environment({...policy,message:'<img src=x onerror=alert(1)>'});
 for(const url of ['javascript:alert(1)','http://example.com/a.apk','https://user:pass@example.com/a.apk','https://127.0.0.1/a.apk','https://192.168.0.1/a.apk','https://8.8.8.8/a.apk','https://site.internal/a.apk','https://example.com:8443/a.apk','https://example.com\\a.apk','https://example.com/a b.apk','https://site.test./a.apk'])assert.equal(e.api.safeDownloadUrl(url),'');
 assert.equal(e.api.normalizePolicy({...policy,minimum_build:3}),null);assert.equal(e.api.normalizePolicy({...policy,latest_build:1.5}),null);
 const gate=e.api.start({client:e.client,platform:'android',bridge:bridge(1)});await gate.ready;assert.equal(e.window.document.querySelector('dialog img'),null);assert(e.window.document.querySelector('.app-update-message').textContent.startsWith('<img'));gate.destroy();e.close();
});
test('admin preserves edits, rejects invalid minimum and clears stale account drafts',async()=>{
 const e=environment();let owner='admin';const mount=e.window.document.querySelector('#admin');const admin=e.api.createAdmin(mount,{client:e.client,allowed:()=>owner==='admin',owner:()=>owner});await admin.load();
 const form=mount.querySelector('form');form.elements.namedItem('minimum_build').value='3';form.dispatchEvent(new e.window.Event('input',{bubbles:true}));admin.sync();assert.equal(form.elements.namedItem('minimum_build').value,'3');
 form.dispatchEvent(new e.window.Event('submit',{cancelable:true}));await new Promise(setImmediate);assert.equal(e.saves,0);assert.match(mount.querySelector('[data-release-feedback]').textContent,/mínima no puede superar/);
 form.elements.namedItem('minimum_build').value='2';form.dispatchEvent(new e.window.Event('submit',{cancelable:true}));await new Promise(setImmediate);assert.equal(e.saves,1);assert.equal(e.saved.minimum_build,2);
 owner='member';admin.sync();assert(form.querySelector('button').disabled);assert.equal(form.elements.namedItem('download_url').value,'');e.close();
});
