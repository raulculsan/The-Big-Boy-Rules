import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const tick = () => new Promise(setImmediate);
test('saved looks: four slots, save with a name, wear and delete', async () => {
  const dom = new JSDOM('<div id="chotaShopStatus"></div><div id="chotaShopItems"></div><p id="clothingShopStatus"></p><section id="chotaOutfits" hidden></section><div id="clothingShopItems"></div>', {url: 'https://fixture.test', runScripts: 'outside-only'});
  const {window: w} = dom, d = w.document, calls = [];
  try {
    w.matchMedia = () => ({matches: false, addEventListener() {}}); w.BIG_BOY_CONFIG = {supabaseUrl: 'https://fixture.invalid'};
    w.eval(read('shop-catalog-media.js')); w.eval(read('chota-shop.js'));
    let looks = [{position: 1, name: 'Domingo', items: {outerwear: 'coat'}, removed_original_slots: []}];
    const state = {balance: 10, room_style: null, items: []};
    w.ChotaShop.initialize({session: () => 'a', cacheNamespace: 'https://fixture.invalid', rpc: async (name, args) => {
      calls.push([name, args && JSON.parse(JSON.stringify(args))]);
      if (name === 'save_chota_outfit') looks = [...looks, {position: args.p_position, name: args.p_name, items: {}, removed_original_slots: []}];
      if (name === 'delete_chota_outfit') looks = looks.filter(look => look.position !== args.p_position);
      return {data: ['get_chota_outfits', 'save_chota_outfit', 'delete_chota_outfit'].includes(name) ? looks : state};
    }});
    await w.ChotaShop.refresh(); await tick(); await tick();
    const host = d.getElementById('chotaOutfits');
    assert.equal(host.hidden, false);
    assert.equal(host.querySelectorAll('.chota-look').length, 4);
    assert.match(host.querySelector('[data-look-wear="1"]').textContent, /Domingo/);
    host.querySelector('[data-look-name="2"]').click();
    const form = host.querySelector('[data-look-save-form="2"]');
    form.querySelector('input').value = '  Fiesta ';
    form.dispatchEvent(new w.Event('submit', {bubbles: true, cancelable: true})); await tick(); await tick();
    assert.deepEqual(calls.find(([name]) => name === 'save_chota_outfit')[1], {p_position: 2, p_name: 'Fiesta'});
    assert.match(host.querySelector('[data-look-wear="2"]').textContent, /Fiesta/);
    host.querySelector('[data-look-wear="1"]').click(); await tick(); await tick();
    assert.deepEqual(calls.find(([name]) => name === 'wear_chota_outfit')[1], {p_position: 1});
    host.querySelector('[data-look-delete="2"]').click(); await tick(); await tick();
    assert.equal(host.querySelector('[data-look-wear="2"]'), null);
    assert.ok(host.querySelector('[data-look-name="2"].is-empty'));
  } finally { w.close(); }
});
