/* Published designs, not a user's inventory. Pack awards stay server-owned. */
(() => {
  const catalog = Object.freeze([
    Object.freeze({
      id: 'jose-enrique-fernandez-cruz-normal', collection: 'los-nuestros-01',
      name: 'JOSE ENRIQUE FERNANDEZ CRUZ', edition: 'Común', score: 86,
      front: 'icons/cards/jose-enrique-fernandez-cruz-comun-86-v4.png',
      back: 'icons/cards/reverso-comun-unificado-v1.png',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'miguel-angel-jimenez-sanchez-normal', collection: 'los-nuestros-01',
      name: 'MIGUEL ANGEL JIMENEZ SANCHEZ', edition: 'Común', score: 83,
      front: 'icons/cards/miguel-angel-jimenez-sanchez-comun-83-v4.png',
      back: 'icons/cards/reverso-comun-unificado-v1.png',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'lizzy-machado-yong-comun', collection: 'los-nuestros-01',
      name: 'LIZZY MACHADO YONG', edition: 'Común', score: 81,
      front: 'icons/cards/lizzy-machado-yong-comun-81-v1.png',
      back: 'icons/cards/reverso-comun-unificado-v1.png',
      width: 948, height: 1659
    }),
    Object.freeze({
      id: 'raul-culsan-gonzalez-normal', collection: 'los-nuestros-01',
      name: 'RAUL CULSAN GONZALEZ', edition: 'Común', score: 83,
      front: 'icons/cards/raul-culsan-gonzalez-comun-83-v4.png',
      back: 'icons/cards/reverso-comun-unificado-v1.png',
      width: 948, height: 1659
    }),
    Object.freeze({
      id: 'mario-salvatierra-medina-comun', collection: 'los-nuestros-01',
      name: 'MARIO SALVATIERRA MEDINA', edition: 'Común', score: 81,
      front: 'icons/cards/mario-salvatierra-medina-comun-81-v1.png',
      back: 'icons/cards/reverso-comun-unificado-v1.png',
      width: 948, height: 1659
    }),
    Object.freeze({
      id: 'almudena-de-diego-matilla-comun', collection: 'los-nuestros-01',
      name: 'ALMUDENA DE DIEGO MATILLA', edition: 'Común', score: 84,
      front: 'icons/cards/almudena-de-diego-matilla-comun-84-v1.png',
      back: 'icons/cards/reverso-comun-unificado-v1.png',
      width: 949, height: 1658
    }),
    Object.freeze({
      id: 'caonabo-alberto-normal', collection: 'los-nuestros-01',
      name: 'CAONABO ALBERTO', edition: 'Común', score: 82,
      front: 'icons/cards/caonabo-alberto-comun-82-v4.png',
      back: 'icons/cards/reverso-comun-unificado-v1.png',
      width: 949, height: 1658
    }),
    Object.freeze({
      id: 'alberto-velasco-normal', collection: 'los-nuestros-01',
      name: 'ALBERTO VELASCO', edition: 'Común', score: 79,
      front: 'icons/cards/alberto-velasco-comun-79-v4.png',
      back: 'icons/cards/reverso-comun-unificado-v1.png',
      width: 948, height: 1659
    }),
    Object.freeze({
      id: 'carlos-gonzalez-motos-normal', collection: 'los-nuestros-01',
      name: 'CARLOS GONZALEZ MOTOS', edition: 'Común', score: 82,
      front: 'icons/cards/carlos-gonzalez-motos-comun-82-v4.png',
      back: 'icons/cards/reverso-comun-unificado-v1.png',
      width: 949, height: 1658
    }),
    Object.freeze({
      id: 'felipe-hp-normal', collection: 'los-nuestros-01',
      name: 'FELIPE HP', edition: 'Común', score: 80,
      front: 'icons/cards/felipe-hp-comun-80-v4.png',
      back: 'icons/cards/reverso-comun-unificado-v1.png',
      width: 948, height: 1659
    }),
    Object.freeze({
      id: 'daniel-gonzalez-motos-normal', collection: 'los-nuestros-01',
      name: 'DANIEL GONZALEZ MOTOS', edition: 'Común', score: 80,
      front: 'icons/cards/daniel-gonzalez-motos-comun-80-v4.png',
      back: 'icons/cards/reverso-comun-unificado-v1.png',
      width: 949, height: 1658
    }),
    Object.freeze({
      id: 'juan-manuel-perez-saldana-retro', collection: 'los-nuestros-01',
      name: 'JUAN MANUEL PEREZ SALDAÑA', edition: 'Retro', score: 90,
      front: 'icons/cards/juan-manuel-perez-saldana-retro-90-v1.png',
      back: 'icons/cards/reverso-retro-unificado-v1.png',
      width: 948, height: 1659
    }),
    Object.freeze({
      id: 'luca-de-tena-especial', collection: 'los-nuestros-01', folder: 'ubicaciones',
      kind: 'Ubicación', name: 'LUCA DE TENA', edition: 'Especial',
      front: 'icons/cards/luca-de-tena-especial-v1.png',
      back: 'icons/cards/reverso-especial-unificado-v1.png',
      width: 948, height: 1659
    }),
    Object.freeze({
      id: 'borox-legendaria', collection: 'los-nuestros-01', folder: 'ubicaciones',
      kind: 'Ubicación', name: 'BOROX', edition: 'Legendaria',
      front: 'icons/cards/borox-legendaria-v5.png',
      back: 'icons/cards/reverso-legendario-unificado-v1.png',
      width: 948, height: 1659
    }),
    Object.freeze({
      id: 'abelias-comun', collection: 'los-nuestros-01', folder: 'ubicaciones',
      kind: 'Ubicación', name: 'ABELIAS', edition: 'Común',
      front: 'icons/cards/abelias-comun-v1.png',
      back: 'icons/cards/reverso-comun-unificado-v1.png',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'castellana-legendaria', collection: 'los-nuestros-01', folder: 'ubicaciones',
      kind: 'Ubicación', name: 'CASTELLANA', edition: 'Legendaria',
      front: 'icons/cards/castellana-legendaria-v2.png',
      back: 'icons/cards/reverso-legendario-unificado-v1.png',
      width: 948, height: 1659
    }),
    Object.freeze({
      id: 'carabanchel-legendaria', collection: 'los-nuestros-01', folder: 'ubicaciones',
      kind: 'Ubicación', name: 'CARABANCHEL', edition: 'Legendaria',
      front: 'icons/cards/carabanchel-legendaria-v1.png',
      back: 'icons/cards/reverso-legendario-unificado-v1.png',
      width: 948, height: 1659
    }),
    Object.freeze({
      id: 'mesena-retro', collection: 'los-nuestros-01', folder: 'ubicaciones',
      kind: 'Ubicación', name: 'MESENA', edition: 'Retro',
      front: 'icons/cards/mesena-retro-v1.png',
      back: 'icons/cards/reverso-retro-unificado-v1.png',
      width: 948, height: 1660
    }),
    Object.freeze({
      id: 'contrato-de-trabajo-comun', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'CONTRATO DE TRABAJO', edition: 'Común',
      front: 'icons/cards/contrato-de-trabajo-comun-v1.png',
      back: 'icons/cards/reverso-comun-unificado-v1.png',
      width: 948, height: 1659
    }),
    Object.freeze({
      id: 'lata-de-red-bull-comun', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'LATA DE RED BULL', edition: 'Común',
      front: 'icons/cards/lata-de-red-bull-comun-v1.png',
      back: 'icons/cards/reverso-comun-unificado-v1.png',
      width: 948, height: 1659
    }),
    Object.freeze({
      id: 'cafe-del-santander-comun', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'CAFÉ DEL SANTANDER', edition: 'Común',
      front: 'icons/cards/cafe-del-santander-comun-v1.png',
      back: 'icons/cards/reverso-comun-unificado-v1.png',
      width: 948, height: 1659
    }),
    Object.freeze({
      id: 'la-biblia-epica', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'LA BIBLIA', edition: 'Épica',
      front: 'icons/cards/la-biblia-epica-v1.png',
      back: 'icons/cards/reverso-especial-unificado-v1.png',
      width: 948, height: 1659
    }),
    Object.freeze({
      id: 'locker-luca-de-tena-legendario', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'LOCKER DE LUCA DE TENA', edition: 'Legendaria',
      front: 'icons/cards/locker-luca-de-tena-legendario-v1.png',
      back: 'icons/cards/reverso-legendario-unificado-v1.png',
      width: 948, height: 1659
    }),
    Object.freeze({
      id: 'big-mac-legendario', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'BIG MAC', edition: 'Legendaria',
      front: 'icons/cards/big-mac-legendario-v1.png',
      back: 'icons/cards/reverso-legendario-unificado-v1.png',
      width: 948, height: 1659
    }),
    Object.freeze({
      id: 'cubo-de-alitas-kfc-legendario', collection: 'los-nuestros-01', folder: 'objetos',
      kind: 'Objeto', name: 'CUBO DE ALITAS DEL KFC', edition: 'Legendaria',
      front: 'icons/cards/cubo-de-alitas-kfc-legendario-v1.png',
      back: 'icons/cards/reverso-legendario-unificado-v1.png',
      width: 948, height: 1660
    })
  ]);
  const dialog = document.getElementById('collectionCardDialog');
  const grid = document.getElementById('collectionCardGrid');
  if (!dialog || !grid) return;
  const front = document.getElementById('collectionCardFront');
  const back = document.getElementById('collectionCardBack');
  const flip = document.getElementById('collectionCardFlip');
  const stage = document.getElementById('collectionCardStage');
  const status = document.getElementById('collectionCardStatus');
  const error = document.getElementById('collectionCardError');
  let trigger, active, reversed = false, detachMotion;

  const kindOf = card => card?.kind || 'Miembro';
  const editionLabel = card => card?.kind === 'Objeto'
    ? ({Legendaria: 'Legendario', 'Épica': 'Épico'}[card.edition] || card.edition || 'Especial')
    : card?.edition || 'Especial';
  const frontLabel = card => card?.score == null
    ? `${kindOf(card)} · ${editionLabel(card)}`
    : `${card?.edition || 'Común'} · ${card.score} puntos`;
  const accessibleDescription = card => card?.score == null
    ? `${card.name}, ${kindOf(card).toLowerCase()} ${editionLabel(card).toLowerCase()}`
    : `${card.name}, edición ${card.edition}, ${card.score} puntos`;
  const backDescription = card => card?.score == null
    ? `Reverso de ${kindOf(card).toLowerCase()} ${editionLabel(card).toLowerCase()}, de Los nuestros, con el monograma BB`
    : card.edition === 'Retro'
      ? 'Reverso de cobre y carmesí envejecidos de Los nuestros, edición Retro, con el monograma BB'
      : 'Reverso negro y bronce de Los nuestros, con el monograma BB';

  function setFace(value) {
    reversed = value;
    stage.classList.toggle('is-reversed', value);
    front.setAttribute('aria-hidden', String(value));
    back.setAttribute('aria-hidden', String(!value));
    flip.setAttribute('aria-pressed', String(value));
    flip.textContent = value ? 'Ver delantera' : 'Ver reverso';
    status.textContent = value
      ? (active?.score == null ? `Reverso · ${kindOf(active)} ${editionLabel(active).toLowerCase()}` : 'Reverso · Los nuestros')
      : frontLabel(active);
  }
  function open(card, button) {
    detachMotion?.();
    active = card; trigger = button;
    document.getElementById('collectionCardTitle').textContent = card.name;
    error.hidden = true;
    front.alt = accessibleDescription(card);
    back.alt = backDescription(card);
    front.src = card.front; back.src = card.back;
    setFace(false);
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('collection-card-open');
    document.getElementById('collectionCardClose').focus({preventScroll:true});
    document.dispatchEvent(new CustomEvent('bb:card-explored', {detail:{cardId:card.id}}));
    detachMotion=globalThis.CollectionMotion?.attachCard(document.getElementById('collectionCardTilt'),document.getElementById('collectionCardFoil'),()=>setFace(!reversed),card.edition);
  }
  function close() {if (dialog.open) dialog.close();globalThis.CollectionMotion?.close();}
  dialog.addEventListener('close', () => {
    detachMotion?.();detachMotion=null;
    document.body.classList.remove('collection-card-open');
    if (trigger?.isConnected) trigger.focus({preventScroll:true});
    trigger = null;
  });
  document.getElementById('collectionCardClose').addEventListener('click', close);
  dialog.addEventListener('click', event => {if (event.target === dialog) close();});
  flip.addEventListener('click', () => setFace(!reversed));
  for (const img of [front, back]) img.addEventListener('error', () => {error.hidden = false;});
  document.getElementById('collectionCardRetry').addEventListener('click', () => {
    if (!active) return;
    error.hidden = true;
    for (const [img, url] of [[front, active.front], [back, active.back]]) {
      img.removeAttribute('src'); img.src = url;
    }
  });
  window.addEventListener('hashchange', close);
  for (const card of catalog) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'collection-card-tile';
    button.setAttribute('aria-label', `Ver carta de ${accessibleDescription(card)}`);
    button.setAttribute('aria-haspopup', 'dialog');
    const img = document.createElement('img');
    img.src = card.front; img.alt = ''; img.width = card.width; img.height = card.height;
    img.loading = 'lazy'; img.decoding = 'async';
    const meta = document.createElement('span'); meta.className = 'collection-card-meta';
    meta.textContent = card.score == null ? `${kindOf(card)} · ${editionLabel(card)}` : `${card.edition} · ${card.score} PTS`;
    const name = document.createElement('strong'); name.textContent = card.name;
    const hint = document.createElement('span'); hint.className = 'collection-card-hint'; hint.textContent = 'Ver las dos caras';
    button.append(img, meta, name, hint);
    button.addEventListener('click', () => open(card, button));
    grid.append(button);
  }
  globalThis.CardCollection = Object.freeze({catalog, close});
})();
