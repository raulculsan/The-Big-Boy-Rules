import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read = file => readFileSync(new URL('../'+file,import.meta.url),'utf8');
const module = read('achievement-admin.js'), app=read('app.js'), html=read('index.html');
const context=vm.createContext({}); vm.runInContext(module,context);
const {normalize,eligible,changes}=context.AchievementAdmin;

test('member search handles accents, case and usernames', () => {
  assert.equal(normalize('MIGUEL ÁNGEL'),'miguel angel');
  assert.ok(normalize('Raúl @raul').includes(normalize('RAUL')));
});
test('only active linked, visible members can be selected', () => {
  const members=[{authId:'a'},{authId:'b',hidden:true},{authId:'c',isActive:false},{id:4}];
  assert.deepEqual([...eligible(members)].map(m=>m.authId),['a']);
  assert.equal(members.length,4);
});
test('assignment summary distinguishes additions and withdrawals without changing inputs', () => {
  const before=new Set(['a','b']),after=new Set(['b','c']);
  const delta=changes(before,after);
  assert.deepEqual([...delta.added],['c']);assert.deepEqual([...delta.removed],['a']);
  assert.deepEqual([...before],['a','b']);assert.deepEqual([...after],['b','c']);
  assert.equal(changes(before,before).added.length,0);
});
test('management, creation and assignment have independent pages with back controls', () => {
  for (const id of ['admin-logros','crear-logro','asignar-logro']) {
    const page=html.match(new RegExp(`<section class="page-section achievement-admin-page" id="${id}">([^]*?)</section>`));
    assert.ok(page,id);assert.ok(page[1].includes('achievement-back'));
  }
  assert.ok(html.includes('data-go="admin-logros"'));
  assert.doesNotMatch(html,/admin-achievements-panel admin-tool-disclosure|id="achievementAssignmentModal"/);
});
test('admin authorization and atomic backend procedures remain enforced', () => {
  assert.match(app,/\["admin-logros", "crear-logro", "asignar-logro"\]\.includes\(sectionId\) && !canManageSite\(\)/);
  assert.match(app,/if \(!canManageSite\(\) \|\| !currentAuthUser \|\| !db\) throw/);
  assert.ok(app.includes('create_achievement_with_awards'));assert.ok(app.includes('set_achievement_awards'));
  assert.match(module,/if \(!options\.canManage\(\) \|\| creating\) return/);
  assert.match(module,/if \(!options\.canManage\(\) \|\| !assignmentId \|\| assigning\) return/);
});
test('search never removes selections and a realtime render retains draft recipients', () => {
  assert.match(module,/const ids = initial \|\| selected\(list\)/);
  assert.match(module,/row\.hidden = !row\.dataset\.search\.includes\(query\)/);
  assert.match(module,/if \(!row\.hidden\) row\.querySelector\('input'\)\.checked = true/);
  assert.match(module,/list\.dataset\.members !== signature/);
  assert.ok(module.includes('original,currentAwards(assignmentId)'));
  assert.ok(module.includes('Se retirará este logro a'));
});
test('profile scroll is vertical, independent and only reserves clearance for the dock', () => {
  const css=read('styles.css'),club=read('club.css');
  assert.doesNotMatch(css,/#perfil\s*\{\s*overflow:\s*hidden/);
  assert.match(club,/#perfil \{ overflow-x: hidden; overflow-y: auto; padding-bottom: calc\(86px \+ env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(club,/#perfil \.profile-achievements \{[^}]*margin: 0; padding: 28px 0 0;/);
});
test('management assets load before the app and ship in preview, offline shell and iOS build', () => {
  assert.ok(html.indexOf('<script src="achievement-admin.js')<html.indexOf('<script src="app.js'));
  for (const file of ['scripts/build-web.mjs','scripts/live-server.mjs','scripts/preview-club.mjs','service-worker.js']) {
    for (const asset of ['achievement-admin.js','achievement-admin.css']) assert.ok(read(file).includes(asset),file+' '+asset);
  }
  assert.ok(!read('scripts/build-web.mjs').includes('achievement-admin-fixture'));
});
