/* The Chota's daily decision lives in the sede: a letter on the rug opens his
   scene, where he walks in, tells the dilemma in his own words and reacts to
   the vote. Story data and votes still come only from ClubPlus RPCs. */
(() => {
  'use strict';
  const scenes = globalThis.ChotaScenes;
  if (!scenes) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));
  const meters = [['money', 'Dinero'], ['fame', 'Fama'], ['energy', 'Energía'], ['trouble', 'Líos']];
  const sequences = {
    walk: [6, 7, 8, 9, 10, 11, 6, 7, 8, 9, 10, 11],
    greet: [1, 2, 3, 4, 3, 4, 2, 5, 1, 0],
    jump: [12, 13, 14, 15, 14, 16, 17, 0],
    sit: [18, 19, 20, 20, 20, 20, 19, 18, 0],
  };
  let story = null, dialog = null, showing = 'today', trigger = null, voting = false, notice = '';
  const art = new Map();

  function snapshot() { return globalThis.ClubPlus?.snapshot?.()?.story || null; }
  function pending(data = story) { return Boolean(data?.today && data.today.mine == null); }

  // Pixel scenes are drawn small and scaled up without smoothing, like the room.
  function sceneImage(key) {
    if (!art.has(key)) art.set(key, new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(scenes.svg(key))}`;
    }));
    return art.get(key);
  }
  async function paint(key) {
    const canvas = dialog?.querySelector('.chd-scene');
    if (!canvas) return;
    canvas.dataset.scene = key;
    const image = await sceneImage(key);
    if (!image || canvas.dataset.scene !== key) return;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
  }

  // A tiny sprite player on the existing Chota sheets: poses (6×4) and talk (3×1).
  const actor = {
    timer: 0, talkTimer: 0, typing: 0, token: 0,
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
      this.timer = setInterval(() => {
        index++;
        if (index >= frames.length) { clearInterval(this.timer); this.timer = 0; done?.(); return; }
        this.frame(frames[index]);
      }, name === 'walk' ? 90 : 120);
    },
    walkIn(done) {
      const node = this.node();
      if (!node || reduced.matches) { done?.(); return; }
      node.animate([{transform: 'translateX(-70%)'}, {transform: 'translateX(0)'}], {duration: 1050, easing: 'cubic-bezier(.25,.7,.3,1)'});
      this.play('walk', done);
    },
    // Text appears as he says it; his mouth moves until the line is complete.
    say(text, gesture) {
      const bubble = dialog?.querySelector('.chd-bubble');
      const node = this.node();
      if (!bubble || !node) return;
      const token = ++this.token;
      clearInterval(this.talkTimer); clearTimeout(this.typing);
      const line = bubble.querySelector('.chd-line');
      // The full line reserves the bubble's height so typing never pushes the page.
      bubble.querySelector('.chd-ghost').textContent = text;
      bubble.setAttribute('aria-label', text);
      bubble.classList.remove('is-popping');
      void bubble.offsetWidth;
      bubble.classList.add('is-popping');
      if (reduced.matches) { line.textContent = text; this.frame(0); if (gesture) this.play(gesture); return; }
      line.textContent = '';
      const run = () => {
        clearInterval(this.timer);
        node.classList.add('is-talking');
        let mouth = 0;
        this.talkTimer = setInterval(() => { node.style.backgroundPosition = `${[0, 1, 2, 1][mouth++ % 4] * 50}% 0`; }, 110);
        let shown = 0;
        const step = () => {
          if (token !== this.token) return;
          shown = Math.min(text.length, shown + 2);
          line.textContent = text.slice(0, shown);
          if (shown < text.length) { this.typing = setTimeout(step, 34); return; }
          clearInterval(this.talkTimer);
          this.typing = setTimeout(() => { if (token !== this.token) return; this.frame(0); if (gesture) this.play(gesture); }, 260);
        };
        step();
      };
      run();
    },
  };

  function meterMarkup(season, deltas = {}) {
    return meters.map(([key, label]) => {
      const value = Math.max(0, Math.min(100, Number(season?.[key]) || 0)), delta = Number(deltas[key]) || 0;
      return `<li class="chd-meter" data-meter="${key}"><span>${label}</span><i><b style="--value:${value}%"></b></i><strong>${value}</strong>${delta ? `<em class="${(key === 'trouble' ? delta < 0 : delta > 0) ? 'is-better' : 'is-worse'}">${delta > 0 ? '+' : ''}${delta}</em>` : ''}</li>`;
    }).join('');
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
  function outcomeLine(y) {
    const changes = meters.map(([key]) => [key, Number(y[key]) || 0]).filter(([, value]) => value);
    changes.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const [key, value] = changes[0] || [];
    const comment = !key ? 'Y aquí sigo, igual que siempre.'
      : key === 'money' ? (value > 0 ? '¡Más dinero en el bolsillo!' : 'Mi cartera está llorando.')
      : key === 'fame' ? (value > 0 ? 'Ya me reconocen por la calle.' : 'Mi fama ha bajado un poquito.')
      : key === 'energy' ? (value > 0 ? 'Estoy como nuevo.' : 'Estoy reventado.')
      : (value > 0 ? 'Me he metido en un buen lío.' : 'Menos líos, más paz.');
    return `Salió «${y.choice}». ${comment}`;
  }
  function good(y) { return (Number(y.money) || 0) + (Number(y.fame) || 0) + (Number(y.energy) || 0) - (Number(y.trouble) || 0) >= 0; }

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
      <p class="chd-ask">${voted ? 'Puedes cambiar tu voto hasta mañana.' : '¿Qué debería hacer el Chota?'}</p>
      <ul class="chd-options">${options}</ul>${twist}`;
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
    const scene = scenes.scenes[key];
    if (past) actor.say(outcomeLine(yesterday), good(yesterday) ? 'jump' : 'sit');
    else if (today.mine != null) actor.say(`Ya has votado «${today.options.find(o => o.i === today.mine)?.label || ''}». Mañana sabremos qué pasa.`, 'greet');
    else actor.say(scene?.intro || today.body, 'greet');
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
        <span class="chd-chota" aria-hidden="true"></span><i class="chd-shadow" aria-hidden="true"></i>
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
      if (event.target.closest('.chd-chota, .chd-scene')) actor.play('jump');
    });
    dialog.addEventListener('close', () => {
      actor.stop();
      document.body.classList.remove('chota-decision-open');
      (trigger?.isConnected ? trigger : document.querySelector('[data-chota-decision]'))?.focus({preventScroll: true});
      trigger = null;
    });
  }

  async function castVote(option) {
    const today = story?.today;
    if (!today || voting) return;
    const same = today.mine === option;
    voting = true; notice = ''; render();
    const scene = scenes.scenes[scenes.keyFor(today)];
    actor.say(scene?.react?.[option] || 'Decidido.', 'jump');
    const ok = same || await globalThis.ClubPlus?.storyVote?.(today.id, option);
    voting = false;
    notice = ok ? '' : globalThis.ClubPlus?.lastNotice?.() || 'No se ha podido guardar el voto.';
    render();
  }
  async function twist() {
    const today = story?.today;
    if (!today || voting) return;
    voting = true; render();
    const ok = await globalThis.ClubPlus?.storyTwist?.(today.id);
    voting = false;
    if (ok) actor.say('¡Giro soltado! Hoy pasa lo inesperado.', 'jump');
    else notice = globalThis.ClubPlus?.lastNotice?.() || 'No se ha podido soltar el giro.';
    render();
  }

  async function open(from = null) {
    if (!dialog) build();
    if (dialog.open) return;
    trigger = from;
    showing = 'today'; notice = '';
    if (!snapshot()) await globalThis.ClubPlus?.refresh?.();
    document.body.classList.add('chota-decision-open');
    dialog.showModal();
    actor.stop();
    actor.frame(0);
    dialog.querySelector('.chd-ghost').textContent = '…';
    dialog.querySelector('.chd-line').textContent = '';
    render(false);
    if (story?.today) {
      void paint(scenes.keyFor(story.today));
      actor.walkIn(() => render(true));
    }
    dialog.querySelector('[data-cd-close]').focus({preventScroll: true});
  }

  // The sede shows a letter on the rug, and a "!" over the Chota while today's vote is open.
  const letter = `<svg viewBox="0 0 22 16" shape-rendering="crispEdges" aria-hidden="true"><rect x="0" y="1" width="22" height="15" fill="#1a1410"/><rect x="1" y="2" width="20" height="13" fill="#efe6d0"/><polygon points="1,2 11,10 21,2" fill="#d8ccb0" stroke="#1a1410" stroke-width="1"/><rect x="9" y="8" width="4" height="4" fill="#b8332a"/></svg>`;
  function syncRoom(data = story) {
    document.querySelectorAll('.clubhouse-room').forEach(room => {
      let button = room.querySelector('.chota-decision-letter');
      if (!data?.today) { button?.remove(); room.querySelector('.chota-decision-mark')?.remove(); return; }
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
      const pet = room.querySelector('.clubhouse-pet');
      let mark = room.querySelector('.chota-decision-mark');
      if (waiting && pet && !mark) {
        mark = document.createElement('span');
        mark.className = 'chota-decision-mark';
        mark.setAttribute('aria-hidden', 'true');
        mark.textContent = '!';
        pet.append(mark);
      } else if (!waiting) mark?.remove();
    });
  }

  document.addEventListener('club-story', event => {
    story = event.detail || null;
    syncRoom(story);
    if (dialog?.open && !voting) render();
  });
  document.addEventListener('click', event => {
    const opener = event.target.closest?.('[data-chota-decision]');
    if (opener) { event.preventDefault(); void open(opener); }
  });
  // The room is rebuilt when the agenda or decorations change; put the letter back.
  const roomRoot = document.getElementById('clubhouseContent');
  if (roomRoot) new MutationObserver(() => { if (story && !roomRoot.querySelector('.chota-decision-letter')) syncRoom(story); }).observe(roomRoot, {childList: true});

  globalThis.ChotaDecision = Object.freeze({open, sync: () => syncRoom(snapshot())});
})();
