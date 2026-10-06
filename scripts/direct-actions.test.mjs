import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read = file => readFileSync(new URL('../'+file, import.meta.url), 'utf8');
const app = read('app.js'), html = read('index.html');
const escapeHtml = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const getAvatar = () => '<span class="avatar">R</span>';
function renderer(name, next, values) {
  const context = vm.createContext({escapeHtml, getAvatar, ...values});
  const start = app.indexOf(`function ${name}(`), end = app.indexOf(`\nfunction ${next}(`, start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(app.slice(start, end), context);
  return context[name];
}

test('redundant launch arrows are removed from rendered UI, not hidden with CSS', () => {
  for (const source of [app, html, read('achievement-admin.js')]) {
    assert.doesNotMatch(source, /↗|club-arrow|club-member-arrow|club-event-arrow|chat-row-chevron|admin-member-chevron/);
  }
  assert.doesNotMatch(read('club.css'), /club-arrow|club-member-arrow|club-event-arrow/);
});

test('the plans heading opens the calendar with a native, keyboard-accessible button', () => {
  assert.match(html, /<h3 id="clubPlansTitle"><button class="club-heading-link" data-go="calendario" type="button"[^>]*>Próximos planes<\/button><\/h3>/);
  assert.match(read('club.css'), /\.club-heading-link \{[^}]*min-height: 44px/);
  assert.match(html, /class="club-calendar-link" data-go="calendario" type="button">Ver calendario<\/button>/);
});

test('the whole member row remains a profile button and hidden members stay excluded', () => {
  const target = {innerHTML:''};
  renderer('renderMembers', 'memberDisplayNumber', {
    document:{getElementById:()=>target},
    members:[{id:1,name:'Raúl',username:'raul'},{id:2,hidden:true,name:'Oculto'}]
  })();
  assert.match(target.innerHTML, /<button class="club-member" type="button" data-profile="1">/);
  assert.match(target.innerHTML, /<strong>Raúl<\/strong>/);
  assert.doesNotMatch(target.innerHTML, /data-profile="2"/);
});

test('plan dates, names and locations are inside the same day-detail button', () => {
  const target={innerHTML:''}, upcoming=[{date:new Date(2026,8,5,20),event:{title:'Cena del club',location:'Madrid'}}];
  renderer('renderUpcomingEvents', 'openCalendarDay', {
    document:{getElementById:()=>target}, groupEvents:[], ClubModel:{upcomingEvents:()=>upcoming}
  })();
  assert.match(target.innerHTML, /<button class="club-event" type="button" data-calendar-date="2026-09-05">/);
  assert.match(target.innerHTML, /<strong>Cena del club<\/strong>/);
  assert.match(target.innerHTML, /Madrid/);
});

test('trophy cards keep their artwork and detail action without a redundant launch label', () => {
  const render=renderer('renderMemberAchievements', 'renderAchievementDetail', {
    currentAuthUser: null,
    achievementsForMember:()=>[{id:'gold-1',name:'Siempre en el equipo',tier:'gold'}],
    achievementTier:()=>({label:'Oro'}), achievementTrophyIcon:()=>'<span class="achievement-trophy">TROPHY</span>'
  });
  const output=render({id:1});
  assert.match(output, /<button[^>]*data-open-achievement="gold-1"[^>]*aria-label="Ver logro: Siempre en el equipo"/);
  assert.match(output, /achievement-trophy/);
  assert.doesNotMatch(output, /<span>Ver logro/);
});

test('chat rows remain actionable and unread indicators are not lost', () => {
  const target={innerHTML:''};
  const values={
    document:{getElementById:id=>id==='privateContacts'?target:{classList:{contains:()=>false}}},
    currentUser:{id:1}, currentAuthUser:{id:'one'}, messages:[], chatChannels:[], privateMessages:[],
    members:[{id:1,authId:'one',name:'Yo'},{id:2,authId:'two',name:'Raúl'}], activePrivateMemberId:null,
    notifications:[{type:'private_message',actorId:'two',readAt:null}],
    filterInboxContacts(){},
    groupAvatarMarkup:()=>'<span>BB</span>'
  };
  const render=renderer('renderPrivateContacts', 'messagePreviewText', values);
  render();
  assert.match(target.innerHTML, /<button[^>]*data-open-group-chat/);
  assert.match(target.innerHTML, /<button[^>]*data-private-member="2"/);
  assert.match(target.innerHTML, /inbox-unread-count/);
  assert.match(target.innerHTML, /data-unread="1"/);
  values.notifications.length=0;
  render();
  assert.doesNotMatch(target.innerHTML, /inbox-unread-count|chat-row-chevron/);
});

test('direct targets still use the existing profile, calendar and trophy handlers', () => {
  for (const action of ['goTo(goTarget.dataset.go)', 'renderProfile(profileId)', 'openCalendarDay(calendarDayTarget.dataset.calendarDate)', 'openAchievementDetail(achievementTarget.dataset.openAchievement, returnFocus)']) {
    assert.ok(app.includes(action), action);
  }
});
