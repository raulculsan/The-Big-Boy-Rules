/* Cloth follow-through. The Chota is 67 flat drawings, so there is no cloth
   simulation: his shirt and coat are drawn once more over the composed sprite
   and leaned by a damped spring, so the hem trails when he sets off, overshoots
   when he stops and bobs when he jumps. Head, arms and paws are redrawn on top,
   so cloth never covers them. Resting cloth is pixel-identical to the sprite,
   and the layers disappear while he idles. Sede and daily dilemma only. */
(() => {
  'use strict';
  const GRIDS = {base: [6, 4], directional: [5, 4], contextual: [4, 4], room: [4, 1], talk: [3, 1]};
  // Torso centre of every pose, in 256 px cell units (wardrobe-rig-v1/poses.json).
  const CENTERS = {"base":[[140,126],[140,126],[140,126],[140,126],[140,126],[140,126],[134,126],[134,126],[134,126],[134,126],[134,126],[134,126],[137,135],[140,155],[137,124],[128,105],[139,142],[140,126],[137,123],[139,155],[137,158],[106,197],[115,207],[115,207]],"directional":[[122,120],[122,119],[122,118],[122,119],[122,120],[122,119],[122,118],[122,119],[135,125],[135,124],[135,123],[135,124],[135,125],[135,124],[135,123],[135,124],[122,119],[124,111],[124,111],[135,124]],"contextual":[[140,126],[140,126],[134,126],[134,126],[140,126],[140,126],[134,125],[134,125],[140,126],[140,126],[133,125],[133,125],[140,126],[140,126],[136,127],[136,127]],"room":[[133,133],[122,133],[124,133],[129,135]],"talk":[[140,126],[140,126],[140,126]]};
  // TRAVEL scales how far he moved on screen; POSE scales how far the drawing moved inside its cell.
  const STIFFNESS = .1, DAMPING = .8, TRAVEL = 1.6, POSE = 1, LIMIT = 7, HEM = 70;
  // Pure spring step: the body moved by (dx, dy) cell px this frame.
  function step(state, dx = 0, dy = 0) {
    let x = state.x - dx, y = state.y - dy;
    let vx = (state.vx - x * STIFFNESS) * DAMPING, vy = (state.vy - y * STIFFNESS) * DAMPING;
    x = Math.max(-LIMIT, Math.min(LIMIT, x + vx)); y = Math.max(-LIMIT, Math.min(LIMIT, y + vy));
    return {x, y, vx, vy};
  }
  const resting = state => Math.abs(state.x) < .12 && Math.abs(state.y) < .12 && Math.abs(state.vx) < .05 && Math.abs(state.vy) < .05;
  // Lean around the neck: shoulders stay put, the hem travels the most.
  function pose(state, mirrored = false) {
    const lean = Math.atan2(state.x, HEM) * 180 / Math.PI * (mirrored ? -1 : 1), stretch = 1 + Math.max(-.06, Math.min(.06, state.y / HEM));
    return {lean, stretch, transform: `skewX(${lean.toFixed(2)}deg) scaleY(${stretch.toFixed(4)})`};
  }
  function poseDelta(fromSheet, fromFrame, toSheet, toFrame) {
    const a = CENTERS[fromSheet]?.[fromFrame], b = CENTERS[toSheet]?.[toFrame];
    if (!a || !b || fromSheet !== toSheet) return [0, 0];
    return [Math.max(-14, Math.min(14, b[0] - a[0])), Math.max(-14, Math.min(14, b[1] - a[1]))];
  }
  const position = (sheet, index) => { const [cols, rows] = GRIDS[sheet]; return {size: `${cols * 100}% ${rows * 100}%`, at: `${index % cols * 100 / (cols - 1)}% ${rows === 1 ? 0 : Math.floor(index / cols) * 100 / (rows - 1)}%`}; };

  const tracked = new Map();
  let raf = 0, layersCache = null;
  const quiet = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motionQuality === 'low';
  function clothLayers() {
    if (layersCache) return layersCache;
    const appearance = globalThis.ChotaAppearance, contract = appearance?.contract?.();
    if (!appearance?.enabled?.() || !contract) return (layersCache = {cloth: [], front: null});
    const cloth = (globalThis.ChotaWardrobe?.clothLayers?.() || []).filter(layer => layer.slot === 'topwear' || layer.slot === 'outerwear');
    const coat = cloth.some(layer => layer.slot === 'outerwear');
    return (layersCache = {cloth, front: cloth.length ? (coat ? contract.foreground : contract.anatomy) : null});
  }
  const url = path => `url("${globalThis.ChotaAppearance?.url?.(path) || path}")`;
  function build(node, entry) {
    node.querySelectorAll(':scope > .chota-cloth, :scope > .chota-cloth-front').forEach(layer => layer.remove());
    entry.layers = [];
    const {cloth, front} = clothLayers();
    if (!cloth.length || !front) return;
    const before = node.querySelector(':scope > .chd-think');
    for (const layer of cloth) { const element = document.createElement('i'); element.className = 'chota-cloth'; element.dataset.slot = layer.slot; element.setAttribute('aria-hidden', 'true'); node.insertBefore(element, before); entry.layers.push({element, source: layer}); }
    const top = document.createElement('i'); top.className = 'chota-cloth-front'; top.setAttribute('aria-hidden', 'true'); node.insertBefore(top, before); entry.layers.push({element: top, source: {atlases: front}});
    entry.painted = '';
  }
  function paint(node, entry) {
    const mirrored = /scaleX\(-1\)/.test(node.style.transform) || node.classList.contains('is-facing-left'), key = [entry.sheet, entry.frame, mirrored].join(':');
    if (entry.painted === key) return;
    entry.painted = key; entry.mirrored = mirrored;
    const {size, at} = position(entry.sheet, entry.frame);
    for (const {element, source} of entry.layers) {
      const atlas = (mirrored && source.flipAtlases || source.atlases)[entry.sheet];
      if (element.dataset.atlas !== atlas) { element.dataset.atlas = atlas; element.style.backgroundImage = url(atlas); }
      element.style.backgroundSize = size; element.style.backgroundPosition = at;
    }
  }
  function show(node, entry, visible) {
    if (entry.visible === visible) return;
    entry.visible = visible; node.classList.toggle('has-chota-cloth', visible);
    if (!visible) { for (const {element} of entry.layers) element.style.transform = ''; if (entry.squash) node.style.scale = ''; }
  }
  function tick() {
    raf = 0;
    let busy = false;
    for (const [node, entry] of tracked) {
      if (!node.isConnected) { tracked.delete(node); continue; }
      if (!entry.layers.length) continue;
      const box = node.getBoundingClientRect(), cell = box.width ? 256 / box.width : 0;
      const dx = entry.box && cell ? (box.left + box.width / 2 - entry.box.x) * cell : 0, dy = entry.box && cell ? (box.bottom - entry.box.y) * cell : 0;
      entry.box = {x: box.left + box.width / 2, y: box.bottom};
      const [px, py] = entry.impulse; entry.impulse = [0, 0];
      // Screen travel is in viewer space; pose travel is drawn mirrored with him.
      entry.state = step(entry.state, Math.max(-3, Math.min(3, dx)) * TRAVEL + (entry.mirrored ? -px : px) * POSE, Math.max(-3, Math.min(3, dy)) * TRAVEL + py * POSE);
      const idle = node.classList.contains('is-idling') || !!node.closest('.is-sleeping') || !box.width;
      if (resting(entry.state)) { entry.state = {x: 0, y: 0, vx: 0, vy: 0}; if (idle || ++entry.still > 40) { show(node, entry, false); continue; } } else entry.still = 0;
      busy = true; paint(node, entry); show(node, entry, true);
      const {transform, stretch} = pose(entry.state, entry.mirrored);
      for (const {element} of entry.layers) if (element.classList.contains('chota-cloth')) element.style.transform = transform;
      if (entry.squash) node.style.scale = `${(1 - (stretch - 1) * .35).toFixed(4)} ${(1 + (stretch - 1) * .5).toFixed(4)}`;
    }
    if (busy) raf = requestAnimationFrame(tick);
  }
  // Called on every pose change of a room or dilemma Chota.
  function frame(node, sheet, index) {
    if (!node || !GRIDS[sheet] || quiet()) return;
    let entry = tracked.get(node);
    if (!entry) { entry = {sheet, frame: index, state: {x: 0, y: 0, vx: 0, vy: 0}, impulse: [0, 0], layers: [], box: null, still: 0, squash: node.classList.contains('tigreton-character')}; tracked.set(node, entry); build(node, entry); }
    const [dx, dy] = poseDelta(entry.sheet, entry.frame, sheet, index);
    entry.impulse = [entry.impulse[0] + dx, entry.impulse[1] + dy]; entry.sheet = sheet; entry.frame = index; entry.still = 0;
    if (entry.visible) paint(node, entry);
    if (!raf && entry.layers.length) raf = requestAnimationFrame(tick);
  }
  function refresh() { layersCache = null; for (const [node, entry] of tracked) { show(node, entry, false); build(node, entry); } }
  if (typeof document !== 'undefined') {
    globalThis.addEventListener('chota-wardrobe-change', refresh);
    globalThis.addEventListener('chota-appearance-change', refresh);
  }
  globalThis.ChotaCloth = Object.freeze({frame, refresh, step, pose, poseDelta, resting, CENTERS});
})();
