import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
const origin='https://club.test/';
function setup() {
  const handlers=new Map(), stores=new Map(), fetched=[];
  const key=request=>new URL(request.url || request,origin).href;
  const caches={keys:async()=>[...stores.keys()],delete:async name=>stores.delete(name),open:async name=>{
    if(!stores.has(name))stores.set(name,new Map()); const store=stores.get(name);
    return {match:async request=>store.get(key(request))?.clone(),put:async(request,response)=>{store.set(key(request),response.clone());},delete:async request=>store.delete(key(request)),keys:async()=>[...store.keys()].map(url=>({url})),addAll:async()=>{}};
  }};
  vm.runInNewContext(source,{URL,Headers,Response,Date,self:{registration:{scope:origin},location:{origin:new URL(origin).origin,href:origin},clients:{claim:async()=>{}},addEventListener:(event,handler)=>handlers.set(event,handler)},caches,fetch:async request=>{fetched.push(key(request));return new Response('public art');}});
  async function dispatch(event,request){let response;const waits=[];handlers.get(event)({request,respondWith:p=>{response=p;},waitUntil:p=>waits.push(p)});const result=await response;await Promise.all(waits);return result;}
  return {stores,caches,fetched,dispatch};
}
test('activation retains public artwork but discards previously cached private images',async()=>{
  const h=setup(),old=await h.caches.open('big-boy-rules-v290');
  await old.put('./icons/cards/fufi-comun-77-v1.png',new Response('fufi'));
  await old.put('./uploads/private-chat/secret.jpg',new Response('private'));
  await old.put('./icons/cards/not-public.png',new Response('private',{headers:{'cache-control':'private, no-store'}}));
  await old.put('./icons/cards/too-heavy.png',new Response(new Uint8Array(7 * 1024 * 1024)));
  await h.dispatch('activate');
  assert.equal(h.stores.has('big-boy-rules-v290'),false);
  const media=await h.caches.open('big-boy-rules-public-media-v1');
  assert.equal(await (await media.match('./icons/cards/fufi-comun-77-v1.png')).text(),'fufi');
  assert.equal(await media.match('./uploads/private-chat/secret.jpg'),undefined);
  assert.equal(await media.match('./icons/cards/not-public.png'),undefined);
  assert.equal(await media.match('./icons/cards/too-heavy.png'),undefined);
  const cached=await h.dispatch('fetch',{method:'GET',url:origin+'icons/cards/fufi-comun-77-v1.png',destination:'image'});
  assert.equal(await cached.text(),'fufi');assert.equal(h.fetched.length,0,'fresh media need no update download');
  assert.equal(await h.dispatch('fetch',{method:'GET',url:origin+'uploads/private-chat/secret.jpg',destination:'image'}),undefined);
});
test('media cache uses exact version URLs, ignores API calls, and bounds entry count',async()=>{
  const h=setup();
  for(let i=0;i<122;i++)await h.dispatch('fetch',{method:'GET',url:origin+`icons/cards/card-v${i}.png`,destination:'image'});
  const media=await h.caches.open('big-boy-rules-public-media-v1');assert.equal((await media.keys()).length,120);
  assert.equal(await media.match('./icons/cards/card-v0.png'),undefined);
  await h.dispatch('fetch',{method:'GET',url:origin+'icons/cards/card-v121.png?v=2',destination:'image'});
  assert.ok(await media.match('./icons/cards/card-v121.png?v=2'));
  assert.equal(await h.dispatch('fetch',{method:'GET',url:origin+'api/private-messages',destination:''}),undefined);
});
