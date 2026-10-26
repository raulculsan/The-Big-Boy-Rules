import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
function setup(reduced = false) {
  const dom = new JSDOM(read('index.html'), {url:'https://club.test/#sobres',runScripts:'outside-only',pretendToBeVisual:true});
  const w = dom.window, animations = [];
  w.matchMedia = () => ({matches:reduced,addEventListener(){},removeEventListener(){}});
  w.HTMLImageElement.prototype.decode = () => new Promise(() => {});
  w.Element.prototype.animate = function(frames) {
    let finish;
    const result = {frames,finished:new Promise(resolve => {finish = resolve;}),cancel(){finish();}};
    animations.push(result); return result;
  };
  w.CardCollection = {catalog:Array.from({length:6}, (_, index) => ({id:`card-${index}`,name:`Carta ${index}`,front:`card-${index}.webp`,folder:'miembros',edition:'Común'})),thumbnail:card => card.front};
  w.eval(read('album.js'));
  w.CardAlbum.update({cards:w.CardCollection.catalog.map(card => ({card_id:card.id,quantity:1}))});
  w.CardAlbum.open(w.document.querySelector('[data-card-album]'));
  return {dom,w,animations,album:w.document.getElementById('album')};
}
test('album turns start on the input frame even while destination images are decoding', async () => {
  const h = setup();
  h.album.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  assert.equal(h.animations.length,4,'both leaves and their shading begin without a decode timeout');
  assert.equal(h.album.querySelector('.card-album-page-viewport').classList.contains('is-turning'),true);
  h.w.CardAlbum.close(); await Promise.resolve();
  assert.equal(h.album.querySelector('.card-album-turn-layer'),null,'leaving the route cancels its page copies');
  h.dom.window.close();
});
test('reduced motion changes the album page immediately without creating moving copies', () => {
  const h = setup(true);
  h.album.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  assert.equal(h.animations.length,0);
  assert.match(h.w.document.getElementById('cardAlbumPageCount').textContent,/^2 \/ /);
  assert.equal(h.album.querySelector('.card-album-turn-layer'),null);
  h.dom.window.close();
});
