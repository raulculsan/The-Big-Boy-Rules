import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const source = fs.readFileSync(new URL('../error-reports.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 10));

function setup({session = true} = {}) {
  const dom = new JSDOM('<!doctype html><script src="app.js?v=20261111-test"></script><section class="page-section active" id="sobres"></section>', {runScripts: 'outside-only', url: 'https://example.test/'});
  const {window} = dom;
  window.eval(source);
  const calls = [];
  let current = session ? {user: {id: 'u'}} : null, listener = null;
  const client = {
    rpc: async (name, args) => { calls.push({name, ...args}); return {data: null, error: null}; },
    auth: {getSession: async () => ({data: {session: current}}), onAuthStateChange: callback => { listener = callback; }},
  };
  const fire = (error, extra = {}) => window.dispatchEvent(new window.ErrorEvent('error', {error, message: error?.message, ...extra}));
  const reject = reason => { const event = new window.Event('unhandledrejection'); event.reason = reason; window.dispatchEvent(event); };
  return {window, client, calls, fire, reject, login() { current = {user: {id: 'u'}}; listener?.('SIGNED_IN', current); }};
}

const ownError = (window, message, type = 'TypeError') => {
  const error = new window[type](message);
  error.stack = `${type}: ${message}\n    at open (https://example.test/banner-shop.js?v=1:615:12)\n    at https://example.test/app.js?v=2:80:3`;
  return error;
};

test('error reports: scrubbed, own frames, screen and version, sent once per session', async () => {
  const t = setup();
  t.window.ClubErrorReports.start({client: t.client});
  const error = ownError(t.window, 'Cannot read reveal of null for raul@example.com at https://x.supabase.co/rest/v1?apikey=eyJabc.def.ghi id 3f2b1c4d-1111-2222-3333-444455556666');
  t.fire(error); t.fire(error);
  await tick();
  assert.equal(t.calls.length, 1);
  const payload = t.calls[0].payload;
  assert.equal(t.calls[0].name, 'record_client_error');
  assert.equal(payload.kind, 'script');
  assert.equal(payload.name, 'TypeError');
  assert.doesNotMatch(payload.message, /raul@|supabase\.co|eyJ|3f2b1c4d/);
  assert.match(payload.message, /<email>.*<url>.*<id>/);
  assert.deepEqual([...payload.frames], ['banner-shop.js:615:12', 'app.js:80:3']);
  assert.equal(payload.area, 'sobres');
  assert.equal(payload.build, '20261111-test');
  assert.equal(payload.platform, 'web');
});

test('error reports: network drops, aborts and foreign scripts are ignored', async () => {
  const t = setup();
  t.window.ClubErrorReports.start({client: t.client});
  t.reject(new t.window.TypeError('Failed to fetch'));
  t.reject(Object.assign(new t.window.Error('stop'), {name: 'AbortError'}));
  t.fire(new t.window.Error('boom'), {filename: 'chrome-extension://abc/content.js', lineno: 1});
  t.fire(null, {message: 'Script error.'});
  t.reject(ownError(t.window, 'x is not a function'));
  await tick();
  assert.equal(t.calls.length, 1);
  assert.equal(t.calls[0].payload.kind, 'promise');
});

test('error reports: waits for a session, then sends what was queued', async () => {
  const t = setup({session: false});
  t.window.ClubErrorReports.start({client: t.client});
  t.fire(ownError(t.window, 'early failure'));
  await tick();
  assert.equal(t.calls.length, 0);
  t.login();
  await tick();
  assert.equal(t.calls.length, 1);
});

test('error reports: at most 15 distinct reports per session', async () => {
  const t = setup();
  t.window.ClubErrorReports.start({client: t.client});
  for (let i = 0; i < 25; i++) t.fire(ownError(t.window, `failure kind ${String.fromCharCode(97 + i)}`));
  await tick(); await tick();
  assert.equal(t.calls.length, 15);
});
