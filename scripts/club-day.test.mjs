import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('club day is shipped everywhere the app loads files from', async () => {
  const [index, worker, build, live] = await Promise.all(['index.html', 'service-worker.js', 'scripts/build-web.mjs', 'scripts/live-server.mjs'].map(read));
  for (const file of ['club-day.js', 'club-day.css']) {
    assert.ok(index.includes(`${file}?v=`));
    assert.ok(worker.includes(`./${file}?v=`));
    assert.ok(build.includes(`"${file}"`));
    assert.ok(live.includes(`"${file}"`));
  }
  assert.ok(index.includes('id="clubDay"'));
});

test('club day keeps coins and votes on the server', async () => {
  const [sql, client] = await Promise.all([read('supabase/migrations/20261031200000_club_day.sql'), read('club-day.js')]);
  assert.match(sql, /revoke all on schema club_day from public,anon,authenticated/);
  assert.equal(sql.match(/create table club_day\./g).length, sql.match(/enable row level security/g).length);
  assert.doesNotMatch(client, /\.from\(/);
  assert.doesNotMatch(client, /award_coins|member_coin/);
});

test('club day never paints a warm highlight on selection', async () => {
  const css = await read('club-day.css');
  assert.doesNotMatch(css, /gold|yellow|--ds-accent/);
});
