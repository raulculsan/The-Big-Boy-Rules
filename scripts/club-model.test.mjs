import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../club-model.js';
const {achievementOwnership, nextEventOccurrence, upcomingEvents} = globalThis.ClubModel;
test('ownership counts only distinct active, visible, registered members', () => {
  const members = [{authId:'a'}, {authId:'b'}, {authId:'a'}, {authId:'c',hidden:true}, {authId:'d',isActive:false}, {}];
  const awards = ['a','a','c','d','deleted'].map(userId=>({achievementId:1,userId}));
  assert.deepEqual(achievementOwnership('1',members,awards),{owners:1,total:2,percent:50});
  assert.deepEqual(achievementOwnership(2,members,awards),{owners:0,total:2,percent:0});
});
test('empty census never reports NaN or Infinity', () => {
  assert.deepEqual(achievementOwnership('a',[],[]),{owners:0,total:0,percent:0});
});
test('award removal changes the percentage immediately', () => {
  const members = [{authId:'a'},{authId:'b'}];
  assert.equal(achievementOwnership('gold',members,[{achievementId:'gold',userId:'a'}]).percent,50);
  assert.equal(achievementOwnership('gold',members,[]).percent,0);
});
const now = new Date(2026,8,2,12);
test('past birthday advances to next year while today remains visible', () => {
  assert.equal(nextEventOccurrence({eventType:'birthday',startsAt:new Date(2000,7,20).toISOString()},now).getFullYear(),2027);
  assert.equal(nextEventOccurrence({eventType:'birthday',startsAt:new Date(2000,8,2).toISOString()},now).getFullYear(),2026);
});
test('invalid and completed events are excluded; ongoing events remain', () => {
  assert.equal(nextEventOccurrence({startsAt:'not a date'},now),null);
  assert.equal(nextEventOccurrence({startsAt:new Date(2026,8,1).toISOString()},now),null);
  assert.ok(nextEventOccurrence({startsAt:new Date(2026,8,1).toISOString(),endsAt:new Date(2026,8,3).toISOString()},now));
});
test('upcoming plans are sorted and limited without mutating source', () => {
  const events = [5,3,4,2].map(day=>({id:day,startsAt:new Date(2026,8,day,20).toISOString()}));
  assert.deepEqual(upcomingEvents(events,now).map(item=>item.event.id),[2,3,4]);
  assert.deepEqual(events.map(item=>item.id),[5,3,4,2]);
});
test('leap-day anniversaries remain on a valid matching date', () => {
  const date = nextEventOccurrence({eventType:'birthday',startsAt:new Date(2000,1,29).toISOString()},now);
  assert.equal(date.getMonth(),1);
  assert.equal(date.getDate(),29);
});
const root = new URL('../',import.meta.url);
const html = readFileSync(new URL('index.html',root),'utf8');
const app = readFileSync(new URL('app.js',root),'utf8');
test('four navigation destinations exist and retired interfaces are absent', () => {
  assert.deepEqual([...html.matchAll(/data-section="([^"]+)"/g)].map(match=>match[1]),['inicio','chat','calendario','perfil']);
  for (const id of ['contenido','mediaUploader','storyCamera','postViewer','mediaViewer','mediaReplyModal']) assert.ok(!html.includes(`id="${id}"`));
  for (const id of ['profileEditor','groupAvatarEditor','messageMediaAttachment','privateMessageMediaAttachment']) assert.ok(html.includes(`id="${id}"`),id);
});
test('no subscriptions or queries remain for retired social tables', () => {
  assert.doesNotMatch(app, /(?:from\(|table: )"(?:moments|profile_posts|media_likes|moment_views|media_replies)"/);
});
test('all directly bound controls exist in static or rendered markup', () => {
  for(const [,id] of app.matchAll(/getElementById\("([^"]+)"\)\.addEventListener/g)) {
    assert.ok(html.includes(`id="${id}"`) || app.includes(`id="${id}"`),`Missing control: ${id}`);
  }
});
test('news start collapsed and club modules are included in build and offline shell', () => {
  assert.match(html,/id="newsCollapsible" hidden/);
  assert.match(app,/setNewsCollapsed\(true\)/);
  for (const file of ['scripts/build-web.mjs','service-worker.js','scripts/live-server.mjs']) {
    const source = readFileSync(new URL(file,root),'utf8');
    assert.ok(source.includes('club.css') && source.includes('club-model.js'),file);
  }
});
