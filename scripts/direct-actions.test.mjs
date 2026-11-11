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
  // ↗ survives only as the "Chats" notification-category symbol, not as a launch arrow.
  const withoutCategorySymbol = app.replace('symbol:"↗"', '');
  for (const source of [withoutCategorySymbol, html, read('achievement-admin.js')]) {
    assert.doesNotMatch(source, /↗|club-arrow|club-member-arrow|club-event-arrow|chat-row-chevron|admin-member-chevron/);
  }
  assert.doesNotMatch(read('club.css'), /club-arrow|club-member-arrow|club-event-arrow/);
});

test('the next plan in the clubhouse is a native button that opens that calendar day', () => {
  const start = app.indexOf('const plan = next ? `<button class="clubhouse-plan"');
  assert.ok(start > 0);
  assert.match(app.slice(start, start + 400), /<button class="clubhouse-plan" type="button" data-calendar-date="\$\{tigretonDayKey\(next\.date\)\}" aria-label="Ver plan: /);
});

test('the whole member tile remains a profile button and hidden members stay excluded', () => {
  const tile = renderer('memberTileMarkup', 'renderMembers', {});
  const markup = [{id:1,name:'Raúl',username:'raul'}].map(tile).join('');
  assert.match(markup, /<button class="club-member" type="button" data-profile="1"/);
  assert.match(markup, /aria-label="Ver perfil de Raúl"/);
  assert.match(markup, /<strong>Raúl<\/strong>/);
  assert.match(app, /members\.filter\(member => !member\.hidden\)\.map\(memberTileMarkup\)/);
});

test('trophy cards keep their artwork and detail action without a redundant launch label', () => {
  const card = renderer('renderProfileAchievementCard', 'renderMemberAchievements', {
    achievementTier:()=>({label:'Oro'}), achievementTrophyIcon:()=>'<span class="achievement-trophy">TROPHY</span>'
  });
  const output = card({id:'gold-1',name:'Siempre en el equipo',tier:'gold'});
  assert.match(output, /<button[^>]*data-open-achievement="gold-1"[^>]*aria-label="Ver logro: Siempre en el equipo/);
  assert.match(output, /achievement-trophy/);
  assert.doesNotMatch(output, /<span>Ver logro/);
});

// Chat rows, unread badges and the group row are covered by club-design.test.mjs.

test('direct targets still use the existing profile, calendar and trophy handlers', () => {
  for (const action of ['goTo(goTarget.dataset.go)', 'renderProfile(profileId)', 'openCalendarDay(calendarDayTarget.dataset.calendarDate)', 'openAchievementDetail(achievementTarget.dataset.openAchievement, returnFocus)']) {
    assert.ok(app.includes(action), action);
  }
});
