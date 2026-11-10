/* The sede answers touch: tap the floor and the Chota walks there, tap the sofa,
   window or board and he goes; he reacts to where and how often he is touched,
   keeps an eye on the finger, welcomes the member and lets the season's mood
   colour what he does on his own. Decisions are pure functions; the motion
   engine in app.js performs them. No new art, no server calls. */
(() => {
  'use strict';
  const VISIT_KEY = 'chota-last-visit';
  // Room coordinates are a share of the room's width (the art is square).
  const ZONES = Object.freeze({
    window: {x0: .83, y0: 0, x1: .985, y1: .4},
    sofa: {x0: 0, y0: .5, x1: .215, y1: .74},
    floor: {x0: .04, y0: .6, x1: .96, y1: .96},
  });
  const inside = (zone, x, y) => x >= zone.x0 && x <= zone.x1 && y >= zone.y0 && y <= zone.y1;
  function zoneAt(x, y, {board = null} = {}) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (board && inside(board, x, y)) return 'board';
    if (inside(ZONES.window, x, y)) return 'window';
    if (inside(ZONES.sofa, x, y)) return 'sofa';
    if (inside(ZONES.floor, x, y)) return 'floor';
    return null;
  }
  // Where on his body (share of the sprite's height) and how insistently.
  function touchReaction({part = .5, taps = 1} = {}) {
    if (taps >= 4) return 'annoyed';
    if (part < .42) return 'happy';
    if (part > .84) return 'shoes';
    return 'greet';
  }
  function tapCount(times, now, windowMs = 2600) {
    return times.filter(time => now - time <= windowMs).length;
  }
  // One welcome per visit: nothing when the member has just been here.
  function welcomeKind({lastVisit = null, now = Date.now(), hour = new Date(now).getHours()} = {}) {
    const away = Number.isFinite(lastVisit) ? now - lastVisit : Infinity;
    if (away < 10 * 60 * 1000) return null;
    if (Number.isFinite(lastVisit) && away >= 3 * 24 * 60 * 60 * 1000) return 'excited';
    if (hour >= 22 || hour < 8) return 'sleepy';
    return 'greet';
  }
  // The daily dilemma's season: money, fame, energy, trouble (0–100 each).
  function moodFrom(season) {
    const n = key => Number.isFinite(Number(season?.[key])) ? Number(season[key]) : null;
    const energy = n('energy'), trouble = n('trouble'), money = n('money'), fame = n('fame');
    if (energy === null && trouble === null) return 'calm';
    if (energy !== null && energy < 30) return 'tired';
    if (trouble !== null && trouble > 65) return 'restless';
    if (money !== null && fame !== null && (money + fame) / 2 > 65 && (trouble ?? 0) < 45) return 'happy';
    return 'calm';
  }
  // What a mood adds to his own routine, at most once per cooldown in the engine.
  function moodAction(mood, random = Math.random()) {
    if (mood === 'tired') return random < .55 ? 'rest' : random < .8 ? 'sofa' : null;
    if (mood === 'restless') return random < .6 ? 'pace' : random < .8 ? 'ears' : null;
    if (mood === 'happy') return random < .4 ? 'jump' : random < .65 ? 'greet' : null;
    return null;
  }

  const taps = [];
  let pending = null, lastLook = 0, welcomed = false;
  const motionFor = room => globalThis.ChotaRoom?.motion?.(room) || null;
  const mood = () => moodFrom(globalThis.ClubPlus?.snapshot?.()?.story?.season);
  function roomPoint(room, event) {
    const box = room.getBoundingClientRect();
    return box.width ? {x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.width, box} : null;
  }
  function boardZone(room, box) {
    const plan = room.querySelector('.clubhouse-plan:not(.clubhouse-plan-empty)')?.getBoundingClientRect();
    return plan?.width ? {x0: (plan.left - box.left) / box.width, y0: (plan.top - box.top) / box.width, x1: (plan.right - box.left) / box.width, y1: (plan.bottom - box.top) / box.width} : null;
  }
  // A neutral ring marks where he is heading; it never tints yellow.
  function mark(room, point) {
    const ring = document.createElement('i');
    ring.className = 'chota-go-mark'; ring.setAttribute('aria-hidden', 'true');
    ring.style.left = `${point.x * 100}%`; ring.style.top = `${point.y * 100}%`;
    room.append(ring); setTimeout(() => ring.remove(), 900);
  }
  // What the next "notice" of a tap on the Chota should be; read once by the engine.
  function takeTouch() { const value = pending; pending = null; return value; }

  if (typeof document !== 'undefined') {
    document.addEventListener('click', event => {
      const sprite = event.target.closest?.('[data-chota-open]');
      if (sprite) {
        const box = sprite.getBoundingClientRect(), now = performance.now();
        taps.push(now); while (taps.length > 8) taps.shift();
        pending = touchReaction({part: box.height ? (event.clientY - box.top) / box.height : .5, taps: tapCount(taps, now)});
      }
    }, true);
    document.addEventListener('click', event => {
      const room = event.target.closest?.('.clubhouse-room, .chota-viewer-room-scene');
      if (!room || event.defaultPrevented || event.target.closest('button, a, input, select, textarea, [role="button"], dialog')) return;
      const motion = motionFor(room), point = roomPoint(room, event);
      if (!motion?.goTo || !point) return;
      const zone = zoneAt(point.x, point.y, {board: boardZone(room, point.box)});
      if (!zone) return;
      if (zone === 'floor') { if (motion.goTo({x: point.x, y: point.y})) mark(room, point); }
      else motion.visit(zone);
    });
    document.addEventListener('pointermove', event => {
      if (!event.isPrimary || event.pointerType === 'mouse' && event.buttons === 0) return;
      const room = event.target.closest?.('.clubhouse-room, .chota-viewer-room-scene'), now = performance.now();
      if (!room || now - lastLook < 380) return;
      lastLook = now; motionFor(room)?.lookAt?.(event.clientX, event.clientY);
    }, {passive: true});
    document.addEventListener('pointerdown', event => {
      const room = event.target.closest?.('.clubhouse-room, .chota-viewer-room-scene');
      if (room && !event.target.closest('[data-chota-open]')) { lastLook = performance.now(); motionFor(room)?.lookAt?.(event.clientX, event.clientY); }
    }, {passive: true});
    // Opening the wardrobe makes him look that way; a purchase makes him celebrate.
    document.addEventListener('click', event => {
      const wardrobe = event.target.closest?.('.chota-room-wardrobe');
      if (wardrobe) motionFor(wardrobe.closest('.clubhouse-room, .chota-viewer-room-scene'))?.glance?.(wardrobe);
    }, true);
    document.addEventListener('bb:chota-items-updated', () => {
      const room = document.querySelector('.clubhouse-room');
      if (room) setTimeout(() => motionFor(room)?.cheer?.(), 600);
    });
  }
  // Called by app.js once the room is on screen and the engine exists.
  function welcome(motion) {
    if (welcomed || !motion?.welcome) return;
    welcomed = true;
    let lastVisit = null;
    try { const raw = localStorage.getItem(VISIT_KEY); lastVisit = raw === null ? null : Number(raw); localStorage.setItem(VISIT_KEY, String(Date.now())); } catch {}
    const kind = welcomeKind({lastVisit: Number.isFinite(lastVisit) ? lastVisit : null});
    // The room may still be scrolling into view: try a few times, then let it go.
    let tries = 0;
    const attempt = () => { if (!motion.welcome(kind) && ++tries < 5) setTimeout(attempt, 1500); };
    if (kind) setTimeout(attempt, 900);
  }
  globalThis.ChotaInteract = Object.freeze({zoneAt, touchReaction, tapCount, welcomeKind, moodFrom, moodAction, takeTouch, mood, welcome, ZONES});
})();
