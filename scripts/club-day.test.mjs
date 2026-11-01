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
  assert.ok(index.includes('data-go="hoy"'));
  assert.ok(index.includes('id="hoy"'));
});

test('club day keeps coins and votes on the server', async () => {
  const [sql, client] = await Promise.all([read('supabase/migrations/20261031200000_club_day.sql'), read('club-day.js')]);
  assert.match(sql, /revoke all on schema club_day from public,anon,authenticated/);
  assert.equal(sql.match(/create table club_day\./g).length, sql.match(/enable row level security/g).length);
  assert.doesNotMatch(client, /\.from\(/);
  assert.doesNotMatch(client, /award_coins|member_coin/);
});

test('duels read scores and ownership only on the server', async () => {
  const [sql, client] = await Promise.all([read('supabase/migrations/20261031210000_club_day_extras.sql'), read('club-day.js')]);
  assert.equal(sql.match(/create table club_day\./g).length, sql.match(/enable row level security/g).length);
  assert.match(sql, /'duel:'\|\|club_day\.today\(\)/);
  assert.doesNotMatch(client, /p_score|p_coins|p_winner/);
});

test('whois keeps authors on the server until the round ends', async () => {
  const sql = await read('supabase/migrations/20261031220000_club_whois.sql');
  assert.equal(sql.match(/create table club_day\./g).length, sql.match(/enable row level security/g).length);
  assert.doesNotMatch(sql, /'answers',case when guessing[^\n]*\n[^\n]*'author'/);
});

test('chat customization only writes through checked functions', async () => {
  const [sql, client, css, index, worker] = await Promise.all(['supabase/migrations/20261101090000_chat_customization.sql', 'chat-custom.js', 'chat-custom.css', 'index.html', 'service-worker.js'].map(read));
  assert.doesNotMatch(sql, /grant (insert|update|delete|all)/i);
  assert.doesNotMatch(client, /\.(insert|update|upsert|delete)\(/);
  assert.doesNotMatch(css, /gold|yellow/);
  for (const file of ['chat-custom.js', 'chat-custom.css']) { assert.ok(index.includes(`${file}?v=`)); assert.ok(worker.includes(`./${file}?v=`)); }
});

test('discarding a selection keeps the last copy and stays atomic', async () => {
  const [sql, shop, css] = await Promise.all(['supabase/migrations/20261101100000_discard_selected_duplicates.sql', 'banner-shop.js', 'design-system.css'].map(read));
  assert.match(sql, /picked\.copies>=held/);
  assert.match(sql, /group by card_id/);
  assert.doesNotMatch(shop, /discard_all_duplicate_cards/);
  assert.doesNotMatch(css.slice(css.indexOf('Repetidas:'), css.indexOf('Pull to refresh')), /gold|yellow|--ds-accent/);
});

test('mentions come from the stored text and never open markup', async () => {
  const [sql, client] = await Promise.all([read('supabase/migrations/20261101120000_group_mentions.sql'), read('chat-mentions.js')]);
  assert.match(sql, /regexp_matches\(new\.body/);
  assert.doesNotMatch(client, /\.rpc\(|\.from\(/);
  assert.match(client, /Takes already-escaped text/);
});

test('pull to refresh ships everywhere and leaves conversations alone', async () => {
  const [app, index, worker, build, live] = await Promise.all(['app.js', 'index.html', 'service-worker.js', 'scripts/build-web.mjs', 'scripts/live-server.mjs'].map(read));
  assert.ok(index.includes('pull-refresh.js?v='));
  assert.ok(worker.includes('./pull-refresh.js?v='));
  assert.ok(build.includes('"pull-refresh.js"'));
  assert.ok(live.includes('"pull-refresh.js"'));
  assert.match(app, /dialog\[open\], \.conversation-open/);
});

test('tickets only write through checked functions and escape what members type', async () => {
  const [sql, client, index, css] = await Promise.all(['supabase/migrations/20261101140000_tickets.sql', 'tickets.js', 'index.html', 'tickets.css'].map(read));
  assert.doesNotMatch(client, /\.(insert|update|upsert|delete)\(/);
  assert.match(sql, /club\.ticket_reopen/);
  assert.match(sql, /Solo administración puede cambiar ese estado/);
  assert.ok(index.includes('id="helpReplyForm"'));
  assert.doesNotMatch(css, /gold|yellow|--ds-accent/);
});

test('club day never paints a warm highlight on selection', async () => {
  const css = await read('club-day.css');
  assert.doesNotMatch(css, /gold|yellow|--ds-accent/);
});
