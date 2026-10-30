import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const source=await readFile(new URL('../native-auth.js',import.meta.url),'utf8');
function setup({url='bigboyrules://auth/callback?code=one-use',owner='raul',stored=null,error=null,consume=''}={}){
 const dom=new JSDOM('',{url:'https://localhost',runScripts:'outside-only'}),w=dom.window,calls=[];
 w.Capacitor={getPlatform:()=> 'android',registerPlugin:()=>({authenticate:async()=>({url}),consume:async()=>({url:consume})})};
 if(stored)w.localStorage.setItem('bb-native-oauth',JSON.stringify(stored));
 const client={auth:{exchangeCodeForSession:async(...args)=>{calls.push(args);return {data:{user:{id:owner}},error};},signOut:async()=>calls.push('signOut')}};
 w.eval(source);return{w,client,calls,api:w.ClubNativeAuth,close:()=>w.close()};
}
test('native callback exchanges PKCE exactly once and carries flow id',async()=>{const c=setup({url:'bigboyrules://auth/callback?code=one-use&sb_flow_id=flow'});try{const data=await c.api.authenticate(c.client,'https://auth.test',{owner:'raul'});assert.equal(data.user.id,'raul');assert.deepEqual(JSON.parse(JSON.stringify(c.calls)),[['one-use',{flowId:'flow'}]]);assert.equal(c.w.localStorage.getItem('bb-native-oauth'),null);}finally{c.close();}});
test('foreign callback is rejected before exchanging any code',async()=>{const c=setup({url:'https://attacker.test/auth/callback?code=wrong'});try{await assert.rejects(c.api.authenticate(c.client,'x'),/no es válida/);assert.equal(c.calls.length,0);}finally{c.close();}});
test('a different returned account signs out and cannot link the profile',async()=>{const c=setup({owner:'other'});try{await assert.rejects(c.api.authenticate(c.client,'x',{owner:'raul'}),/no corresponde/);assert.equal(c.calls.at(-1),'signOut');}finally{c.close();}});
test('Android recovers an interrupted browser return with the original account receipt',async()=>{const c=setup({stored:{at:Date.now(),owner:'raul'},consume:'bigboyrules://auth/callback?code=restored'});try{assert.equal((await c.api.resume(c.client)).user.id,'raul');assert.equal(c.calls.length,1);assert.equal(c.w.localStorage.getItem('bb-native-oauth'),null);}finally{c.close();}});
test('expired or unsolicited Android callbacks never exchange a code',async()=>{const c=setup({stored:{at:Date.now()-16*60*1000,owner:'raul'},consume:'bigboyrules://auth/callback?code=stale'});try{assert.equal(await c.api.resume(c.client),null);assert.equal(c.calls.length,0);}finally{c.close();}});
test('denial and missing code clear pending state so retry is possible',async()=>{for(const url of ['bigboyrules://auth/callback?error=access_denied','bigboyrules://auth/callback']){const c=setup({url});try{await assert.rejects(c.api.authenticate(c.client,'x'));assert.equal(c.calls.length,0);assert.equal(c.w.localStorage.getItem('bb-native-oauth'),null);}finally{c.close();}}});
