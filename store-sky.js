/* The store's window looks onto Madrid as it is right now: the same sun as the
   sede, the real weather from ClubLife, drifting clouds, a bird or two and a
   city that lights up at night. The painted skyline stays in front of a live sky. */
(() => {
  'use strict';
  // The window's glass inside the 1024 × 1280 store illustration.
  const RECT = [551, 159, 99, 244], W = 1024, H = 1280;
  const ASSET = 'icons/shop/club-store-v1/';
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.reducedMotion === 'true';
  const low = () => document.documentElement.dataset.motionQuality === 'low';
  const rand = (min, max) => min + Math.random() * (max - min);
  const dialog = () => document.getElementById('bannerShopDialog');
  let node = null, key = '', birdTimer = 0, flashTimer = 0, tick = 0;

  function weights(now = new Date()) {
    const sun = globalThis.ClubDaylight?.(now);
    if (sun?.weights) return {...sun.weights, moment: sun.moment};
    // Fallback before the app has loaded: a plain Madrid day.
    const hour = now.getHours() + now.getMinutes() / 60;
    const moment = hour < 7 || hour >= 21 ? 'night' : hour < 8.5 ? 'dawn' : hour < 19 ? 'day' : 'evening';
    return {dawn: +(moment === 'dawn'), day: +(moment === 'day'), evening: +(moment === 'evening'), night: +(moment === 'night'), moment};
  }
  const weather = () => globalThis.ClubLife?.weather?.() || {kind: 'clear', wind: 0, cloud: 0};

  function markup(kind, moment, wind) {
    const parts = [];
    const clouds = {clear: 2, clouds: 4, overcast: 6, fog: 3, drizzle: 5, rain: 6, storm: 6, snow: 5}[kind] ?? 2;
    for (let i = 0; i < clouds; i++) {
      const big = i % 3 === 0;
      parts.push(`<i class="sw-cloud${big ? ' is-big' : ''}" style="--y:${(4 + (i * 37) % 48).toFixed(0)}%;--d:${(46 + i * 17 - Math.min(wind, 30)).toFixed(0)}s;--o:${(-i * 13.7).toFixed(1)}s;--s:${(0.7 + (i % 3) * 0.25).toFixed(2)}"></i>`);
    }
    const heavy = ['overcast', 'rain', 'storm', 'drizzle', 'snow', 'fog'].includes(kind);
    return `<span class="sw-sky" aria-hidden="true"><i class="sw-sky-dawn"></i><i class="sw-sky-day"></i><i class="sw-sky-evening"></i><i class="sw-sky-night"></i><i class="sw-stars"></i><i class="sw-sun"></i><i class="sw-moon"></i>${heavy ? '<i class="sw-grey"></i>' : ''}<span class="sw-clouds">${parts.join('')}</span><span class="sw-birds"></span></span>`
      + `<span class="sw-city" aria-hidden="true"><img class="sw-city-dawn" src="${ASSET}window-city-v1.png" alt="" draggable="false"><img class="sw-city-day" src="${ASSET}window-city-v1.png" alt="" draggable="false"><img class="sw-city-evening" src="${ASSET}window-city-v1.png" alt="" draggable="false"><img class="sw-city-night" src="${ASSET}window-city-v1.png" alt="" draggable="false"></span>`
      + `<span class="sw-weather" aria-hidden="true">${precipitation(kind, wind)}</span><i class="sw-flash" aria-hidden="true"></i><i class="sw-glare" aria-hidden="true"></i>`;
  }
  function precipitation(kind, wind) {
    if (kind === 'rain' || kind === 'storm' || kind === 'drizzle') return globalThis.ClubLife?.rainMarkup?.(kind, wind) || '';
    if (kind === 'snow') return '<i class="club-life-snow"></i><i class="club-life-snow club-life-snow--far"></i>';
    if (kind === 'fog') return '<i class="club-life-tint club-life-tint--fog"></i><i class="club-life-mist"></i><i class="club-life-mist club-life-mist--2"></i>';
    return '';
  }

  function sync() {
    if (!node?.isConnected) return;
    updateRainMotion();
    const sun = weights(), sky = weather();
    const stage = node.parentElement;
    for (const name of ['dawn', 'day', 'evening', 'night']) stage.style.setProperty(`--sw-${name}`, (sun[name] || 0).toFixed(3));
    node.dataset.time = sun.moment;
    node.dataset.weather = sky.kind;
    if (node.offsetWidth) node.style.setProperty('--sw-w', `${node.offsetWidth}px`);
    const next = `${sky.kind}|${low()}|${still()}|${Math.round((sky.wind || 0) / 3)}`;
    if (next !== key) { key = next; node.innerHTML = markup(sky.kind, sun.moment, sky.wind || 0); }
  }

  // A small flock crosses now and then, only when birds would be out.
  function birds() {
    clearTimeout(birdTimer);
    birdTimer = setTimeout(birds, rand(14000, 32000));
    const host = node?.querySelector('.sw-birds');
    if (!host || !visible() || still() || low()) return;
    const kind = weather().kind, moment = node.dataset.time;
    if (moment === 'night' || ['rain', 'storm', 'snow', 'fog'].includes(kind)) return;
    const flock = document.createElement('span');
    const leftward = Math.random() < 0.5, count = 2 + Math.floor(Math.random() * 3);
    flock.className = `sw-flock${leftward ? ' is-left' : ''}`;
    flock.style.setProperty('--y', `${rand(8, 46).toFixed(1)}%`);
    flock.style.setProperty('--t', `${rand(7, 11).toFixed(1)}s`);
    flock.style.setProperty('--rise', `${rand(-14, 10).toFixed(0)}px`);
    for (let i = 0; i < count; i++) flock.insertAdjacentHTML('beforeend', `<i style="--bx:${i * 7 + (i % 2) * 2}px;--by:${(i % 2) * 4 + (i === 0 ? 0 : 1)}px;--f:${(0.32 + i * 0.05).toFixed(2)}s"></i>`);
    host.append(flock);
    flock.addEventListener('animationend', event => { if (event.target === flock) flock.remove(); });
  }
  function storm() {
    clearTimeout(flashTimer);
    flashTimer = setTimeout(storm, rand(9000, 22000));
    if (!visible() || still() || weather().kind !== 'storm') return;
    const flash = node.querySelector('.sw-flash');
    flash?.classList.remove('is-on'); void flash?.offsetWidth; flash?.classList.add('is-on');
  }
  let windowInView = true;
  const visible = () => node?.isConnected && windowInView && !document.hidden && dialog()?.open && !document.getElementById('clubStoreScene')?.hidden;
  function updateRainMotion() { if (node) node.dataset.rainRunning = String(Boolean(visible() && !still())); }
  const rainObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => { for (const entry of entries) if (entry.target === node) { windowInView = entry.isIntersecting; updateRainMotion(); } }, {threshold: .01}) : null;


  function mount(stage) {
    if (!stage) return;
    const previousWindow = node;
    node = stage.querySelector(':scope > .store-window');
    if (previousWindow && previousWindow !== node) rainObserver?.unobserve(previousWindow);
    if (!node) {
      node = document.createElement('div');
      node.className = 'store-window';
      node.setAttribute('aria-hidden', 'true');
      node.style.cssText = `left:${RECT[0] / W * 100}%;top:${RECT[1] / H * 100}%;width:${RECT[2] / W * 100}%;height:${RECT[3] / H * 100}%`;
      stage.append(node);
    }
    let ambient = stage.querySelector(':scope > .store-ambient');
    if (!ambient) { ambient = document.createElement('div'); ambient.className = 'store-ambient'; ambient.setAttribute('aria-hidden', 'true'); stage.append(ambient); }
    rainObserver?.observe(node);
    key = '';
    sync();
    if (!birdTimer) { birdTimer = setTimeout(birds, 2500); flashTimer = setTimeout(storm, 4000); }
  }
  const rainHostWatch = new MutationObserver(updateRainMotion);
  if (dialog()) rainHostWatch.observe(dialog(), {attributes: true, attributeFilter: ['open']});
  const scene = document.getElementById('clubStoreScene');
  if (scene) rainHostWatch.observe(scene, {attributes: true, attributeFilter: ['hidden']});
  // The sky moves on slowly while the store is open; weather is re-read each time.
  setInterval(() => { if (visible() && ++tick) sync(); }, 20000);
  document.addEventListener('visibilitychange', () => { updateRainMotion(); if (!document.hidden) sync(); });
  // Reopening the store shows the sky of this moment, not the last visit's.
  document.addEventListener('click', event => { if (event.target.closest?.('[data-banner-shop], #clubStoreBack')) setTimeout(sync, 0); });
  globalThis.StoreSky = Object.freeze({mount, sync, birds});
})();
