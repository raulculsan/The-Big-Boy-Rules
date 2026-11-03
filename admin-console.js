/* Presentation settings are data, never markup or access-control rules. */
(() => {
  'use strict';
  const SETTING_KEY = 'club_presentation_v1';
  const PALETTES = Object.freeze({
    gold: {label: 'Oro del club', color: '#dbba73', soft: '#efdaa7', light: '#866119', lightSoft: '#a27a30'},
    blue: {label: 'Azul eléctrico', color: '#8ebdff', soft: '#c3dcff', light: '#235f9c', lightSoft: '#477aab'},
    jade: {label: 'Jade', color: '#7ccbad', soft: '#b8ead7', light: '#207052', lightSoft: '#3d8869'},
    coral: {label: 'Coral', color: '#f5a58e', soft: '#ffd4c8', light: '#ac442a', lightSoft: '#c0654e'}
  });
  const DEFAULTS = Object.freeze({
    clubName: 'The Big Boy Rules', homeTitle: 'Inicio', membersTitle: 'Miembros',
    plansTitle: 'La sede del club', newsTitle: 'Al día', musicTitle: 'Nuestra música',
    accent: 'gold', density: 'comfortable', showNews: true, showPlans: true,
    showMusic: true, announcementEnabled: false, announcementTitle: '', announcementText: ''
  });
  const TEXT_LIMITS = {clubName: 40, homeTitle: 36, membersTitle: 36, plansTitle: 36, newsTitle: 36, musicTitle: 36, announcementTitle: 64, announcementText: 240};
  const cleanText = (value, fallback, limit) => typeof value === 'string' ? (value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, limit) || fallback) : fallback;
  function normalize(input) {
    let value = input;
    if (typeof value === 'string') { try { value = JSON.parse(value); } catch { value = {}; } }
    if (!value || typeof value !== 'object' || Array.isArray(value)) value = {};
    const result = {...DEFAULTS};
    for (const [key, limit] of Object.entries(TEXT_LIMITS)) result[key] = cleanText(value[key], DEFAULTS[key], limit);
    for (const key of ['showNews', 'showPlans', 'showMusic', 'announcementEnabled']) result[key] = typeof value[key] === 'boolean' ? value[key] : DEFAULTS[key];
    result.accent = typeof value.accent === 'string' && Object.hasOwn(PALETTES, value.accent) ? value.accent : 'gold';
    result.density = value.density === 'compact' ? 'compact' : 'comfortable';
    return result;
  }
  function apply(settings) {
    const value = normalize(settings?.[SETTING_KEY]);
    const palette = PALETTES[value.accent], root = document.documentElement;
    root.dataset.clubAccent = value.accent;
    root.style.setProperty('--club-accent-color', palette.color);
    root.style.setProperty('--club-accent-soft', palette.soft);
    root.style.setProperty('--club-accent-light', palette.light);
    root.style.setProperty('--club-accent-light-soft', palette.lightSoft);
    root.dataset.clubDensity = value.density;
    const setText = (selector, text) => { const node = document.querySelector(selector); if (node && node.textContent !== text) node.textContent = text; };
    setText('#inicio .club-welcome .eyebrow', value.clubName);
    setText('#inicio .club-welcome h2', value.homeTitle);
    setText('#clubMembersTitle', value.membersTitle);
    setText('#clubhouseTitle', value.plansTitle === 'Próximos planes' ? 'La sede del club' : value.plansTitle);
    setText('#clubNewsTitle', value.newsTitle);
    setText('#inicio .spotify-panel h3', value.musicTitle);
    for (const [selector, key] of [['#noticias', 'showNews'], ['#inicio .clubhouse', 'showPlans'], ['#inicio .spotify-panel', 'showMusic']]) document.querySelector(selector)?.classList.toggle('club-section-disabled', !value[key]);
    const dashboard = document.querySelector('#inicio .club-dashboard');
    dashboard?.classList.toggle('club-dashboard-single', value.showMusic !== value.showPlans);
    dashboard?.classList.toggle('club-section-disabled', !value.showMusic && !value.showPlans);
    const notice = document.getElementById('clubAdminAnnouncement');
    if (notice) { notice.hidden = !value.announcementEnabled || !value.announcementText; setText('#clubAdminAnnouncement strong', value.announcementTitle || 'Aviso del club'); setText('#clubAdminAnnouncement p', value.announcementText); }
    return value;
  }
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${({
    panel: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    people: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-16a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5"/>',
    paint: '<path d="m14 3 7 7-11 11H3v-7L14 3Zm-8 9 7 7M11 6l7 7"/>',
    pulse: '<path d="M2 12h5l3-8 4 16 3-8h5"/>',
    trophy: '<path d="M8 3h8v6a4 4 0 0 1-8 0V3ZM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 2v6m-4 2h8"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>',
    chat: '<path d="M21 11a8 8 0 0 1-8 8H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v4Z"/><path d="M7 8h10M7 12h6"/>',
    cards: '<rect x="3" y="7" width="12" height="15" rx="2"/><path d="M8 7V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M6 12h6m-6 4h4"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    logout: '<path d="M10 3H4v18h6m5-14 5 5-5 5M8 12h12"/>',
    gift: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 13h18M12 8S10 3 7 4s0 4 5 4Zm0 0s2-5 5-4 0 4-5 4Z"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M14.8 8.5h-4a2 2 0 0 0 0 4h2.4a2 2 0 0 1 0 4H9M12 6v12"/>',
    pack: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M5 6h14M5 18h14M9 12h6"/>',
    market: '<path d="M4 9h16l-1.5-5h-13zM5 9v11h14V9M9 20v-6h6v6"/>',
    megaphone: '<path d="M3 10v4h4l8 5V5L7 10H3Zm15-2a5 5 0 0 1 0 8"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 18 17"/>',
    fire: '<path d="M12 3c2 3 5 4.5 5 9a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.5 1 2.5 2 3 0-3 .5-5.5 1-7.5Z"/>'
  })[name] || ''}</svg>`;
  function createConsole(api) {
    const mount = document.getElementById('superAdminConsole');
    if (!mount) return {sync() {}, apply};
    let owner = null, saved = normalize(), draft = {...saved}, dirty = false, busy = false, ready = false;
    mount.innerHTML = `
      <header class="control-bar"><button type="button" data-control-back aria-label="Volver a administración" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg></button><h2 data-control-title>Administración</h2></header>
      <div data-control-panel="overview">
        <section class="ctl-hero" aria-label="Pulso del club">
          <div class="ctl-hero-top"><div><span class="ctl-kicker" data-ctl-date></span><h3>Hola, <b data-control-username></b></h3><p data-ctl-headline>Cargando el pulso del club…</p></div><div class="ctl-hero-actions"><button type="button" class="ctl-icon-button" data-ctl-refresh aria-label="Actualizar el panel">${icon('refresh')}</button><button type="button" class="ctl-icon-button" data-control-action="logout" aria-label="Cerrar sesión" title="Cerrar sesión">${icon('logout')}</button></div></div>
          <div class="ctl-kpis">
            <div class="ctl-kpi" style="--tone:#5ac8fa">${icon('people')}<strong data-ctl="active_today">—</strong><span>activos hoy</span><small data-ctl-sub="members">de — miembros</small></div>
            <div class="ctl-kpi" style="--tone:#ff9f0a">${icon('pack')}<strong data-ctl="packs_opened_week">—</strong><span>sobres abiertos</span><small>últimos 7 días</small></div>
            <div class="ctl-kpi" style="--tone:#30d158">${icon('coin')}<strong data-ctl="coins_circulating">—</strong><span>monedas en el club</span><small data-ctl-sub="coins">—</small></div>
            <div class="ctl-kpi" style="--tone:#bf5af2">${icon('trophy')}<strong data-ctl="trophies_week">—</strong><span>trofeos ganados</span><small>últimos 7 días</small></div>
          </div>
          <figure class="ctl-chart"><figcaption><span>Miembros activos</span><small data-ctl-sub="week">14 días</small></figcaption><div class="ctl-bars" data-ctl-bars role="img" aria-label="Miembros activos cada día"></div></figure>
        </section>
        <div class="ctl-alerts" data-ctl-alerts></div>
        <section class="ctl-section"><h3>Acciones rápidas</h3><div class="ctl-quick">${[
          ['tab','gift','gift','Regalar al club','Sobres o monedas para todos','#ff375f'],
          ['tab','requests','people','Solicitudes','Nuevos accesos al club','#5ac8fa','<small class="ctl-badge" data-request-count hidden></small>'],
          ['route','admin-cuentas','people','Cuentas','Perfiles, sobres y monedas','#64d2ff'],
          ['tab','economy','cards','Tienda y sobres','Precios y rarezas','#30d158'],
          ['tab','market','market','Mercado','Cartas a la venta','#ffd60a'],
          ['route','admin-logros','trophy','Logros','Trofeos y escaleras','#bf5af2'],
          ['tab','design','paint','Personalizar','Nombre, colores y aviso','#ff9f0a','<span class="ctl-badge" data-control-unsaved hidden>Sin publicar</span>'],
          ['tab','updates','panel','Actualizaciones','Versión de Android','#8e8e93']
        ].map(([kind,target,symbol,title,detail,tone,extra='']) => `<button type="button" class="ctl-tile" style="--tone:${tone}" data-control-${kind}="${target}"><span class="ctl-tile-icon">${icon(symbol)}</span>${extra}<strong>${title}</strong><small>${detail}</small></button>`).join('')}</div></section>
        <div class="ctl-split">
          <section class="ctl-card"><header><h3>Economía · 7 días</h3>${icon('coin')}</header><dl class="ctl-ledger" data-ctl-economy><div><dt>Cargando…</dt><dd></dd></div></dl></section>
          <section class="ctl-card"><header><h3>Podio</h3><div class="ctl-segment" role="group" aria-label="Clasificación">${[['top_collectors','Cartas'],['top_coins','Monedas'],['top_streaks','Racha']].map(([key,label],i) => `<button type="button" data-ctl-podium="${key}" aria-pressed="${i===0}">${label}</button>`).join('')}</div></header><ol class="ctl-podium" data-ctl-podium-list></ol></section>
        </div>
        <section class="ctl-card ctl-feed"><header><h3>Actividad reciente</h3>${icon('fire')}</header><ul data-ctl-feed><li class="ctl-empty">Cargando…</li></ul></section>
        <h3 class="ctl-tools-heading">Todas las herramientas</h3>
        ${[
          ['Club', [
            ['route', 'ayuda', 'help', 'Ayuda y solicitudes', 'Mensajes de los miembros'],
            ['route', 'calendario', 'calendar', 'Agenda', 'Cumpleaños, eventos y asistencia'],
            ['route', 'chat', 'chat', 'Conversaciones', 'Secciones, encuestas y mensajes automáticos'],
            ['route', 'catalogo', 'cards', 'Colección', 'Cartas, rarezas y puntuaciones'],
            ['route', 'admin-diagnostico', 'pulse', 'Rendimiento y diagnóstico', 'Estado de este dispositivo']
          ]]
        ].map(([heading, rows]) => `<section class="control-group"><h3>${heading}</h3>${rows.map(([kind, target, symbol, title, detail, extra = '']) => `<button type="button" class="control-row" data-control-${kind}="${target}">${icon(symbol)}<span><strong>${title}</strong><small>${detail}</small></span>${extra}<i aria-hidden="true"></i></button>`).join('')}</section>`).join('')}
        <section class="control-group" data-control-security><h3>Tu cuenta</h3><button type="button" class="control-row" data-control-action="preview">${icon('eye')}<span><strong>Ver el club</strong><small>Como lo ven los miembros</small></span><i aria-hidden="true"></i></button></section>
        <footer class="control-session"><span>Sesión de <b data-control-username></b></span><button type="button" class="ctl-logout" data-control-action="logout">${icon('logout')}Cerrar sesión</button></footer>
      </div>
      <section data-control-panel="requests" class="request-admin-section" hidden aria-label="Solicitudes de cuenta">
        <div class="request-section-heading"><div><p>Revisa quién quiere entrar y decide cuándo activar su cuenta.</p></div><button type="button" data-request-refresh>Actualizar</button></div>
        <div data-request-review><p class="request-intro">Las solicitudes aparecen al enviarse. Para aceptar una cuenta, su correo debe estar verificado.</p><p class="request-feedback" role="status" aria-live="polite"></p><div class="request-review-list"></div></div>
      </section>
      <section data-control-panel="gift" class="ctl-gift" hidden aria-label="Regalar al club">
        <form class="ctl-card ctl-gift-form" data-ctl-gift-form>
          <p class="ctl-lead">Un regalo para todos los miembros a la vez. Cada uno recibe un aviso; los sobres se suman a su saldo.</p>
          <fieldset><legend>Sobres por miembro</legend><div class="ctl-chips">${[0,1,2,3,5,10].map(n => `<label><input type="radio" name="packs" value="${n}" ${n===1?'checked':''}><span>${n}</span></label>`).join('')}</div></fieldset>
          <fieldset><legend>Monedas por miembro</legend><div class="ctl-chips">${[0,10,25,50,100,250].map(n => `<label><input type="radio" name="coins" value="${n}" ${n===0?'checked':''}><span>${n}</span></label>`).join('')}</div></fieldset>
          <label class="ctl-field">Nota para el aviso (opcional)<input name="note" maxlength="120" placeholder="Por ejemplo: ¡Por el aniversario del club!" autocomplete="off"></label>
          <p class="ctl-gift-summary" data-ctl-gift-summary></p>
          <button type="submit" class="ctl-primary" data-ctl-gift-submit>Preparar regalo</button>
          <p class="ctl-feedback" data-ctl-gift-feedback role="status" aria-live="polite"></p>
        </form>
        <section class="ctl-card"><header><h3>Últimos regalos</h3>${icon('gift')}</header><ul class="ctl-list" data-ctl-gifts><li class="ctl-empty">Todavía no hay regalos.</li></ul></section>
      </section>
      <section data-control-panel="market" class="ctl-market" hidden aria-label="Mercado">
        <section class="ctl-card"><header><h3>Cartas a la venta</h3><button type="button" class="ctl-icon-button" data-ctl-market-reload aria-label="Actualizar mercado">${icon('refresh')}</button></header>
          <p class="ctl-lead">Retirar una carta la devuelve al álbum de quien la vendía y le avisa.</p>
          <ul class="ctl-list" data-ctl-market><li class="ctl-empty">Cargando…</li></ul><p class="ctl-feedback" data-ctl-market-feedback role="status" aria-live="polite"></p></section>
      </section>
      <section data-control-panel="economy" class="control-economy" hidden aria-label="Tienda y sobres">
        <div class="control-design-intro"><div><p>Precios en monedas y probabilidades de cada rareza para todos los usuarios.</p></div><button type="button" data-economy-reload>Actualizar datos</button></div>
        <div data-economy-content></div><p data-economy-feedback role="status" aria-live="polite"></p>
      </section>
      <section data-control-panel="updates" class="control-releases" hidden aria-label="Actualizaciones de Android"><div data-release-content></div></section>
      <div data-control-panel="design" hidden>
        <div class="control-design-intro"><div><p>Los cambios se publican para todos en Android, iPhone y web.</p></div><div class="control-settings-sync"><span data-control-settings-state>Esperando configuración</span><button type="button" data-control-action="reload">Sincronizar</button></div></div>
        <form id="clubPresentationForm" class="control-editor">
          <div class="control-editor-fields">
            <section class="control-editor-section"><header><i>${icon('paint')}</i><div><h4>Identidad y aspecto</h4><p>Una misma personalidad en cada pantalla.</p></div></header>
              <label>Nombre del club<input name="clubName" maxlength="40" required autocomplete="off"></label>
              <fieldset class="control-palette"><legend>Color de acento</legend>${Object.entries(PALETTES).map(([key, p]) => `<label style="--swatch:${p.color}"><input type="radio" name="accent" value="${key}"><span></span><small>${p.label}</small></label>`).join('')}</fieldset>
              <label>Espacio entre secciones<select name="density"><option value="comfortable">Cómodo</option><option value="compact">Compacto</option></select></label>
            </section>
            <section class="control-editor-section"><header><i>${icon('panel')}</i><div><h4>Pantalla de inicio</h4><p>Elige los nombres y qué secciones se muestran.</p></div></header>
              <div class="control-field-pair"><label>Título principal<input name="homeTitle" maxlength="36" required></label><label>Sección de miembros<input name="membersTitle" maxlength="36" required></label></div>
              ${[['plansTitle', 'showPlans', 'Sede del club'], ['musicTitle', 'showMusic', 'Spotify'], ['newsTitle', 'showNews', 'Noticias']].map(([key, toggle, label]) => `<div class="control-section-setting"><label>${label}<input name="${key}" maxlength="36" required></label><label class="control-switch"><input name="${toggle}" type="checkbox"><span></span><b>Visible</b></label></div>`).join('')}
              <p class="control-field-note">La visibilidad afecta al inicio; el calendario y las demás funciones siguen disponibles desde su navegación.</p>
            </section>
            <section class="control-editor-section"><header><i>${icon('chat')}</i><div><h4>Aviso del club</h4><p>Un mensaje destacado al entrar en Inicio.</p></div></header>
              <label class="control-switch control-notice-toggle"><input name="announcementEnabled" type="checkbox"><span></span><b>Mostrar aviso</b></label>
              <label>Título del aviso<input name="announcementTitle" maxlength="64" placeholder="Por ejemplo: Novedades del club"></label>
              <label>Mensaje<textarea name="announcementText" maxlength="240" rows="3" placeholder="Escribe el aviso para todos los miembros"></textarea><small data-control-notice-count>0 / 240</small></label>
            </section>
          </div>
          <aside class="control-preview-column"><div class="control-preview-label"><span>VISTA PREVIA</span><small>Sin publicar</small></div><div class="control-phone-preview"><header><span>BB</span><i></i><i></i></header><div class="control-preview-welcome"><small data-preview="clubName"></small><h4 data-preview="homeTitle"></h4></div><div class="control-preview-notice"><small>AVISO DEL CLUB</small><strong data-preview="announcementTitle"></strong><p data-preview="announcementText"></p></div><section data-preview-section="showNews"><span>ACTUALIDAD</span><strong data-preview="newsTitle"></strong><div class="control-preview-news"><i></i><i></i></div></section><div class="control-preview-dashboard"><section data-preview-section="showPlans"><strong data-preview="plansTitle"></strong><i></i><i></i></section><section data-preview-section="showMusic"><strong data-preview="musicTitle"></strong><div class="control-preview-record"></div></section></div><section><strong data-preview="membersTitle"></strong><div class="control-preview-people"><i></i><i></i><i></i></div></section></div><p class="control-preview-caption">Colores, títulos, avisos y distribución. Vista orientativa; los datos del club se conservan.</p></aside>
          <footer class="control-publish-bar"><div><strong data-control-save-state>Sin cambios</strong><small data-control-feedback role="status" aria-live="polite">Carga la configuración para editar.</small></div><div><button type="button" data-control-action="revert" disabled>Revertir</button><button type="submit" data-control-save disabled>Publicar cambios</button></div></footer>
          <button type="button" class="control-defaults" data-control-action="defaults" disabled>Preparar valores originales</button>
        </form>
      </div>`;
    // The security entry keeps its app listener; it only moves into the list.
    const securityEntry = document.getElementById('adminSecurityButton');
    if (securityEntry) { securityEntry.classList.add('control-row'); mount.querySelector('[data-control-security] h3').after(securityEntry); }
    const form = mount.querySelector('#clubPresentationForm'), fields = form.elements;
    const dock = document.createElement('nav');
    dock.id = 'superAdminDock'; dock.className = 'control-dock'; dock.hidden = true; dock.setAttribute('aria-label', 'Navegación de administración');
    dock.innerHTML = [['panel', 'administracion', 'Panel'], ['people', 'admin-cuentas', 'Cuentas'], ['trophy', 'admin-logros', 'Logros'], ['eye', 'inicio', 'Ver club']].map(([symbol, route, label]) => `<button type="button" data-control-route="${route}">${icon(symbol)}<span>${label}</span></button>`).join('');
    document.body.append(dock);
    const feedback = mount.querySelector('[data-control-feedback]');
    const economyContent = mount.querySelector('[data-economy-content]');
    const economyFeedback = mount.querySelector('[data-economy-feedback]');
    const economyReload = mount.querySelector('[data-economy-reload]');
    const releaseAdmin = globalThis.ClubAppUpdate?.createAdmin(mount.querySelector('[data-release-content]'), {client:api.releaseClient, allowed:api.allowed, owner:api.owner});
    const rarityLabels = {common:'Común',retro:'Retro',special:'Especial',epic:'Épica',legendary:'Legendaria',full_art:'Full Art',vice_city:'Vice City',halloween:'Halloween'};
    const safe = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    let economy = null, economyBusy = false, economyOwner = null, economyRequest = 0;
    async function economyRPC(name, args) {
      const result = await api.rpc(name, args);
      if (result.error) throw result.error;
      return result.data;
    }
    // Rarity tones match the pack-opening colours, so the chart reads like the packs.
    const rarityTones = {common:'#a1a1aa',retro:'#c9b08a',special:'#8fc7ff',epic:'#c79bff',legendary:'#ffd76e',full_art:'#9ff2e6',vice_city:'#ff6fc4',halloween:'#ff9a4a'};
    function drawEconomy() {
      if (!economy) return;
      const products = (rows, kind) => rows.map(item => `<label class="ctl-price-row"><span class="ctl-price-name"><strong>${safe(item.name)}</strong><small><span class="ctl-pill ${item.active ? 'is-on' : ''}">${item.active ? 'En tienda' : 'Fuera de catálogo'}</span>${item.minimum_price ? ` mínimo ${safe(item.minimum_price)}` : ''}</small></span><span class="ctl-number">${icon('coin')}<input type="number" inputmode="numeric" min="${item.minimum_price || 0}" max="1000000" step="1" required aria-label="Precio de ${safe(item.name)}" data-price-kind="${kind}" data-price-id="${safe(item.id)}" value="${safe(item.price)}"></span></label>`).join('') || '<p class="ctl-empty">Aún no hay artículos.</p>';
      const block = (title, symbol, rows, kind, lead) => `<section class="ctl-card"><header><h3>${title} <span class="ctl-count">${rows.length}</span></h3>${icon(symbol)}</header><p class="ctl-lead">${lead}</p><div class="ctl-price-list">${products(rows, kind)}</div></section>`;
      economyContent.innerHTML = `<form class="control-economy-form ctl-economy">
        <section class="ctl-card ctl-odds"><header><h3>Probabilidades de los sobres</h3>${icon('pack')}</header>
          <p class="ctl-lead">6 cartas por sobre: 3 miembros o personajes, 2 objetos y 1 ubicación, sin repetir carta dentro del sobre.</p>
          <div class="ctl-odds-bar" data-odds-bar aria-hidden="true">${Object.keys(rarityLabels).map(key => `<i data-odds-segment="${key}" style="--tone:${rarityTones[key]}"></i>`).join('')}</div>
          <div class="ctl-odds-list">${Object.entries(rarityLabels).map(([key, label]) => `<label class="ctl-odds-row" style="--tone:${rarityTones[key]}"><i aria-hidden="true"></i><span><strong>${label}</strong><small data-odds-hint="${key}"></small></span><span class="ctl-number"><input type="number" inputmode="decimal" min="0" max="100" step="0.01" required data-rarity="${key}" aria-label="Porcentaje ${label}" value="${safe(economy.probabilities[key])}"><b>%</b></span></label>`).join('')}</div>
          <p class="control-odds-total ctl-odds-total" data-economy-total></p>
          <p class="ctl-note">Porcentajes base por carta. Si una rareza se agota en una categoría, el resto se ajusta en proporción. Halloween se aplica a cada hueco de miembro. Pon 0 para desactivar una rareza.</p>
        </section>
        ${block('Banners de perfil', 'paint', economy.banners, 'banner', 'Precio de cada diseño para el perfil.')}
        ${block('Vales del club', 'trophy', economy.vouchers, 'voucher', 'Precio para desbloquear cada premio.')}
        ${Array.isArray(economy.chota_items) ? block('Objetos del Chota', 'gift', economy.chota_items, 'chota', 'Precio de los objetos de su habitación. Algunos desbloquean juegos.') : ''}
        <footer class="ctl-save-bar"><div><strong>Publicar para todo el club</strong><small>Los sobres ya abiertos conservan sus cartas.</small></div><button type="submit" class="ctl-primary" data-economy-save>Guardar cambios</button></footer>
      </form>`;
      economyContent.querySelector('form').addEventListener('input', updateEconomyTotal);
      economyContent.querySelector('form').addEventListener('submit', saveEconomy);
      updateEconomyTotal();
    }
    function updateEconomyTotal() {
      const inputs = [...economyContent.querySelectorAll('[data-rarity]')];
      const total = inputs.reduce((sum, input) => sum + Math.round(Number(input.value) * 100), 0);
      const valid = total === 10000 && inputs.every(input => input.value !== '' && input.validity.valid);
      for (const input of inputs) {
        const share = Math.max(0, Number(input.value) || 0);
        economyContent.querySelector(`[data-odds-segment="${input.dataset.rarity}"]`).style.flexGrow = String(share);
        economyContent.querySelector(`[data-odds-hint="${input.dataset.rarity}"]`).textContent = share > 0 ? `≈ 1 de cada ${new Intl.NumberFormat('es-ES', {maximumFractionDigits: share >= 10 ? 1 : 0}).format(100 / share)} cartas` : 'Desactivada';
      }
      const label = economyContent.querySelector('[data-economy-total]');
      label.textContent = `Total: ${(total / 100).toLocaleString('es-ES', {maximumFractionDigits:2})}%${valid ? ' · Listo para guardar' : ' · Debe sumar 100%'}`;
      label.classList.toggle('is-invalid', !valid);
      economyContent.querySelector('[data-economy-save]').disabled = economyBusy || !valid;
    }
    async function loadEconomy() {
      if (!api.allowed() || economyBusy) return;
      const actor = api.owner(), request = ++economyRequest;
      economyBusy = true; economyReload.disabled = true;
      economyFeedback.textContent = 'Cargando precios y probabilidades…';
      try {
        const data = await economyRPC('admin_get_club_economy');
        if (!api.allowed() || api.owner() !== actor || request !== economyRequest) return;
        economyOwner = actor; economy = data; drawEconomy();
        economyFeedback.textContent = 'Los cambios se aplican al guardar.';
      } catch (error) {
        if (api.owner() === actor && request === economyRequest) economyFeedback.textContent = ['PGRST202','42883'].includes(error.code) ? 'Falta activar la configuración de tienda en el servidor.' : error.message || 'No se pudieron cargar los datos.';
      } finally {
        if (request === economyRequest) { economyBusy = false; economyReload.disabled = false; if (economy) updateEconomyTotal(); }
      }
    }
    async function saveEconomy(event) {
      event.preventDefault();
      if (economyBusy || !api.allowed() || economyOwner !== api.owner() || !event.target.reportValidity()) return;
      const actor = api.owner(), request = ++economyRequest;
      const probabilities = Object.fromEntries([...economyContent.querySelectorAll('[data-rarity]')].map(input => [input.dataset.rarity, Number(input.value)]));
      const prices = [...economyContent.querySelectorAll('[data-price-id]')].map(input => ({kind:input.dataset.priceKind,id:input.dataset.priceId,price:Number(input.value)}));
      economyBusy = true; economyReload.disabled = true;
      economyContent.querySelectorAll('input,button').forEach(input => {input.disabled = true;});
      economyFeedback.textContent = 'Guardando para Android, iPhone y web…';
      try {
        const data = await economyRPC('admin_save_club_economy', {p_revision:economy.revision,p_probabilities:probabilities,p_prices:prices});
        if (!api.allowed() || api.owner() !== actor || request !== economyRequest) return;
        economy = data; drawEconomy();
        economyFeedback.textContent = 'Guardado. Los nuevos precios y porcentajes ya están activos.';
        Promise.resolve(api.refreshShop?.()).catch(() => {});
      } catch (error) {
        if (api.owner() === actor && request === economyRequest) economyFeedback.textContent = error.message || 'No se guardó. Comprueba la conexión y vuelve a intentarlo.';
      } finally {
        if (request === economyRequest) { economyBusy = false; economyReload.disabled = false; economyContent.querySelectorAll('input,button').forEach(input => {input.disabled = false;}); if (economy) updateEconomyTotal(); }
      }
    }
    economyReload.addEventListener('click', loadEconomy);

    const TAB_TITLES = {overview:'Administración', requests:'Solicitudes', economy:'Tienda y sobres', updates:'Actualizaciones', design:'Personalización', gift:'Regalar al club', market:'Mercado'};
    // Club pulse ------------------------------------------------------------
    const number = value => new Intl.NumberFormat('es-ES').format(Number(value) || 0);
    let dashboard = null, dashboardAt = 0, dashboardRequest = 0, podium = 'top_collectors', giftId = null, giftArmed = false, giftBusy = false;
    const $ = selector => mount.querySelector(selector);
    function relative(at) {
      const minutes = Math.max(0, Math.round((Date.now() - Date.parse(at)) / 60000));
      return minutes < 1 ? 'ahora' : minutes < 60 ? `hace ${minutes} min` : minutes < 1440 ? `hace ${Math.round(minutes / 60)} h` : `hace ${Math.round(minutes / 1440)} d`;
    }
    function drawPodium() {
      const rows = dashboard?.[podium] || [], unit = {top_collectors:'cartas', top_coins:'monedas', top_streaks:'días'}[podium];
      $('[data-ctl-podium-list]').innerHTML = rows.map((row, index) => `<li><span class="ctl-rank" data-rank="${index + 1}">${index + 1}</span><span class="ctl-avatar">${row.avatar_url ? `<img src="${safe(row.avatar_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : safe(String(row.name || '?').charAt(0))}</span><strong>${safe(row.name)}</strong><b>${number(row.value)} <small>${unit}</small></b></li>`).join('') || '<li class="ctl-empty">Sin datos todavía.</li>';
      mount.querySelectorAll('[data-ctl-podium]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.ctlPodium === podium)));
    }
    function drawDashboard() {
      const d = dashboard; if (!d) return;
      mount.querySelectorAll('[data-ctl]').forEach(node => { node.textContent = number(d[node.dataset.ctl]); });
      $('[data-ctl-sub="members"]').textContent = `de ${number(d.members)} miembros · ${number(d.active_week)} esta semana`;
      $('[data-ctl-sub="coins"]').textContent = `+${number(d.coins_earned_week)} · −${number(d.coins_spent_week)} esta semana`;
      $('[data-ctl-headline]').textContent = d.active_today ? `${number(d.active_today)} ${d.active_today === 1 ? 'miembro ha entrado' : 'miembros han entrado'} hoy y hay ${number(d.packs_waiting)} sobres esperando a abrirse.` : `Nadie ha entrado todavía hoy. Hay ${number(d.packs_waiting)} sobres esperando a abrirse.`;
      const visits = d.visits || [], peak = Math.max(1, ...visits.map(v => v.count));
      $('[data-ctl-bars]').innerHTML = visits.map(v => { const day = new Date(`${v.day}T12:00:00`); return `<span style="--h:${Math.round(v.count / peak * 100)}%" title="${day.toLocaleDateString('es-ES', {weekday:'short', day:'numeric'})}: ${v.count}"><i></i><small>${day.toLocaleDateString('es-ES', {weekday:'narrow'})}</small></span>`; }).join('');
      $('[data-ctl-sub="week"]').textContent = `${number(d.active_week)} distintos en 7 días`;
      const alerts = [
        d.pending_requests ? ['tab', 'requests', 'people', `${d.pending_requests} ${d.pending_requests === 1 ? 'solicitud de cuenta espera' : 'solicitudes de cuenta esperan'} tu revisión`, '#5ac8fa'] : null,
        d.open_tickets ? ['route', 'ayuda', 'help', `${d.open_tickets} ${d.open_tickets === 1 ? 'mensaje de ayuda abierto' : 'mensajes de ayuda abiertos'}`, '#ff9f0a'] : null,
        d.market_open ? ['tab', 'market', 'market', `${d.market_open} ${d.market_open === 1 ? 'carta a la venta' : 'cartas a la venta'} en el mercado`, '#ffd60a'] : null,
      ].filter(Boolean);
      $('[data-ctl-alerts]').innerHTML = alerts.length ? alerts.map(([kind, target, symbol, text, tone]) => `<button type="button" class="ctl-alert" style="--tone:${tone}" data-control-${kind}="${target}">${icon(symbol)}<span>${safe(text)}</span><i aria-hidden="true"></i></button>`).join('') : `<p class="ctl-calm">${icon('eye')}<span>Todo al día: sin solicitudes ni mensajes pendientes.</span></p>`;
      $('[data-ctl-economy]').innerHTML = [
        ['Monedas ganadas', `+${number(d.coins_earned_week)}`], ['Monedas gastadas', `−${number(d.coins_spent_week)}`],
        ['Sobres por abrir', number(d.packs_waiting)], ['Ventas en el mercado', `${number(d.market_sales_week)} · ${number(d.market_volume_week)} monedas`],
        ['Intercambios', number(d.trades_week)], ['Fusiones', number(d.fusions_week)],
      ].map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
      drawPodium();
      const kinds = {trophy:['trophy','#bf5af2'], sale:['market','#ffd60a'], fusion:['fire','#ff9f0a'], pull:['cards','#ff375f']};
      const editions = {legendary:'legendaria', full_art:'Full Art', vice_city:'Vice City', halloween:'Halloween'};
      $('[data-ctl-feed]').innerHTML = (d.recent || []).slice(0, 12).map(item => {
        const [symbol, tone] = kinds[item.kind] || kinds.trophy;
        const text = item.kind === 'trophy' ? `ha ganado «${safe(item.what)}»` : item.kind === 'sale' ? `ha comprado «${safe(item.what)}» por ${number(item.price)} monedas` : item.kind === 'fusion' ? `ha fusionado repetidas y le ha salido «${safe(item.what)}»` : `ha sacado «${safe(item.what)}» (${editions[item.edition] || safe(item.edition)})`;
        return `<li style="--tone:${tone}"><span class="ctl-feed-icon">${icon(symbol)}</span><p><strong>${safe(item.who)}</strong> ${text}</p><time>${relative(item.at)}</time></li>`;
      }).join('') || '<li class="ctl-empty">Todavía no hay actividad.</li>';
    }
    async function loadDashboard(force = false) {
      if (!api.allowed() || (!force && Date.now() - dashboardAt < 30000)) return;
      const actor = api.owner(), request = ++dashboardRequest; dashboardAt = Date.now();
      $('[data-ctl-refresh]').classList.add('is-spinning');
      try {
        const data = await economyRPC('admin_club_dashboard');
        if (api.owner() !== actor || request !== dashboardRequest) return;
        dashboard = data; drawDashboard();
      } catch (error) {
        if (api.owner() === actor && request === dashboardRequest) { dashboardAt = 0; $('[data-ctl-headline]').textContent = ['PGRST202','42883'].includes(error.code) ? 'Falta activar el panel en el servidor.' : 'No se pudo cargar el pulso del club. Pulsa actualizar.'; }
      } finally { if (request === dashboardRequest) $('[data-ctl-refresh]').classList.remove('is-spinning'); }
    }
    // Club gift -------------------------------------------------------------
    const giftForm = $('[data-ctl-gift-form]');
    function giftValues() { const data = new FormData(giftForm); return {packs:Number(data.get('packs')) || 0, coins:Number(data.get('coins')) || 0, note:String(data.get('note') || '').trim()}; }
    function drawGift() {
      const {packs, coins} = giftValues(), people = dashboard?.members ?? api.stats().members;
      const parts = [packs ? `${packs} ${packs === 1 ? 'sobre' : 'sobres'}` : '', coins ? `${coins} monedas` : ''].filter(Boolean).join(' y ');
      $('[data-ctl-gift-summary]').textContent = parts ? `Cada uno de los ${number(people)} miembros recibirá ${parts}. En total: ${number(packs * people)} sobres y ${number(coins * people)} monedas.` : 'Elige al menos sobres o monedas.';
      const submit = $('[data-ctl-gift-submit]');
      submit.disabled = giftBusy || !parts;
      submit.textContent = giftBusy ? 'Enviando…' : giftArmed ? 'Confirmar y enviar a todos' : 'Preparar regalo';
      submit.classList.toggle('is-armed', giftArmed);
    }
    async function loadGifts() {
      try {
        const rows = await economyRPC('admin_recent_club_gifts');
        $('[data-ctl-gifts]').innerHTML = rows.map(g => `<li><span>${[g.packs ? `${g.packs} ${g.packs === 1 ? 'sobre' : 'sobres'}` : '', g.coins ? `${g.coins} monedas` : ''].filter(Boolean).join(' + ')}${g.note ? ` · ${safe(g.note)}` : ''}</span><small>${number(g.recipients)} miembros · ${relative(g.created_at)}</small></li>`).join('') || '<li class="ctl-empty">Todavía no hay regalos.</li>';
      } catch { /* The list is informative; sending still works. */ }
    }
    giftForm.addEventListener('change', () => { giftArmed = false; giftId = null; drawGift(); });
    giftForm.addEventListener('input', () => { giftArmed = false; drawGift(); });
    giftForm.addEventListener('submit', async event => {
      event.preventDefault();
      if (giftBusy || !api.allowed()) return;
      // Two steps: the first press shows the total, the second sends it.
      if (!giftArmed) { giftArmed = true; giftId = crypto.randomUUID(); drawGift(); return; }
      const {packs, coins, note} = giftValues(), feedbackNode = $('[data-ctl-gift-feedback]');
      giftBusy = true; drawGift(); feedbackNode.textContent = 'Enviando el regalo…';
      try {
        const result = await economyRPC('admin_gift_club', {gift_id:giftId, gift_packs:packs, gift_coins:coins, gift_note:note || null});
        feedbackNode.textContent = `Regalo enviado a ${number(result.recipients)} miembros.`;
        giftForm.reset(); giftArmed = false; giftId = null;
        void loadGifts(); void loadDashboard(true);
      } catch (error) { feedbackNode.textContent = error.message || 'No se pudo enviar. Vuelve a intentarlo: el regalo no se duplica.'; }
      finally { giftBusy = false; drawGift(); }
    });
    // Market moderation -----------------------------------------------------
    async function loadMarket() {
      const list = $('[data-ctl-market]');
      try {
        const rows = await economyRPC('admin_market_listings');
        list.innerHTML = rows.map(row => `<li><span><strong>${safe(row.card_name)}</strong><small>${safe(row.seller_name)} · ${number(row.price)} monedas · ${relative(row.created_at)}</small></span><button type="button" data-ctl-withdraw="${safe(row.id)}">Retirar</button></li>`).join('') || '<li class="ctl-empty">No hay cartas a la venta.</li>';
      } catch (error) { list.innerHTML = `<li class="ctl-empty">${safe(error.message || 'No se pudo cargar el mercado.')}</li>`; }
    }
    $('[data-ctl-market]').addEventListener('click', async event => {
      const button = event.target.closest('[data-ctl-withdraw]'); if (!button) return;
      button.disabled = true; const feedbackNode = $('[data-ctl-market-feedback]');
      try { await economyRPC('admin_withdraw_market_listing', {target_listing_id:Number(button.dataset.ctlWithdraw)}); feedbackNode.textContent = 'Carta retirada y devuelta a su dueño.'; await loadMarket(); }
      catch (error) { button.disabled = false; feedbackNode.textContent = error.message || 'No se pudo retirar.'; }
    });
    $('[data-ctl-market-reload]').addEventListener('click', loadMarket);
    $('[data-ctl-refresh]').addEventListener('click', () => loadDashboard(true));
    mount.querySelectorAll('[data-ctl-podium]').forEach(button => button.addEventListener('click', () => { podium = button.dataset.ctlPodium; drawPodium(); }));
    function view(tab) {
      if (tab === 'overview') loadDashboard();
      if (tab === 'gift') { giftArmed = false; drawGift(); loadGifts(); }
      if (tab === 'market') loadMarket();
      if (tab === 'updates') releaseAdmin?.load();
      if (tab === 'economy') loadEconomy();
      if (tab === 'requests') document.dispatchEvent(new Event('club-account-requests-open'));
      for (const node of mount.querySelectorAll('[data-control-panel]')) node.hidden = node.dataset.controlPanel !== tab;
      mount.querySelector('[data-control-title]').textContent = TAB_TITLES[tab];
      mount.querySelector('[data-control-back]').hidden = tab === 'overview';
      mount.closest('.page-section')?.scrollTo({top:0, behavior:'instant'});
    }
    function fill(value) { for (const key of Object.keys(DEFAULTS)) { const field = fields.namedItem(key); if (!field) continue; if (field.type === 'checkbox') field.checked = value[key]; else field.value = value[key]; } }
    function read() {
      const result = {};
      for (const key of Object.keys(DEFAULTS)) { const field = fields.namedItem(key); result[key] = field.type === 'checkbox' ? field.checked : field.value; }
      return normalize(result);
    }
    function paint() {
      const value = draft, palette = PALETTES[value.accent];
      form.querySelectorAll('input,textarea,select').forEach(node => { node.disabled = !ready || busy; });
      const preview = mount.querySelector('.control-phone-preview');
      preview.style.setProperty('--preview-tone', palette.color);
      preview.style.setProperty('--preview-tone-light', palette.light);
      preview.dataset.density = value.density;
      mount.querySelectorAll('[data-preview]').forEach(node => { node.textContent = value[node.dataset.preview] || (node.dataset.preview === 'announcementTitle' ? 'Aviso del club' : ''); });
      mount.querySelectorAll('[data-preview-section]').forEach(node => { node.hidden = !value[node.dataset.previewSection]; });
      mount.querySelector('.control-preview-notice').hidden = !value.announcementEnabled || !value.announcementText;
      mount.querySelector('[data-control-notice-count]').textContent = `${fields.announcementText.value.length} / 240`;
      mount.querySelector('[data-control-unsaved]').hidden = !dirty;
      mount.querySelector('[data-control-save-state]').textContent = busy ? 'Publicando…' : dirty ? 'Cambios sin publicar' : 'Todo guardado';
      form.querySelector('[data-control-save]').disabled = busy || !dirty || !ready;
      form.querySelector('[data-control-action="revert"]').disabled = busy || !dirty;
      form.querySelector('[data-control-action="defaults"]').disabled = busy || !ready;
    }
    function edited() { draft = read(); dirty = JSON.stringify(draft) !== JSON.stringify(saved); feedback.textContent = dirty ? 'La vista previa todavía no es pública.' : 'La app está usando esta configuración.'; paint(); }
    function route(id) { if (!api.allowed()) return; api.navigate(id); syncNavigation(id); }
    function updateStats() {
      if (!api.allowed()) return;
      const stats = api.stats();
      for (const [key, value] of Object.entries(stats)) { const node = mount.querySelector(`[data-control-stat="${key}"]`); if (node && node.textContent !== String(value)) node.textContent = String(value); }
    }
    const sectionsOf = {administracion:['admin-configuracion','admin-diagnostico'], 'admin-logros':['crear-logro','asignar-logro'], 'admin-cuentas':['editar-usuario']};
    function syncNavigation(id) { menu.hidden = true; dock.querySelectorAll('[data-control-route]').forEach(node => { const active = node.dataset.controlRoute === id || (sectionsOf[node.dataset.controlRoute] || []).includes(id); node.classList.toggle('active', active); if (active) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current'); }); }
    async function publish(event) {
      event.preventDefault();
      if (busy || !ready || !api.allowed() || !form.reportValidity()) return;
      draft = read();
      if (draft.announcementEnabled && !draft.announcementText) { feedback.textContent = 'Escribe el mensaje del aviso o desactívalo.'; fields.announcementText.focus(); return; }
      const submittingOwner = owner, payload = {...draft};
      busy = true; paint(); feedback.textContent = 'Guardando para todos los miembros…';
      try {
        await api.save(SETTING_KEY, JSON.stringify(payload));
        if (owner !== submittingOwner || !api.allowed()) return;
        saved = payload; draft = read(); dirty = JSON.stringify(draft) !== JSON.stringify(saved);
        feedback.textContent = 'Publicado. Los miembros recibirán los cambios al sincronizar.';
      } catch (error) {
        if (owner !== submittingOwner) return;
        feedback.textContent = 'No se ha publicado. Revisa la conexión y vuelve a intentarlo.';
        console.warn('No se pudo publicar la presentación del club', error?.code || 'request-failed');
      } finally { if (owner === submittingOwner) { busy = false; paint(); } }
    }
    form.addEventListener('submit', publish);
    form.addEventListener('input', edited);
    form.addEventListener('change', edited);
    mount.addEventListener('click', event => {
      if (!api.allowed()) return;
      const button = event.target.closest('button'); if (!button) return;
      if (button.hasAttribute('data-control-back')) view('overview');
      if (button.dataset.controlTab) view(button.dataset.controlTab);
      if (button.dataset.controlRoute) route(button.dataset.controlRoute);
      switch (button.dataset.controlAction) {
        case 'reload':
          if (busy) break;
          button.disabled = true;
          Promise.resolve(api.reload()).catch(() => {}).finally(() => {
            button.disabled = false;
            if (api.allowed() && !ready) feedback.textContent = 'No se pudo cargar la configuración. Comprueba la conexión y pulsa Sincronizar.';
          });
          break;
        case 'preview': route('inicio'); break;
        case 'logout': api.logout(); break;
        case 'revert': draft = {...saved}; dirty = false; fill(draft); feedback.textContent = 'Se han recuperado los últimos valores publicados.'; paint(); break;
        case 'defaults': draft = {...DEFAULTS}; fill(draft); edited(); break;
      }
    });
    dock.addEventListener('click', event => { const button = event.target.closest('[data-control-route]'); if (button) route(button.dataset.controlRoute); });
    // The crown opens the console menu, so session actions are one tap away anywhere.
    const menu = document.createElement('div');
    menu.className = 'ctl-crown-menu'; menu.hidden = true; menu.tabIndex = -1; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', 'Menú de administración');
    menu.innerHTML = `<p class="ctl-crown-who">${icon('people')}<span>Sesión de <b data-control-username></b></span></p>${[
      ['route','administracion','panel','Panel de administración'], ['route','inicio','eye','Ver el club como miembro'],
      ['security','','help','Seguridad de la cuenta'], ['logout','','logout','Cerrar sesión']
    ].map(([kind,target,symbol,label]) => `<button type="button" role="menuitem" data-crown="${kind}" data-target="${target}" ${kind === 'logout' ? 'class="is-danger"' : ''}>${icon(symbol)}<span>${label}</span></button>`).join('')}`;
    document.body.append(menu);
    let menuAnchor = null;
    function closeMenu(restore = false) { if (menu.hidden) return; menu.hidden = true; menuAnchor?.setAttribute('aria-expanded', 'false'); if (restore) menuAnchor?.focus({preventScroll:true}); }
    function toggleMenu(anchor) {
      if (!api.allowed()) return;
      if (!menu.hidden) { closeMenu(true); return; }
      menuAnchor = anchor; anchor?.setAttribute('aria-expanded', 'true');
      const box = anchor?.getBoundingClientRect();
      menu.style.top = `${Math.round((box?.bottom ?? 60) + 8)}px`;
      menu.style.right = `${Math.max(12, Math.round(innerWidth - (box?.right ?? innerWidth - 12)))}px`;
      menu.hidden = false; menu.focus({preventScroll:true});
    }
    menu.addEventListener('click', event => {
      const button = event.target.closest('[data-crown]'); if (!button) return;
      closeMenu();
      if (button.dataset.crown === 'route') route(button.dataset.target);
      if (button.dataset.crown === 'security') document.getElementById('adminSecurityButton')?.click();
      if (button.dataset.crown === 'logout') api.logout();
    });
    document.addEventListener('pointerdown', event => { if (!menu.hidden && !menu.contains(event.target) && !menuAnchor?.contains(event.target)) closeMenu(); }, true);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(true); });
    return {
      apply,
      toggleMenu,
      didNavigate: syncNavigation,
      refreshStats: updateStats,
      sync() {
        const allowed = Boolean(api.allowed());
        releaseAdmin?.sync();
        mount.hidden = !allowed; dock.hidden = !allowed;
        if (!allowed) closeMenu();
        const crown = document.getElementById('adminPanelButton');
        if (allowed) { crown?.setAttribute('aria-haspopup', 'menu'); crown?.setAttribute('aria-expanded', String(!menu.hidden)); crown?.setAttribute('aria-label', 'Menú de administración'); }
        else { crown?.removeAttribute('aria-haspopup'); crown?.removeAttribute('aria-expanded'); crown?.setAttribute('aria-label', 'Abrir administración'); }
        // Inside the console, admin pages return to the console, not the old settings page.
        document.querySelectorAll('#admin-cuentas .achievement-back, #admin-logros .achievement-back, #admin-diagnostico .achievement-back').forEach(node => { node.dataset.go = allowed ? 'administracion' : 'admin-configuracion'; node.setAttribute('aria-label', allowed ? 'Volver al panel' : 'Volver a configuración'); });
        document.getElementById('standardAdminPanel').hidden = allowed;
        document.body.classList.toggle('superadmin-console-session', allowed);
        const shellLabel = document.querySelector('.topbar-title .eyebrow');
        if (shellLabel) shellLabel.textContent = allowed ? 'CONSOLA DE ADMINISTRACIÓN' : 'COMUNIDAD PRIVADA';
        if (!allowed) { ++dashboardRequest; dashboard = null; dashboardAt = 0; giftArmed = false; giftId = null; ++economyRequest; economy = null; economyOwner = null; economyBusy = false; economyContent.replaceChildren(); economyFeedback.textContent = ''; economyReload.disabled = false; owner = null; dirty = false; busy = false; ready = false; saved = normalize(); draft = {...saved}; fill(draft); view('overview'); return; }
        const nextOwner = api.owner();
        if (owner !== nextOwner) { owner = nextOwner; dirty = false; busy = false; ready = false; view('overview'); }
        updateStats();
        [mount, menu].forEach(root => root.querySelectorAll('[data-control-username]').forEach(node => { node.textContent = api.username(); }));
        $('[data-ctl-date]').textContent = new Date().toLocaleDateString('es-ES', {weekday:'long', day:'numeric', month:'long'});
        void loadDashboard();
        const value = normalize(api.settings()?.[SETTING_KEY]);
        saved = value;
        ready = Boolean(api.ready());
        if (!dirty && !busy) { draft = {...value}; fill(draft); }
        form.querySelectorAll('input,textarea,select').forEach(node => { node.disabled = !ready || busy; });
        mount.querySelector('[data-control-settings-state]').textContent = ready ? 'Sincronizado con el club' : 'Cargando configuración…';
        if (!dirty && !busy) feedback.textContent = ready ? 'La app está usando esta configuración.' : 'Carga la configuración para editar.';
        paint();
        const active = document.querySelector('.page-section.active'); if (active) syncNavigation(active.id);
      }
    };
  }
  // Ordinary accounts only apply saved presentation data. Build the management
  // DOM on the first verified superadmin session instead of adding startup work.
  function create(api) {
    let instance;
    return {
      apply,
      sync() { if (api.allowed()) (instance ||= createConsole(api)).sync(); else instance?.sync(); },
      didNavigate(id) { instance?.didNavigate?.(id); },
      toggleMenu(anchor) { instance?.toggleMenu?.(anchor); },
      refreshStats() { instance?.refreshStats?.(); },
    };
  }
  globalThis.AdminConsole = Object.freeze({create, apply});
})();
