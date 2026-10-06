import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
const read = file => readFileSync(new URL('../'+file,import.meta.url),'utf8');
const app = read('app.js');
function inbox() {
  const dom = new JSDOM(read('index.html'));
  const document = dom.window.document;
  const context = vm.createContext({document, Date, Set, JSON,
    escapeHtml:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
    currentUser:{id:1},currentAuthUser:{id:'a'},activePrivateMemberId:null,
    localStorage:{data:{},getItem(key){return this.data[key]??null;},setItem(key,value){this.data[key]=value;}},
    members:[{id:1,authId:'a',name:'Yo'},{id:2,authId:'b',name:'Álex',username:'alex'},{id:3,authId:'c',name:'María',username:'mari'}],
    messages:[],chatChannels:[],
    privateMessages:[{senderId:'a',recipientId:'b',body:'Hola <script>',createdAt:new Date().toISOString()}],
    notifications:[{type:'private_message',actorId:'b',readAt:null}],
    getAvatar:()=>'<span class="avatar">A</span>',groupAvatarMarkup:()=>'<span class="chat-group-avatar">BB</span>'
  });
  vm.runInContext(app.slice(app.indexOf('function formatInboxTime('),app.indexOf('async function openPrivateConversation(')),context);
  context.renderPrivateContacts();
  return {dom,document,context,visible:()=>[...document.querySelectorAll('.private-contact:not([hidden])')],
    filter:mode=>document.querySelector(`[data-inbox-filter="${mode}"]`).click()};
}
test('inbox defaults to existing conversations; new chat still exposes other members',()=>{
  const s=inbox();
  assert.equal(s.visible().length,2);
  s.filter('new'); assert.equal(s.visible().length,2);
  assert.ok(s.visible().every(row=>!row.hasAttribute('data-open-group-chat')));
  assert.equal(s.document.activeElement.id,'inboxSearchInput');
  s.filter('all'); assert.equal(s.visible().length,2);
  s.filter('groups'); assert.equal(s.visible().length,1); assert.equal(s.visible()[0].dataset.kind,'group');
  s.dom.window.close();
});
test('accent-insensitive search uses member names and handles, never message contents',()=>{
  const s=inbox(), input=s.document.getElementById('inboxSearchInput');
  input.value='MARIA';input.dispatchEvent(new s.dom.window.Event('input'));
  assert.equal(s.visible()[0].dataset.privateMember,'3');
  input.value='Hola';input.dispatchEvent(new s.dom.window.Event('input'));
  assert.equal(s.visible().length,0);
  assert.equal(s.document.getElementById('inboxEmpty').hidden,false);
  s.dom.window.close();
});
test('unread filter and badges refresh when notifications change without losing the search',()=>{
  const s=inbox();s.filter('unread');
  assert.equal(s.visible().length,1);
  assert.equal(s.visible()[0].querySelector('.inbox-unread-count').textContent,'1');
  s.document.getElementById('inboxSearchInput').value='alex';
  s.context.notifications.length=0;s.context.renderPrivateContacts();
  assert.equal(s.visible().length,0);
  assert.equal(s.document.getElementById('inboxSearchInput').value,'alex');
  assert.equal(s.document.querySelector('[data-inbox-filter="unread"]').getAttribute('aria-pressed'),'true');
  s.dom.window.close();
});
test('favorite filter is distinct from groups and shows the empty message',()=>{
  const s=inbox();
  s.filter('favorites'); assert.equal(s.visible().length,0);
  assert.match(s.document.getElementById('inboxEmpty').textContent,/favoritos/);
  assert.equal(s.document.querySelector('[data-inbox-filter="favorites"]').getAttribute('aria-pressed'),'true');
  s.dom.window.close();
});
test('message previews escape markup, retain actions and distinguish outgoing messages',()=>{
  const s=inbox();
  const row=s.document.querySelector('[data-private-member="2"]');
  assert.equal(row.querySelector('small').textContent,'Tú: Hola <script>');
  assert.equal(row.querySelector('script'),null);
  assert.ok(row.querySelector('time[datetime]'));
  s.dom.window.close();
});
test('compact timestamps handle today, yesterday, year boundaries and invalid dates',()=>{
  const s=inbox(), fn=s.context.formatInboxTime, now=new Date(2026,0,1,12);
  assert.equal(fn(new Date(2025,11,31,23).toISOString(),now),'Ayer');
  assert.match(fn(new Date(2026,0,1,9,5).toISOString(),now),/09:05/);
  assert.equal(fn('invalid',now),'');s.dom.window.close();
});
test('new appearance preserves keyboard owners, native gestures, assets and 16px inputs',()=>{
  const css=read('chat.css');
  assert.match(css,/inbox-search input[^}]*16px/);
  assert.match(css,/message-form input[^}]*font-size: 16px/);
  assert.match(css,/private-contact\[hidden\][^}]*display: none/);
  for(const file of ['index.html','service-worker.js']) for(const asset of ['club.css?v=20261006-157','chat.css?v=20261006-157','app.js?v=20261006-157']) assert.ok(read(file).includes(asset));
  assert.match(app,/data-edit-private-message/);assert.match(app,/data-delete-private-message/);
  assert.match(app,/class="private-message-time" datetime=/);
});
