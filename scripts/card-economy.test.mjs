import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('fusion recipes shown in the app match the server', () => {
  const client = read('card-economy.js'), server = read('supabase/migrations/20261103140000_card_fusion_market_wishlist.sql');
  for (const [key, needs] of [['common', 5], ['special', 4], ['epic', 4], ['legendary', 3]]) {
    assert.match(client, new RegExp(`key:'${key}'[^}]*needs:${needs}`), `${key} needs ${needs} in the app`);
  }
  assert.match(server, /required:=case tier when 'common' then 5 when 'special' then 4 when 'epic' then 4 else 3 end/);
  assert.match(server, /when 'retro' then 'special'/, 'retro fuses with special');
});

test('the market never lists the last copy and keeps the discard value as minimum price', () => {
  const server = read('supabase/migrations/20261103140000_card_fusion_market_wishlist.sql');
  assert.match(server, /if held is null or held<2 then raise exception 'Solo puedes vender repetidas/);
  assert.match(server, /minimum:=public\.card_discard_reward\(edition_name\)/);
  assert.match(server, /if listing\.seller_id=actor then raise exception/);
});

test('darts goals and the 20-level platinum are the same in the app and the server', () => {
  const games = read('chota-games.js'), server = read('supabase/migrations/20261103150000_chota_darts.sql');
  assert.match(games, /id==='darts'\?\[12,18,24,30,36\]\[level-1\]/);
  assert.match(server, /when 'darts' then \(array\[12,18,24,30,36\]\)\[game_row\.level\]/);
  assert.match(server, /set target_count=20/);
  assert.match(read('chota-shop.js'), /darts: \{src:'icons\/clubhouse\/props\/darts-board-v1\.svg'/);
});

test('streak protectors are capped at two and priced like the claim reports', () => {
  const server = read('supabase/migrations/20261103130000_streak_shields.sql'), client = read('daily-packs.js');
  assert.match(server, /check \(shields between 0 and 2\)/);
  assert.match(server, /price constant integer:=80/);
  assert.match(server, /'streak_shield_price',80,'streak_shield_limit',2/);
  assert.match(client, /data-buy-shield/);
});
