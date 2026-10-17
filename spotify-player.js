(() => {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const playlistId = value => String(value || '').match(/(?:open\.spotify\.com\/playlist\/|spotify:playlist:)([A-Za-z0-9]+)/)?.[1] || '';
  const native = () => window.Capacitor?.getPlatform?.() === 'ios';
  let plugin, listener, initialization, configuration, host, playlist = '', owner = '', generation = 0, pending = false, notice = '';
  let state = {connected:false, configured:false, installed:false, linked:false};
  let receivedAt = Date.now(), lastStateRequest = 0, stateRequest = false, hostObserver = null, hostVisible = false, seeking = false;
  const playerVisible = () => !!host?.isConnected && !document.hidden && (hostObserver ? hostVisible : !!host.getClientRects().length);
  const clock = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2,'0')}`;
  const svg = kind => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${kind === 'pause' ? '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>' : kind === 'previous' ? '<path d="M5 4h2v16H5zM19 4v16L8 12z"/>' : kind === 'next' ? '<path d="M17 4h2v16h-2zM5 4l11 8-11 8z"/>' : '<path d="M7 3l15 9-15 9z"/>'}</svg>`;
  function receive(value) {
    if (value.owner !== undefined && value.owner !== owner) return;
    const next = {...value};
    if (next.queueStatus === 'unavailable' && state.queue?.length && !next.queue?.length) next.queue = state.queue;
    if (next.playbackStatus === 'unavailable' && state.currentAvailable && !next.currentAvailable) {
      for (const key of ['currentAvailable','title','artist','artwork','duration','position','paused']) next[key] = state[key];
    }
    state = {...state, ...next}; receivedAt = Number(value.positionUpdatedAt) || Date.now();
    if (playerVisible()) draw();
  }
  function queueMarkup() {
    if (!state.linked) return '';
    const songs = Array.isArray(state.queue) ? state.queue : [];
    const status = ({loading:'Consultando la cola de Spotify…', empty:'No hay canciones en la cola. Pon música en Spotify para ver qué viene después.', authorization:'Spotify no permite consultar la cola. Revisa los permisos y el acceso de tu cuenta.', unavailable:'La cola no está disponible ahora. Volveremos a consultarla automáticamente.'})[state.queueStatus] || 'Consultando la cola de Spotify…';
    return `<section class="spotify-queue" aria-label="Siguientes canciones"><div class="spotify-queue-heading"><strong>A continuación</strong><span>Cola de Spotify</span></div>${songs.length && ['ready','unavailable','loading'].includes(state.queueStatus) ? `<ol>${songs.slice(0,20).map((song, index) => {
      const image = /^https:\/\//i.test(song.artwork || '') ? song.artwork : '';
      return `<li><span class="spotify-queue-number">${index + 1}</span>${image ? `<img src="${escape(image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span class="spotify-queue-placeholder" aria-hidden="true">♫</span>'}<div><strong>${escape(song.title)}</strong><span>${escape(song.artist)}</span></div><span class="spotify-queue-duration">${clock(Number(song.duration) || 0)}</span></li>`;
    }).join('')}</ol>${state.queueStatus === 'unavailable' ? '<p class="service-feedback" data-state="error">No se pudo actualizar. Mostramos la última cola.<button type="button" data-spotify="refresh">Reintentar</button></p>' : ''}` : `<p role="status">${escape(status)}</p>${state.queueStatus === 'authorization' ? '<button type="button" data-spotify="authorize">Revisar permisos de Spotify</button>' : state.queueStatus === 'unavailable' ? '<button type="button" data-spotify="refresh">Reintentar</button>' : ''}`}</section>`;
  }
  function accountMarkup() {
    if (!state.linked) return `<button type="button" class="spotify-connect" data-spotify="connect" ${pending || state.authorizing || !state.configured || !state.installed ? 'disabled' : ''}>Vincular Spotify</button>`;
    return `<div class="spotify-account-heading"><span class="spotify-linked">Cuenta vinculada</span><button type="button" class="spotify-disconnect" data-spotify="disconnect">Desvincular</button></div>${state.connected ? `<button type="button" class="spotify-listen" data-spotify="playlist" ${pending || state.commandPending || !state.canPlay ? 'disabled' : ''}>Escuchar playlist</button>` : `<button type="button" class="spotify-connect" data-spotify="connect" ${pending || state.authorizing || !state.installed ? 'disabled' : ''}>Abrir Spotify y volver a Big Boy</button>`}`;
  }
  function updateProgress() {
    if (!host || seeking) return;
    const elapsed = state.paused ? 0 : (Date.now() - receivedAt) * (state.speed || 1);
    const position = Math.min(state.duration || 0, Math.max(0, (state.position || 0) + elapsed));
    const input = host.querySelector('.spotify-progress input');
    if (input && document.activeElement !== input) input.value = position;
    const time = host.querySelector('[data-spotify-time]');
    if (time) time.textContent = clock(position);
  }
  function homeScrollAnchor() {
    const page = host?.closest('.page-section.active');
    const members = page?.querySelector('.home-members-section');
    if (!page || !members || !window.matchMedia('(max-width: 760px)').matches) return null;
    const viewport = page.getBoundingClientRect(), player = host.getBoundingClientRect();
    const top = members.getBoundingClientRect().top;
    // Keep the members the reader is looking at still when real Spotify data
    // above them changes (song, connection or queue), within this scroll owner.
    return page.scrollTop > 0 && player.top < viewport.top && top < viewport.bottom
      ? {page, members, top} : null;
  }
  function draw() {
    if (!host || !native() || !playlist) return;
    const disabled = pending || state.commandPending || !state.controlsAvailable;
    const current = state.currentAvailable === true;
    const playbackStatus = ({loading:'Consultando la reproducción de Spotify…', empty:'La playlist está lista. Abre Spotify y vuelve a Big Boy para escucharla.', authorization:'Spotify no permite consultar la reproducción. Revisa los permisos de tu cuenta.', unavailable:current ? 'No se ha podido actualizar la reproducción. Mostramos la última lectura.' : 'La reproducción no está disponible ahora. Volveremos a consultarla.'})[state.playbackStatus];
    const status = notice || (state.linked && !state.controlsAvailable && state.controlsNeedAuthorization ? 'Activa los controles de Spotify una vez para pausar y cambiar canciones desde la app.' : '') || (state.linked && !state.connected ? playbackStatus || (current ? `${state.paused ? 'En pausa' : 'Reproduciendo'} en Spotify. ${state.controlsAvailable ? 'Controles disponibles. Tu cuenta sigue vinculada.' : 'Abre Spotify y vuelve a Big Boy para recuperar la reproducción.'}` : '') : '') || state.message || (state.connected ? 'Conectado a Spotify' : state.connecting ? 'Conectando con Spotify…' : !state.configured ? 'Spotify estará disponible pronto.' : !state.installed ? 'Instala Spotify e inicia sesión para escuchar la playlist.' : state.linked ? 'Cuenta vinculada. Abre Spotify y vuelve a Big Boy para escuchar la playlist.' : 'Vincula Spotify y escucha la playlist completa.');
    const artwork = current && /^(?:data:image\/jpeg;base64,|https:\/\/)/i.test(state.artwork || '') ? escape(state.artwork) : '';
    const failed = !pending && !state.connecting && (!!notice || state.playbackStatus === 'unavailable');
    const phase = pending || state.connecting || state.playbackStatus === 'loading' ? 'loading' : failed ? 'error' : 'ready';
    const queueTop = host.querySelector('.spotify-queue ol')?.scrollTop || 0;
    const markup = `<div class="club-spotify-player"><div class="spotify-now"><div class="spotify-art">${artwork ? `<img src="${artwork}" alt="Carátula">` : '<span aria-hidden="true">♫</span>'}</div><div class="spotify-track"><span class="spotify-brand">Spotify</span><strong>${escape(current && state.title ? state.title : 'La música del club')}</strong><span>${escape(current ? state.artist || state.contextTitle || 'Nuestra playlist' : 'Nuestra playlist')}</span></div></div><div class="spotify-controls"><button type="button" data-spotify="previous" aria-label="Canción anterior" ${disabled || !state.canSkipPrevious ? 'disabled' : ''}>${svg('previous')}</button><button type="button" class="spotify-toggle" data-spotify="toggle" aria-label="${state.paused ? 'Reanudar' : 'Pausar'}" ${disabled || !state.canToggle ? 'disabled' : ''}>${svg(state.paused ? 'play' : 'pause')}</button><button type="button" data-spotify="next" aria-label="Canción siguiente" ${disabled || !state.canSkipNext ? 'disabled' : ''}>${svg('next')}</button></div><div class="spotify-progress"><input type="range" min="0" max="${Math.max(1,state.duration || 0)}" value="0" aria-label="Posición de la canción" ${disabled || !state.canSeek ? 'disabled' : ''}><div><span data-spotify-time>0:00</span><span>${clock(state.duration || 0)}</span></div></div><div class="spotify-status service-feedback" data-state="${phase}" role="status"><span>${escape(status)}</span>${failed ? '<button type="button" data-spotify="refresh">Reintentar</button>' : ''}</div><div class="spotify-account">${accountMarkup()}</div>${state.linked && (state.controlsNeedAuthorization || state.playbackStatus === 'authorization') ? `<button type="button" class="spotify-authorize" data-spotify="authorize" ${pending || state.authorizing ? 'disabled' : ''}>${state.controlsNeedAuthorization ? 'Activar controles' : 'Revisar permisos de Spotify'}</button>` : ''}${queueMarkup()}</div>`;
    if (host._spotifyMarkup === markup) { updateProgress(); return; }
    // Polls preserve the visible queue and a seek gesture in progress.
    if (seeking) return;
    const anchor = homeScrollAnchor();
    host.innerHTML = markup; host._spotifyMarkup = markup;
    updateProgress();
    if (anchor) anchor.page.scrollTop += anchor.members.getBoundingClientRect().top - anchor.top;
    const queue = host.querySelector('.spotify-queue ol'); if (queue) queue.scrollTop = queueTop;
  }
  async function initialize() {
    if (initialization) return initialization;
    initialization = (async () => {
      plugin = window.Capacitor.registerPlugin('ClubSpotify');
      listener = await plugin.addListener('playerState', receive);
    })().catch(() => { plugin = null; initialization = null; notice = 'No se ha podido preparar Spotify. Vuelve a abrir la aplicación.'; draw(); });
    return initialization;
  }
  async function action(command, position) {
    if (command === 'refresh') {
      if (pending) return;
      pending = true; notice = 'Actualizando Spotify…'; draw();
      const token = generation;
      try {
        await window.ClubSpotify.mount(host, `spotify:playlist:${playlist}`, owner);
        if (plugin && token === generation) receive(await plugin.getState());
      } catch { if (token === generation) notice = 'No se pudo actualizar Spotify. Comprueba la conexión.'; }
      finally { if (token === generation) { pending = false; if (notice === 'Actualizando Spotify…') notice = ''; draw(); } }
      return;
    }
    if (!plugin || pending) return;
    const actionGeneration = generation;
    pending = true; notice = ''; draw();
    try {
      if (command === 'connect' || command === 'authorize') { const value = await plugin.connect({uri:`spotify:playlist:${playlist}`, authorize:command === 'authorize'}); if (actionGeneration === generation) receive(value); }
      else if (command === 'disconnect') receive(await plugin.disconnect());
      else await plugin.command({action:command === 'toggle' ? state.paused ? 'resume' : 'pause' : command === 'playlist' ? 'play' : command, uri:`spotify:playlist:${playlist}`, position});
    } catch (error) { if (actionGeneration !== generation) return; notice = error.message || 'Spotify no ha podido completar la acción. Inténtalo de nuevo.'; }
    finally { if (actionGeneration === generation) { pending = false; draw(); } }
  }
  document.addEventListener('click', event => { const button = event.target.closest('[data-spotify]'); if (button && host?.contains(button)) action(button.dataset.spotify); });
  document.addEventListener('pointerdown', event => { if (host?.contains(event.target) && event.target.matches('.spotify-progress input')) seeking = true; });
  for (const type of ['pointerup', 'pointercancel']) document.addEventListener(type, () => { if (seeking) { seeking = false; window.setTimeout(draw, 0); } });
  document.addEventListener('change', event => { if (host?.contains(event.target) && event.target.matches('.spotify-progress input')) action('seek', Number(event.target.value)); });
  setInterval(() => {
    if (!playerVisible() || !state.currentAvailable || state.playbackStatus === 'unavailable' || state.paused) return;
    updateProgress();
  }, 1000);
  const refreshState = () => {
    const interval = state.currentAvailable && !state.paused ? 15000 : state.connected ? 30000 : 60000;
    if (document.activeElement?.matches('input:not([type=range]),textarea,[contenteditable=true]')) return;
    if (!plugin || !configuration || !owner || !state.linked || !playerVisible() || stateRequest || Date.now() - lastStateRequest < interval) return;
    lastStateRequest = Date.now();
    const token = generation;
    stateRequest = true;
    plugin.getState().then(value => { if (token === generation) receive(value); }).catch(() => {}).finally(() => {stateRequest = false;});
  };
  setInterval(refreshState, 10000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { lastStateRequest = 0; draw(); refreshState(); } });
  window.addEventListener('focus', refreshState);
  window.ClubSpotify = {
    async mount(element, url, userId) {
      if (host !== element) {
        hostObserver?.disconnect(); host = element; hostVisible = false;
        hostObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
          hostVisible = entries.some(entry => entry.isIntersecting);
          if (playerVisible()) {draw();refreshState();}
        }) : null;
        hostObserver?.observe(host);
      }
      const id = playlistId(url);
      if (!id) { playlist = ''; host.innerHTML = '<div class="empty-state"><strong>La música está por llegar.</strong><span>Aquí sonará la playlist del club.</span></div>'; return; }
      if (!native()) {
        if (host.dataset.spotifyPlaylist === id) return;
        host.dataset.spotifyPlaylist = id;
        host.innerHTML = `<iframe src="https://open.spotify.com/embed/playlist/${id}?utm_source=generator&theme=0" title="Playlist del club en Spotify" width="100%" height="352" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe><p class="spotify-web-note">El reproductor web puede limitarse a muestras. <a href="https://open.spotify.com/playlist/${id}" target="_blank" rel="noopener">Escuchar playlist en Spotify ↗</a></p>`;
        return;
      }
      const nextOwner = userId || '';
      const changed = owner !== nextOwner; playlist = id; owner = nextOwner;
      if (changed) {
        ++generation; configuration = null; pending = false; notice = '';
        lastStateRequest = 0;
        state = {connected:false,configured:false,linked:false,installed:false};
      }
      const token = generation;
      draw();
      await initialize();
      // A render awaiting the bridge must never configure a different account.
      if (!plugin || token !== generation) return;
      const clientId = window.BIG_BOY_CONFIG?.spotifyClientId || '';
      if (!configuration || configuration.token !== token || configuration.clientId !== clientId) {
        const request = {token, clientId};
        configuration = request;
        request.promise = plugin.configure({clientId, owner:nextOwner}).then(value => {
          if (token === generation) receive(value);
        }).catch(() => {
          if (token !== generation) return;
          if (configuration === request) configuration = null;
          notice = 'Spotify no está disponible en este momento.'; draw();
        });
      }
      await configuration.promise;
    },
    async disconnect() { ++generation; configuration = null; owner = ''; pending = false; notice = ''; state = {connected:false,configured:false,linked:false,installed:false}; if (plugin) { try { await plugin.configure({clientId:'', owner:''}); } catch {} } draw(); }
  };
})();
