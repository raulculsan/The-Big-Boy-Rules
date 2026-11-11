import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const ME = 'me', PEER = 'peer';
const cards = ['c1','c2','c3','c4','r1'].map((id, i) => ({id, name: `Carta ${i + 1}`, edition: 'Común', score: 80 + i, front: `icons/cards/${id}.jpg`, back: 'icons/cards/back.jpg', width: 948, height: 1660}));

function setup(trades = []) {
  const dom = new JSDOM('<!doctype html><body></body>', {url: 'https://club.test/', runScripts: 'outside-only', pretendToBeVisual: true});
  const {window: w} = dom;
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.CSS = {escape: value => value};
  w.CardCollection = {catalog: cards, thumbnail: card => card.front};
  w.crypto.randomUUID = () => 'new-offer';
  const calls = [];
  const state = {marks: [], peers: [{id: PEER, name: 'Beto', username: 'beto'}], trades};
  w.eval(read('collection-social.js'));
  w.CollectionSocial.initialize({session: () => ME, rpc: async (name, args) => { calls.push([name, JSON.parse(JSON.stringify(args))]); return {data: name === 'get_collection_social_state' ? state : 'review', error: null}; }, refreshInventory: async () => {}});
  w.CollectionSocial.update([{card_id: 'c1', quantity: 2}, {card_id: 'c2', quantity: 3}, {card_id: 'c3', quantity: 2}, {card_id: 'c4', quantity: 2}, {card_id: 'r1', quantity: 1}]);
  const d = w.document, trade = () => d.querySelector('.collection-trade-dialog');
  const click = selector => { const node = trade().querySelector(selector); assert.ok(node, selector); node.click(); };
  return {w, d, calls, trade, click, close: () => w.close()};
}

test('invite offers a lot of up to three duplicates', async () => {
  const t = setup();
  t.w.CollectionSocial.openTrades(); await flush();
  t.click('[data-trade-start], [data-trade-new], .social-send');
  await flush();
  t.click(`[data-trade-peer="${PEER}"]`);
  for (const id of ['c1', 'c2', 'c3', 'c4']) t.click(`[data-trade-card="${id}"]`);
  const picked = [...t.trade().querySelectorAll('.trade-pick-card.is-picked')].map(node => node.dataset.tradeCard).sort();
  assert.deepEqual(picked, ['c1', 'c2', 'c3'], 'a fourth card is not added');
  assert.equal(t.trade().querySelector('[data-trade-card="c4"]').getAttribute('aria-disabled'), 'true');
  assert.equal(t.trade().querySelector('[data-trade-card="r1"]'), null, 'single copies are not offered');
  assert.match(t.trade().querySelector('.trade-selection-dock').textContent, /TUS 3 CARTAS/);
  t.click('[data-trade-card="c2"]');
  assert.deepEqual([...t.trade().querySelectorAll('.trade-pick-card.is-picked')].map(node => node.dataset.tradeCard).sort(), ['c1', 'c3'], 'tapping again removes it');
  t.click('[data-trade-next]');
  assert.equal(t.trade().querySelectorAll('.trade-review-art .social-trade-lot img').length, 2);
  t.click('[data-trade-create]'); await flush();
  const invite = t.calls.find(([name]) => name === 'invite_card_trade');
  assert.deepEqual(invite[1], {offer_id: 'new-offer', target_user_id: PEER, give_card_ids: ['c1', 'c3']});
  t.close();
});

test('received lots show every card and the reply proposes a lot', async () => {
  const offer = {id: 'o1', sender_id: PEER, recipient_id: ME, sender_name: 'Beto', recipient_name: 'Yo', status: 'selecting', offered_card_id: 'c4', offered_card_ids: ['c4', 'r1'], requested_card_ids: null, expires_at: new Date(Date.now() + 86400000).toISOString()};
  const t = setup([offer]);
  t.w.CollectionSocial.openTrades(); await flush();
  assert.equal(t.trade().querySelectorAll('[data-trade-offer-id="o1"] .social-trade-lot img').length, 2);
  t.click('[data-trade-pick-offer="o1"]');
  assert.equal(t.trade().querySelector('[data-trade-card="c4"]'), null, 'cards you would receive are not offered back');
  t.click('[data-trade-card="c1"]'); t.click('[data-trade-card="c2"]');
  t.click('[data-trade-next]'); t.click('[data-trade-create]'); await flush();
  const propose = t.calls.find(([name, args]) => name === 'advance_card_trade' && args.decision === 'propose');
  assert.deepEqual(propose[1], {offer_id: 'o1', decision: 'propose', own_card_ids: ['c1', 'c2']});
  t.close();
});
