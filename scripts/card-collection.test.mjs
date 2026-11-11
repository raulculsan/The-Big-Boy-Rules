import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const read = file => readFileSync(new URL('../'+file, import.meta.url), 'utf8');
function setup() {
  const dom = new JSDOM(read('index.html'), {url:'https://club.test/#sobres',runScripts:'outside-only'});
  const {window:w} = dom, d = w.document;
  w.HTMLDialogElement.prototype.showModal = function() {this.setAttribute('open','');};
  w.HTMLDialogElement.prototype.close = function() {this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
  // The catalogue renders lazily, only once its page is shown.
  d.getElementById('catalogo').classList.add('active');
  w.eval(read('card-collection.js'));
  return {dom,w,d:w.document};
}
// Width and height from a PNG or JPEG header.
function imageSize(data) {
  if (data.readUInt32BE(0) === 0x89504e47) return [data.readUInt32BE(16), data.readUInt32BE(20)];
  for (let offset = 2; offset < data.length;) {
    const marker = data[offset + 1], length = data.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return [data.readUInt16BE(offset + 7), data.readUInt16BE(offset + 5)];
    offset += 2 + length;
  }
  return null;
}
// Tiles are grouped by edition, so locate a card's tile by its artwork.
const tileFor = (d, card) => [...d.querySelectorAll('.collection-card-tile')].find(tile => tile.querySelector('img').dataset.cardOriginal === card.front);
const byId = (w, id) => w.CardCollection.catalog.find(card => card.id === id);

test('only opening a full catalog card emits exploration; flips do not', () => {
  const {dom,w,d}=setup();const events=[];
  d.addEventListener('bb:card-explored',e=>events.push(e.detail.cardId));
  const card=byId(w,'jose-enrique-fernandez-cruz-normal');
  tileFor(d,card).click();
  assert.deepEqual(events,[card.id]);
  d.getElementById('collectionCardFlip').click();d.getElementById('collectionCardFlip').click();
  assert.equal(events.length,1);
  dom.window.close();
});

test('the catalogue shows every card once, lazily, at original size and without granting ownership', () => {
  const {dom,w,d} = setup();
  const catalog = w.CardCollection.catalog;
  assert.ok(catalog.length >= 79);
  assert.equal(new Set(catalog.map(card=>card.id)).size, catalog.length, 'unique ids');
  assert.equal(d.querySelectorAll('.collection-card-tile').length, catalog.length);
  for (const card of catalog) {
    assert.ok(Object.isFrozen(card), card.id);
    assert.ok(Math.abs(card.width/card.height-0.6)<0.035, `${card.id} keeps the portrait card format`);
    assert.ok(tileFor(d,card), `${card.id} has a tile`);
  }
  assert.equal(d.querySelector('.collection-card-tile img').loading,'lazy');
  assert.equal(d.getElementById('collectionCardBack').getAttribute('src'),null);
  assert.doesNotMatch(read('card-collection.js'),/localStorage|\.rpc\(|fetch\(/);
  dom.window.close();
});

test('opens full card, flips repeatedly, closes restoring focus and resets to front on next opening', () => {
  const {dom,w,d} = setup(); const card=byId(w,'jose-enrique-fernandez-cruz-normal'); const trigger = tileFor(d,card);trigger.focus();trigger.click();
  const dialog = d.getElementById('collectionCardDialog'), flip=d.getElementById('collectionCardFlip');
  assert.equal(dialog.open,true);assert.ok(d.body.classList.contains('collection-card-open'));
  assert.ok(d.getElementById('collectionCardFront').src.endsWith(card.front));
  assert.ok(d.getElementById('collectionCardBack').src.endsWith(card.back));
  flip.click();assert.equal(flip.getAttribute('aria-pressed'),'true');assert.equal(d.getElementById('collectionCardFront').getAttribute('aria-hidden'),'true');
  for(let i=0;i<10;i++)flip.click();assert.equal(flip.textContent,'Ver delantera');
  d.getElementById('collectionCardClose').click();assert.equal(dialog.open,false);assert.equal(d.activeElement,trigger);
  assert.ok(!d.body.classList.contains('collection-card-open'));
  trigger.click();assert.equal(flip.getAttribute('aria-pressed'),'false');dom.window.close();
});

test('failed images offer retry; navigation and explicit session close release the dialog', () => {
  const {dom,w,d} = setup();const trigger=tileFor(d,w.CardCollection.catalog[0]);trigger.click();
  d.getElementById('collectionCardBack').dispatchEvent(new w.Event('error'));
  assert.equal(d.getElementById('collectionCardError').hidden,false);
  d.getElementById('collectionCardRetry').click();assert.equal(d.getElementById('collectionCardError').hidden,true);
  w.dispatchEvent(new w.Event('hashchange'));assert.equal(d.getElementById('collectionCardDialog').open,false);
  trigger.click();w.CardCollection.close();assert.ok(!d.body.classList.contains('collection-card-open'));
  assert.match(read('app.js'),/function showLogin\(\) \{\s*globalThis.CardCollection\?\.close\(\)/);
  dom.window.close();
});

test('every card opens with its own name, edition, score (or none) and both faces', () => {
  const {dom,w,d}=setup();
  for (const card of w.CardCollection.catalog) {
    const tile=tileFor(d,card);
    const located = card.score == null;
    if (located) assert.doesNotMatch(tile.textContent+tile.getAttribute('aria-label'),/PTS|puntos|undefined/i,card.id);
    else assert.match(tile.querySelector('.collection-card-meta').textContent,new RegExp(`${card.edition} · ${card.score} PTS$`),card.id);
    tile.click();
    assert.equal(d.getElementById('collectionCardTitle').textContent,card.name,card.id);
    const status=d.getElementById('collectionCardStatus').textContent;
    if (located) assert.doesNotMatch(status,/puntos|\d/,card.id);
    else assert.match(status,new RegExp(` · ${card.edition} · ${card.score} puntos$`),card.id);
    assert.ok(d.getElementById('collectionCardFront').src.endsWith(card.front),card.id);
    assert.ok(d.getElementById('collectionCardBack').src.endsWith(card.back),card.id);
    d.getElementById('collectionCardFlip').click();
    assert.match(d.getElementById('collectionCardStatus').textContent,/^Reverso · /,card.id);
    w.CardCollection.close();
  }
  dom.window.close();
});

test('locations such as Luca de Tena and Borox never expose a score', () => {
  const {dom,w}=setup();
  for (const id of ['luca-de-tena-especial','borox-legendaria']) {
    const card=byId(w,id);
    assert.ok(card,id);assert.equal(card.score,undefined,id);
  }
  assert.equal(byId(w,'luca-de-tena-especial').edition,'Especial');
  assert.equal(byId(w,'borox-legendaria').edition,'Legendaria');
  dom.window.close();
});

test('every bundled face exists on disk and the catalogue ships in web, offline and native builds', () => {
  const {dom,w}=setup();
  const cards=[...w.CardCollection.bundledCatalog];
  dom.window.close();
  for(const card of cards) {
    for(const path of [card.front,card.back]) assert.ok(readFileSync(new URL('../'+path, import.meta.url)).length>0, path);
    // Declared size matches the real artwork (±2 px), so tiles never stretch.
    const [width, height] = imageSize(readFileSync(new URL('../'+card.front, import.meta.url)));
    assert.ok(Math.abs(width-card.width)<=2 && Math.abs(height-card.height)<=2, `${card.id}: ${width}×${height} vs ${card.width}×${card.height}`);
  }
  for(const file of ['index.html','service-worker.js','scripts/build-web.mjs','scripts/live-server.mjs','scripts/preview-club.mjs']) assert.ok(read(file).includes('card-collection.js'),file);
  assert.ok(read('ios/App/App/public/card-collection.js').length>0);
  assert.match(read('packs.css'),/prefers-reduced-motion:reduce/);
});
