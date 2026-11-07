/* Everyday life in the sede: Madrid's real weather at the window, city lights
   at night, shooting stars, lamp glow, moths around the ceiling lamp and a phone
   that buzzes on the rug. The Chota comments on the weather and jumps at thunder.
   Everything pauses while the room is off screen or the page is hidden. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const low = () => document.documentElement.dataset.motionQuality === 'low';
  const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=40.4168&longitude=-3.7038&current=weather_code,is_day,cloud_cover,wind_speed_10m&timezone=Europe%2FMadrid';
  const WEATHER_KEY = 'bb-sede-weather-v1', WEATHER_TTL = 30 * 60000;
  let weather = {kind: 'clear', wind: 0, cloud: 0}, weatherAt = 0, loading = null;
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  const rand = (min, max) => min + Math.random() * (max - min);
  const session = {
    get(key) { try { return sessionStorage.getItem(key); } catch { return null; } },
    set(key) { try { sessionStorage.setItem(key, '1'); } catch {} },
  };

  // WMO weather codes → what the window shows.
  function kindFor(code, cloud) {
    if (code >= 95) return 'storm';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
    if (code >= 51 && code <= 57) return 'drizzle';
    if (code === 45 || code === 48) return 'fog';
    if (code === 3 || cloud >= 80) return 'overcast';
    if (code >= 1 || cloud >= 35) return 'clouds';
    return 'clear';
  }
  function readCache() {
    try {
      const saved = JSON.parse(localStorage.getItem(WEATHER_KEY) || 'null');
      if (saved && Date.now() - saved.at < WEATHER_TTL) { weather = saved.weather; weatherAt = saved.at; return true; }
    } catch {}
    return false;
  }
  async function refreshWeather() {
    if (loading || Date.now() - weatherAt < WEATHER_TTL || navigator.onLine === false) return loading;
    loading = (async () => {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(WEATHER_URL, {signal: controller.signal, credentials: 'omit', cache: 'no-store'});
        if (!response.ok) return;
        const current = (await response.json())?.current;
        if (!current) return;
        const code = Number(current.weather_code) || 0, cloud = Number(current.cloud_cover) || 0;
        weather = {kind: kindFor(code, cloud), wind: Math.min(60, Number(current.wind_speed_10m) || 0), cloud};
        weatherAt = Date.now();
        try { localStorage.setItem(WEATHER_KEY, JSON.stringify({at: weatherAt, weather})); } catch {}
        syncAll();
      } catch {} finally { clearTimeout(timer); loading = null; }
    })();
    return loading;
  }

  const rooms = () => [...document.querySelectorAll('.clubhouse-room, .chota-viewer-room-scene')];
  const live = room => room.isConnected && !document.hidden && (room.classList.contains('is-in-view') || room.closest('dialog[open]'));
  const night = room => room.dataset.time === 'night' || room.dataset.time === 'evening';
  const asleep = room => room.classList.contains('is-sleeping');

  // One life layer per room, rebuilt only when the weather or time of day changes.
  function ensure(room) {
    let sky = room.querySelector('.clubhouse-sky .club-life-sky');
    const host = room.querySelector('.clubhouse-sky');
    if (host && !sky) {
      sky = document.createElement('span');
      sky.className = 'club-life-sky';
      sky.setAttribute('aria-hidden', 'true');
      host.append(sky);
    }
    let layer = room.querySelector(':scope > .club-life');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'club-life';
      layer.setAttribute('aria-hidden', 'true');
      layer.innerHTML = '<i class="club-life-flash"></i><i class="club-life-glow club-life-glow--stump"></i><i class="club-life-glow club-life-glow--lantern"></i>'
        + '<span class="club-life-moths"><i></i><i></i></span><span class="club-life-phone"><i></i><b>bzz</b></span>';
      room.append(layer);
    }
    return {sky, layer};
  }
  function skyMarkup(kind, isNight, wind) {
    const parts = [];
    const lean = Math.round(Math.min(30, wind) * .8);
    if (kind === 'clouds' || kind === 'overcast') {
      for (let i = 0; i < (kind === 'overcast' ? 4 : 2); i++) parts.push(`<i class="club-life-cloud" style="--y:${8 + i * 17}%;--d:${70 + i * 23}s;--o:${-i * 29}s;--s:${.8 + (i % 2) * .5}"></i>`);
      if (kind === 'overcast') parts.push('<i class="club-life-tint club-life-tint--grey"></i>');
    }
    if (kind === 'fog') parts.push('<i class="club-life-tint club-life-tint--fog"></i><i class="club-life-mist"></i><i class="club-life-mist club-life-mist--2"></i>');
    if (kind === 'rain' || kind === 'drizzle' || kind === 'storm') {
      parts.push(`<i class="club-life-tint club-life-tint--rain"></i><i class="club-life-rain${kind === 'drizzle' ? ' is-light' : ''}" style="--lean:${lean}deg"></i>`);
      const drops = low() ? 3 : kind === 'drizzle' ? 4 : 8;
      for (let i = 0; i < drops; i++) parts.push(`<i class="club-life-drop" style="--x:${rand(4, 94).toFixed(1)}%;--y:${rand(2, 40).toFixed(1)}%;--d:${rand(2.4, 5).toFixed(2)}s;--o:${(-rand(0, 5)).toFixed(2)}s"></i>`);
    }
    if (kind === 'snow') parts.push('<i class="club-life-tint club-life-tint--grey"></i><i class="club-life-snow"></i><i class="club-life-snow club-life-snow--far"></i>');
    // The city behind the glass keeps living at night: windows go on and off.
    if (isNight) for (let i = 0; i < (low() ? 6 : 12); i++) parts.push(`<i class="club-life-window" data-window style="--x:${rand(12, 90).toFixed(1)}%;--y:${rand(77, 95).toFixed(1)}%"></i>`);
    return parts.join('');
  }
  function sync(room) {
    const {sky, layer} = ensure(room);
    const isNight = night(room), kind = weather.kind;
    const key = `${kind}|${isNight}|${low()}|${reduced.matches}`;
    if (sky && sky.dataset.key !== key) { sky.dataset.key = key; sky.innerHTML = skyMarkup(kind, isNight, weather.wind); }
    room.dataset.weather = kind;
    layer.classList.toggle('is-night', isNight);
    layer.classList.toggle('is-lights-off', asleep(room));
  }
  function syncAll() { rooms().forEach(sync); }

  // Occasional moments, each picking one visible room.
  function liveRoom() { const list = rooms().filter(live); return list.find(room => room.closest('dialog[open]')) || list[0] || null; }
  function cityFlicker() {
    later(cityFlicker, rand(2500, 6000));
    const room = liveRoom();
    if (!room || reduced.matches) return;
    const windows = room.querySelectorAll('[data-window]');
    if (!windows.length) return;
    windows[Math.floor(Math.random() * windows.length)].classList.toggle('is-off');
  }
  function shootingStar() {
    later(shootingStar, rand(35000, 90000));
    const room = liveRoom();
    if (!room || reduced.matches || room.dataset.time !== 'night' || !['clear', 'clouds'].includes(weather.kind)) return;
    const sky = room.querySelector('.club-life-sky');
    if (!sky) return;
    const star = document.createElement('i');
    star.className = 'club-life-star';
    star.style.setProperty('--x', `${rand(10, 70).toFixed(1)}%`);
    star.style.setProperty('--y', `${rand(4, 30).toFixed(1)}%`);
    sky.append(star);
    star.addEventListener('animationend', () => star.remove(), {once: true});
  }
  function thunder() {
    later(thunder, rand(14000, 32000));
    const room = liveRoom();
    if (!room || weather.kind !== 'storm' || reduced.matches) return;
    const flash = room.querySelector('.club-life-flash');
    flash?.classList.remove('is-on'); void flash?.offsetWidth; flash?.classList.add('is-on');
    room.querySelector('.club-life-sky')?.classList.remove('is-lit');
    void room.offsetWidth;
    room.querySelector('.club-life-sky')?.classList.add('is-lit');
    // The thunder arrives a moment after the light; he jumps if he is awake.
    if (!asleep(room) && room.classList.contains('clubhouse-room')) later(() => globalThis.ChotaRoom?.play?.('celebrate'), 700);
  }
  function phone() {
    later(phone, rand(140000, 320000));
    const room = liveRoom();
    if (!room || asleep(room) || reduced.matches || low()) return;
    const node = room.querySelector('.club-life-phone');
    node?.classList.remove('is-buzzing'); void node?.offsetWidth; node?.classList.add('is-buzzing');
    navigator.vibrate?.(0);
  }
  // He mentions the weather once a session, when his bubble is free.
  const weatherLines = {
    rain: 'Está lloviendo en Madrid. Hoy no salgo ni loco.',
    drizzle: 'Chispea. Lo justo para despeinarte.',
    storm: '¿Has oído eso? Yo no me asusto, ¿eh?',
    snow: '¡Está nevando en Madrid! Esto no pasa nunca.',
    fog: 'Con esta niebla no se ve ni la Castellana.',
  };
  function weatherTalk() {
    later(weatherTalk, 45000);
    const line = weatherLines[weather.kind], key = `bb-chota-weather-${weather.kind}-${new Date().toDateString()}`;
    if (!line || session.get(key)) return;
    const room = document.querySelector('#clubhouseContent .clubhouse-room');
    if (!room || !live(room) || asleep(room) || room.querySelector('.clubhouse-bubble:not([hidden])') || document.querySelector('#chotaDecision[open]')) return;
    if (globalThis.ChotaRoom?.say?.(line, weather.kind === 'storm' ? 'look' : 'nod')) session.set(key);
  }

  // Rooms come and go (agenda rebuilds, the enlarged viewer); keep their layers.
  const root = document.getElementById('clubhouseContent');
  if (root) new MutationObserver(() => syncAll()).observe(root, {childList: true});
  new MutationObserver(records => {
    for (const record of records) {
      const target = record.target;
      if (record.type === 'attributes' && target.matches?.('.clubhouse-room, .chota-viewer-room-scene')) sync(target);
      for (const node of record.addedNodes || []) if (node.id === 'chotaViewer') later(syncAll, 50);
    }
  }).observe(document.body, {childList: true, subtree: false});
  const attributeWatch = new MutationObserver(records => records.forEach(record => sync(record.target)));
  const watched = new WeakSet();
  setInterval(() => {
    rooms().forEach(room => { if (!watched.has(room)) { watched.add(room); attributeWatch.observe(room, {attributes: true, attributeFilter: ['data-time', 'class']}); } });
    syncAll();
    void refreshWeather();
  }, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { syncAll(); void refreshWeather(); } });
  addEventListener('online', () => void refreshWeather());

  readCache();
  later(() => { syncAll(); rooms().forEach(room => { watched.add(room); attributeWatch.observe(room, {attributes: true, attributeFilter: ['data-time', 'class']}); }); void refreshWeather(); }, 600);
  later(cityFlicker, 4000);
  later(shootingStar, 20000);
  later(thunder, 9000);
  later(phone, 60000);
  later(weatherTalk, 25000);

  globalThis.ClubLife = Object.freeze({weather: () => ({...weather}), sync: syncAll, setWeather(kind) { weather = {...weather, kind}; syncAll(); }});
})();
