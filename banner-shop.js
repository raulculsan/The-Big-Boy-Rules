/* Wallet, inventory and purchases are authoritative server RPC results. */
(() => {
  let options, state = null, busy = false, loading = false, failure = '', notice = '', generation = 0, request = null, profileTarget = null;
  const memberBanners = new Map();
  const memberBannerRequests = new Map(), memberBannerFetchedAt = new Map();
  let membersTarget = null;
  let reveal = null, swipe = null, suppressRevealClickUntil = 0;
  const revealDialog = document.createElement('dialog');
  revealDialog.className = 'pack-reveal-dialog';
  revealDialog.setAttribute('aria-label', 'Abrir sobre: revelar cartas');
  document.body.append(revealDialog);
  const extraCopies = () => (state?.cards || []).reduce((sum, item) => sum + Math.max(0, Number(item.quantity) - 1), 0);
  function renderReveal() {
    if (!reveal || !revealDialog.open) return;
    const item = reveal.cards[reveal.index], design = card(item.card_id);
    const duplicate = !reveal.discarded.has(reveal.index) && Number(item.quantity) > 1 && Number(state?.cards?.find(owned => owned.card_id === item.card_id)?.quantity) > 1;
    const reward = state?.discard_rewards?.[item.edition] || 1;
    // Keep the turning card intact during wallet refreshes and discards.
    if (revealDialog.dataset.cardIndex !== String(reveal.index)) {
      revealDialog.dataset.cardIndex = String(reveal.index);
      revealDialog.innerHTML = `<header class="pack-reveal-header"><span>Carta ${reveal.index + 1} de ${reveal.cards.length}</span><button type="button" data-reveal-close aria-label="Cerrar: todas las cartas ya están guardadas">✕</button></header><div class="pack-reveal-stage"><button type="button" class="pack-reveal-card" data-reveal-flip aria-label="Girar carta" aria-pressed="false"><span class="pack-reveal-face pack-reveal-back"><img src="${escape(design?.back || 'icons/cards/reverso-comun-unificado-v1.png')}" alt="Reverso de carta"></span><span class="pack-reveal-face pack-reveal-front" aria-hidden="true"></span></button></div><div class="pack-reveal-info" aria-live="polite"></div><div class="pack-reveal-actions"></div><p class="pack-reveal-status" role="status"></p>`;
      revealDialog.querySelector('[data-reveal-flip]').focus({preventScroll:true});
    }
    const turn = revealDialog.querySelector('[data-reveal-flip]');
    if (reveal.flipped && !turn.classList.contains('is-flipped')) {
      const front = turn.querySelector('.pack-reveal-front');
      front.innerHTML = design ? `<img src="${escape(design.front)}" alt="${escape(design.name)}">` : '<span>Carta guardada</span>';
      front.setAttribute('aria-hidden','false');
      turn.querySelector('.pack-reveal-back').setAttribute('aria-hidden','true');
      turn.classList.add('is-flipped'); turn.setAttribute('aria-pressed','true'); turn.setAttribute('aria-label',design?.name || item.card_id);
    }
    revealDialog.querySelector('.pack-reveal-info').innerHTML = reveal.flipped ? `<h3>${escape(design?.name || item.card_id)}</h3><p>${escape(rarityNames[item.edition] || item.edition)} · ${reveal.discarded.has(reveal.index) ? 'Repetida descartada' : Number(item.quantity) > 1 ? 'Repetida' : 'Nueva'}</p>` : '<p>Pulsa o desliza hacia la izquierda para descubrirla</p>';
    revealDialog.querySelector('.pack-reveal-actions').innerHTML = reveal.flipped ? `${duplicate ? `<button type="button" class="packs-sync" data-reveal-discard ${busy || loading || !online() ? 'disabled' : ''}>Descartar repetida · +${escape(reward)} monedas</button>` : ''}<p class="pack-reveal-swipe-hint">${reveal.index + 1 < reveal.cards.length ? 'Desliza hacia la izquierda para pasar a la siguiente carta' : 'Desliza hacia la izquierda para terminar'}</p>` : '';
    revealDialog.querySelector('.pack-reveal-status').textContent = failure || notice;
  }
  function startReveal(cards) {
    if (!cards.length) return;
    reveal = {cards,index:0,flipped:false,discarded:new Set()};
    delete revealDialog.dataset.cardIndex;
    revealDialog.showModal(); renderReveal();
  }
  revealDialog.addEventListener('click', event => {
    if (event.target.closest('[data-reveal-close]')) revealDialog.close();
    if (Date.now() < suppressRevealClickUntil) return;
    if (event.target.closest('[data-reveal-flip]') && reveal && !reveal.flipped) {reveal.flipped = true; renderReveal();}
    if (event.target.closest('[data-reveal-discard]') && reveal?.flipped) void mutate('discard_duplicate_card', {target_card_id:reveal.cards[reveal.index].card_id,copies:1}, 'Repetida descartada. Monedas añadidas.', reveal.index);
  });
  function advanceReveal(stage) {
    if (!reveal?.flipped || reveal.advancing || busy || loading) return;
    const current = reveal;
    current.advancing = true;
    stage.classList.add('is-leaving');
    stage.style.removeProperty('transform');
    stage.style.removeProperty('opacity');
    setTimeout(() => {
      if (reveal !== current || !revealDialog.open) return;
      if (current.index + 1 === current.cards.length) revealDialog.close();
      else {current.index++; current.flipped = false; current.advancing = false; renderReveal();}
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220);
  }
  revealDialog.addEventListener('pointerdown', event => {
    const stage = event.target.closest('.pack-reveal-stage');
    if (!stage || !reveal || reveal.advancing || busy || loading || !event.isPrimary || event.button !== 0) return;
    swipe = {id:event.pointerId,x:event.clientX,y:event.clientY,stage,flipped:reveal.flipped,index:reveal.index,dx:0,horizontal:false};
  });
  revealDialog.addEventListener('pointermove', event => {
    if (!swipe || swipe.id !== event.pointerId) return;
    swipe.dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    if (!swipe.horizontal && Math.abs(swipe.dx) > 12 && Math.abs(swipe.dx) > Math.abs(dy) * 1.3) {
      swipe.horizontal = true;
      swipe.stage.setPointerCapture(event.pointerId);
    }
    if (!swipe.horizontal) return;
    swipe.stage.classList.add('is-dragging');
    swipe.stage.style.transform = `translateX(${Math.min(0, swipe.dx)}px)`;
    swipe.stage.style.opacity = String(Math.max(.35, 1 + Math.min(0, swipe.dx) / 400));
  });
  function finishSwipe(event) {
    if (!swipe || swipe.id !== event.pointerId) return;
    const gesture = swipe; swipe = null;
    gesture.stage.classList.remove('is-dragging');
    gesture.stage.style.removeProperty('transform');
    gesture.stage.style.removeProperty('opacity');
    if (gesture.horizontal) suppressRevealClickUntil = Date.now() + 400;
    if (gesture.stage.hasPointerCapture(event.pointerId)) gesture.stage.releasePointerCapture(event.pointerId);
    if (event.type !== 'pointerup' || !gesture.horizontal || gesture.dx >= -Math.min(70, gesture.stage.clientWidth * .25) || !reveal || reveal.index !== gesture.index) return;
    if (gesture.flipped) advanceReveal(gesture.stage);
    else {reveal.flipped = true; renderReveal();}
  }
  revealDialog.addEventListener('pointerup', finishSwipe);
  revealDialog.addEventListener('pointercancel', finishSwipe);
  revealDialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' && reveal && !reveal.advancing && !event.repeat && !event.target.closest('[data-reveal-discard], [data-reveal-close]')) {
      event.preventDefault();
      if (reveal.flipped) advanceReveal(revealDialog.querySelector('.pack-reveal-stage'));
      else {reveal.flipped = true; renderReveal();}
    }
  });
  revealDialog.addEventListener('close', () => {reveal = null; swipe = null; el('ownedPackOpen')?.focus({preventScroll:true});});
  const el = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const card = id => globalThis.CardCollection?.catalog.find(item => item.id === id);
  const online = () => navigator.onLine !== false && !!options?.session();
  const rarityNames = {common:'Común',retro:'Retro',special:'Especial',epic:'Épica',legendary:'Legendaria'};
  const coins = () => state ? `${state.balance} monedas` : '— monedas';
  function errorMessage(error) {
    if (navigator.onLine === false) return 'Sin conexión. Conéctate para actualizar tu colección y tus monedas.';
    if (['PGRST202','42883','42P01'].includes(error?.code)) return 'La tienda está en preparación. Prueba de nuevo cuando esté activada.';
    return error?.message || 'No se pudo conectar con la tienda. Vuelve a intentarlo.';
  }
  async function rpc(name, args = {}) {
    if (!online()) throw new Error('Conéctate e inicia sesión para usar tu colección y la tienda.');
    const response = await options.rpc(name, args);
    if (response.error) throw response.error;
    return response.data;
  }
  let galiciaSceneId = 0, basketSceneId = 0;
  function galiciaArtwork(banner, extra, compact = false) {
    if (!compact && extra.split(/\s+/).includes('member-banner-art')) {
      return `<div class="banner-art banner-alberto-member-responsive ${extra}" role="img" aria-label="${escape(banner.name || 'Alberto Velasco con sus cabras en Galicia')}">${galiciaArtwork(banner, 'banner-alberto-member-compact', true)}${galiciaArtwork(banner, 'banner-alberto-member-wide')}</div>`;
    }
    // Each mounted tile gets its own clip IDs; all joints use the 2172 × 724
    // source coordinates, preserving their registration at every display size.
    const id = `galicia-${++galiciaSceneId}`;
    const sceneFit = compact ? 'none' : 'xMidYMid meet';
    const sceneWidth = compact ? 1299 : 2172;
    const figure = `<image href="icons/banners/${compact ? 'alberto-galicia-member-figures-v1.png' : 'alberto-galicia-figures-v1.png'}" width="${sceneWidth}" height="724"/>`;
    const background = `<image href="icons/banners/${compact ? 'alberto-galicia-member-bg-v1.png' : 'alberto-galicia-bg-v1.png'}" width="${sceneWidth}" height="724"/>`;
    const head = '275,0 500,0 500,180 442,218 388,241 323,209 290,166';
    const goats = [
      {box:[575,305,510,419], head:'882,466 975,471 987,522 1083,585 1083,724 918,724 884,624 847,557', joint:'906px 539px', tail:'585,322 652,322 675,362 664,412 615,406 585,377', tailJoint:'655px 395px', ear:'858,562 890,550 935,552 946,564 930,587 894,602 864,587', earJoint:'936px 561px', wind:'3.7s', phase:'0s', duration:'5.8s'},
      {box:[1085,305,515,419], head:'1090,451 1180,451 1285,481 1348,572 1303,631 1259,724 1085,724', joint:'1250px 558px', tail:'1500,331 1589,331 1600,377 1580,411 1520,427 1510,398', tailJoint:'1515px 398px', ear:'1085,562 1115,553 1165,550 1160,575 1126,603 1085,615', earJoint:'1158px 560px', wind:'4.6s', phase:'-2.3s', duration:'7.1s'},
      {box:[1600,300,520,424], head:'1600,465 1715,465 1794,496 1855,559 1836,611 1772,724 1600,724', joint:'1770px 558px', tail:'1987,316 2070,316 2070,383 2040,421 1999,406 1990,362', tailJoint:'2006px 400px', ear:'1600,560 1640,551 1700,550 1690,569 1650,586 1600,582', earJoint:'1695px 559px', wind:'3.2s', phase:'-4.1s', duration:'6.4s'}
    ];
    // The Krita exports contain baked goat transforms. Use their final bounds
    // for compact tiles; the wide scene retains its articulated source joints.
    if (compact) {
      [[545,525,239,199],[784,525,234,199],[1018,520,281,204]].forEach((box,i) => { goats[i].box = box; });
    }
    const goatSplit = 575, goatFeet = 565;
    const goatDefs = goats.map((goat, i) => {
      const [x,y,w,h] = goat.box;
      return `<clipPath id="${id}-goat-${i}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath><clipPath id="${id}-goat-head-${i}"><polygon points="${goat.head}"/></clipPath><clipPath id="${id}-goat-upper-${i}"><rect x="${x}" y="${y}" width="${w}" height="${goatSplit-y}"/></clipPath><clipPath id="${id}-goat-feet-${i}"><rect x="${x}" y="${goatFeet}" width="${w}" height="${724-goatFeet}"/></clipPath><clipPath id="${id}-goat-tail-${i}"><polygon points="${goat.tail}"/></clipPath><clipPath id="${id}-goat-ear-${i}"><polygon points="${goat.ear}"/></clipPath><mask id="${id}-goat-face-${i}" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="white"/><polygon points="${goat.ear}" fill="black"/></mask><mask id="${id}-goat-body-${i}" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="white"/><polygon points="${goat.head}" fill="black"/><polygon points="${goat.tail}" fill="black"/></mask>`;
    }).join('');
    const goatArt = compact ? goats.map((goat,i) => `<g class="banner-galicia-member-goat" style="--graze-duration:${goat.duration};--graze-phase:${goat.phase};--member-goat-joint:${goat.box[0]+goat.box[2]/2}px 724px"><g clip-path="url(#${id}-goat-${i})">${figure}</g></g>`).join('') : goats.map((goat, i) => `<g class="banner-galicia-goat" style="--graze-duration:${goat.duration};--graze-phase:${goat.phase};--goat-joint:${goat.joint};--tail-joint:${goat.tailJoint};--ear-joint:${goat.earJoint};--wind-duration:${goat.wind}" clip-path="url(#${id}-goat-${i})"><g clip-path="url(#${id}-goat-feet-${i})" mask="url(#${id}-goat-body-${i})">${figure}</g><g class="banner-galicia-goat-body"><g clip-path="url(#${id}-goat-upper-${i})" mask="url(#${id}-goat-body-${i})">${figure}</g></g><g class="banner-galicia-goat-tail"><g clip-path="url(#${id}-goat-tail-${i})">${figure}</g></g><g class="banner-galicia-goat-head"><g clip-path="url(#${id}-goat-head-${i})" mask="url(#${id}-goat-face-${i})">${figure}</g><g class="banner-galicia-goat-ear"><g clip-path="url(#${id}-goat-ear-${i})">${figure}</g></g></g></g>`).join('');
    // Feathered source patches keep the painted foliage, with each base pinned
    // to the ground. The sky patches stop above the mountain silhouettes.
    const foliage = [
      {x:105,y:130,rx:230,ry:145,joint:'145px 277px',duration:'4.8s',phase:'-1.1s',tree:true},
      {x:compact ? 1210 : 2060,y:176,rx:144,ry:120,joint:compact ? '1220px 300px' : '2070px 300px',duration:'5.6s',phase:'-3.4s',tree:true},
      ...Array.from({length:compact ? 6 : 10}, (_,i) => ({x:95+i*226,y:690,rx:170,ry:95,joint:`${95+i*226}px 724px`,duration:`${3.1+(i%4)*.4}s`,phase:`${i*-.47}s`}))
    ];
    const foliageDefs = foliage.map((patch,i) => `<mask id="${id}-foliage-${i}" maskUnits="userSpaceOnUse" x="${patch.x-patch.rx}" y="${patch.y-patch.ry}" width="${patch.rx*2}" height="${patch.ry*2}"><ellipse cx="${patch.x}" cy="${patch.y}" rx="${patch.rx}" ry="${patch.ry}" fill="url(#${id}-foliage-fade)"/></mask>`).join('');
    const foliageArt = (trees) => foliage.map((patch,i) => !!patch.tree === trees ? `<g class="banner-galicia-foliage ${trees ? 'is-tree' : ''}" style="--foliage-joint:${patch.joint};--wind-duration:${patch.duration};--wind-phase:${patch.phase}"><g mask="url(#${id}-foliage-${i})">${background}</g></g>` : '').join('');
    const grass = Array.from({length:compact ? 21 : 35}, (_, i) => {
      const x = 25 + i * 63, y = 722 - (i % 3) * 5;
      return `<g class="banner-galicia-blade" style="--blade-phase:${i * -.19}s;--blade-joint:${x}px ${y}px"><path d="M${x} ${y} Q${x-14} ${y-41} ${x-5} ${y-75} M${x} ${y} Q${x+15} ${y-37} ${x+36} ${y-52}"/><path class="is-light" d="M${x+5} ${y} Q${x+27} ${y-18} ${x+43} ${y-26}"/></g>`;
    }).join('');
    const cloudDefs = (compact ? [400,800,1150] : [650,1160,1690]).map((x,i) => `<mask id="${id}-cloud-${i}" maskUnits="userSpaceOnUse" x="${x-340}" y="-65" width="680" height="160"><ellipse cx="${x}" cy="12" rx="340" ry="80" fill="url(#${id}-cloud-fade)"/></mask>`).join('');
    const clouds = [0,1,2].map(i => `<g class="banner-galicia-clouds" style="--cloud-duration:${23+i*8}s;--cloud-phase:${i*-9}s"><g mask="url(#${id}-cloud-${i})">${background}</g></g>`).join('');
    const birds = Array.from({length:5},(_,i) => `<g class="banner-galicia-bird-flight" style="--flight-duration:${17+i*3}s;--flight-phase:${-i*4.3}s;--flight-height:${108+(i%3)*37}px;--bird-scale:${.7+(i%3)*.25}"><g class="banner-galicia-bird" style="--flap-duration:${.72+i*.11}s"><path class="banner-galicia-wing is-left" d="M0 0 Q-13 -16 -29 -11 Q-13 -7 0 3Z"/><path class="banner-galicia-wing is-right" d="M0 0 Q13 -16 29 -11 Q13 -7 0 3Z"/><path d="M-3 0 Q0 -5 4 0 L10 3 L3 4 L0 10Z"/></g></g>`).join('');
    // Only the registered face changes; the soft edge preserves the original
    // head silhouette and the expression follows the same animated head joint.
    const expression = `<g class="banner-galicia-expression" mask="url(#${id}-expression)"><image href="icons/banners/alberto-galicia-expression-v2.png" width="2172" height="724"/></g>`;
    return `<div class="banner-art banner-alberto-galicia ${extra}" role="img" aria-label="${escape(banner.name || 'Alberto Velasco con sus cabras en Galicia')}"><img class="banner-galicia-fallback" src="icons/banners/${compact ? 'alberto-galicia-member-v1.png' : 'alberto-galicia-anime-preview-v1.png'}" width="${sceneWidth}" height="724" alt="" decoding="async" aria-hidden="true"><svg class="banner-galicia-scene" viewBox="0 0 ${sceneWidth} 724" preserveAspectRatio="${sceneFit}" aria-hidden="true" focusable="false"><defs><clipPath id="${id}-alberto"><rect width="545" height="724"/></clipPath><clipPath id="${id}-head"><polygon points="${head}"/></clipPath><clipPath id="${id}-torso"><rect y="155" width="545" height="395"/></clipPath><clipPath id="${id}-legs"><rect y="535" width="545" height="189"/></clipPath><mask id="${id}-body" maskUnits="userSpaceOnUse" x="0" y="0" width="545" height="724"><rect width="545" height="724" fill="white"/><polygon points="${head}" fill="black"/></mask><radialGradient id="${id}-cloud-fade"><stop offset="45%" stop-color="white"/><stop offset="100%" stop-color="black"/></radialGradient><radialGradient id="${id}-foliage-fade"><stop offset="50%" stop-color="white"/><stop offset="100%" stop-color="black"/></radialGradient><radialGradient id="${id}-expression-fade"><stop offset="65%" stop-color="white"/><stop offset="100%" stop-color="black"/></radialGradient><mask id="${id}-expression" maskUnits="userSpaceOnUse" x="357" y="62" width="126" height="152"><ellipse cx="420" cy="138" rx="63" ry="76" fill="url(#${id}-expression-fade)"/></mask>${cloudDefs}${foliageDefs}${goatDefs}</defs>${background}${clouds}${foliageArt(true)}${birds}<g class="banner-galicia-alberto" clip-path="url(#${id}-alberto)"><g clip-path="url(#${id}-legs)">${figure}</g><g class="banner-galicia-torso"><g clip-path="url(#${id}-torso)" mask="url(#${id}-body)">${figure}</g></g><g class="banner-galicia-head"><g clip-path="url(#${id}-head)">${figure}${expression}</g></g></g>${goatArt}${foliageArt(false)}<g class="banner-galicia-grass">${grass}</g><g class="banner-galicia-breeze"><path d="M730 473 Q820 441 917 460"/><path d="M1460 269 Q1530 245 1616 256"/></g></svg></div>`;
  }
  function artwork(banner, extra = '') {
    // Only known artwork keys become styles; future Krita exports are added here.
    if (banner?.art_key === 'alberto-galicia-anime-v1') return galiciaArtwork(banner, extra);
    if (banner?.art_key === 'miguel-basket-bano-v1') {
      const member = extra.split(/\s+/).includes('member-banner-art');
      const memberClass = member ? 'banner-basket-compact' : '';
      const poses = ['00', '00a', '01', '01a', '02', '02a', '03'].map((frame, index) => `<image class="banner-basket-pose banner-basket-pose-${index}" href="icons/banners/miguel-basket-miguel-${frame}-v1.png" width="2172" height="724"/>`).join('');
      const shots = Array.from({length: 3}, (_, i) => `<g class="banner-basket-shot banner-basket-shot-${i}"><text x="0" y="0" text-anchor="middle" dominant-baseline="central">💩</text></g>`).join('');
      // Recompose the narrow member tile: bring the toilet beside Miguel, retaining
      // each subject's proportions instead of shrinking the entire wide scene.
      const id = `basket-${++basketSceneId}`;
      const background = member ? `<defs><linearGradient id="${id}-edge"><stop stop-color="black"/><stop offset="24%" stop-color="white"/></linearGradient><mask id="${id}-toilet"><rect x="630" width="712" height="724" fill="url(#${id}-edge)"/></mask></defs><svg width="1297" height="724" viewBox="650 0 850 724" preserveAspectRatio="none"><image href="icons/banners/miguel-basket-bano-bg-v1.png" width="2172" height="724"/></svg><g mask="url(#${id}-toilet)"><image href="icons/banners/miguel-basket-bano-bg-v1.png" x="-820" width="2172" height="724"/></g>` : `<image href="icons/banners/miguel-basket-bano-bg-v1.png" width="2172" height="724"/>`;
      const subject = `<g class="banner-basket-held"><text x="0" y="0" text-anchor="middle" dominant-baseline="central">💩</text></g>${poses}`;
      const impact = `<g class="banner-basket-impact" transform="translate(${member ? '960' : '1780'} 539)"><ellipse class="banner-basket-ring" rx="60" ry="12"/><path class="banner-basket-splash" d="M-42 -3 Q-67 -66 -78 -37 M-18 -8 Q-29 -86 -42 -67 M12 -8 Q28 -91 39 -63 M38 -3 Q65 -60 78 -39"/><text class="banner-basket-score" x="0" y="-75" text-anchor="middle">+3</text></g>`;
      const wideScene = `<svg class="banner-basket-scene ${member ? 'banner-basket-wide-scene' : ''}" viewBox="0 0 2172 724" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"><image href="icons/banners/miguel-basket-bano-bg-v1.png" width="2172" height="724"/>${subject}${shots}<g class="banner-basket-impact" transform="translate(1780 539)"><ellipse class="banner-basket-ring" rx="60" ry="12"/><path class="banner-basket-splash" d="M-42 -3 Q-67 -66 -78 -37 M-18 -8 Q-29 -86 -42 -67 M12 -8 Q28 -91 39 -63 M38 -3 Q65 -60 78 -39"/><text class="banner-basket-score" x="0" y="-75" text-anchor="middle">+3</text></g></svg>`;
      const compactScene = member ? `<svg class="banner-basket-scene banner-basket-compact-scene" viewBox="0 0 1297 724" preserveAspectRatio="none" aria-hidden="true" focusable="false">${background}<g transform="translate(0 72) scale(.9)">${subject}</g>${shots}${impact}</svg>` : '';
      return `<div class="banner-art banner-miguel-basket ${memberClass} ${extra}" role="img" aria-label="${escape(banner.name || 'Miguel encesta emojis en el váter')}">${member ? '' : '<img class="banner-basket-fallback" src="icons/banners/miguel-basket-bano-v1.png" width="2172" height="724" alt="" decoding="async" aria-hidden="true">'}${compactScene}${wideScene}</div>`;
    }
    if (banner?.art_key === 'miguel-moto-anime-v1') {
      // All moving motorcycle parts use the source image's coordinates, so they
      // stay attached to the wheels and hair in every banner size.
      const spokes = Array.from({length: 6}, (_, i) => `<path d="M0 -58 L0 -132" transform="rotate(${i * 60})"/>`).join('');
      const wheels = `<svg class="banner-moto-wheels" viewBox="0 0 1312 1199" fill="none"><g transform="translate(503 929) rotate(8) scale(.47 1)"><g class="banner-moto-wheel-spin"><circle r="145" class="banner-moto-wheel-rim"/><g class="banner-moto-wheel-spokes">${spokes}</g><circle r="156" class="banner-moto-wheel-tread"/></g></g><g transform="translate(962 916) rotate(8) scale(.43 .67)"><g class="banner-moto-wheel-spin is-front"><circle r="145" class="banner-moto-wheel-rim"/><g class="banner-moto-wheel-spokes">${spokes}</g><circle r="156" class="banner-moto-wheel-tread"/></g></g></svg>`;
      return `<div class="banner-art banner-miguel-moto ${extra}" role="img" aria-label="${escape(banner.name || 'Miguel en moto por la ciudad')}"><div class="banner-moto-city banner-moto-far" aria-hidden="true"></div><div class="banner-moto-clouds" aria-hidden="true"><i></i><i></i></div><div class="banner-moto-city banner-moto-mid" aria-hidden="true"></div><div class="banner-moto-city banner-moto-near" aria-hidden="true"></div><div class="banner-moto-city banner-moto-near banner-moto-near-delayed" aria-hidden="true"></div><div class="banner-moto-road" aria-hidden="true">${Array.from({length: 12}, (_, i) => `<i class="banner-moto-lane ${i > 5 ? 'is-right' : ''}" style="--phase:${i % 6}"></i>`).join('')}</div><div class="banner-moto-rider-group" aria-hidden="true"><div class="banner-moto-shadow"></div><div class="banner-moto-rider-plane"><img class="banner-moto-rider" src="icons/banners/miguel-moto-rider-v2.png" width="1312" height="1199" alt="" decoding="async">${wheels}<img class="banner-moto-hair" src="icons/banners/miguel-moto-rider-v2.png" width="1312" height="1199" alt="" decoding="async"><svg class="banner-moto-wind" viewBox="0 0 1312 1199" fill="none"><path d="M710 43 Q684 27 669 42 M729 29 Q711 13 693 25 M693 64 Q670 53 658 65"/></svg></div></div><div class="banner-moto-light" aria-hidden="true"></div></div>`;
    }
    const style = banner?.art_key === 'banner-de-prueba' ? 'banner-trial' : 'banner-neutral';
    return `<div class="banner-art ${style} ${extra}" role="img" aria-label="${escape(banner?.name || 'Banner de perfil')}"><span>BB</span></div>`;
  }
  function paintProfile() {
    if (!profileTarget?.node.isConnected) return;
    const {node, userId, own} = profileTarget;
    const banner = own ? state?.banners?.find(item => item.id === state.equipped_banner_id) : memberBanners.get(userId);
    const identity = node.querySelector('.club-profile-identity');
    const avatar = identity?.querySelector('.club-profile-avatar');
    let hero = identity?.querySelector('.profile-banner-hero');
    if (banner && identity && avatar) {
      if (!hero) {
        hero = document.createElement('div');
        hero.className = 'profile-banner-hero';
        avatar.before(hero);
        hero.append(avatar);
      }
      // Keep the decoded, circular avatar intact while the artwork changes.
      if (hero.dataset.bannerId !== String(banner.id) || !hero.querySelector('.profile-banner')) {
        hero.querySelector('.profile-banner')?.remove();
        hero.insertAdjacentHTML('afterbegin', artwork(banner, 'profile-banner'));
        hero.dataset.bannerId = String(banner.id);
      }
    } else if (hero) {
      if (avatar) hero.before(avatar);
      hero.remove();
    }
    if (own) {
      const balance = node.querySelector('[data-wallet-balance]');
      if (balance) balance.textContent = coins();
      node.querySelector('[data-banner-shop]')?.setAttribute('aria-label', `Abrir tienda de banners. ${coins()}`);
    }
  }
  function memberBanner(userId) {
    if (userId && userId === options?.session() && state) {
      return state.banners?.find(item => item.id === state.equipped_banner_id) || null;
    }
    return memberBanners.get(userId) || null;
  }
  function memberArtwork(userId) {
    return artwork(memberBanner(userId), 'member-banner-art');
  }
  function paintMembers() {
    if (!membersTarget?.isConnected) return;
    membersTarget.querySelectorAll('[data-member-banner-user]').forEach(node => {
      const banner = memberBanner(node.dataset.memberBannerUser);
      const key = banner?.id || '';
      const surface = node.querySelector('.club-member-banner');
      if (surface && (surface.dataset.bannerId !== key || !surface.firstElementChild)) {
        surface.innerHTML = artwork(banner, 'member-banner-art');
        surface.dataset.bannerId = key;
      }
    });
  }
  function loadMemberBanner(userId, force = false) {
    if (!userId || !online()) return Promise.resolve();
    if (memberBannerRequests.has(userId)) return memberBannerRequests.get(userId);
    if (!force && Date.now() - (memberBannerFetchedAt.get(userId) || 0) < 60000) return Promise.resolve();
    const token = generation, session = options.session();
    const pending = rpc('get_member_profile_banner', {target_user_id:userId}).then(data => {
      if (token !== generation || session !== options.session()) return;
      memberBanners.set(userId, data);
      memberBannerFetchedAt.set(userId, Date.now());
      paintProfile(); paintMembers();
    }).catch(() => {
      // Keep the last good artwork and avoid retrying on every UI render.
      if (token === generation && session === options.session()) memberBannerFetchedAt.set(userId, Date.now());
    }).finally(() => {
      if (memberBannerRequests.get(userId) === pending) memberBannerRequests.delete(userId);
    });
    memberBannerRequests.set(userId, pending);
    return pending;
  }
  function mountMembers(node) {
    membersTarget = node;
    paintMembers();
    new Set([...node.querySelectorAll('[data-member-banner-user]')].map(item => item.dataset.memberBannerUser)).forEach(userId => {
      if (userId !== options?.session() || !state) void loadMemberBanner(userId);
    });
  }
  function renderEditor() {
    const settings = el('profileBannerSettings');
    if (!settings || settings.hidden) return;
    const picker = el('profileBannerPicker'), list = el('profileBannerOptions');
    if (state) {
      const owned = (state.banners || []).filter(banner => banner.owned);
      const selected = owned.find(banner => banner.id === state.equipped_banner_id);
      el('profileBannerSelection').textContent = selected?.name || 'Sin banner';
      const signature = JSON.stringify([state.equipped_banner_id, owned]);
      if (list.dataset.signature !== signature) {
        list.dataset.signature = signature;
        list.innerHTML = `<button type="button" class="profile-banner-option" data-profile-banner="" data-banner-id="" aria-pressed="${!state.equipped_banner_id}"><div class="profile-banner-empty" aria-hidden="true">BB</div><span>Sin banner</span></button>` + owned.map(banner => `<button type="button" class="profile-banner-option" data-profile-banner="${escape(banner.id)}" data-banner-id="${escape(banner.id)}" aria-pressed="${banner.id === state.equipped_banner_id}">${artwork(banner)}<span>${escape(banner.name)}</span></button>`).join('');
      }
    }
    list.querySelectorAll('button').forEach(button => {button.disabled = busy || loading || !state || !online();});
    picker.setAttribute('aria-busy', String(busy || loading));
    el('profileBannerStatus').textContent = failure || (busy ? 'Aplicando banner…' : loading ? 'Cargando tus banners…' : !online() ? 'Conéctate para elegir tu banner.' : notice || (state && !(state.banners || []).some(banner => banner.owned) ? 'Todavía no tienes banners comprados.' : ''));
    el('profileBannerRetry').hidden = !failure && (loading || !!state);
    el('profileBannerRetry').disabled = busy || loading || !online();
  }
  function openEditor(own) {
    el('profileBannerSettings').hidden = !own;
    el('profileBannerPicker').hidden = true;
    el('profileBannerToggle').setAttribute('aria-expanded', 'false');
    failure = ''; notice = '';
    if (own) {renderEditor(); void refresh();}
  }
  function closeEditor() {
    el('profileBannerSettings').hidden = true;
    el('profileBannerPicker').hidden = true;
    el('profileBannerToggle').setAttribute('aria-expanded', 'false');
  }
  function render() {
    if (state && options?.session()) {
      const userId = options.session();
      memberBanners.set(userId, state.banners?.find(item => item.id === state.equipped_banner_id) || null);
      memberBannerFetchedAt.set(userId, Date.now());
    }
    paintProfile();
    paintMembers();
    renderReveal();
    renderEditor();
    document.querySelectorAll('[data-duplicates-count]').forEach(node => {node.textContent = state ? extraCopies() : '—'; node.closest('button')?.setAttribute('aria-label', `Gestionar ${state ? extraCopies() : ''} cartas repetidas`);});
    if (el('discardAllDuplicates')) el('discardAllDuplicates').disabled = busy || loading || !extraCopies() || !online();
    if (el('duplicatesStatus')) el('duplicatesStatus').textContent = failure || notice || (loading ? 'Actualizando repetidas…' : state ? `${extraCopies()} copias repetidas. Conservas una de cada carta.` : 'Actualiza la colección para consultar las repetidas.');
    globalThis.CardAlbum?.update({cards:state?.cards || null, loading, failure});
    const status = el('bannerShopStatus');
    if (status) { status.textContent = failure || (loading ? 'Actualizando colección…' : notice); status.classList.toggle('is-error', !!failure); }
    if (el('bannerShopBalance')) el('bannerShopBalance').textContent = coins();
    if (el('bannerShopRefresh')) el('bannerShopRefresh').disabled = busy || loading;
    if (el('ownedPackOpen')) el('ownedPackOpen').disabled = busy || loading || !state?.available_packs?.length || !online();
    if (el('packsOpenHint')) el('packsOpenHint').textContent = busy || loading ? 'Preparando tu colección…' : state?.available_packs?.length ? 'Toca el sobre para abrirlo.' : 'Vuestras historias, por descubrir.';
    if (el('packRarityOdds')) el('packRarityOdds').textContent = state?.rarity_probabilities ? Object.keys(rarityNames).filter(rarity => state.rarity_probabilities[rarity] != null).map(rarity => `${rarityNames[rarity]}: ${state.rarity_probabilities[rarity]}%`).join(' · ') : 'Actualiza para consultar las probabilidades.';
    const container = el('bannerShopItems');
    if (container) container.innerHTML = state ? (state.banners || []).map(banner => `<article class="banner-shop-item">${artwork(banner)}<h3>${escape(banner.name)}</h3><p>${escape(banner.description)}</p><span>${banner.owned ? 'En tu colección' : `${escape(banner.price)} ${Number(banner.price) === 1 ? 'moneda' : 'monedas'}`}</span><button class="packs-sync" type="button" data-banner-action="${banner.owned ? 'equip' : 'buy'}" data-banner-id="${escape(banner.id)}" ${busy || loading || banner.equipped || (!banner.owned && Number(state.balance) < Number(banner.price)) || !online() ? 'disabled' : ''}>${banner.equipped ? 'Equipado' : banner.owned ? 'Equipar' : 'Comprar'}</button></article>`).join('') : '<p>Actualiza para consultar los banners disponibles.</p>';
    if (el('bannerUnequip')) el('bannerUnequip').disabled = busy || loading || !state?.equipped_banner_id || !online();
    const inventory = el('ownedCardInventory');
    if (inventory) inventory.innerHTML = state ? (extraCopies() ? state.cards.filter(item => Number(item.quantity) > 1).map(item => {
      const design = card(item.card_id), reward = state.discard_rewards?.[item.edition] || 1;
      return `<article class="owned-card">${design ? `<img src="${escape(design.front)}" alt="${escape(design.name)}" loading="lazy" decoding="async">` : ''}<h4>${escape(design?.name || item.card_id)}</h4><p>${escape(design?.edition || item.edition)} · ${escape(item.quantity)} ${Number(item.quantity) === 1 ? 'copia' : 'copias'}</p>${Number(item.quantity) > 1 ? `<button type="button" class="packs-sync" data-discard-card="${escape(item.card_id)}" ${busy || loading || !online() ? 'disabled' : ''}>Descartar 1 repetida · +${escape(reward)} monedas</button>` : '<small>Única copia</small>'}</article>`;
    }).join('') : '<p>No tienes cartas repetidas.</p>') : '<p>Tu inventario se mostrará al sincronizar la colección.</p>';
  }
  function refresh(forceDaily = false) {
    if (request) return request;
    const token = generation, user = options?.session();
    if (!user) state = null;
    loading = true; failure = ''; render();
    request = (async () => {
      try {
        // The daily claim must finish before reading available packs. This also
        // covers profile mounting and reconnect, not just packs navigation.
        await options?.synchronizePacks?.(forceDaily);
        if (token !== generation || user !== options.session()) return;
        const data = await rpc('get_banner_shop_state'); if (token === generation && user === options.session()) {state = data; globalThis.DailyPacks?.updateBalance(state.available_packs.length); failure = ''; render();} }
      catch (error) { if (token === generation) {failure = errorMessage(error); render();} }
      finally {if (token === generation) {loading = false; request = null; render();}}
    })();
    return request;
  }
  async function mutate(name, args, message, discardedIndex = null) {
    if (busy || loading) return;
    const token = generation, user = options.session();
    const focus = document.activeElement;
    const revealAtStart = reveal;
    const focusCard = focus?.dataset?.discardCard;
    const focusBanner = focus?.dataset?.bannerId;
    const focusProfileBanner = focus?.dataset?.profileBanner;
    busy = true; failure = ''; notice = ''; render();
    try {
      const data = await rpc(name, args);
      if (token !== generation || user !== options.session()) return;
      if (discardedIndex != null && reveal === revealAtStart) reveal.discarded.add(discardedIndex);
      // A successful spend invalidates the old wallet until the server refreshes it.
      state = null;
      if (name === 'open_owned_card_pack') {
        const draws = data.cards || (data.card ? [data.card] : []);
        el('ownedPackResult').textContent = `${draws.length} cartas guardadas en tu colección.`;
        startReveal(draws);
        await options.synchronizePacks?.(true);
        if (token !== generation || user !== options.session()) return;
      }
      if (name === 'discard_duplicate_card' || name === 'discard_all_duplicate_cards') {
        const earned = Number(data.coins_earned) || 0;
        const copies = name === 'discard_all_duplicate_cards' ? Number(data.copies_discarded) || 0 : 1;
        message = `${copies} ${copies === 1 ? 'carta repetida descartada' : 'cartas repetidas descartadas'} · +${earned} ${earned === 1 ? 'moneda' : 'monedas'}.`;
      }
      notice = message;
      await refresh();
    } catch (error) { if (token === generation) {state = null; const message = errorMessage(error); await refresh(); if (token === generation) failure = `${message} Comprueba el saldo actualizado antes de repetir la acción.`;} }
    finally {if (token === generation) {busy = false; render();
      const destination = [...document.querySelectorAll('[data-discard-card], [data-banner-id]')].find(button => !button.disabled && ((focusCard && button.dataset.discardCard === focusCard) || (focusBanner && button.dataset.bannerId === focusBanner)));
      if (focusProfileBanner !== undefined) {
        if (!el('profileBannerSettings').hidden && !el('profileBannerPicker').hidden) {
          const option = [...el('profileBannerOptions').querySelectorAll('[data-profile-banner]')].find(button => button.dataset.profileBanner === focusProfileBanner);
          (option && !option.disabled ? option : el('profileBannerToggle')).focus({preventScroll:true});
        }
      } else if (revealDialog.open) revealDialog.querySelector('[data-reveal-flip]')?.focus({preventScroll:true});
      else if (el('duplicatesDialog').open && focusCard) (destination || el('discardAllDuplicates')).focus({preventScroll:true});
      else if (destination) destination.focus({preventScroll:true});
      else if (focusCard) el('duplicatesTitle')?.focus({preventScroll:true});
    }}
  }
  function mountProfile(node, userId, own) {
    profileTarget = {node, userId, own};
    if (own) {
      const topline = node.querySelector('.club-profile-topline');
      if (topline && !topline.querySelector('[data-banner-shop]')) topline.insertAdjacentHTML('beforeend', '<button type="button" class="banner-shop-trigger" data-banner-shop aria-haspopup="dialog"><span data-wallet-balance>— monedas</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h18l-2-6H5L3 9Zm1 0v12h16V9M9 21v-7h6v7M3 9c0 3 4 3 4 0 0 3 5 3 5 0 0 3 5 3 5 0 0 3 4 3 4 0"/></svg></button>');
      if (topline && !topline.querySelector('[data-card-album]')) topline.insertAdjacentHTML('beforeend', `<button type="button" class="card-album-trigger" data-card-album aria-label="Abrir mi álbum de cartas" aria-haspopup="dialog">${globalThis.CardAlbum?.icon || ''}</button>`);
      paintProfile();
      if (!state && !request) void refresh();
    } else if (userId) {
      paintProfile();
      void loadMemberBanner(userId, true);
    }
  }
  function initialize(config) {
    options = config;
    globalThis.CardAlbum?.configure({refresh:() => refresh()});
    document.addEventListener('click', event => {
      if (event.target.closest('[data-banner-shop]')) {el('bannerShopDialog').showModal(); void refresh();}
      const ownedOption = event.target.closest('[data-profile-banner]');
      if (ownedOption && !el('profileBannerSettings').hidden && !ownedOption.disabled) {
        const id = ownedOption.dataset.profileBanner || null;
        if (state && id !== (state.equipped_banner_id || null) && (id === null || state?.banners?.some(banner => banner.id === id && banner.owned))) void mutate('equip_profile_banner', {target_banner_id:id}, id ? 'Banner aplicado a tu perfil.' : 'Banner retirado de tu perfil.');
      }
      const banner = event.target.closest('[data-banner-action]');
      if (banner) void mutate(banner.dataset.bannerAction === 'buy' ? 'buy_profile_banner' : 'equip_profile_banner', {target_banner_id:banner.dataset.bannerId}, banner.dataset.bannerAction === 'buy' ? 'Banner comprado. Ya puedes equiparlo.' : 'Banner equipado en la cabecera de tu perfil.');
      if (event.target.closest('[data-duplicates-open]')) {el('duplicatesDialog').showModal(); void refresh();}
      if (event.target.closest('[data-duplicates-close]')) el('duplicatesDialog').close();
      const discard = event.target.closest('[data-discard-card]');
      if (discard) void mutate('discard_duplicate_card', {target_card_id:discard.dataset.discardCard,copies:1}, 'Carta repetida descartada. Monedas añadidas a tu cuenta.');
    });
    el('discardAllDuplicates').addEventListener('click', () => void mutate('discard_all_duplicate_cards', {}, 'Todas las repetidas descartadas. Monedas añadidas a tu cuenta.'));
    el('profileBannerToggle').addEventListener('click', () => {
      const picker = el('profileBannerPicker');
      picker.hidden = !picker.hidden;
      el('profileBannerToggle').setAttribute('aria-expanded', String(!picker.hidden));
      if (!picker.hidden) {renderEditor(); if (!state && !request) void refresh();}
    });
    el('profileBannerRetry').addEventListener('click', () => void refresh());
    el('bannerShopClose').addEventListener('click', () => el('bannerShopDialog').close());
    el('bannerShopRefresh').addEventListener('click', () => void refresh());
    el('bannerUnequip').addEventListener('click', () => void mutate('equip_profile_banner', {target_banner_id:null}, 'Banner retirado de tu perfil.'));
    el('ownedPackOpen').addEventListener('click', () => void mutate('open_owned_card_pack', {}, 'Sobre abierto. Todas las cartas se han guardado en tu colección.'));
    el('bannerShopInventory').addEventListener('click', () => {el('bannerShopDialog').close(); if (globalThis.CardAlbum) globalThis.CardAlbum.open(el('bannerShopInventory')); else {options.openInventory(); el('packsTitle')?.focus();}});
    window.addEventListener('online', () => {
      if (options.session()) void refresh();
      if (membersTarget?.isConnected) mountMembers(membersTarget);
    });
    window.addEventListener('offline', render);
    render();
  }
  function reset() {
    closeEditor();
    el('profileBannerOptions').replaceChildren();
    delete el('profileBannerOptions').dataset.signature;
    el('profileBannerSelection').textContent = 'Sin banner';
    generation++; state = null; busy = false; loading = false; request = null; failure = ''; notice = ''; profileTarget = null; memberBanners.clear(); memberBannerRequests.clear(); memberBannerFetchedAt.clear();
    paintMembers(); membersTarget = null;
    globalThis.CardAlbum?.reset();
    revealDialog.close(); el('duplicatesDialog')?.close();
    el('bannerShopDialog')?.close(); if (el('ownedPackResult')) el('ownedPackResult').replaceChildren(); render();
  }
  globalThis.BannerShop = Object.freeze({initialize, refresh, openEditor, closeEditor, mountProfile, mountMembers, memberArtwork, artwork, reset});
})();
