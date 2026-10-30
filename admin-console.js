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
    logout: '<path d="M10 3H4v18h6m5-14 5 5-5 5M8 12h12"/>'
  })[name] || ''}</svg>`;
  function createConsole(api) {
    const mount = document.getElementById('superAdminConsole');
    if (!mount) return {sync() {}, apply};
    let owner = null, saved = normalize(), draft = {...saved}, dirty = false, busy = false, ready = false;
    mount.innerHTML = `
      <header class="control-heading"><div class="control-brand"><span class="control-emblem">BB<span>CONTROL</span></span><div><span class="control-kicker">THE BIG BOY RULES</span><h2>Tu centro de control.</h2><p>Contenido, personas y experiencia del club.</p></div></div><span class="control-access">Control total</span></header>
      <nav class="control-tabs" aria-label="Secciones del centro de control"><button type="button" data-control-tab="overview" aria-pressed="true">Vista general</button><button type="button" data-control-tab="requests" aria-pressed="false">Solicitudes<span data-request-count hidden></span></button><button type="button" data-control-tab="economy" aria-pressed="false">Tienda y sobres</button><button type="button" data-control-tab="updates" aria-pressed="false">Actualizaciones</button><button type="button" data-control-tab="design" aria-pressed="false">Personalización<span data-control-unsaved hidden></span></button><button type="button" data-control-action="preview">${icon('eye')}<span>Ver el club</span></button></nav>
      <div data-control-panel="overview">
        <section class="control-overview" aria-label="Resumen del club"><article class="control-overview-lead"><span class="control-kicker">ESTADO DEL CLUB</span><strong>Administra el club.</strong><p>Gestiona las cuentas, prepara los próximos planes y ajusta la experiencia.</p><button type="button" data-control-action="design">Personalizar el club ${icon('paint')}</button></article><div class="control-metrics"><article><span>Cuentas del club</span><strong data-control-stat="members">—</strong><small>Usuarios visibles</small></article><article><span>Conectados</span><strong data-control-stat="online">—</strong><small>Presencia ahora</small></article><article><span>Próximos planes</span><strong data-control-stat="events">—</strong><small>Eventos programados</small></article><article><span>Equipo</span><strong data-control-stat="admins">—</strong><small>Administradores del club</small></article></div></section>
        <div class="control-section-label"><h3>Gestionar el club</h3><span>Accesos de trabajo</span></div>
        <div class="control-workspaces"><button type="button" class="control-workspace" data-control-tab="requests"><span class="control-workspace-top"><i>${icon('people')}</i><small data-request-count hidden></small></span><strong>Solicitudes de cuenta</strong><span>Verifica el correo y decide quién entra al club.</span><b>Revisar accesos</b></button><button type="button" class="control-workspace" data-control-tab="economy"><span class="control-workspace-top"><i>${icon('cards')}</i><small>ECONOMÍA</small></span><strong>Tienda y sobres</strong><span>Modifica los precios y las probabilidades de cada rareza.</span><b>Configurar</b></button><button type="button" class="control-workspace" data-control-tab="updates"><span class="control-workspace-top"><i>${icon('panel')}</i><small>ANDROID</small></span><strong>Actualizaciones</strong><span>Publica el APK y decide desde qué compilación se puede entrar.</span><b>Gestionar versiones</b></button>${[
          ['people', 'admin-cuentas', '01', 'Cuentas y perfiles', 'Usuarios, contraseñas, sobres, monedas y regalos.', 'Cuentas'],
          ['calendar', 'calendario', '02', 'Agenda del club', 'Cumpleaños, eventos y asistencia.', 'Organizar'],
          ['chat', 'chat', '03', 'Conversaciones', 'Secciones, encuestas y mensajes automáticos.', 'Abrir chats'],
          ['trophy', 'admin-logros', '04', 'Logros y progreso', 'Diseña los objetivos y reconoce a los miembros.', 'Configurar'],
          ['cards', 'catalogo', '05', 'Colección', 'Consulta las cartas, rarezas y puntuaciones.', 'Ver catálogo'],
          ['help', 'ayuda', '06', 'Ayuda y solicitudes', 'Atiende los mensajes enviados por los miembros.', 'Atender']
        ].map(([symbol, route, number, title, description, action]) => `<button type="button" class="control-workspace" data-control-route="${route}"><span class="control-workspace-top"><i>${icon(symbol)}</i><small>${number}</small></span><strong>${title}</strong><span>${description}</span><b>${action}</b></button>`).join('')}</div>
        <button type="button" class="control-diagnostics" data-control-route="admin-diagnostico">${icon('pulse')}<span><strong>Rendimiento y diagnóstico</strong><small>Tiempos de carga, pausas y estado de este dispositivo.</small></span><b>Consultar</b></button>
      </div>
      <section data-control-panel="requests" class="request-admin-section" hidden aria-label="Solicitudes de cuenta">
        <div class="request-section-heading"><div><span class="control-kicker">ACCESO AL CLUB</span><h3>Solicitudes</h3><p>Revisa quién quiere entrar y decide cuándo activar su cuenta.</p></div><button type="button" data-request-refresh>Actualizar</button></div>
        <div data-request-review><p class="request-intro">Las solicitudes aparecen al enviarse. Para aceptar una cuenta, su correo debe estar verificado.</p><p class="request-feedback" role="status" aria-live="polite"></p><div class="request-review-list"></div></div>
      </section>
      <section data-control-panel="economy" class="control-economy" hidden aria-label="Tienda y sobres">
        <div class="control-design-intro"><div><span class="control-kicker">ECONOMÍA DEL CLUB</span><h3>Tienda y sobres</h3><p>Precios en monedas y probabilidades de cada rareza para todos los usuarios.</p></div><button type="button" data-economy-reload>Actualizar datos</button></div>
        <div data-economy-content></div><p data-economy-feedback role="status" aria-live="polite"></p>
      </section>
      <section data-control-panel="updates" class="control-releases" hidden aria-label="Actualizaciones de Android"><div data-release-content></div></section>
      <div data-control-panel="design" hidden>
        <div class="control-design-intro"><div><h3>Personalización del club.</h3><p>Los cambios se publican para todos en Android, iPhone y web.</p></div><div class="control-settings-sync"><span data-control-settings-state>Esperando configuración</span><button type="button" data-control-action="reload">Sincronizar</button></div></div>
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
      </div>
      <footer class="control-session"><span>Sesión de administración · <b data-control-username></b></span><button type="button" data-control-action="logout">Cerrar sesión ${icon('logout')}</button></footer>`;
    const form = mount.querySelector('#clubPresentationForm'), fields = form.elements;
    const dock = document.createElement('nav');
    dock.id = 'superAdminDock'; dock.className = 'control-dock'; dock.hidden = true; dock.setAttribute('aria-label', 'Navegación de administración');
    dock.innerHTML = [['panel', 'administracion', 'Panel'], ['people', 'admin-cuentas', 'Cuentas'], ['calendar', 'calendario', 'Agenda'], ['eye', 'inicio', 'Ver club']].map(([symbol, route, label]) => `<button type="button" data-control-route="${route}">${icon(symbol)}<span>${label}</span></button>`).join('');
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
    function drawEconomy() {
      if (!economy) return;
      const products = (rows, kind) => rows.map(item => `<label class="control-price-row"><span><strong>${safe(item.name)}</strong><small>${item.active ? 'En tienda' : 'Fuera de catálogo'}${item.minimum_price ? ` · mínimo ${safe(item.minimum_price)} monedas` : ''}</small></span><span class="control-price-input"><input type="number" inputmode="numeric" min="${item.minimum_price || 0}" max="1000000" step="1" required aria-label="Precio de ${safe(item.name)}" data-price-kind="${kind}" data-price-id="${safe(item.id)}" value="${safe(item.price)}"><small>monedas</small></span></label>`).join('') || '<p>Aún no hay artículos.</p>';
      economyContent.innerHTML = `<form class="control-economy-form"><section class="control-editor-section"><header><i>${icon('cards')}</i><div><h4>Probabilidades de los sobres</h4><p>6 cartas: 3 miembros o personajes, 2 objetos y 1 ubicación. No se repiten cartas dentro del sobre.</p></div></header><div class="control-odds-grid">${Object.entries(rarityLabels).map(([key, label]) => `<label>${label}<span><input type="number" inputmode="decimal" min="0" max="100" step="0.01" required data-rarity="${key}" aria-label="Porcentaje ${label}" value="${safe(economy.probabilities[key])}"><b>%</b></span></label>`).join('')}</div><p class="control-odds-total" data-economy-total></p><p class="control-field-note">Porcentajes base por carta. En cada categoría se reparten entre las rarezas disponibles; si una rareza se agota, se ajustan proporcionalmente. Halloween se aplica a cada hueco de miembro elegible, sin repetirse dentro del sobre. Puedes poner 0 para desactivarla.</p></section><section class="control-editor-section"><header><i>${icon('paint')}</i><div><h4>Banners de perfil</h4><p>Precio de cada diseño en monedas.</p></div></header>${products(economy.banners, 'banner')}</section><section class="control-editor-section"><header><i>${icon('trophy')}</i><div><h4>Vales del club</h4><p>Precio para desbloquear cada premio.</p></div></header>${products(economy.vouchers, 'voucher')}</section>${Array.isArray(economy.chota_items) ? `<section class="control-editor-section"><header><i>${icon('paint')}</i><div><h4>Objetos del Chota</h4><p>Precio de los objetos para su habitación.</p></div></header>${products(economy.chota_items, 'chota')}</section>` : ''}<footer class="control-publish-bar"><div><strong>Publicar para todo el club</strong><small>Los sobres ya abiertos conservan sus cartas.</small></div><button type="submit" data-economy-save>Guardar precios y porcentajes</button></footer></form>`;
      economyContent.querySelector('form').addEventListener('input', updateEconomyTotal);
      economyContent.querySelector('form').addEventListener('submit', saveEconomy);
      updateEconomyTotal();
    }
    function updateEconomyTotal() {
      const inputs = [...economyContent.querySelectorAll('[data-rarity]')];
      const total = inputs.reduce((sum, input) => sum + Math.round(Number(input.value) * 100), 0);
      const valid = total === 10000 && inputs.every(input => input.value !== '' && input.validity.valid);
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

    function view(tab) {
      if (tab === 'updates') releaseAdmin?.load();
      if (tab === 'economy') loadEconomy();
      if (tab === 'requests') document.dispatchEvent(new Event('club-account-requests-open'));
      for (const node of mount.querySelectorAll('[data-control-panel]')) node.hidden = node.dataset.controlPanel !== tab;
      for (const node of mount.querySelectorAll('[data-control-tab]')) node.setAttribute('aria-pressed', String(node.dataset.controlTab === tab));
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
    function syncNavigation(id) { dock.querySelectorAll('[data-control-route]').forEach(node => { const active = node.dataset.controlRoute === id || (node.dataset.controlRoute === 'administracion' && ['admin-configuracion', 'admin-logros', 'admin-diagnostico'].includes(id)); node.classList.toggle('active', active); if (active) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current'); }); }
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
      if (button.dataset.controlTab) view(button.dataset.controlTab);
      if (button.dataset.controlRoute) route(button.dataset.controlRoute);
      switch (button.dataset.controlAction) {
        case 'design': view('design'); break;
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
    return {
      apply,
      didNavigate: syncNavigation,
      refreshStats: updateStats,
      sync() {
        const allowed = Boolean(api.allowed());
        releaseAdmin?.sync();
        mount.hidden = !allowed; dock.hidden = !allowed;
        document.getElementById('standardAdminPanel').hidden = allowed;
        document.body.classList.toggle('superadmin-console-session', allowed);
        const shellLabel = document.querySelector('.topbar-title .eyebrow');
        if (shellLabel) shellLabel.textContent = allowed ? 'CONSOLA DE ADMINISTRACIÓN' : 'COMUNIDAD PRIVADA';
        if (!allowed) { ++economyRequest; economy = null; economyOwner = null; economyBusy = false; economyContent.replaceChildren(); economyFeedback.textContent = ''; economyReload.disabled = false; owner = null; dirty = false; busy = false; ready = false; saved = normalize(); draft = {...saved}; fill(draft); view('overview'); return; }
        const nextOwner = api.owner();
        if (owner !== nextOwner) { owner = nextOwner; dirty = false; busy = false; ready = false; view('overview'); }
        updateStats();
        mount.querySelector('[data-control-username]').textContent = api.username();
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
      refreshStats() { instance?.refreshStats?.(); },
    };
  }
  globalThis.AdminConsole = Object.freeze({create, apply});
})();
