/* Pack opening v3: the player tears the pack with a finger, then the deck leaves it.
   Presentation only: the cards are already saved when this starts, so closing,
   skipping or failing here can never change a reward. Only transforms, opacity
   and clip-path move; no player, canvas or layout loop. */
(() => {
  'use strict';
  const ART = `${globalThis.PACK_OPENING_ROOT || ""}icons/cards/sobre-los-nuestros-recortado-v2.png`;
  const FLARE = `${globalThis.PACK_OPENING_ROOT || ""}icons/cards/pack-seal-flare-v2.png`;
  const WIDTH = 1024, HEIGHT = 1536;
  // Pack edges and the tear line, in artwork pixels, just under the top crimp.
  const LEFT = 128, RIGHT = 894, TEAR_Y = 178;
  const RANK = ['common','retro','special','epic','legendary','full_art','halloween','vice_city'];
  const TEAR_THRESHOLD = .55, FLICK_SPEED = .7, TAP_DISTANCE = 10, DRAG_SPAN = .72;
  const TOTAL_BURST = 1320;

  const percent = (x, y) => `${(x / WIDTH * 100).toFixed(2)}% ${(y / HEIGHT * 100).toFixed(2)}%`;
  const polygon = points => `polygon(${points.map(([x, y]) => percent(x, y)).join(',')})`;
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

  // A fixed, irregular edge: foil tears in small uneven steps, never a straight cut.
  function tearLine(steps = 34) {
    return Array.from({length: steps + 1}, (_, index) => {
      const wave = Math.sin(index * 2.399) * 4.6 + Math.sin(index * .83) * 2.4;
      return [LEFT + (RIGHT - LEFT) * index / steps, TEAR_Y + (index % 2 ? wave : -wave * .6)];
    });
  }
  // Split the strip above the line at a horizontal position, keeping both halves closed.
  function stripPieces(line, front) {
    const frontX = LEFT + (RIGHT - LEFT) * front;
    const index = line.findIndex(([x]) => x >= frontX);
    const at = index < 0 ? line.length - 1 : index;
    const pivot = [frontX, line[at][1]];
    const before = line.filter(([x]) => x < frontX), after = line.filter(([x]) => x > frontX);
    return {pivot,
      before: [[0, 0], [frontX, 0], pivot, ...[...before].reverse(), [0, TEAR_Y]],
      after: [[frontX, 0], [WIDTH, 0], [WIDTH, TEAR_Y], ...[...after].reverse(), pivot]};
  }
  function bestEdition(cards) {
    return cards.reduce((best, card) => RANK.indexOf(card?.edition) > RANK.indexOf(best) ? card.edition : best, 'common');
  }
  function shouldComplete(progress, speed) {
    return progress >= TEAR_THRESHOLD || (progress > .12 && speed >= FLICK_SPEED);
  }

  function play({stage, back, count = 6, edition = 'common', onDone = () => {}}) {
    const line = tearLine();
    const body = polygon([...line, [WIDTH, TEAR_Y], [WIDTH, HEIGHT], [0, HEIGHT], [0, TEAR_Y]]);
    const deck = Array.from({length: Math.min(count, 6)}, (_, index) =>
      `<img class="pack-tear-card" src="${back}" alt="" draggable="false" style="--card:${index}">`).join('');
    const sparks = Array.from({length: 18}, (_, index) => `<i class="pack-tear-spark" style="--spark:${index}"></i>`).join('');
    const root = document.createElement('div');
    root.className = 'pack-tear is-entering';
    root.dataset.edition = edition;
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = `<span class="pack-tear-aura"></span><span class="pack-tear-rays"></span>
      <div class="pack-tear-pack"><div class="pack-tear-float">
        <div class="pack-tear-shell pack-tear-shell-back"><img class="pack-tear-art pack-tear-inside" src="${ART}" alt="" draggable="false"></div>
        <div class="pack-tear-deck">${deck}</div>
        <div class="pack-tear-shell pack-tear-shell-front">
          <img class="pack-tear-art pack-tear-body" src="${ART}" alt="" draggable="false" style="clip-path:${body}">
          <span class="pack-tear-sheen" style="clip-path:${body}"></span>
        </div>
        <img class="pack-tear-art pack-tear-strip-rest" src="${ART}" alt="" draggable="false">
        <img class="pack-tear-art pack-tear-strip-torn" src="${ART}" alt="" draggable="false">
        <svg class="pack-tear-art pack-tear-edge" viewBox="0 0 ${WIDTH} ${HEIGHT}"><polyline pathLength="1" fill="none"/></svg>
        <img class="pack-tear-flare" src="${FLARE}" alt="" draggable="false">
        <span class="pack-tear-sparks">${sparks}</span>
      </div></div>
      <span class="pack-tear-guide"><i></i></span>
      <p class="pack-tear-hint">Desliza para abrir</p>`;
    stage.append(root);

    const $ = selector => root.querySelector(selector);
    const pack = $('.pack-tear-pack'), rest = $('.pack-tear-strip-rest'), torn = $('.pack-tear-strip-torn');
    const edge = $('.pack-tear-edge polyline'), sheen = $('.pack-tear-sheen');
    const animations = [];
    let phase = 'ready', progress = 0, direction = 1, frame = 0, drag = null, dead = false, timer = 0;
    let tiltX = 0, tiltY = 0, settle = 0;

    function setDirection(next) {
      direction = next;
      const ordered = direction > 0 ? line : [...line].reverse();
      edge.setAttribute('points', ordered.map(point => point.join(',')).join(' '));
    }
    function paintTear() {
      const front = direction > 0 ? progress : 1 - progress;
      const {pivot, before, after} = stripPieces(line, front);
      const [tearing, resting] = direction > 0 ? [before, after] : [after, before];
      torn.style.clipPath = polygon(tearing);
      rest.style.clipPath = polygon(resting);
      torn.style.transformOrigin = percent(...pivot);
      // The freed strip lifts away from the point still attached to the pack.
      torn.style.transform = `rotate(${direction * (4 + 15 * progress)}deg)`;
      edge.style.strokeDasharray = `${progress} 1`;
      edge.style.opacity = progress > .01 ? '1' : '0';
    }
    function paintTilt() {
      frame = 0;
      if (dead) return;
      pack.style.transform = `rotateX(${(-tiltY * 7).toFixed(2)}deg) rotateY(${(tiltX * 10).toFixed(2)}deg)`;
      sheen.style.setProperty('--sheen-x', `${(tiltX * 42).toFixed(1)}%`);
      if (phase === 'tearing' || phase === 'finishing' || phase === 'dragging') paintTear();
    }
    const queue = () => { if (!frame) frame = requestAnimationFrame(paintTilt); };
    function aim(event) {
      const bounds = root.getBoundingClientRect();
      if (!bounds.width) return;
      tiltX = clamp((event.clientX - bounds.left) / bounds.width * 2 - 1, -1, 1);
      tiltY = clamp((event.clientY - bounds.top) / bounds.height * 2 - 1, -1, 1);
    }
    function tween(from, to, duration, done) {
      cancelAnimationFrame(settle);
      const start = performance.now();
      const step = now => {
        if (dead) return;
        const t = clamp((now - start) / duration);
        progress = from + (to - from) * (1 - (1 - t) ** 3);
        paintTear();
        if (t < 1) settle = requestAnimationFrame(step); else done?.();
      };
      settle = requestAnimationFrame(step);
    }
    function finish() {
      if (dead) return;
      stop();
      onDone();
    }
    function run(node, keyframes, options) {
      if (!node?.animate) return;
      const animation = node.animate(keyframes, {fill: 'both', ...options});
      animations.push(animation);
    }
    function burst() {
      phase = 'burst';
      root.classList.add('is-bursting');
      const ease = 'cubic-bezier(.22,1,.36,1)';
      const angle = direction * 19;
      rest.style.visibility = 'hidden';
      pack.style.transform = '';
      run(torn, [{transform: `rotate(${angle}deg)`, opacity: 1},
        {transform: `translate(${direction * 26}%,-34%) rotate(${angle + direction * 34}deg)`, opacity: 1, offset: .7},
        {transform: `translate(${direction * 38}%,-48%) rotate(${angle + direction * 52}deg)`, opacity: 0}], {duration: 620, easing: 'cubic-bezier(.3,.6,.4,1)'});
      run($('.pack-tear-edge'), [{opacity: 1}, {opacity: 0}], {duration: 300, delay: 60, easing: 'ease-out'});
      run($('.pack-tear-flare'), [{opacity: 0, transform: 'scale(.5)'}, {opacity: 1, transform: 'scale(1)', offset: .22},
        {opacity: 0, transform: 'scale(1.25)'}], {duration: 460, easing: 'ease-out'});
      run($('.pack-tear-aura'), [{opacity: 0, transform: 'scale(.7)'}, {opacity: 1, transform: 'scale(1)', offset: .3},
        {opacity: .75, transform: 'scale(1.1)', offset: .72}, {opacity: 0, transform: 'scale(1.18)'}], {duration: TOTAL_BURST, easing: 'ease-out'});
      run($('.pack-tear-rays'), [{opacity: 0, transform: 'rotate(-6deg) scale(.8)'}, {opacity: 1, offset: .3},
        {opacity: 0, transform: 'rotate(10deg) scale(1.15)'}], {duration: TOTAL_BURST, easing: 'ease-out'});
      run($('.pack-tear-float'), [{transform: 'translateY(0) scale(1)'}, {transform: 'translateY(7px) scale(1.012,.985)', offset: .35},
        {transform: 'translateY(0) scale(1)'}], {duration: 220, easing: 'ease-out'});
      root.querySelectorAll('.pack-tear-spark').forEach((spark, index) => {
        const x = 50 + (index - 8.5) * 5.1, drift = (index - 8.5) * 11 + Math.sin(index * 2.4) * 16;
        const rise = 48 + (index * 37) % 92;
        spark.style.left = `${x}%`;
        run(spark, [{opacity: 0, transform: 'translate(0,0) scale(.6)'}, {opacity: 1, offset: .12},
          {opacity: 1, transform: `translate(${drift * .7}px,${-rise}px) scale(1)`, offset: .55},
          {opacity: 0, transform: `translate(${drift}px,${-rise * .72}px) scale(.3)`}],
        {duration: 620 + (index % 4) * 70, delay: (index % 5) * 22, easing: 'cubic-bezier(.12,.7,.3,1)'});
      });
      // The stack rises out, fans for a beat over the falling pack, then gathers.
      root.querySelectorAll('.pack-tear-card').forEach((card, index, all) => {
        const lane = index - (all.length - 1) / 2, depth = all.length - 1 - index;
        // Straight up while inside the pack: fanning any earlier would cut through its sides.
        const fan = `translate(${lane * 15}%,${-26 + Math.abs(lane) * 2}%) rotate(${lane * 5}deg) scale(.9)`;
        // Eased per segment: a global curve would rush these offsets and fan too early.
        run(card, [{transform: 'translateY(4%) scale(.88)', offset: 0, easing: ease},
          {transform: 'translateY(-30%) scale(.88)', offset: .36, easing: ease},
          {transform: fan, offset: .56}, {transform: fan, offset: .68, easing: ease},
          {transform: `translateY(${-depth * .4}%) scale(1)`}], {duration: 1040, delay: 170 + depth * 18});
      });
      for (const shell of root.querySelectorAll('.pack-tear-shell'))
        run(shell, [{transform: 'translateY(0) rotate(0)', opacity: 1}, {transform: 'translateY(4%) rotate(0)', opacity: 1, offset: .3},
          {transform: `translateY(112%) rotate(${direction * -5}deg)`, opacity: 0}], {duration: 680, delay: 330, easing: 'cubic-bezier(.5,0,.8,.5)'});
      timer = setTimeout(finish, TOTAL_BURST);
    }
    function complete() {
      if (phase === 'finishing' || phase === 'burst') return;
      phase = 'finishing';
      root.classList.remove('is-idle');
      root.classList.add('is-tearing');
      tween(progress, 1, Math.round(120 + 200 * (1 - progress)), burst);
    }
    function tear() {
      if (phase === 'ready' || phase === 'tearing') { paintTear(); complete(); }
    }
    function down(event) {
      if (drag || phase !== 'ready' || event.isPrimary === false || (event.button !== undefined && event.button !== 0)) return;
      drag = {id: event.pointerId, x: event.clientX, y: event.clientY, width: root.getBoundingClientRect().width || 1,
        lastX: event.clientX, lastTime: event.timeStamp, speed: 0, moved: false};
      phase = 'dragging';
      cancelAnimationFrame(settle);
      root.setPointerCapture?.(event.pointerId);
      root.classList.remove('is-idle');
      aim(event); queue();
    }
    function move(event) {
      if (!drag) { if (phase === 'ready' && event.pointerType === 'mouse') { aim(event); queue(); } return; }
      if (event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x;
      if (!drag.moved && Math.hypot(dx, event.clientY - drag.y) > TAP_DISTANCE) drag.moved = true;
      if (Math.abs(dx) > 4 && !progress) setDirection(dx > 0 ? 1 : -1);
      const elapsed = event.timeStamp - drag.lastTime;
      if (elapsed > 0) drag.speed = Math.abs(event.clientX - drag.lastX) / elapsed;
      drag.lastX = event.clientX; drag.lastTime = event.timeStamp;
      progress = clamp(dx * direction / (drag.width * DRAG_SPAN));
      if (progress > .01) root.classList.add('is-tearing');
      aim(event); queue();
    }
    function up(event) {
      if (!drag || event.pointerId !== drag.id) return;
      const {moved, speed} = drag;
      drag = null;
      tiltX = tiltY = 0;
      if (event.type === 'pointerup' && (!moved || shouldComplete(progress, speed))) { complete(); return; }
      phase = 'ready';
      tween(progress, 0, 220, () => { root.classList.remove('is-tearing'); root.classList.add('is-idle'); });
      queue();
    }
    root.addEventListener('pointerdown', down);
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', up);
    root.addEventListener('lostpointercapture', up);
    root.addEventListener('pointerleave', () => { if (!drag && phase === 'ready') { tiltX = tiltY = 0; queue(); } });

    function stop() {
      if (dead) return;
      dead = true;
      clearTimeout(timer);
      cancelAnimationFrame(frame); cancelAnimationFrame(settle);
      animations.forEach(animation => animation.cancel());
      root.remove();
    }
    setDirection(1);
    paintTear();
    // The entrance owns the first 420 ms; the hint waits so it never competes with it.
    timer = setTimeout(() => { if (!dead && phase === 'ready') root.classList.add('is-idle'); root.classList.remove('is-entering'); }, 420);
    return {stop, tear};
  }

  globalThis.PackOpening = Object.freeze({play, bestEdition, tearLine, stripPieces, shouldComplete, art: ART});
})();
