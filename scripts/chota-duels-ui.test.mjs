import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(setImmediate); };
test('arcade menu lists open and claimable duels; play, decline and claim', async () => {
  const dom = new JSDOM('<!doctype html><body></body>', {url: 'https://fixture.test', runScripts: 'outside-only', pretendToBeVisual: true});
  const {window: w} = dom, d = w.document, calls = [];
  try {
    w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    w.HTMLDialogElement.prototype.close = function () { this.open = false; };
    w.matchMedia = () => ({matches: false, addEventListener() {}});
    const later = new Date(Date.now() + 86400000).toISOString();
    let duels = [
      {id: 'd1', incoming: true, other: 'Ana', game: 'football', level: 2, target_score: 40, attempts: 1, rival_best: 20, status: 'open', expires_at: later, can_claim: false},
      {id: 'd2', incoming: false, other: 'Beto', game: 'football', level: 1, target_score: 30, attempts: 3, rival_best: 12, status: 'lost', expires_at: later, can_claim: true},
      {id: 'd3', incoming: false, other: 'Cris', game: 'football', level: 1, target_score: 30, attempts: 3, rival_best: 40, status: 'won', expires_at: later, can_claim: false}
    ];
    w.eval(read('chota-games.js'));
    w.ChotaGames.initialize({user: () => 'me', session: () => 'me', owned: async () => new Set(['football']), rpc: async (name, args) => {
      calls.push([name, args && JSON.parse(JSON.stringify(args))]);
      if (name === 'decline_chota_duel') duels = duels.map(x => x.id === args.p_duel ? {...x, status: 'lost'} : x);
      if (name === 'claim_chota_duel') { duels = duels.map(x => x.id === args.p_duel ? {...x, can_claim: false} : x); return {data: {duels, awarded_coins: 40}}; }
      if (['get_chota_duels', 'decline_chota_duel'].includes(name)) return {data: {duels, peers: []}};
      if (name === 'get_chota_level_progress') return {data: {football: 2}};
      return {data: null};
    }});
    await w.ChotaGames.open(); await settle();
    const panel = d.querySelector('[data-duels]');
    assert.equal(panel.hidden, false);
    const rows = [...panel.querySelectorAll('.chota-duel')];
    assert.equal(rows.length, 2, 'finished duels without a prize are not listed');
    assert.match(rows[0].textContent, /Te reta Ana/);
    assert.match(rows[0].textContent, /Supera 40 .* 2 intentos/);
    assert.match(rows[1].textContent, /Tu marca ha aguantado/);
    panel.querySelector('[data-duel-claim="d2"]').click(); await settle();
    assert.deepEqual(calls.find(([name]) => name === 'claim_chota_duel')[1], {p_duel: 'd2'});
    assert.match(d.querySelector('[data-duels] .chota-duel-feedback').textContent, /\+40 monedas/);
    d.querySelector('[data-duel-decline="d1"]').click(); await settle();
    assert.deepEqual(calls.find(([name]) => name === 'decline_chota_duel')[1], {p_duel: 'd1'});
  } finally { w.close(); }
});
