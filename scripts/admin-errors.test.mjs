import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const source = fs.readFileSync(new URL('../admin-errors.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function setup(result) {
  const dom = new JSDOM('<section id="adminErrors"></section>', {runScripts: 'outside-only'});
  dom.window.eval(source);
  const calls = [];
  const client = {rpc: async (name, args) => { calls.push([name, args]); return typeof result === 'function' ? result() : result; }};
  return {w: dom.window, d: dom.window.document, client, calls};
}
test('admin errors: lists grouped errors safely, with member, device and place', async () => {
  const t = setup({data: [{member: 'Daniel <b>', occurrences: 3, name: 'TypeError', message: 'x is <script>', frames: ['banner-shop.js:615:12'], platform: 'android', area: 'sobres', native: {version: '1.1.110', build: 112}, last_seen: new Date().toISOString(), first_seen: new Date(Date.now() - 7200000).toISOString()}], error: null});
  await t.w.AdminErrors.show(t.client);
  const html = t.d.getElementById('adminErrors').innerHTML;
  assert.equal(t.calls.length, 1); assert.equal(t.calls[0][0], 'admin_client_errors'); assert.equal(t.calls[0][1].p_limit, 60);
  assert.match(html, /×3/);
  assert.match(html, /Daniel &lt;b&gt;/);
  assert.match(html, /x is &lt;script&gt;/);
  assert.match(html, /Android · sobres · <code>banner-shop\.js:615:12<\/code> · 1\.1\.110 \(112\)/);
  assert.doesNotMatch(html, /<script>/);
});
test('admin errors: empty list, failure with retry, refresh button reloads', async () => {
  let reply = {data: [], error: null};
  const t = setup(() => reply);
  await t.w.AdminErrors.show(t.client);
  assert.match(t.d.getElementById('adminErrors').textContent, /Ningún error/);
  reply = {data: null, error: {message: 'Solo la administración puede ver los errores.'}};
  t.d.querySelector('[data-admin-errors-refresh]').click(); await tick();
  assert.match(t.d.getElementById('adminErrors').textContent, /No se pudieron cargar los errores\. Solo la administración/);
  assert.ok(t.d.querySelector('[data-admin-errors-refresh]'));
  assert.equal(t.calls.length, 2);
});
