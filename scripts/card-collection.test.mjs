import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const read = file => readFileSync(new URL('../'+file, import.meta.url), 'utf8');
function setup() {
  const dom = new JSDOM(read('index.html'), {url:'https://club.test/#sobres',runScripts:'outside-only'});
  const {window:w} = dom;
  w.HTMLDialogElement.prototype.showModal = function() {this.setAttribute('open','');};
  w.HTMLDialogElement.prototype.close = function() {this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
  w.eval(read('card-collection.js'));
  return {dom,w,d:w.document};
}
test('only opening a full catalog card emits exploration; flips and pack previews do not',()=>{
  const {dom,w,d}=setup();const events=[];
  d.addEventListener('bb:card-explored',e=>events.push(e.detail.cardId));
  assert.equal(events.length,0);
  d.querySelector('.collection-card-tile').click();
  assert.deepEqual(events,[w.CardCollection.catalog[0].id]);
  d.getElementById('collectionCardFlip').click();
  d.getElementById('packPreviewButton').click();
  assert.equal(events.length,1);
  const sql=read('supabase-collection-achievements.sql');
  for(const card of w.CardCollection.catalog) {
    const edition=card.edition==='Especial'?'special':card.edition==='Legendaria'?'legendary':'common';
    assert.ok(sql.includes(`('${card.id}','${edition}','${card.kind==='Ubicación'?'location':'member'}')`));
  }
  dom.window.close();
});
test('catalog contains the approved member, edition, score and both original-sized faces, without granting ownership', () => {
  const {dom,w,d} = setup();
  assert.equal(w.CardCollection.catalog.length,13);
  const card = w.CardCollection.catalog[0];
  assert.equal(card.name,'JOSE ENRIQUE FERNANDEZ CRUZ');assert.equal(card.score,86);assert.equal(card.edition,'Común');
  assert.equal(card.width,948);assert.equal(card.height,1660);assert.ok(Object.isFrozen(card));
  assert.match(d.querySelector('.collection-catalog').textContent,/no tus cartas conseguidas/);
  assert.equal(d.querySelectorAll('.collection-card-tile').length,13);
  assert.equal(d.querySelector('.collection-card-tile img').loading,'lazy');
  assert.equal(d.getElementById('collectionCardBack').getAttribute('src'),null);
  assert.equal(d.getElementById('packsCount').textContent,'—');
  assert.doesNotMatch(read('card-collection.js'),/localStorage|\.rpc\(|fetch\(/);
  dom.window.close();
});
test('opens full card, flips repeatedly, closes restoring focus and resets to front on next opening', () => {
  const {dom,d} = setup(); const trigger = d.querySelector('.collection-card-tile');trigger.focus();trigger.click();
  const dialog = d.getElementById('collectionCardDialog'), flip=d.getElementById('collectionCardFlip');
  assert.equal(dialog.open,true);assert.ok(d.body.classList.contains('collection-card-open'));
  assert.match(d.getElementById('collectionCardFront').src,/comun-86-v4.png$/);
  assert.match(d.getElementById('collectionCardBack').src,/reverso-v1.png$/);
  flip.click();assert.equal(flip.getAttribute('aria-pressed'),'true');assert.equal(d.getElementById('collectionCardFront').getAttribute('aria-hidden'),'true');
  for(let i=0;i<10;i++)flip.click();assert.equal(flip.textContent,'Ver delantera');
  d.getElementById('collectionCardClose').click();assert.equal(dialog.open,false);assert.equal(d.activeElement,trigger);
  assert.ok(!d.body.classList.contains('collection-card-open'));
  trigger.click();assert.equal(flip.getAttribute('aria-pressed'),'false');dom.window.close();
});
test('failed images offer retry; navigation and explicit session close release the dialog', () => {
  const {dom,w,d} = setup();const trigger=d.querySelector('.collection-card-tile');trigger.click();
  d.getElementById('collectionCardBack').dispatchEvent(new w.Event('error'));
  assert.equal(d.getElementById('collectionCardError').hidden,false);
  d.getElementById('collectionCardRetry').click();assert.equal(d.getElementById('collectionCardError').hidden,true);
  w.dispatchEvent(new w.Event('hashchange'));assert.equal(d.getElementById('collectionCardDialog').open,false);
  trigger.click();w.CardCollection.close();assert.ok(!d.body.classList.contains('collection-card-open'));
  assert.match(read('app.js'),/function showLogin\(\) \{\s*globalThis.CardCollection\?\.close\(\)/);
  dom.window.close();
});
test('switching members shows Miguel’s own name, 83 points and both approved faces, then restores Jose’s card', () => {
  const {dom,w,d} = setup();const tiles=d.querySelectorAll('.collection-card-tile');
  const card=w.CardCollection.catalog[1];
  assert.equal(card.name,'MIGUEL ANGEL JIMENEZ SANCHEZ');assert.equal(card.score,83);assert.equal(card.edition,'Común');
  tiles[1].click();
  assert.equal(d.getElementById('collectionCardTitle').textContent,card.name);
  assert.equal(d.getElementById('collectionCardStatus').textContent,'Común · 83 puntos');
  assert.ok(d.getElementById('collectionCardFront').src.endsWith(card.front));
  assert.ok(d.getElementById('collectionCardBack').src.endsWith(card.back));
  d.getElementById('collectionCardFlip').click();assert.equal(d.getElementById('collectionCardFlip').getAttribute('aria-pressed'),'true');
  w.CardCollection.close();tiles[0].click();
  assert.equal(d.getElementById('collectionCardStatus').textContent,'Común · 86 puntos');
  assert.equal(d.getElementById('collectionCardFlip').getAttribute('aria-pressed'),'false');
  dom.window.close();
});
test('Lizzy opens with common edition, 81 points and her own front and back', () => {
  const {dom,w,d}=setup();const card=w.CardCollection.catalog[2];
  assert.equal(card.name,'LIZZY MACHADO YONG');assert.equal(card.edition,'Común');assert.equal(card.score,81);
  d.querySelectorAll('.collection-card-tile')[2].click();
  assert.equal(d.getElementById('collectionCardTitle').textContent,card.name);
  assert.equal(d.getElementById('collectionCardStatus').textContent,'Común · 81 puntos');
  assert.ok(d.getElementById('collectionCardFront').src.endsWith(card.front));
  assert.ok(d.getElementById('collectionCardBack').src.endsWith(card.back));
  d.getElementById('collectionCardFlip').click();assert.equal(d.getElementById('collectionCardFlip').getAttribute('aria-pressed'),'true');
  dom.window.close();
});
test('Raul uses the approved second photo version and shows 83 points with its matching reverse', () => {
  const {dom,w,d}=setup();const card=w.CardCollection.catalog[3];
  assert.equal(card.name,'RAUL CULSAN GONZALEZ');assert.equal(card.edition,'Común');assert.equal(card.score,83);
  assert.match(card.front,/comun-83-v4.png$/);assert.match(card.back,/normal-83-reverso-v2.png$/);
  d.querySelectorAll('.collection-card-tile')[3].click();
  assert.equal(d.getElementById('collectionCardTitle').textContent,card.name);
  assert.equal(d.getElementById('collectionCardStatus').textContent,'Común · 83 puntos');
  assert.ok(d.getElementById('collectionCardFront').src.endsWith(card.front));
  assert.ok(d.getElementById('collectionCardBack').src.endsWith(card.back));
  d.getElementById('collectionCardFlip').click();assert.equal(d.getElementById('collectionCardFlip').getAttribute('aria-pressed'),'true');
  dom.window.close();
});
test('Mario and Almudena show their own names, common editions, scores and both faces', () => {
  const {dom,w,d}=setup();
  for (const [id,name,score] of [
    ['mario-salvatierra-medina-comun','MARIO SALVATIERRA MEDINA',81],
    ['almudena-de-diego-matilla-comun','ALMUDENA DE DIEGO MATILLA',84]
  ]) {
    const index=w.CardCollection.catalog.findIndex(card=>card.id===id);
    assert.ok(index>=0);
    const card=w.CardCollection.catalog[index];
    assert.equal(card.name,name);assert.equal(card.edition,'Común');assert.equal(card.score,score);
    d.querySelectorAll('.collection-card-tile')[index].click();
    assert.equal(d.getElementById('collectionCardTitle').textContent,name);
    assert.equal(d.getElementById('collectionCardStatus').textContent,`Común · ${score} puntos`);
    assert.ok(d.getElementById('collectionCardFront').src.endsWith(card.front));
    assert.ok(d.getElementById('collectionCardBack').src.endsWith(card.back));
    assert.equal(d.getElementById('collectionCardFlip').getAttribute('aria-pressed'),'false');
    d.getElementById('collectionCardFlip').click();
    assert.equal(d.getElementById('collectionCardFlip').getAttribute('aria-pressed'),'true');
    w.CardCollection.close();
  }
  dom.window.close();
});
test('Caonabo opens with Común edition, 82 points and the correct artwork on both sides', () => {
  const {dom,w,d}=setup();
  const index=w.CardCollection.catalog.findIndex(card=>card.id==='caonabo-alberto-normal');
  assert.ok(index>=0);
  const card=w.CardCollection.catalog[index];
  assert.equal(card.name,'CAONABO ALBERTO');assert.equal(card.edition,'Común');assert.equal(card.score,82);
  d.querySelectorAll('.collection-card-tile')[index].click();
  assert.equal(d.getElementById('collectionCardTitle').textContent,card.name);
  assert.equal(d.getElementById('collectionCardStatus').textContent,'Común · 82 puntos');
  assert.ok(d.getElementById('collectionCardFront').src.endsWith(card.front));
  assert.ok(d.getElementById('collectionCardBack').src.endsWith(card.back));
  d.getElementById('collectionCardFlip').click();
  assert.equal(d.getElementById('collectionCardFlip').getAttribute('aria-pressed'),'true');
  w.CardCollection.close();
  dom.window.close();
});
test('Alberto opens with Común edition, 79 points and the approved rural portrait and reverse', () => {
  const {dom,w,d}=setup();
  const index=w.CardCollection.catalog.findIndex(card=>card.id==='alberto-velasco-normal');
  assert.ok(index>=0);
  const card=w.CardCollection.catalog[index];
  assert.equal(card.name,'ALBERTO VELASCO');assert.equal(card.edition,'Común');assert.equal(card.score,79);
  assert.equal(card.front,'icons/cards/alberto-velasco-comun-79-v4.png');
  assert.equal(card.back,'icons/cards/alberto-velasco-normal-79-reverso-v1.png');
  d.querySelectorAll('.collection-card-tile')[index].click();
  assert.equal(d.getElementById('collectionCardTitle').textContent,card.name);
  assert.equal(d.getElementById('collectionCardStatus').textContent,'Común · 79 puntos');
  assert.ok(d.getElementById('collectionCardFront').src.endsWith(card.front));
  assert.ok(d.getElementById('collectionCardBack').src.endsWith(card.back));
  d.getElementById('collectionCardFlip').click();
  assert.equal(d.getElementById('collectionCardFlip').getAttribute('aria-pressed'),'true');
  w.CardCollection.close();
  dom.window.close();
});
test('Carlos uses only approved v3, with Común edition, 82 points and matching reverse', () => {
  const {dom,w,d}=setup();
  const index=w.CardCollection.catalog.findIndex(card=>card.id==='carlos-gonzalez-motos-normal');
  assert.ok(index>=0);
  const card=w.CardCollection.catalog[index];
  assert.equal(card.name,'CARLOS GONZALEZ MOTOS');assert.equal(card.edition,'Común');assert.equal(card.score,82);
  assert.equal(card.front,'icons/cards/carlos-gonzalez-motos-comun-82-v4.png');
  assert.equal(card.back,'icons/cards/carlos-gonzalez-motos-normal-82-reverso-v3.png');
  d.querySelectorAll('.collection-card-tile')[index].click();
  assert.equal(d.getElementById('collectionCardTitle').textContent,card.name);
  assert.equal(d.getElementById('collectionCardStatus').textContent,'Común · 82 puntos');
  assert.ok(d.getElementById('collectionCardFront').src.endsWith(card.front));
  assert.ok(d.getElementById('collectionCardBack').src.endsWith(card.back));
  d.getElementById('collectionCardFlip').click();
  assert.equal(d.getElementById('collectionCardFlip').getAttribute('aria-pressed'),'true');
  w.CardCollection.close();
  dom.window.close();
});
test('Felipe HP opens with 80 points, Común edition and the approved front and reverse', () => {
  const {dom,w,d}=setup();
  const index=w.CardCollection.catalog.findIndex(card=>card.id==='felipe-hp-normal');
  assert.ok(index>=0);
  const card=w.CardCollection.catalog[index];
  assert.equal(card.name,'FELIPE HP');assert.equal(card.edition,'Común');assert.equal(card.score,80);
  assert.equal(card.front,'icons/cards/felipe-hp-comun-80-v4.png');
  assert.equal(card.back,'icons/cards/felipe-hp-normal-80-reverso-v1.png');
  d.querySelectorAll('.collection-card-tile')[index].click();
  assert.equal(d.getElementById('collectionCardTitle').textContent,card.name);
  assert.equal(d.getElementById('collectionCardStatus').textContent,'Común · 80 puntos');
  assert.ok(d.getElementById('collectionCardFront').src.endsWith(card.front));
  assert.ok(d.getElementById('collectionCardBack').src.endsWith(card.back));
  d.getElementById('collectionCardFlip').click();
  assert.equal(d.getElementById('collectionCardFlip').getAttribute('aria-pressed'),'true');
  w.CardCollection.close();dom.window.close();
});
test('Daniel opens with 80 points, Común edition and both approved faces', () => {
  const {dom,w,d}=setup();
  const index=w.CardCollection.catalog.findIndex(card=>card.id==='daniel-gonzalez-motos-normal');
  assert.ok(index>=0);
  const card=w.CardCollection.catalog[index];
  assert.equal(card.name,'DANIEL GONZALEZ MOTOS');assert.equal(card.edition,'Común');assert.equal(card.score,80);
  assert.equal(card.front,'icons/cards/daniel-gonzalez-motos-comun-80-v4.png');
  assert.equal(card.back,'icons/cards/daniel-gonzalez-motos-normal-80-reverso-v1.png');
  assert.equal(card.width,949);assert.equal(card.height,1658);
  d.querySelectorAll('.collection-card-tile')[index].click();
  assert.equal(d.getElementById('collectionCardTitle').textContent,card.name);
  assert.equal(d.getElementById('collectionCardStatus').textContent,'Común · 80 puntos');
  assert.ok(d.getElementById('collectionCardFront').src.endsWith(card.front));
  assert.ok(d.getElementById('collectionCardBack').src.endsWith(card.back));
  d.getElementById('collectionCardFlip').click();
  assert.equal(d.getElementById('collectionCardFlip').getAttribute('aria-pressed'),'true');
  w.CardCollection.close();dom.window.close();
});
test('Luca de Tena is a special location and never exposes a score or PTS', () => {
  const {dom,w,d}=setup();
  const index=w.CardCollection.catalog.findIndex(card=>card.id==='luca-de-tena-especial');
  assert.ok(index>=0);
  const card=w.CardCollection.catalog[index];
  assert.equal(card.kind,'Ubicación');assert.equal(card.edition,'Especial');assert.equal(card.score,undefined);
  assert.equal(card.front,'icons/cards/luca-de-tena-especial-v1.png');
  assert.equal(card.back,'icons/cards/luca-de-tena-especial-reverso-v1.png');
  assert.equal(card.width,948);assert.equal(card.height,1659);
  const tile=d.querySelectorAll('.collection-card-tile')[index];
  assert.equal(tile.querySelector('.collection-card-meta').textContent,'Ubicación · Especial');
  assert.doesNotMatch(tile.textContent,/PTS|puntos|\b\d+\b/i);
  assert.doesNotMatch(tile.getAttribute('aria-label'),/PTS|puntos|\b\d+\b/i);
  tile.click();
  assert.equal(d.getElementById('collectionCardTitle').textContent,'LUCA DE TENA');
  assert.equal(d.getElementById('collectionCardStatus').textContent,'Ubicación · Especial');
  assert.doesNotMatch(d.getElementById('collectionCardFront').alt,/PTS|puntos|\b\d+\b/i);
  assert.ok(d.getElementById('collectionCardFront').src.endsWith(card.front));
  assert.ok(d.getElementById('collectionCardBack').src.endsWith(card.back));
  d.getElementById('collectionCardFlip').click();
  assert.equal(d.getElementById('collectionCardStatus').textContent,'Reverso · Ubicación especial');
  assert.doesNotMatch(d.getElementById('collectionCardBack').alt,/PTS|puntos|\b\d+\b/i);
  w.CardCollection.close();dom.window.close();
});
test('Borox opens as a scoreless legendary location, including the reverse label', () => {
  const {dom,w,d}=setup();
  const index=w.CardCollection.catalog.findIndex(card=>card.id==='borox-legendaria');
  assert.ok(index>=0);
  const card=w.CardCollection.catalog[index];
  assert.equal(card.edition,'Legendaria');assert.equal(card.score,undefined);
  const tile=d.querySelectorAll('.collection-card-tile')[index];tile.click();
  assert.equal(d.getElementById('collectionCardTitle').textContent,'BOROX');
  assert.equal(d.getElementById('collectionCardStatus').textContent,'Ubicación · Legendaria');
  assert.ok(d.getElementById('collectionCardFront').src.endsWith(card.front));
  assert.ok(d.getElementById('collectionCardBack').src.endsWith(card.back));
  assert.doesNotMatch(tile.textContent,/PTS|puntos|undefined/i);
  d.getElementById('collectionCardFlip').click();
  assert.equal(d.getElementById('collectionCardStatus').textContent,'Reverso · Ubicación legendaria');
  assert.match(d.getElementById('collectionCardBack').alt,/Legendaria/);
  dom.window.close();
});
test('both faces are identical copies of approved artwork and are included in web, offline and stable native bundles', () => {
  const {dom,w}=setup();
  const cards=[...w.CardCollection.catalog];
  dom.window.close();
  const buffer = path => readFileSync(new URL('../'+path, import.meta.url));
  for(const card of cards) {
    for(const path of [card.front,card.back]) {
      const file=path.split('/').pop();
      assert.deepEqual(buffer(`docs/cartas/${card.folder || 'miembros'}/${file}`),buffer('icons/cards/'+file));
      assert.deepEqual(buffer('icons/cards/'+file),buffer('ios/App/App/public/icons/cards/'+file));
      assert.match(read('service-worker.js'),new RegExp(file));
    }
  }
  for(const file of ['index.html','service-worker.js','scripts/build-web.mjs','scripts/live-server.mjs','scripts/preview-club.mjs']) assert.ok(read(file).includes('card-collection.js'),file);
  assert.equal(read('card-collection.js'),read('ios/App/App/public/card-collection.js'));
  assert.match(read('packs.css'),/prefers-reduced-motion:reduce/);
  assert.match(read('packs.css'),/object-fit:contain/);
});
