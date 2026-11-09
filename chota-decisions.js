/* The Chota's daily decision lives in the sede. A letter and the day's object
   wait on the floor; the letter opens his scene, where he walks in, tells the
   dilemma, acts out every choice and replays yesterday. In the room he shows
   his mood and talks about the dilemma. Story data and votes still come only
   from ClubPlus RPCs. */
(() => {
  'use strict';
  const scenes = globalThis.ChotaScenes;
  if (!scenes) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));
  const meters = [['money', 'Dinero'], ['fame', 'Fama'], ['energy', 'Energía'], ['trouble', 'Líos']];
  const sequences = {
    walk: [6, 7, 8, 9, 10, 11, 6, 7, 8, 9, 10, 11],
    step: [6, 7, 8, 9, 0],
    greet: [1, 2, 3, 4, 3, 4, 2, 5, 1, 0],
    wave: [1, 2, 3, 2, 1, 0],
    jump: [12, 13, 14, 15, 14, 16, 17, 0],
    cheer: [12, 13, 14, 15, 15, 15, 14, 16, 17, 0],
    sit: [18, 19, 20, 20, 20, 20, 19, 18, 0],
  };
  const quips = ['¡Eh! Que estoy pensando.', 'Tú vota, que yo pongo la cara.', 'Esto me pasa por salir de casa.', 'Si sale mal, la culpa es del club.',
    'Ya me estoy arrepintiendo y aún no he hecho nada.', 'Necesito un café. O tres.', 'Prometo hacer caso. Probablemente.', 'No me mires así, que me pongo nervioso.'];
  const nudges = ['¿Entonces? Tú decides.', 'Venga, que no tengo todo el día. Bueno, sí lo tengo.', 'Elige una, que me como las uñas.', 'El club espera tu voto.'];
  // Living details of each place, in the scene's 192×120 pixels.
  const placeFx = {
    calle: [['twinkle', 4, 6], ['twinkle', 61, 4], ['twinkle', 131, 5], ['twinkle', 170, 12], ['flicker', 81, 42], ['window', 23, 58], ['window', 165, 44]],
    playa: [['shimmer', 22, 66], ['shimmer', 116, 70], ['shimmer', 60, 75], ['glow', 150, 58], ['gull', 40, 16]],
    sede: [['motes', 60, 50], ['glow', 22, 22]],
    oficina: [['motes', 90, 40], ['blinds', 44, 32]],
    escenario: [['beam', 96, 0], ['motes', 96, 50]],
    lago: [['ripple', 40, 72], ['ripple', 96, 86], ['leaf', 70, 40]],
    metro: [['flicker', 96, 26], ['motes', 60, 60], ['train', 96, 92]],
    cocina: [['motes', 80, 40]],
    fiesta: [[8, 13, '#f2c14e'], [24, 18, '#e5654a'], [44, 17, '#6f93d1'], [60, 13, '#8cc06a'], [80, 18, '#f08fb0'], [100, 20, '#f2c14e'], [118, 15, '#e5654a'], [140, 15, '#6f93d1'], [156, 19, '#8cc06a'], [176, 14, '#f08fb0']]
      .map(([x, y, c], i) => ['bulb', x + 1, y + 2, c, i]).concat([['confetti', 96, 0]]),
  };
  const particles = {steam: 3, zzz: 3, notes: 2, bubbles: 3, motes: 4, dust: 3, confetti: 10, ripple: 2, sweat: 2, flame: 1};
  let story = null, dialog = null, showing = 'today', trigger = null, voting = false, notice = '', clock = 0, nudgeTimer = 0, lastVoteLabel = '', choice = null;
  const art = new Map();

  function snapshot() { return globalThis.ClubPlus?.snapshot?.()?.story || story || null; }
  function pending(data = story) { return Boolean(data?.today && data.today.mine == null); }
  const pct = (value, total) => `${(value / total * 100).toFixed(2)}%`;
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const session = {
    get(key) { try { return sessionStorage.getItem(key); } catch { return null; } },
    set(key) { try { sessionStorage.setItem(key, '1'); } catch {} },
  };

  // Pixel art is drawn small and scaled up without smoothing, like the room.
  function svgImage(markup) {
    if (!art.has(markup)) art.set(markup, new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    }));
    return art.get(markup);
  }
  async function paint(key) {
    const canvas = dialog?.querySelector('.chd-scene');
    if (!canvas) return;
    canvas.dataset.scene = key;
    const image = await svgImage(scenes.svg(key));
    if (!image || canvas.dataset.scene !== key) return;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
  }
  function fxMarkup(key) {
    const list = [...(placeFx[scenes.place(key)] || []), ...scenes.fx(key)];
    return list.map(([type, x, y, color, index = 0]) => {
      const dots = Array.from({length: particles[type] || 0}, (_, i) => `<b style="--i:${i}"></b>`).join('');
      return `<i class="chd-fx chd-fx--${type}" style="--x:${pct(x, 192)};--y:${pct(y, 120)};--c:${color || '#fff3b0'};--n:${index}">${dots}</i>`;
    }).join('');
  }

  // Short bursts: rewards, outcomes and reactions.
  function burst(kind, count = 10) {
    const layer = dialog?.querySelector('.chd-burst');
    if (!layer || reduced.matches) return;
    const stage = dialog.querySelector('.chd-stage');
    if (kind === 'flash') { stage.classList.remove('is-flashing'); void stage.offsetWidth; stage.classList.add('is-flashing'); return; }
    if (kind === 'shake') { stage.classList.remove('is-shaking'); void stage.offsetWidth; stage.classList.add('is-shaking'); return; }
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('i');
      piece.className = `chd-piece chd-piece--${kind}`;
      piece.style.setProperty('--x', `${kind === 'coin' || kind === 'drop' ? 8 + Math.random() * 84 : 14 + Math.random() * 30}%`);
      piece.style.setProperty('--dx', `${(Math.random() - .5) * 120}px`);
      piece.style.setProperty('--d', `${Math.round(Math.random() * 380)}ms`);
      piece.style.setProperty('--r', `${Math.round((Math.random() - .5) * 360)}deg`);
      layer.append(piece);
      piece.addEventListener('animationend', () => piece.remove(), {once: true});
    }
  }
  function reward(text) {
    const layer = dialog?.querySelector('.chd-burst');
    if (!layer) return;
    const tag = document.createElement('span');
    tag.className = 'chd-reward';
    tag.textContent = text;
    layer.append(tag);
    setTimeout(() => tag.remove(), 2200);
    navigator.vibrate?.(14);
  }

  // The sprite cell must be a whole number of CSS pixels. A fractional actor
  // (82 % of a fluid stage) makes the 600 %-wide sheet sample the neighbouring
  // pose at the edges and shifts the drawing by a pixel between frames.
  let actorFit = null;
  function fitActor() {
    const stage = dialog?.querySelector('.chd-stage'), mover = dialog?.querySelector('.chd-actor');
    if (!stage || !mover) return;
    const size = Math.max(1, Math.round(stage.clientHeight * .82));
    if (mover.style.height !== `${size}px`) { mover.style.height = `${size}px`; mover.style.width = `${size}px`; }
    if (!actorFit && typeof ResizeObserver === 'function') { actorFit = new ResizeObserver(() => fitActor()); actorFit.observe(stage); }
  }

  // A small sprite player on the Chota sheets: poses (6×4) and talk (3×1).
  const actor = {
    timer: 0, talkTimer: 0, typing: 0, token: 0, x: 0, sheet: 'base', index: 0,
    node() { return dialog?.querySelector('.chd-chota'); },
    pose(sheet, index) {
      const node = this.node();
      if (!node) return;
      const cols = sheet === 'talk' ? 3 : 6, rows = sheet === 'talk' ? 1 : 4;
      this.sheet = sheet; this.index = index;
      node.classList.toggle('is-talking', sheet === 'talk');
      node.dataset.sheet = sheet; node.dataset.frame = String(index);
      node.style.backgroundSize = `${cols * 100}% ${rows * 100}%`;
      node.style.backgroundPosition = `${index % cols * 100 / (cols - 1)}% ${rows === 1 ? 0 : Math.floor(index / cols) * 100 / (rows - 1)}%`;
      this.dress(sheet, node.style.backgroundPosition);
    },
    frame(index) {
      // A gesture can interrupt speech; no queued mouth tick may select a talk
      // garment on the base body afterwards.
      clearInterval(this.talkTimer); this.talkTimer = 0;
      this.pose('base', index);
    },
    // He wears the clothes he has on in the sede: one layer per garment over the same cell.
    wear() {
      const node = this.node();
      if (!node) return;
      node.querySelectorAll('.chd-wear').forEach(layer => layer.remove());
      for (const {slot, atlases} of globalThis.ChotaWardrobe?.outfit?.() || []) {
        const layer = document.createElement('i');
        layer.className = 'chd-wear';
        layer.dataset.slot = slot;
        layer.dataset.base = atlases.base;
        layer.dataset.talk = atlases.talk;
        node.querySelector('.chd-think') ? node.insertBefore(layer, node.querySelector('.chd-think')) : node.append(layer);
      }
      const sheet=this.sheet,index=this.index,cols=sheet==='talk'?3:6,rows=sheet==='talk'?1:4;
      this.dress(sheet,`${index%cols*100/(cols-1)}% ${rows===1?0:Math.floor(index/cols)*100/(rows-1)}%`);
    },
    dress(sheet, position) {
      for (const layer of this.node()?.querySelectorAll('.chd-wear') || []) {
        const url = layer.dataset[sheet];
        if (layer.dataset.sheet !== sheet) { layer.dataset.sheet = sheet; layer.style.backgroundImage = url ? `url("${url}")` : 'none'; layer.style.backgroundSize = sheet === 'talk' ? '300% 100%' : '600% 400%'; }
        layer.style.backgroundPosition = position || '0 0';
      }
    },
    stop() { clearInterval(this.timer); clearInterval(this.talkTimer); clearTimeout(this.typing); this.timer = this.talkTimer = this.typing = 0; this.token++; },
    play(name, done) {
      this.stop();
      const token = this.token;
      const frames = sequences[name] || sequences.greet;
      if (reduced.matches) { this.frame(0); done?.(); return; }
      let index = 0;
      this.frame(frames[0]);
      this.node()?.classList.toggle('is-airborne', name === 'jump' || name === 'cheer');
      this.timer = setInterval(() => {
        if (token !== this.token) return;
        index++;
        if (index >= frames.length) { clearInterval(this.timer); this.timer = 0; this.node()?.classList.remove('is-airborne'); done?.(); return; }
        this.frame(frames[index]);
      }, name === 'walk' || name === 'step' ? 90 : 120);
    },
    // He walks along the floor; positions are a share of the stage width.
    mover() { return dialog?.querySelector('.chd-actor'); },
    moveTo(x, done) {
      const mover = this.mover(), node = this.node();
      if (!mover || !node) return;
      const from = this.x;
      this.x = x;
      mover.style.translate = `${x}% 0`;
      if (reduced.matches || from === x) { done?.(); return; }
      node.classList.toggle('is-facing-left', x < from);
      mover.animate([{translate: `${from}% 0`}, {translate: `${x}% 0`}], {duration: Math.min(900, 140 + Math.abs(x - from) * 22), easing: 'ease-in-out'});
      this.play(Math.abs(x - from) > 12 ? 'walk' : 'step', () => { node.classList.remove('is-facing-left'); done?.(); });
    },
    walkIn(done) {
      const mover = this.mover();
      this.x = 0;
      if (!mover) { done?.(); return; }
      mover.style.translate = '0% 0';
      if (reduced.matches) { done?.(); return; }
      mover.animate([{translate: '-120% 0'}, {translate: '0% 0'}], {duration: 1050, easing: 'cubic-bezier(.25,.7,.3,1)'});
      this.play('walk', done);
    },
    think(on) { dialog?.querySelector('.chd-think')?.classList.toggle('is-on', Boolean(on) && !reduced.matches); },
    // Text appears as he says it; the bubble keeps the full line's height so
    // typing never pushes the page, and his mouth moves until it is complete.
    say(text, gesture, after) {
      const bubble = dialog?.querySelector('.chd-bubble');
      const node = this.node();
      if (!bubble || !node) return;
      this.stop();
      const token = this.token;
      this.think(false);
      const line = bubble.querySelector('.chd-line');
      bubble.querySelector('.chd-ghost').textContent = text;
      bubble.setAttribute('aria-label', text);
      bubble.classList.remove('is-popping');
      void bubble.offsetWidth;
      bubble.classList.add('is-popping');
      const finish = () => { if (token !== this.token) return; this.frame(0); if (gesture) this.play(gesture, after); else after?.(); };
      if (reduced.matches) { line.textContent = text; finish(); return; }
      line.textContent = '';
      this.pose('talk', 0);
      let mouth = 0, shown = 0;
      this.talkTimer = setInterval(() => { if (token === this.token) this.pose('talk', [0,1,2,1][mouth++%4]); }, 110);
      const step = () => {
        if (token !== this.token) return;
        shown = Math.min(text.length, shown + 2);
        line.textContent = text.slice(0, shown);
        if (shown < text.length) { this.typing = setTimeout(step, 34); return; }
        clearInterval(this.talkTimer);
        this.typing = setTimeout(finish, 260);
      };
      step();
    },
  };

  function meterMarkup(season, deltas = {}) {
    return meters.map(([key, label]) => {
      const value = Math.max(0, Math.min(100, Number(season?.[key]) || 0)), delta = Number(deltas[key]) || 0;
      const better = key === 'trouble' ? delta < 0 : delta > 0;
      return `<li class="chd-meter${delta ? ' is-changed' : ''}" data-meter="${key}"><span>${label}</span><i><b style="--value:${value}%;--from:${Math.max(0, Math.min(100, value - delta))}%"></b></i><strong data-count="${value}" data-from="${value - delta}">${value}</strong>${delta ? `<em class="${better ? 'is-better' : 'is-worse'}">${delta > 0 ? '+' : ''}${delta}</em>` : ''}</li>`;
    }).join('');
  }
  // Changed meters count from yesterday's value to today's.
  function countMeters() {
    if (reduced.matches) return;
    dialog?.querySelectorAll('.chd-meter.is-changed strong').forEach(node => {
      const from = Number(node.dataset.from), to = Number(node.dataset.count), start = performance.now();
      const tick = now => {
        const t = Math.min(1, (now - start) / 900);
        node.textContent = String(Math.round(from + (to - from) * (1 - (1 - t) ** 3)));
        if (t < 1 && node.isConnected) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
  function mood(season) {
    if (!season) return '';
    if (season.trouble >= 70) return 'Anda metido en líos';
    if (season.energy <= 30) return 'Está agotado';
    if (season.money >= 70) return 'Le sobra el dinero';
    if (season.money <= 30) return 'Está sin un euro';
    if (season.fame >= 70) return 'Le piden fotos por la calle';
    return 'Sigue a lo suyo';
  }
  // Yesterday's line is built from what changed most, in his voice.
  function changes(y) { return meters.map(([key]) => [key, Number(y?.[key]) || 0]).filter(([, value]) => value).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]) || (b[0] === 'trouble') - (a[0] === 'trouble')); }
  function outcomeComment(y) {
    const [key, value] = changes(y)[0] || [];
    return !key ? 'Y aquí sigo, igual que siempre.'
      : key === 'money' ? (value > 0 ? '¡Más dinero en el bolsillo!' : 'Mi cartera está llorando.')
      : key === 'fame' ? (value > 0 ? 'Ya me reconocen por la calle.' : 'Mi fama ha bajado un poquito.')
      : key === 'energy' ? (value > 0 ? 'Estoy como nuevo.' : 'Estoy reventado.')
      : (value > 0 ? 'Me he metido en un buen lío.' : 'Menos líos, más paz.');
  }
  function outcomeLine(y) { return `Salió «${y.choice}». ${outcomeComment(y)}`; }
  function good(y) { return (Number(y.money) || 0) + (Number(y.fame) || 0) + (Number(y.energy) || 0) - (Number(y.trouble) || 0) >= 0; }
  // Each change gets its own picture: coins, flashes, sweat, lightning…
  function replay(y) {
    let delay = 500;
    for (const [key, value] of changes(y)) {
      const kinds = key === 'money' ? (value > 0 ? [['coin', 14]] : [['drop', 8]])
        : key === 'fame' ? (value > 0 ? [['flash'], ['star', 8]] : [['drop', 5]])
        : key === 'energy' ? (value > 0 ? [['star', 6]] : [['sweat', 6]])
        : value > 0 ? [['bolt', 3], ['shake']] : [['heart', 6]];
      setTimeout(() => { if (dialog?.open && showing === 'yesterday') kinds.forEach(([kind, count]) => burst(kind, count)); }, delay);
      delay += 650;
    }
  }

  function untilTomorrow() {
    const now = new Date(), next = new Date(now);
    next.setHours(24, 0, 0, 0);
    const minutes = Math.max(1, Math.round((next - now) / 60000));
    return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
  }
  // Your vote on each chapter, kept on this device to tell you later whether
  // the club went your way.
  const MY_VOTES = 'bb-chota-my-votes-v1';
  const myVotes = () => { try { return JSON.parse(localStorage.getItem(MY_VOTES) || '{}'); } catch { return {}; } };
  function saveMyVote(title, label) { try { const all = myVotes(); all[title] = label; localStorage.setItem(MY_VOTES, JSON.stringify(all)); } catch {} }
  const lock = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  // One simple flow: read, pick, confirm. Once confirmed the choice is final.
  function todayCard(today) {
    const voted = today.mine != null;
    if (!voted) {
      const picked = today.options.find(o => o.i === choice);
      return `<p class="chd-situation">${esc(today.body)}</p>
        <h3 class="chd-ask">¿Qué hace el Chota?</h3>
        <ul class="chd-options">${today.options.map((o, index) => `<li><button type="button" class="chd-option" data-cd-pick="${o.i}" aria-pressed="${choice === o.i}"${voting ? ' disabled' : ''}><span class="chd-option-key" aria-hidden="true">${'ABC'[index] || index + 1}</span><span class="chd-option-label">${esc(o.label)}</span></button></li>`).join('')}</ul>
        ${picked ? `<div class="chd-confirm" role="group" aria-label="Confirmar tu decisión"><p>Vas a elegir <strong>«${esc(picked.label)}»</strong>. No podrás cambiarla.</p><div><button type="button" class="chd-secondary" data-cd-cancel>Volver</button><button type="button" class="chd-primary" data-cd-confirm${voting ? ' disabled' : ''}>${voting ? 'Guardando…' : 'Elegir'}</button></div></div>`
          : '<p class="chd-note">Piénsalo bien: tu decisión es final.</p>'}`;
    }
    const total = today.options.reduce((sum, o) => sum + (Number(o.votes) || 0), 0);
    const top = Math.max(...today.options.map(o => Number(o.votes) || 0));
    const mine = today.options.find(o => o.i === today.mine);
    const results = today.options.map(o => {
      const votes = Number(o.votes) || 0, share = total ? Math.round(votes / total * 100) : 0;
      const leads = today.twisted ? o.i === 1 : votes === top && votes > 0;
      return `<li class="chd-result${o.i === today.mine ? ' is-mine' : ''}"><div><span>${esc(o.label)}</span>${o.i === today.mine ? '<em>Tu voto</em>' : ''}${leads ? `<em class="is-lead">${today.twisted ? 'Ganará por el giro' : 'Va ganando'}</em>` : ''}</div><strong>${share}%</strong><i style="--share:${share}%"></i><small>${votes} ${votes === 1 ? 'voto' : 'votos'}</small></li>`;
    }).join('');
    const twist = today.twisted ? '<p class="chd-note">Alguien ha soltado un giro: hoy ganará la segunda opción.</p>'
      : story.twist ? '<button type="button" class="chd-secondary chd-twist" data-cd-twist>Soltar mi giro</button>' : '';
    return `<div class="chd-mine">${lock}<div><small>Tu decisión · final</small><strong>«${esc(mine?.label || '')}»</strong></div></div>
      <h3 class="chd-ask">Así va la votación</h3>
      <ul class="chd-results">${results}</ul>
      <p class="chd-note">${total} ${total === 1 ? 'miembro ha votado' : 'miembros han votado'}.</p>
      ${twist}
      <p class="chd-countdown" aria-live="off">Se sabrá qué pasa en <strong>${untilTomorrow()}</strong></p>`;
  }
  function yesterdayCard(y) {
    const mine = myVotes()[y.title];
    const verdict = !mine ? '' : mine === y.choice ? `<p class="chd-verdict is-hit">Votaste «${esc(mine)}» y salió. ¡Acertaste!</p>` : `<p class="chd-verdict">Votaste «${esc(mine)}», pero salió otra cosa.</p>`;
    return `<p class="chd-situation">${esc(y.result)}</p>
      <div class="chd-mine is-past">${lock}<div><small>Ganó</small><strong>«${esc(y.choice)}»</strong></div></div>
      ${verdict}
      <p class="chd-note">${y.votes ? `${y.votes} ${y.votes === 1 ? 'voto' : 'votos'}` : 'Nadie votó y lo decidió el Chota'}.${y.twist ? ' Hubo un giro.' : ''}</p>`;
  }

  function render(fresh = false) {
    if (!dialog) return;
    story = snapshot() || story;
    const content = dialog.querySelector('.chd-content');
    if (!story?.today) {
      dialog.querySelector('.chd-title').textContent = 'El Chota';
      dialog.querySelector('.chd-kicker').textContent = 'La sede del club';
      content.innerHTML = '<p class="chd-body">El Chota está preparando la historia. Vuelve en un rato.</p>';
      return;
    }
    const {season, today, yesterday} = story;
    const past = showing === 'yesterday' && yesterday;
    const entry = past ? yesterday : today;
    const key = scenes.keyFor(entry);
    dialog.querySelector('.chd-kicker').textContent = `Temporada ${season?.number || 1} · Día ${past ? Math.max(1, (season?.day || 2) - 1) : season?.day || 1} · ${mood(season)}`;
    dialog.querySelector('.chd-title').textContent = entry.title;
    dialog.querySelector('.chd-tabs').innerHTML = yesterday
      ? `<button type="button" data-cd-show="today" aria-pressed="${!past}">Hoy</button><button type="button" data-cd-show="yesterday" aria-pressed="${Boolean(past)}">Lo que pasó ayer</button>` : '';
    dialog.querySelector('.chd-meters').innerHTML = meterMarkup(season, past ? yesterday : {});
    content.innerHTML = `${past ? yesterdayCard(yesterday) : todayCard(today)}
      <p class="chd-note chd-streak">Racha: ${Number(story.streak) || 0} · Mejor: ${Number(story.best) || 0}</p>
      ${notice ? `<p class="chd-note" role="status">${esc(notice)}</p>` : ''}`;
    if (!fresh) return;
    void paint(key);
    dialog.querySelector('.chd-fxs').innerHTML = reduced.matches ? '' : fxMarkup(key);
    countMeters();
    const scene = scenes.scenes[key];
    clearTimeout(nudgeTimer);
    if (past) {
      actor.moveTo(0);
      actor.say(outcomeLine(yesterday), good(yesterday) ? 'cheer' : 'sit');
      replay(yesterday);
    } else if (today.mine != null) {
      actor.say(`Elegiste «${today.options.find(o => o.i === today.mine)?.label || ''}». Ya no hay vuelta atrás: esta noche sabremos qué pasa.`, 'wave');
    } else {
      actor.say(scene?.intro || today.body, 'greet', () => {
        actor.think(true);
        nudgeTimer = setTimeout(() => { if (dialog?.open && pending() && showing === 'today' && !voting) actor.say(pick(nudges), 'wave', () => actor.think(true)); }, 9000);
      });
    }
  }

  function build() {
    dialog = document.createElement('dialog');
    dialog.id = 'chotaDecision';
    dialog.className = 'chd-dialog';
    dialog.setAttribute('aria-labelledby', 'chotaDecisionTitle');
    dialog.innerHTML = `<div class="chd-sheet">
      <header class="chd-head"><div><small class="chd-kicker"></small><h2 class="chd-title" id="chotaDecisionTitle"></h2></div>
        <button type="button" class="chd-close" data-cd-close aria-label="Cerrar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></header>
      <div class="chd-tabs"></div>
      <figure class="chd-stage">
        <canvas class="chd-scene" width="192" height="120" role="img" aria-label="Escena del día del Chota"></canvas>
        <div class="chd-fxs" aria-hidden="true"></div>
        <span class="chd-actor" aria-hidden="true"><i class="chd-shadow"></i><span class="chd-chota"><i class="chd-think">?</i></span></span>
        <div class="chd-burst" aria-hidden="true"></div>
      </figure>
      <div class="chd-bubble" role="status" aria-live="polite"><span class="chd-ghost" aria-hidden="true">…</span><span class="chd-line" aria-hidden="true"></span></div>
      <ul class="chd-meters" aria-label="Cómo está el Chota"></ul>
      <div class="chd-content"></div>
    </div>`;
    document.body.append(dialog);
    dialog.addEventListener('click', event => {
      if (event.target === dialog || event.target.closest('[data-cd-close]')) { dialog.close(); return; }
      const show = event.target.closest('[data-cd-show]');
      if (show && show.dataset.cdShow !== showing) { showing = show.dataset.cdShow; notice = ''; render(true); return; }
      const option = event.target.closest('[data-cd-pick]');
      if (option && !option.disabled) pickOption(Number(option.dataset.cdPick));
      if (event.target.closest('[data-cd-cancel]')) { choice = null; actor.moveTo(0); render(); }
      const confirm = event.target.closest('[data-cd-confirm]');
      if (confirm && !confirm.disabled && choice != null) void castVote(choice);
      if (event.target.closest('[data-cd-twist]')) void twist();
      if (event.target.closest('.chd-actor')) { actor.say(pick(quips), 'jump'); }
      else if (event.target.closest('.chd-scene')) actor.play('jump');
    });
    // Pressing an option, he takes a step towards the day's object.
    const lean = event => {
      if (!event.target.closest?.('[data-cd-pick]') || voting || showing !== 'today') return;
      actor.moveTo(event.type === 'pointercancel' ? 0 : 10);
    };
    dialog.addEventListener('pointerdown', lean);
    dialog.addEventListener('pointercancel', lean);
    dialog.addEventListener('close', () => {
      actor.stop(); clearInterval(clock); clearTimeout(nudgeTimer);
      document.body.classList.remove('chota-decision-open');
      (trigger?.isConnected ? trigger : document.querySelector('[data-chota-decision]'))?.focus({preventScroll: true});
      trigger = null;
      // Back in the sede, he reacts to the vote that was just cast.
      if (lastVoteLabel) { const label = lastVoteLabel; lastVoteLabel = ''; setTimeout(() => globalThis.ChotaRoom?.say(`Decidido: «${label}». Esta noche os cuento qué pasa.`, 'celebrate'), 450); }
      syncRoom(story);
    });
  }

  // Picking only previews; he asks if you are sure before the vote is cast.
  function pickOption(option) {
    const today = story?.today;
    if (!today || today.mine != null || voting) return;
    choice = option;
    const label = today.options.find(o => o.i === option)?.label || '';
    actor.say(`¿«${label}»? Piénsalo, que luego no hay vuelta atrás.`, 'wave');
    render();
    dialog.querySelector('[data-cd-confirm]')?.focus({preventScroll: true});
  }
  async function castVote(option) {
    const today = story?.today;
    if (!today || voting || today.mine != null) return;
    const first = true, same = false;
    const label = today.options.find(o => o.i === option)?.label || '';
    voting = true; notice = ''; render();
    clearTimeout(nudgeTimer);
    const scene = scenes.scenes[scenes.keyFor(today)];
    actor.moveTo(26, () => {
      actor.say(scene?.react?.[option] || 'Decidido.', 'cheer', () => actor.moveTo(8));
      burst('star', 10);
      if (first) setTimeout(() => burst('coin', 8), 240);
    });
    const ok = same || await globalThis.ClubPlus?.storyVote?.(today.id, option);
    voting = false;
    if (ok && !same) { lastVoteLabel = label; saveMyVote(today.title, label); if (first) reward('+2 monedas'); }
    choice = null;
    notice = ok ? '' : globalThis.ClubPlus?.lastNotice?.() || 'No se ha podido guardar el voto.';
    render();
  }
  async function twist() {
    const today = story?.today;
    if (!today || voting) return;
    voting = true; render();
    const ok = await globalThis.ClubPlus?.storyTwist?.(today.id);
    voting = false;
    if (ok) { actor.say('¡Giro soltado! Hoy pasa lo inesperado.', 'cheer'); burst('bolt', 2); burst('shake'); }
    else notice = globalThis.ClubPlus?.lastNotice?.() || 'No se ha podido soltar el giro.';
    render();
  }

  async function open(from = null) {
    // The Chota's decisions rest with him at night, whichever button asks.
    if (globalThis.ChotaRoom?.sleeping?.()) return;
    if (!dialog) build();
    if (dialog.open) return;
    trigger = from;
    showing = 'today'; notice = ''; lastVoteLabel = ''; choice = null;
    // The saved story only paints the sede; votes always need today's real one.
    if (!globalThis.ClubPlus?.snapshot?.()) await globalThis.ClubPlus?.refresh?.();
    story = globalThis.ClubPlus?.snapshot?.()?.story || story;
    document.body.classList.add('chota-decision-open');
    dialog.showModal();
    actor.stop();
    fitActor();
    actor.wear();
    actor.frame(0);
    dialog.querySelector('.chd-ghost').textContent = '…';
    dialog.querySelector('.chd-line').textContent = '';
    dialog.querySelector('.chd-fxs').innerHTML = '';
    dialog.querySelector('.chd-burst').innerHTML = '';
    render(false);
    if (story?.today) {
      void paint(scenes.keyFor(story.today));
      actor.walkIn(() => render(true));
    }
    clearInterval(clock);
    clock = setInterval(() => { const node = dialog.querySelector('.chd-countdown strong'); if (node) node.textContent = untilTomorrow(); }, 30000);
    dialog.querySelector('[data-cd-close]').focus({preventScroll: true});
  }

  // ——— The sede ———
  const letter = `<svg viewBox="0 0 22 16" shape-rendering="crispEdges" aria-hidden="true"><rect x="0" y="1" width="22" height="15" fill="#1a1410"/><rect x="1" y="2" width="20" height="13" fill="#efe6d0"/><polygon class="chota-letter-flap" points="1,2 11,10 21,2" fill="#d8ccb0" stroke="#1a1410" stroke-width="1"/><rect x="9" y="8" width="4" height="4" fill="#b8332a"/></svg>`;
  const moodIcons = {
    money: '<svg viewBox="0 0 12 12" shape-rendering="crispEdges"><rect x="2" y="1" width="8" height="10" fill="#1a1410"/><rect x="1" y="2" width="10" height="8" fill="#1a1410"/><rect x="3" y="2" width="6" height="8" fill="#f2c14e"/><rect x="2" y="3" width="8" height="6" fill="#f2c14e"/><rect x="5" y="3" width="2" height="6" fill="#c99a2e"/></svg>',
    broke: '<svg viewBox="0 0 12 12" shape-rendering="crispEdges"><rect x="1" y="3" width="10" height="7" fill="#1a1410"/><rect x="2" y="4" width="8" height="5" fill="#7a4a2a"/><rect x="4" y="1" width="1" height="2" fill="#9aa3ad"/><rect x="7" y="0" width="1" height="2" fill="#9aa3ad"/></svg>',
    fame: '<svg viewBox="0 0 12 12" shape-rendering="crispEdges"><polygon points="6,0 7.5,4 12,4.4 8.5,7 9.6,11.5 6,9 2.4,11.5 3.5,7 0,4.4 4.5,4" fill="#f2c14e" stroke="#1a1410" stroke-width=".8"/></svg>',
    tired: '<svg viewBox="0 0 12 12" shape-rendering="crispEdges"><rect x="1" y="1" width="6" height="1.6" fill="#f3ead8"/><polygon points="7,2.6 1,8.4 3,8.4 7,4" fill="#f3ead8"/><rect x="1" y="7" width="6" height="1.6" fill="#f3ead8"/><rect x="7" y="7" width="4" height="1.2" fill="#9fbbe6"/><polygon points="11,8 8,11 9.5,11 11,9.3" fill="#9fbbe6"/><rect x="8" y="10.4" width="3" height="1" fill="#9fbbe6"/></svg>',
    trouble: '<svg viewBox="0 0 12 12" shape-rendering="crispEdges"><polygon points="7,0 2,7 5.5,7 4,12 10,4.5 6.5,4.5 8.5,0" fill="#f2c14e" stroke="#1a1410" stroke-width=".8"/></svg>',
  };
  function moodKind(season) {
    if (!season) return '';
    if (season.trouble >= 60) return 'trouble';
    if (season.energy <= 35) return 'tired';
    if (season.money >= 65) return 'money';
    if (season.money <= 30) return 'broke';
    if (season.fame >= 65) return 'fame';
    return '';
  }
  // The day's object stands on the sede floor, cropped from its scene.
  const propCache = new Map();
  async function propCanvas(name) {
    if (!propCache.has(name)) propCache.set(name, (async () => {
      const ns = 'http://www.w3.org/2000/svg', probe = document.createElementNS(ns, 'svg');
      probe.setAttribute('width', '192'); probe.setAttribute('height', '120');
      probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden';
      probe.innerHTML = `<g>${scenes.propSvg(name)}</g>`;
      document.body.append(probe);
      let box;
      try { box = probe.firstElementChild.getBBox(); } finally { probe.remove(); }
      if (!box?.width) return null;
      const x = Math.floor(box.x) - 1, y = Math.floor(box.y) - 1, w = Math.ceil(box.width) + 3, h = Math.ceil(box.height) + 3;
      const image = await svgImage(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}" shape-rendering="crispEdges">${scenes.propSvg(name)}</svg>`);
      return image && {image, w, h};
    })());
    return propCache.get(name);
  }
  async function drawProp(canvas, name) {
    const drawn = name ? await propCanvas(name) : null;
    if (!drawn || !canvas.isConnected) return;
    canvas.width = drawn.w; canvas.height = drawn.h;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, drawn.w, drawn.h);
    context.drawImage(drawn.image, 0, 0);
  }

  // The day's dilemma hangs from the ceiling beam in the top-left corner: a small
  // wooden sign with the day's object and its state, swinging while you have
  // not voted yet.
  function placeSign(room, data) {
    let sign = room.querySelector('.chota-decision-sign');
    if (!data?.today) { sign?.remove(); return; }
    if (!sign) {
      sign = document.createElement('button');
      sign.type = 'button';
      sign.className = 'chota-decision-sign';
      sign.dataset.chotaDecision = '';
      sign.innerHTML = '<i class="cds-rope cds-rope--left"></i><i class="cds-rope cds-rope--right"></i><span class="cds-board"><small>Dilema del día</small><canvas class="cds-thumb"></canvas></span><b class="cds-status"></b>';
      room.append(sign);
    }
    const key = scenes.keyFor(data.today), name = scenes.mainProp(key), waiting = pending(data);
    if (sign.dataset.prop !== name) { sign.dataset.prop = name; void drawProp(sign.querySelector('.cds-thumb'), name); }
    sign.classList.toggle('is-pending', waiting);
    sign.querySelector('.cds-status').textContent = waiting ? '¡Vota!' : 'Votado';
    sign.setAttribute('aria-label', `${waiting ? 'Dilema del día pendiente' : 'Dilema del día'}: ${data.today.title}`);
  }

  // The drawer: the chest on the low cabinet keeps every day's object with what
  // happened. The club's story has no history endpoint, so each device collects
  // the days it sees, from today's and yesterday's chapters.
  const DRAWER_KEY = 'bb-chota-drawer-v1', DRAWER_SEEN = 'bb-chota-drawer-seen-v1';
  const store = {
    read(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } },
    write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
  };
  function remember(data) {
    const season = data?.season;
    if (!season?.number || !data.today) return;
    const list = store.read(DRAWER_KEY, []);
    const put = entry => {
      const index = list.findIndex(item => item.id === entry.id);
      if (index < 0) list.push(entry); else list[index] = {...list[index], ...entry};
    };
    put({id: `${season.number}-${season.day}`, season: season.number, day: season.day, title: data.today.title, key: scenes.keyFor(data.today)});
    const y = data.yesterday;
    if (y && season.day > 1) put({id: `${season.number}-${season.day - 1}`, season: season.number, day: season.day - 1, title: y.title, key: scenes.keyFor(y), choice: y.choice, result: y.result, good: good(y), deltas: {money: y.money, fame: y.fame, energy: y.energy, trouble: y.trouble}});
    list.sort((p, q) => q.season - p.season || q.day - p.day);
    store.write(DRAWER_KEY, list.slice(0, 120));
  }
  const kept = () => store.read(DRAWER_KEY, []).filter(item => item.choice);
  function placeDrawer(room) {
    let drawer = room.querySelector('.chota-drawer');
    if (!drawer) {
      drawer = document.createElement('button');
      drawer.type = 'button';
      drawer.className = 'chota-drawer';
      drawer.dataset.chotaDrawer = '';
      drawer.innerHTML = '<i class="chota-drawer-glint"></i><b class="chota-drawer-badge"></b>';
      room.append(drawer);
    }
    const count = kept().length, fresh = Math.max(0, count - (Number(store.read(DRAWER_SEEN, 0)) || 0));
    drawer.classList.toggle('has-new', fresh > 0);
    drawer.querySelector('.chota-drawer-badge').textContent = fresh ? `+${fresh}` : '';
    drawer.setAttribute('aria-label', `El cajón del Chota: ${count} ${count === 1 ? 'objeto guardado' : 'objetos guardados'}${fresh ? `, ${fresh} nuevo${fresh === 1 ? '' : 's'}` : ''}`);
  }

  // How the Chota is doing shows in the room: papers everywhere when he is in
  // trouble, a blanket on the bean bag when he is worn out, a gold star on the
  // photo and press flashes at the window when he is famous.
  const decorArt = {
    papers: '<svg viewBox="0 0 44 14" shape-rendering="crispEdges"><polygon points="2,9 13,6 15,12 4,14" fill="#efe6d0" stroke="#1a1410" stroke-width=".8"/><polygon points="12,4 24,3 24,10 12,11" fill="#f6f0df" stroke="#1a1410" stroke-width=".8"/><rect x="14" y="5" width="7" height="1" fill="#b9ad94"/><rect x="14" y="7" width="8" height="1" fill="#b9ad94"/><polygon points="26,6 38,8 36,13 25,11" fill="#e2d7bc" stroke="#1a1410" stroke-width=".8"/><polygon points="26,6 31,10 38,8" fill="#d2c4a2" stroke="#1a1410" stroke-width=".6"/><rect x="30" y="9" width="2" height="2" fill="#b8332a"/><polygon points="36,2 43,4 41,8 35,6" fill="#f3ead8" stroke="#1a1410" stroke-width=".8"/><rect x="37" y="4" width="3" height="1" fill="#e5654a"/></svg>',
    blanket: '<svg viewBox="0 0 32 14" shape-rendering="crispEdges"><polygon points="1,3 30,1 31,9 27,12 3,13 0,8" fill="#3a5f9e" stroke="#1a1410" stroke-width=".8"/><rect x="4" y="3" width="2" height="9" fill="#e8c9a0"/><rect x="12" y="2" width="2" height="10" fill="#e8c9a0"/><rect x="20" y="2" width="2" height="10" fill="#e8c9a0"/><rect x="27" y="2" width="2" height="9" fill="#e8c9a0"/><rect x="3" y="12" width="1" height="2" fill="#e8c9a0"/><rect x="7" y="12" width="1" height="2" fill="#e8c9a0"/><rect x="11" y="12" width="1" height="2" fill="#e8c9a0"/><rect x="15" y="12" width="1" height="2" fill="#e8c9a0"/><rect x="19" y="12" width="1" height="2" fill="#e8c9a0"/><rect x="23" y="12" width="1" height="2" fill="#e8c9a0"/></svg>',
    star: '<svg viewBox="0 0 12 12" shape-rendering="crispEdges"><polygon points="6,0 7.6,4 12,4.4 8.6,7.2 9.8,11.8 6,9.2 2.2,11.8 3.4,7.2 0,4.4 4.4,4" fill="#f2c14e" stroke="#1a1410" stroke-width=".8"/><rect x="5" y="3" width="1" height="2" fill="#fff3b0"/></svg>',
  };
  function placeDecor(room, season) {
    let layer = room.querySelector(':scope > .chota-statdecor');
    if (!season) { layer?.remove(); return; }
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'chota-statdecor';
      layer.setAttribute('aria-hidden', 'true');
      layer.innerHTML = Object.entries(decorArt).map(([kind, svg]) => `<span class="chota-decor chota-decor--${kind}">${svg}</span>`).join('');
      room.append(layer);
    }
    layer.classList.toggle('show-papers', season.trouble >= 60);
    layer.classList.toggle('show-blanket', season.energy <= 35);
    layer.classList.toggle('show-star', season.fame >= 65);
    room.classList.toggle('chota-is-famous', season.fame >= 65);
  }
  let pressTimer = 0;
  function pressFlash() {
    clearTimeout(pressTimer);
    pressTimer = setTimeout(pressFlash, 25000 + Math.random() * 30000);
    if (reduced.matches || document.hidden) return;
    document.querySelectorAll('.clubhouse-room.chota-is-famous.is-in-view, dialog[open] .chota-viewer-room-scene.chota-is-famous').forEach(room => {
      const sky = room.querySelector('.clubhouse-sky');
      if (!sky) return;
      const flash = document.createElement('i');
      flash.className = 'chota-press-flash';
      flash.style.setProperty('--x', `${20 + Math.random() * 60}%`);
      flash.style.setProperty('--y', `${55 + Math.random() * 35}%`);
      sky.append(flash);
      flash.addEventListener('animationend', () => flash.remove(), {once: true});
    });
  }

  function syncRoom(data = story) {
    if (data) remember(data);
    document.querySelectorAll('.clubhouse-room').forEach(room => {
      placeJar(room, data?.season);
      placeDecor(room, data?.season);
      placeDrawer(room);
      room.querySelectorAll('.chota-decision-letter, .chota-decision-prop').forEach(node => node.remove());
      placeSign(room, data);
      if (!data?.today) { room.querySelectorAll('.chota-decision-mark,.chota-mood').forEach(node => node.remove()); return; }
      const waiting = pending(data);
      watchSleep(room);
      const pet = room.querySelector('.clubhouse-pet');
      let mark = room.querySelector('.chota-decision-mark');
      if (waiting && pet && !mark) {
        mark = document.createElement('span');
        mark.className = 'chota-decision-mark';
        mark.setAttribute('aria-hidden', 'true');
        mark.textContent = '!';
        pet.append(mark);
      } else if (!waiting) mark?.remove();
      syncSleep(room);
    });
    syncViewer(data);
    scheduleRoomTalk();
  }
  // His money jar sits on the floor behind the bottom-right plant and fills with
  // coins, then notes, as his money (0–100) grows. Drawn on a 14×18 pixel grid.
  function jarSvg(money) {
    const value = Math.max(0, Math.min(100, Number(money) || 0));
    // Glass silhouette: a narrow neck, round shoulders and a rounded base.
    const inside = (x, y) => (y >= 3 && y <= 4 && x >= 4 && x <= 9) || (y === 5 && x >= 3 && x <= 10) || (y >= 6 && y <= 15 && x >= 2 && x <= 11) || (y === 16 && x >= 3 && x <= 10);
    const level = Math.round(value / 100 * 13), top = 17 - level, cells = [];
    const notes = [['#c9e6b4', '#7fbf6a', '#3f7a3a'], ['#f6d2a6', '#e0954a', '#a8622a']];
    const px = (x, y, fill, w = 1, h = 1, alpha = 1) => cells.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${alpha < 1 ? ` fill-opacity="${alpha}"` : ''}/>`);
    for (let y = 2; y <= 17; y++) for (let x = 1; x <= 12; x++) {
      if (inside(x, y)) {
        if (y >= top) {
          // Stacked banknotes: green notes five pixels wide, a dark line under each
          // layer, a lighter middle on each note and now and then an orange one.
          const layer = Math.floor((16 - y) / 2), shift = (layer * 3) % 5, note = Math.floor((x + shift) / 5);
          const [light, mid, dark] = notes[(layer * 7 + note * 3) % 5 === 0 ? 1 : 0];
          const under = (16 - y) % 2 === 0, gap = (x + shift) % 5 === 0;
          px(x, y, under ? dark : gap ? dark : (x + shift) % 5 === 2 ? light : mid);
        } else px(x, y, x === 11 ? '#8fbcd9' : '#cfe6ff', 1, 1, x === 11 ? .55 : .22);
      } else if ([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inside(x + dx, y + dy))) px(x, y, '#1a1410');
    }
    // An empty jar has a moth; a full one spills notes over the rim.
    if (value <= 10) { px(5, 13, '#9aa3ad'); px(6, 12, '#c9ced4', 2); px(8, 13, '#9aa3ad'); }
    if (value >= 90) {
      // Too many notes: they stick out of the open neck in a little fan.
      px(3, 0, '#3f7a3a', 3, 1); px(3, 1, '#7fbf6a', 3, 2); px(4, 1, '#c9e6b4');
      px(6, 0, '#3f7a3a', 2, 1); px(6, 1, '#9ad081', 2, 2);
      px(8, 0, '#a8622a', 3, 1); px(8, 1, '#e0954a', 3, 2); px(9, 1, '#f6d2a6');
    }
    else { px(3, 0, '#1a1410', 8); px(3, 1, '#8a5a32', 8); px(4, 1, '#a8703f', 6); }
    // Shine on the glass, shorter as it fills.
    for (let y = 6; y < Math.min(13, top); y++) px(3, y, '#ffffff', 1, 1, .85);
    return `<svg viewBox="0 0 14 18" shape-rendering="crispEdges" aria-hidden="true"><g opacity=".98">${cells.join('')}</g></svg>`;
  }
  function placeJar(room, season) {
    let zone = room.querySelector('.chota-jar-zone');
    if (!season) { zone?.remove(); return; }
    if (!zone) {
      zone = document.createElement('div');
      zone.className = 'chota-jar-zone';
      zone.innerHTML = '<span class="chota-jar" role="img"></span>';
      room.append(zone);
    }
    const jar = zone.querySelector('.chota-jar'), money = Math.max(0, Math.min(100, Number(season.money) || 0));
    if (jar.dataset.money === String(money)) return;
    const before = jar.dataset.money;
    jar.dataset.money = String(money);
    jar.innerHTML = jarSvg(money);
    jar.setAttribute('aria-label', `Bote del Chota: ${money} de 100 de dinero`);
    if (before != null && !reduced.matches) { jar.classList.remove('is-clinking'); void jar.offsetWidth; jar.classList.add('is-clinking'); }
  }

  // The enlarged room (the Chota viewer) shows the same jar and day's object,
  // as decoration only: it is built once and opened as a dialog.
  function syncViewer(data = story) {
    document.querySelectorAll('.chota-viewer-room-scene').forEach(scene => {
      placeJar(scene, data?.season);
      placeDecor(scene, data?.season);
      scene.querySelector('.chota-decision-prop')?.remove();
    });
  }
  new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node.id !== 'chotaViewer') continue;
      new MutationObserver(() => { if (node.open) syncViewer(story || snapshot()); }).observe(node, {attributes: true, attributeFilter: ['open']});
      if (node.open) syncViewer(story || snapshot());
    }
  }).observe(document.body, {childList: true});

  // While the Chota sleeps the letter and the object can't be opened.
  const sleepWatched = new WeakSet();
  let lastAsleep = null;
  function syncSleep(room) {
    const asleep = room.classList.contains('is-sleeping');
    // Hoy en el club repaints its Chota row when he falls asleep or wakes up.
    if (asleep !== lastAsleep) { lastAsleep = asleep; globalThis.ClubDay?.paintEntry?.(); }
    const sign = room.querySelector('.chota-decision-sign');
    if (sign) {
      sign.disabled = asleep;
      sign.classList.toggle('is-asleep', asleep);
      if (asleep) { sign.setAttribute('aria-label', 'Dilema del día: el Chota está durmiendo'); sign.querySelector('.cds-status').textContent = 'Zzz'; }
      else if (story?.today) placeSign(room, story);
    }
  }
  function watchSleep(room) {
    if (sleepWatched.has(room)) return;
    sleepWatched.add(room);
    new MutationObserver(() => syncSleep(room)).observe(room, {attributes: true, attributeFilter: ['class']});
  }
  // Now and then a mood icon pops over his head; the first time the sede is seen
  // today he tells yesterday's outcome and asks for help with the new dilemma.
  let moodTimer = 0, talkTimer = 0;
  function liveRoom() {
    const room = document.querySelector('#clubhouseContent .clubhouse-room');
    return room?.classList.contains('is-in-view') && !room.classList.contains('is-sleeping') && !document.hidden && !dialog?.open && !globalThis.ChotaRoom?.sleeping?.() ? room : null;
  }
  function showMood() {
    clearTimeout(moodTimer);
    moodTimer = setTimeout(showMood, 22000 + Math.random() * 16000);
    const room = liveRoom(), kind = moodKind(story?.season);
    if (!room || !kind || reduced.matches || room.querySelector('.chota-decision-mark')) return;
    const pet = room.querySelector('.clubhouse-pet');
    if (!pet || pet.querySelector('.chota-mood')) return;
    const bubble = document.createElement('span');
    bubble.className = `chota-mood chota-mood--${kind}`;
    bubble.setAttribute('aria-hidden', 'true');
    bubble.innerHTML = moodIcons[kind];
    pet.append(bubble);
    setTimeout(() => bubble.remove(), 2800);
  }
  function scheduleRoomTalk() {
    clearTimeout(talkTimer);
    if (!story?.today) return;
    talkTimer = setTimeout(roomTalk, 2600);
  }
  function roomTalk() {
    if (!liveRoom()) { talkTimer = setTimeout(roomTalk, 6000); return; }
    const y = story?.yesterday, today = story?.today;
    const yesterdayKey = y ? `bb-chota-told-${y.title}-${story.season?.day}` : '', hookKey = today ? `bb-chota-hook-${today.id}` : '';
    if (y && !session.get(yesterdayKey)) {
      if (globalThis.ChotaRoom?.say(`Ayer salió «${y.choice}». ${outcomeComment(y)}`, good(y) ? 'celebrate' : 'doze')) session.set(yesterdayKey);
      talkTimer = setTimeout(roomTalk, 9000);
      return;
    }
    // A new object in the drawer gets a mention once.
    const fresh = kept().length - (Number(store.read(DRAWER_SEEN, 0)) || 0), newest = kept()[0];
    if (fresh > 0 && newest && !session.get(`bb-chota-drawer-told-${newest.id}`)) {
      if (globalThis.ChotaRoom?.say(`He guardado «${newest.title}» en el cajón del mueble. Tócalo y lo ves.`, 'nod')) session.set(`bb-chota-drawer-told-${newest.id}`);
      talkTimer = setTimeout(roomTalk, 9000);
      return;
    }
    if (pending() && !session.get(hookKey)) {
      if (globalThis.ChotaRoom?.say(`Tengo un dilema: «${today.title}». Mira el cartel de arriba.`, 'nod')) session.set(hookKey);
    }
  }

  // The drawer's own sheet, in the Repetidas look: the Chota shows what he kept.
  let drawerDialog = null;
  function drawerLine(list, today) {
    const fresh = Math.max(0, list.length - (Number(store.read(DRAWER_SEEN, 0)) || 0));
    if (fresh && list[0]) return ['cheer', `¡Ha entrado «${list[0].title}» en el cajón! Salió «${list[0].choice}».`];
    if (!list.length) return ['wave', today ? `Aquí guardaré los objetos de cada día. El primero será el de «${today.title}».` : 'Aquí guardaré los objetos de cada día.'];
    return ['wave', `${list.length} ${list.length === 1 ? 'objeto guardado' : 'objetos guardados'} y ni uno tirado por la habitación. Soy un tigre ordenado.`];
  }
  function deltaChips(deltas = {}) {
    return [['money', 'Dinero'], ['fame', 'Fama'], ['energy', 'Energía'], ['trouble', 'Líos']].filter(([key]) => Number(deltas[key])).map(([key, label]) => {
      const value = Number(deltas[key]), better = key === 'trouble' ? value < 0 : value > 0;
      return `<span class="cdr-delta ${better ? 'is-better' : 'is-worse'}">${label} ${value > 0 ? '+' : ''}${value}</span>`;
    }).join('');
  }
  function renderDrawer() {
    if (!drawerDialog?.open) return;
    const list = kept(), today = story?.today, [mood, line] = drawerLine(list, today);
    const todayCard = today ? `<article class="eco-card cdr-card is-today"><button type="button" class="eco-art cdr-art" data-cdr-today aria-label="Abrir el dilema de hoy: ${esc(today.title)}"><canvas data-cdr-prop="${esc(scenes.mainProp(scenes.keyFor(today)))}"></canvas><span class="eco-count">Hoy</span></button><h4>${esc(today.title)}</h4><p>${pending() ? 'Aún no has votado' : 'Se decide esta noche'}</p></article>` : '';
    drawerDialog.innerHTML = `<header class="eco-head"><div><h2 id="chotaDrawerTitle" tabindex="-1">El cajón del Chota</h2></div><button type="button" class="eco-close" data-cdr-close aria-label="Cerrar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>
      <div class="dup-chota eco-chota" data-mood="${mood}"><i class="dup-chota-sprite" aria-hidden="true"></i><p>${esc(line)}</p></div>
      <div class="eco-grid cdr-grid">${todayCard}${list.map(item => `<article class="eco-card cdr-card ${item.good ? 'is-good' : 'is-bad'}"><div class="eco-art cdr-art"><canvas data-cdr-prop="${esc(scenes.mainProp(item.key))}"></canvas><span class="eco-count">Día ${item.day}</span></div><h4>${esc(item.title)}</h4><p>Salió «${esc(item.choice)}»</p><p class="cdr-result">${esc(item.result || '')}</p><div class="cdr-deltas">${deltaChips(item.deltas)}</div></article>`).join('')}</div>
      ${!list.length && !today ? '<p class="eco-empty">El cajón está vacío por ahora.</p>' : ''}`;
    drawerDialog.querySelectorAll('canvas[data-cdr-prop]').forEach(canvas => void drawProp(canvas, canvas.dataset.cdrProp));
  }
  function openDrawer(from) {
    if (!drawerDialog) {
      drawerDialog = document.createElement('dialog');
      drawerDialog.id = 'chotaDrawer';
      drawerDialog.className = 'economy-dialog chota-drawer-dialog';
      drawerDialog.setAttribute('aria-labelledby', 'chotaDrawerTitle');
      document.body.append(drawerDialog);
      drawerDialog.addEventListener('click', event => {
        if (event.target.closest('[data-cdr-close]')) drawerDialog.close();
        if (event.target.closest('[data-cdr-today]')) { drawerDialog.close(); void open(from); }
      });
      drawerDialog.addEventListener('close', () => {
        // What was on screen counts as seen; the chest stops glowing.
        store.write(DRAWER_SEEN, kept().length);
        document.querySelectorAll('.clubhouse-room').forEach(placeDrawer);
        if (drawerDialog._from?.isConnected) drawerDialog._from.focus({preventScroll: true});
      });
    }
    drawerDialog._from = from;
    drawerDialog.showModal();
    renderDrawer();
    drawerDialog.querySelector('h2')?.focus({preventScroll: true});
  }
  document.addEventListener('click', event => {
    const chest = event.target.closest?.('[data-chota-drawer]');
    if (!chest) return;
    event.preventDefault();
    if (!reduced.matches) { chest.classList.remove('is-opening'); void chest.offsetWidth; chest.classList.add('is-opening'); }
    setTimeout(() => openDrawer(chest), reduced.matches ? 0 : 200);
  });

  document.addEventListener('club-story', event => {
    story = event.detail || null;
    syncRoom(story);
    if (dialog?.open && !voting) render();
  });
  document.addEventListener('click', event => {
    const opener = event.target.closest?.('[data-chota-decision]');
    if (!opener || opener.disabled || opener.closest('.clubhouse-room.is-sleeping')) return;
    event.preventDefault();
    // The sign gives a little tug before the scene appears.
    if (opener.classList.contains('chota-decision-sign') && !reduced.matches) { opener.classList.add('is-pulled'); setTimeout(() => { opener.classList.remove('is-pulled'); void open(opener); }, 240); }
    else void open(opener);
  });
  // The room is rebuilt when the agenda or decorations change; put everything back.
  const roomRoot = document.getElementById('clubhouseContent');
  if (roomRoot) new MutationObserver(() => { if (story && !roomRoot.querySelector('.chota-decision-sign')) syncRoom(story); }).observe(roomRoot, {childList: true});
  pressTimer = setTimeout(pressFlash, 12000);
  moodTimer = setTimeout(showMood, 9000);

  globalThis.addEventListener('chota-wardrobe-change',()=>{if(dialog?.open)actor.wear();});
  globalThis.ChotaDecision = Object.freeze({open, openDrawer, sync: () => syncRoom(snapshot())});
})();
