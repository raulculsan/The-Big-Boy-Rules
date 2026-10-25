import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
function warmHarness() {
  const images=[], timers=new Map(); let next=0, active='inicio';
  class Image {
    constructor(){this.naturalWidth=0;this.naturalHeight=0;this.complete=false;images.push(this);}
    removeAttribute(){this.src='';}
    load(width=640,height=480){this.naturalWidth=width;this.naturalHeight=height;this.complete=true;this.onload?.();}
  }
  const ctx=vm.createContext({Image,Map,Set,navigator:{},document:{hidden:false,getElementById:id=>({classList:{contains:()=>id===active}})},currentAuthUser:{id:'alice'},messages:[],privateMessages:[],activeChatChannelId:'general',activePrivateMemberId:7,getMember:()=>({authId:'bob'}),messageTimestamp:m=>m.time,getSharedMediaReference:()=>null,chatImageSource:url=>url?.startsWith('https:')?url:null,setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(app.slice(app.indexOf('const chatImageWarmCache'),app.indexOf('const chatThumbnailLoads')),ctx);
  return {ctx,images,timers,setActive:value=>{active=value;},flush(){const queued=[...timers];for(const [id,fn] of queued){timers.delete(id);fn();}}};
}
const photo=(id,time=id)=>({attachmentUrl:`https://media.test/${id}.jpg`,attachmentType:'image/jpeg',channelId:'general',time});
test('chat image warmup is deferred and does not fetch during the home startup',()=>{
  const h=warmHarness();h.ctx.messages=[photo(1),{...photo(2),channelId:'other'}];h.ctx.scheduleChatImageWarmup();assert.equal(h.images.length,0);h.flush();assert.equal(h.images.length,0);
  h.setActive('chat');h.ctx.scheduleChatImageWarmup();h.flush();assert.equal(h.images.length,1);assert.equal(h.images[0].fetchPriority,'low');
});
test('warmup picks the newest safe images, deduplicates and bounds retained decoded memory',()=>{
  const h=warmHarness();h.ctx.warmChatImages([photo(1),photo(2),photo(3),photo(4),photo(5),photo(5),{...photo(9),attachmentUrl:'storage://private-chat/unresolved'}]);
  assert.deepEqual(h.images.map(i=>i.src),[5,4,3,2].map(id=>`https://media.test/${id}.jpg`));
  h.images.forEach(image=>image.load(2048,2048));
  assert.ok(h.images.filter(image=>image.src).length<=1,'decoded copies stay within the pixel budget');
  h.ctx.warmChatImages([photo(2)],{explicit:true});assert.equal(h.images.length,4,'an already warm image is reused');
  h.ctx.clearChatImageWarmCache();assert.ok(h.images.every(image=>!image.src));assert.equal(h.timers.size,0);
});
test('automatic warmup respects data saver; explicit entry works and account changes release old images',()=>{
  const h=warmHarness();h.ctx.navigator.connection={saveData:true};h.ctx.warmChatImages([photo(1)]);assert.equal(h.images.length,0);
  h.ctx.warmChatImages([photo(1)],{explicit:true});assert.equal(h.images.length,1);
  h.ctx.currentAuthUser={id:'bob'};h.ctx.warmChatImages([photo(2)],{explicit:true});assert.equal(h.images[0].src,'');assert.equal(h.images[1].src,'https://media.test/2.jpg');
});
test('private conversation warmup excludes other conversations',()=>{
  const h=warmHarness();h.setActive('privados');h.ctx.privateMessages=[{...photo(1),senderId:'bob',recipientId:'alice'},{...photo(2),senderId:'alice',recipientId:'eve'}];h.ctx.scheduleChatImageWarmup();h.flush();assert.deepEqual(h.images.map(i=>i.src),['https://media.test/1.jpg']);
});
test('private messages render before signing completes and stale account completions do not refresh',async()=>{
  let finishSigning, refreshes=0;const states=[];
  const ctx=vm.createContext({currentAuthUser:{id:'alice'},privateMessages:[],document:{getElementById:()=>({})},ClubFeedback:{set:(_anchor,state)=>states.push(state)},db:{from:()=>({select(){return this},order(){return this},limit:async()=>({data:[{id:1}]})})},mapPrivateMessage:item=>item,applyCachedPrivateAttachments(){},refreshPrivateMessageSurfaces(){refreshes++;},resolvePrivateAttachments:()=>new Promise(resolve=>{finishSigning=resolve;})});
  vm.runInContext(app.slice(app.indexOf('async function loadPrivateMessages()'),app.indexOf('const privateAttachmentCache')),ctx);
  await ctx.loadPrivateMessages();assert.equal(refreshes,1);assert.deepEqual(states,['loading','ready']);
  ctx.currentAuthUser={id:'bob'};finishSigning();await Promise.resolve();assert.equal(refreshes,1);
});
