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
  let story = null, dialog = null, showing = 'today', trigger = null, voting = false, notice = '', clock = 0, nudgeTimer = 0, lastVoteLabel = '';
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

  // A small sprite player on the Chota sheets: poses (6×4) and talk (3×1).
  const actor = {
    timer: 0, talkTimer: 0, typing: 0, token: 0, x: 0,
    node() { return dialog?.querySelector('.chd-chota'); },
    frame(index) {
      const node = this.node();
      if (!node) return;
      node.classList.remove('is-talking');
      node.style.backgroundPosition = `${(index % 6) * 20}% ${Math.floor(index / 6) * (100 / 3)}%`;
    },
    stop() { clearInterval(this.timer); clearInterval(this.talkTimer); clearTimeout(this.typing); this.timer = this.talkTimer = this.typing = 0; this.token++; },
    play(name, done) {
      clearInterval(this.timer);
      const frames = sequences[name] || sequences.greet;
      if (reduced.matches) { this.frame(0); done?.(); return; }
      let index = 0;
      this.frame(frames[0]);
      this.node()?.classList.toggle('is-airborne', name === 'jump' || name === 'cheer');
      this.timer = setInterval(() => {
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
      const token = ++this.token;
      clearInterval(this.talkTimer); clearTimeout(this.typing);
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
      clearInterval(this.timer);
      node.classList.add('is-talking');
      let mouth = 0, shown = 0;
      this.talkTimer = setInterval(() => { node.style.backgroundPosition = `${[0, 1, 2, 1][mouth++ % 4] * 50}% 0`; }, 110);
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
  function todayCard(today) {
    const voted = today.mine != null;
    const total = voted ? today.options.reduce((sum, o) => sum + (Number(o.votes) || 0), 0) : 0;
    const options = today.options.map((o, index) => {
      const share = voted && total ? Math.round((Number(o.votes) || 0) / total * 100) : 0;
      return `<li><button type="button" class="chd-option" data-cd-vote="${o.i}" aria-pressed="${today.mine === o.i}"${voting ? ' disabled' : ''}>
        <span class="chd-option-key" aria-hidden="true">${'ABC'[index] || index + 1}</span><span class="chd-option-label">${esc(o.label)}</span>
        ${voted ? `<span class="chd-option-votes">${Number(o.votes) || 0}</span><i class="chd-option-bar" style="--share:${share}%" aria-hidden="true"></i>` : ''}
        ${today.mine === o.i ? '<span class="chd-option-mine">Tu voto</span>' : ''}</button></li>`;
    }).join('');
    const twist = today.twisted ? '<p class="chd-note">Alguien ha soltado un giro: hoy ganará la segunda opción.</p>'
      : story.twist && voted ? '<button type="button" class="chd-secondary" data-cd-twist>Soltar mi giro</button>' : '';
    return `<p class="chd-body">${esc(today.body)}</p>
      <p class="chd-ask">${voted ? 'Puedes cambiar tu voto hasta medianoche.' : '¿Qué debería hacer el Chota?'}</p>
      <ul class="chd-options">${options}</ul>${twist}
      <p class="chd-countdown" aria-live="off">Se sabrá qué pasa en <strong>${untilTomorrow()}</strong></p>`;
  }
  function yesterdayCard(y) {
    return `<p class="chd-body">${esc(y.result)}</p>
      <p class="chd-note">Ganó «${esc(y.choice)}»${y.votes ? '' : ' porque nadie votó'}.${y.twist ? ' Hubo un giro.' : ''}</p>`;
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
      actor.say(`Ya has votado «${today.options.find(o => o.i === today.mine)?.label || ''}». Esta noche sabremos qué pasa.`, 'wave');
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
      const vote = event.target.closest('[data-cd-vote]');
      if (vote && !vote.disabled) void castVote(Number(vote.dataset.cdVote));
      if (event.target.closest('[data-cd-twist]')) void twist();
      if (event.target.closest('.chd-actor')) { actor.say(pick(quips), 'jump'); }
      else if (event.target.closest('.chd-scene')) actor.play('jump');
    });
    // Pressing an option, he takes a step towards the day's object.
    const lean = event => {
      if (!event.target.closest?.('[data-cd-vote]') || voting || showing !== 'today') return;
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

  async function castVote(option) {
    const today = story?.today;
    if (!today || voting) return;
    const first = today.mine == null, same = today.mine === option;
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
    if (ok && !same) { lastVoteLabel = label; if (first) reward('+2 monedas'); }
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
    showing = 'today'; notice = ''; lastVoteLabel = '';
    // The saved story only paints the sede; votes always need today's real one.
    if (!globalThis.ClubPlus?.snapshot?.()) await globalThis.ClubPlus?.refresh?.();
    story = globalThis.ClubPlus?.snapshot?.()?.story || story;
    document.body.classList.add('chota-decision-open');
    dialog.showModal();
    actor.stop();
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
  async function placeProp(room, data) {
    const name = data?.today ? scenes.mainProp(scenes.keyFor(data.today)) : '';
    let holder = room.querySelector('.chota-decision-prop');
    if (!name) { holder?.remove(); return; }
    if (holder?.dataset.prop === name) return;
    const drawn = await propCanvas(name);
    if (!drawn || !room.isConnected) return;
    holder = room.querySelector('.chota-decision-prop');
    // It drops in only when the day's object changes, not on every launch.
    const changed = Boolean(holder?.dataset.prop);
    if (!holder) {
      holder = document.createElement('button');
      holder.type = 'button';
      holder.className = 'chota-decision-prop';
      holder.dataset.chotaDecision = '';
      holder.innerHTML = '<canvas></canvas>';
      room.append(holder);
    }
    holder.dataset.prop = name;
    holder.setAttribute('aria-label', `Objeto del día: ${data.today.title}`);
    const canvas = holder.querySelector('canvas');
    canvas.width = drawn.w; canvas.height = drawn.h;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    context.drawImage(drawn.image, 0, 0);
    // A small object on the stump: at most 6.4% of the room wide and 8% tall.
    holder.style.width = `${Math.min(6.4, 8 * drawn.w / drawn.h).toFixed(2)}%`;
    if (changed) { holder.classList.remove('is-arriving'); void holder.offsetWidth; holder.classList.add('is-arriving'); }
  }
  function syncRoom(data = story) {
    document.querySelectorAll('.clubhouse-room').forEach(room => {
      let button = room.querySelector('.chota-decision-letter');
      placeJar(room, data?.season);
      if (!data?.today) { button?.remove(); room.querySelectorAll('.chota-decision-mark,.chota-decision-prop,.chota-mood').forEach(node => node.remove()); return; }
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'chota-decision-letter';
        button.dataset.chotaDecision = '';
        button.innerHTML = `${letter}<span>Decisión del día</span>`;
        room.append(button);
      }
      const waiting = pending(data);
      button.classList.toggle('is-pending', waiting);
      button.setAttribute('aria-label', `${waiting ? 'Decisión del día pendiente' : 'Decisión del día'}: ${data.today.title}`);
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
      void placeProp(room, data).then(() => syncSleep(room));
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
      if (!data?.today) { scene.querySelector('.chota-decision-prop')?.remove(); return; }
      void placeProp(scene, data).then(() => {
        const prop = scene.querySelector('.chota-decision-prop');
        if (!prop) return;
        prop.tabIndex = -1;
        prop.setAttribute('aria-hidden', 'true');
        delete prop.dataset.chotaDecision;
      });
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
    room.querySelectorAll('.chota-decision-letter, .chota-decision-prop').forEach(button => {
      button.disabled = asleep;
      if (asleep) button.setAttribute('aria-label', 'Decisión del día: el Chota está durmiendo');
    });
    if (!asleep && story?.today) {
      const letterButton = room.querySelector('.chota-decision-letter');
      letterButton?.setAttribute('aria-label', `${pending() ? 'Decisión del día pendiente' : 'Decisión del día'}: ${story.today.title}`);
      room.querySelector('.chota-decision-prop')?.setAttribute('aria-label', `Objeto del día: ${story.today.title}`);
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
    if (pending() && !session.get(hookKey)) {
      if (globalThis.ChotaRoom?.say(`Tengo un dilema: «${today.title}». Mira la carta de la alfombra.`, 'nod')) session.set(hookKey);
    }
  }

  document.addEventListener('club-story', event => {
    story = event.detail || null;
    syncRoom(story);
    if (dialog?.open && !voting) render();
  });
  document.addEventListener('click', event => {
    const opener = event.target.closest?.('[data-chota-decision]');
    if (!opener || opener.disabled || opener.closest('.clubhouse-room.is-sleeping')) return;
    event.preventDefault();
    // The letter flips open before the scene appears.
    if (opener.classList.contains('chota-decision-letter') && !reduced.matches) { opener.classList.add('is-opening'); setTimeout(() => { opener.classList.remove('is-opening'); void open(opener); }, 220); }
    else void open(opener);
  });
  // The room is rebuilt when the agenda or decorations change; put everything back.
  const roomRoot = document.getElementById('clubhouseContent');
  if (roomRoot) new MutationObserver(() => { if (story && !roomRoot.querySelector('.chota-decision-letter')) syncRoom(story); }).observe(roomRoot, {childList: true});
  moodTimer = setTimeout(showMood, 9000);

  globalThis.ChotaDecision = Object.freeze({open, sync: () => syncRoom(snapshot())});
})();
