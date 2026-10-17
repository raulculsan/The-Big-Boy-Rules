/* Motion preference is local to this account/device and always respects Reduce Motion. */
(() => {
  const system = matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = new Set();
  let owner = '', choice = 'system';
  const media = {get matches() { return choice === 'reduce' || system.matches; },
    addEventListener(type, callback) { if (type === 'change') listeners.add(callback); },
    removeEventListener(type, callback) { if (type === 'change') listeners.delete(callback); }};
  const apply = () => {
    document.documentElement.dataset.reducedMotion = String(media.matches);
    document.querySelectorAll('[data-motion-preference]').forEach(select => { select.value = choice; });
    [...listeners].forEach(callback => callback({matches:media.matches, media:system.media}));
    dispatchEvent(new CustomEvent('club:motion-change', {detail:{reduced:media.matches}}));
  };
  window.ClubMotion = {
    media,
    configure(account) {
      const next = String(account || 'guest');
      if (owner === next) return;
      owner = next;
      try { choice = localStorage.getItem(`bb-motion-v1:${owner}`) === 'reduce' ? 'reduce' : 'system'; } catch { choice = 'system'; }
      apply();
    },
    mount(form) {
      if (!form || form.querySelector('[data-motion-preference]')) return;
      const row = document.createElement('label'); row.className = 'motion-preference';
      row.innerHTML = '<span>Animaciones</span><select data-motion-preference aria-label="Preferencia de animaciones"><option value="system">Según el dispositivo</option><option value="reduce">Suaves</option></select><small>Suaves reduce giros, destellos y movimiento. Se respeta siempre Reducir movimiento del dispositivo.</small>';
      row.querySelector('select').value = choice;
      row.querySelector('select').addEventListener('change', event => {
        choice = event.target.value === 'reduce' ? 'reduce' : 'system';
        try { localStorage.setItem(`bb-motion-v1:${owner}`, choice); } catch {}
        apply();
      });
      const anchor=form.querySelector(".modal-actions");
      if(anchor)anchor.before(row);else form.append(row);
    }
  };
  system.addEventListener('change', apply);
  window.ClubMotion.configure('guest');
})();

/* Bounded local diagnostics. No account data, content, URLs or tokens. */
(() => {
  'use strict';
  const key = 'bb-local-health-v1', limit = 300;
  const session = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const areas = {inicio:'Inicio', chat:'Chats', privados:'Chat privado', perfil:'Perfil', calendario:'Calendario', sobres:'Sobres', album:'Álbum', catalogo:'Catálogo', administracion:'Administración', 'admin-configuracion':'Configuración', 'admin-cuentas':'Cuentas', 'admin-logros':'Logros', 'admin-diagnostico':'Diagnóstico', otra:'Otras'};
  const kinds = ['session-start','authenticated','shell-ready','home-ready','main-thread','network','stall','image','image-error','script-error','promise-error','interaction','editor-focus','editor-input'];
  let previous = [];
  try {
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(stored)) previous = stored.slice(-limit).filter(item => item && kinds.includes(item.kind)).map(item => {
      const clean = {kind:item.kind};
      for (const field of ['at','ts','ms','kb','mp','status','inputMs']) if (Number.isFinite(item[field]) && item[field] >= 0) clean[field] = item[field];
      if (typeof item.session === 'string' && /^[a-z0-9-]{1,40}$/.test(item.session)) clean.session = item.session;
      if (Object.hasOwn(areas, item.area)) clean.area = item.area;
      if (['sobres','album','chats','chota'].includes(item.action)) clean.action = item.action;
      if (['input','textarea'].includes(item.field)) clean.field = item.field;
      if (['auth','media','function','data','resource'].includes(item.resource)) clean.resource = item.resource;
      return clean;
    });
  } catch {}
  const samples = [], marked = new Set();
  let renderTimer;
  const record = (kind, values = {}) => {
    samples.push({kind, at:Math.round(performance.now()), ts:Date.now(), session, ...values});
    if (samples.length > limit) samples.shift();
    if (document.getElementById('admin-diagnostico')?.classList.contains('active') && !renderTimer) renderTimer = setTimeout(() => { renderTimer = null; window.ClubHealth?.show(); }, 700);
  };
  const area = () => { const id = document.querySelector('.page-section.active')?.id; return Object.hasOwn(areas, id) ? id : 'otra'; };
  const resourceKind = value => { try { const path = new URL(value, location.href).pathname; return path.includes('/auth/') ? 'auth' : path.includes('/storage/') ? 'media' : path.includes('/functions/') ? 'function' : path.includes('/rest/') ? 'data' : 'resource'; } catch { return 'resource'; } };
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const at = performance.now(), section = area();
    try {
      const response = await originalFetch.apply(this, args);
      if (!response.ok) record('network', {resource:resourceKind(typeof args[0] === 'string' ? args[0] : args[0]?.url), status:response.status, ms:Math.round(performance.now() - at), area:section});
      return response;
    } catch (error) {
      if (error?.name !== 'AbortError') record('network', {resource:resourceKind(typeof args[0] === 'string' ? args[0] : args[0]?.url), status:0, ms:Math.round(performance.now() - at), area:section});
      throw error;
    }
  };
  let last = performance.now(), visible = !document.hidden;
  setInterval(() => {
    const now = performance.now(), delay = now - last - 1000;
    if (visible && !document.hidden && delay > 350) record('stall', {ms:Math.round(delay), area:area()});
    last = now; visible = !document.hidden;
  }, 1000);
  try {
    new PerformanceObserver(list => {
      for (const item of list.getEntries()) if (item.initiatorType === 'img' && (item.decodedBodySize > 1000000 || item.duration > 1500)) record('image', {kb:Math.round(item.decodedBodySize / 1024), ms:Math.round(item.duration), area:area()});
    }).observe({type:'resource', buffered:true});
  } catch {}
  // Chromium exposes exact main-thread tasks; Safari keeps the interval and
  // input-to-frame measurements above/below. No task names or attribution are kept.
  try {
    if (PerformanceObserver.supportedEntryTypes?.includes('longtask')) new PerformanceObserver(list => {
      for (const item of list.getEntries()) if (item.duration >= 50 && !document.hidden) record('main-thread', {ms:Math.round(item.duration), area:area()});
    }).observe({type:'longtask', buffered:true});
  } catch {}
  document.addEventListener('load', event => {
    const image = event.target;
    if (image instanceof HTMLImageElement && image.naturalWidth * image.naturalHeight > 4000000) record('image', {mp:Math.round(image.naturalWidth * image.naturalHeight / 1000000), area:area()});
  }, true);
  document.addEventListener('error', event => { if (event.target instanceof HTMLImageElement) record('image-error', {area:area()}); }, true);
  window.addEventListener('error', () => record('script-error', {area:area()}));
  window.addEventListener('unhandledrejection', () => record('promise-error', {area:area()}));
  // Estimate input-to-presented-frame on Safari/WKWebView too. No message content is stored.
  const interactionAction = target => {
    if (!(target instanceof Element)) return null;
    if (target.closest('[data-chota-open], [data-chota-expand], [data-chota-action]')) return 'chota';
    if (target.closest('#album, #albumDialog')) return 'album';
    if (target.closest('#packOpeningDialog, #ownedPackOpen, #packsTopButton, .pack-reveal-dialog, .pack-opening-stage, [data-open-pack]')) return 'sobres';
    if (target.closest('#chat, #privados')) return 'chats';
    return null;
  };
  let lastInteraction = 0;
  const measureInteraction = event => {
    if(event.type==='keydown' && !['Enter',' ','ArrowLeft','ArrowRight'].includes(event.key))return;
    const action = interactionAction(event.target), started = performance.now();
    if (!action || document.hidden || started - lastInteraction < 150) return;
    lastInteraction = started;
    const delay = started - event.timeStamp;
    const inputMs = delay >= 0 && delay < 60000 ? Math.round(delay) : 0;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!document.hidden) record('interaction', {action, area:area(), inputMs, ms:Math.round(performance.now() - started + inputMs)});
    }));
  };
  ['pointerup','click','keydown'].forEach(type => document.addEventListener(type,measureInteraction,{capture:true,passive:true}));
  // Sample focus and only the first edit, never the value, field name or account.
  // Two animation frames include presentation work without forcing layout reads.
  let editorPress = null;
  const editorSessions = new WeakMap();
  const textEditor = target => target instanceof Element && target.matches('textarea,input:not([type]),input[type=text],input[type=search],input[type=email],input[type=tel],input[type=url],input[type=number]');
  const editorSample = (kind, event, pressedAt) => {
    const started = performance.now(), section = area();
    const delay = started - (pressedAt ?? event.timeStamp);
    const inputMs = delay >= 0 && delay < 60000 ? Math.round(delay) : 0;
    const field = event.target.tagName.toLowerCase();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!document.hidden) record(kind, {area:section, field, inputMs, ms:Math.round(performance.now() - started + inputMs)});
    }));
  };
  document.addEventListener('pointerdown', event => {
    editorPress = textEditor(event.target) ? {target:event.target, at:event.timeStamp} : null;
  }, {capture:true, passive:true});
  document.addEventListener('focusin', event => {
    if (!textEditor(event.target)) return;
    editorSessions.set(event.target, false);
    const pressedAt = editorPress?.target === event.target && performance.now() - editorPress.at < 60000 ? editorPress.at : undefined;
    editorPress = null;
    editorSample('editor-focus', event, pressedAt);
  }, {passive:true});
  document.addEventListener('input', event => {
    if (!event.isTrusted || !textEditor(event.target) || editorSessions.get(event.target) !== false) return;
    editorSessions.set(event.target, true);
    editorSample('editor-input', event);
  }, {passive:true});
  const all = () => [...previous, ...samples].slice(-limit);
  const persist = () => { try { localStorage.setItem(key, JSON.stringify(all())); } catch {} };
  document.addEventListener('visibilitychange', () => { last = performance.now(); visible = !document.hidden; if (document.hidden) persist(); });
  window.addEventListener('pagehide', persist);
  record('session-start');
  const report = () => ({version:2, platform:window.Capacitor?.getPlatform?.() || 'web', viewport:[innerWidth, innerHeight], samples:all(), note:'Registro local acotado a 300 muestras. Las muestras antiguas sin fecha se agrupan aparte. Las pausas son estimaciones del temporizador visible; los recursos externos pueden ocultar su tamaño.'});
  const time = value => Number.isFinite(value) ? value >= 1000 ? `${(value / 1000).toLocaleString('es-ES', {maximumFractionDigits:2})} s` : `${Math.round(value)} ms` : '—';
  const percentile = (values, p) => values.length ? [...values].sort((a,b) => a-b)[Math.max(0, Math.ceil(values.length * p) - 1)] : undefined;
  const maxValue = values => values.length ? Math.max(...values) : undefined;
  const durationValues = items => items.map(item => item.ms).filter(Number.isFinite);
  const category = item => item.kind === 'stall' ? 0 : item.kind === 'network' ? 1 : item.kind === 'image' || item.kind === 'image-error' ? 2 : item.kind === 'script-error' || item.kind === 'promise-error' ? 3 : -1;
  const colors = ['#e2bb73','#f1828b','#81b9ed','#b39ae5'];
  const labels = ['Pausas','Red','Imágenes','Código'];
  const legend = () => `<div class="health-legend">${labels.map((label,i) => `<span><i style="background:${colors[i]}"></i>${label}</span>`).join('')}</div>`;
  const empty = message => `<p class="health-empty">${message}</p>`;
  function drawStartup(groups) {
    const points = groups.map((group, index) => ({index, value:group.items.find(item => item.kind === 'home-ready')?.ms})).filter(point => Number.isFinite(point.value));
    if (!points.length) return empty('Todavía no hay un inicio completo registrado. Se medirá al entrar en la app.');
    const ceiling = Math.max(1000, ...points.map(point => point.value)) * 1.15;
    const x = index => 44 + index * (416 / Math.max(1, groups.length - 1)), y = value => 148 - value / ceiling * 120;
    const grid = [0,.5,1].map(fraction => `<line x1="44" y1="${y(ceiling * fraction)}" x2="472" y2="${y(ceiling * fraction)}" stroke="#ffffff12"/><text x="36" y="${y(ceiling * fraction)+4}" text-anchor="end">${(ceiling*fraction/1000).toFixed(1)} s</text>`).join('');
    // Separate missing sessions so a line never implies an unmeasured start.
    const segments = points.reduce((result, point) => { if (!result.length || point.index !== result.at(-1).at(-1).index + 1) result.push([]); result.at(-1).push(point); return result; }, []);
    return `<svg class="health-line-chart" viewBox="0 0 490 183" role="img" aria-label="Tiempo desde la apertura hasta inicio listo por sesión">${grid}${segments.map(segment => `<polyline points="${segment.map(point => `${x(point.index)},${y(point.value)}`).join(' ')}" fill="none" stroke="#e2bb73" stroke-width="2.5"/>`).join('')}${points.map(point => `<circle cx="${x(point.index)}" cy="${y(point.value)}" r="4" fill="#e2bb73"><title>Sesión ${point.index+1}: ${time(point.value)}</title></circle>`).join('')}${groups.map((group,index) => `<text x="${x(index)}" y="173" text-anchor="middle">${index+1}</text>`).join('')}</svg>`;
  }
  function dashboard(items) {
    const groups = [];
    for (const item of items) {
      const id = item.session || 'legacy';
      let group = groups.find(value => value.id === id);
      if (!group) { group = {id, ts:item.ts, items:[]}; groups.push(group); }
      group.items.push(item);
    }
    const recent = groups.slice(-8), stalls = items.filter(item => item.kind === 'stall'), pauses = durationValues(stalls), startup = durationValues(items.filter(item => item.kind === 'home-ready'));
    const network = items.filter(item => item.kind === 'network'), images = items.filter(item => item.kind === 'image' || item.kind === 'image-error');
    const card = (label,value,detail) => `<article class="health-metric"><small>${label}</small><strong>${value}</strong><span>${detail}</span></article>`;
    const counts = group => labels.map((label,index) => group.items.filter(item => category(item) === index).length);
    const sessionCounts = recent.map(counts), countMax = Math.max(1, ...sessionCounts.map(values => values.reduce((a,b) => a+b,0)));
    const sessionRows = recent.map((group,index) => {
      const values = sessionCounts[index], total = values.reduce((a,b) => a+b,0);
      const date = group.ts ? new Date(group.ts).toLocaleString('es-ES', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : 'Sin fecha';
      return `<div class="health-session-row"><span><b>${index+1}</b>${date}</span><div class="health-stack" role="img" aria-label="${values.map((value,i) => `${labels[i]}: ${value}`).join(', ')}">${values.map((value,i) => `<i style="width:${value/countMax*100}%;background:${colors[i]}"></i>`).join('')}</div><strong>${total}</strong></div>`;
    }).join('');
    const areaGroups = Object.keys(areas).map(id => ({id, items:items.filter(item => item.area === id && category(item) >= 0)})).filter(group => group.items.length).sort((a,b) => b.items.length-a.items.length);
    const areaMax = Math.max(1, ...areaGroups.map(group => group.items.length));
    const areaRows = areaGroups.map(group => {
      const values = counts(group), areaPauses = durationValues(group.items.filter(item => item.kind === 'stall'));
      return `<div class="health-area-row"><div><strong>${areas[group.id]}</strong><small>${group.items.length} avisos${areaPauses.length ? ` · pausa máx. ${time(maxValue(areaPauses))}` : ''}</small></div><div class="health-stack" role="img" aria-label="${values.map((value,i) => `${labels[i]}: ${value}`).join(', ')}">${values.map((value,i) => `<i style="width:${value/areaMax*100}%;background:${colors[i]}"></i>`).join('')}</div></div>`;
    }).join('');
    const responseRows = [['sobres','Sobres'],['album','Álbum'],['chats','Chats'],['chota','El Chota']].map(([action,label]) => {
      const events = items.filter(item => item.kind === 'interaction' && item.action === action), values = durationValues(events);
      const p95 = percentile(values,.95), delay = percentile(events.map(item => item.inputMs).filter(Number.isFinite),.95);
      return `<div class="health-response-row"><strong>${label}</strong><span>${events.length} toques</span><b>${time(p95)}</b><small>${p95 > 200 ? 'Revisar respuesta' : events.length ? 'Respuesta ágil' : 'Sin muestras'} · espera de entrada ${time(delay)}</small><i style="--response-width:${Math.min(100,(p95 || 0)/10)}%"></i></div>`;
    }).join('');
    const editorRows = [['editor-focus','Activar campo'],['editor-input','Primera escritura']].map(([kind,label]) => {
      const events = items.filter(item => item.kind === kind), p95 = percentile(durationValues(events), .95);
      const queue = percentile(events.map(item => item.inputMs).filter(Number.isFinite), .95);
      const worst = events.reduce((result,item) => !result || item.ms > result.ms ? item : result, null);
      return `<div class="health-response-row"><strong>${label}</strong><span>${events.length} muestras</span><b>${time(p95)}</b><small>Espera de entrada ${time(queue)}${worst ? ` · máximo ${time(worst.ms)} en ${areas[worst.area] || areas.otra} (${worst.field === 'textarea' ? 'texto largo' : 'campo'})` : ''}</small><i style="--response-width:${Math.min(100,(p95 || 0)/10)}%"></i></div>`;
    }).join('');
    return `<div class="health-metrics">${card('Inicio listo · p95',time(percentile(startup,.95)),`${startup.length} mediciones desde apertura`)}${card('Primera pantalla · p95',time(percentile(durationValues(items.filter(item => item.kind === 'shell-ready')),.95)),'Primer fotograma tras retirar la carga')}${card('Tarea principal más larga',time(maxValue(durationValues(items.filter(item => item.kind === 'main-thread')))),'Tareas de 50 ms o más; requiere navegador compatible')}${card('Pausas detectadas',stalls.length,`p95 ${time(percentile(pauses,.95))} · máx. ${time(maxValue(pauses))}`)}${card('Fallos de red',network.length,`Respuesta fallida o sin conexión`)}${card('Avisos de imágenes',images.length,`p95 ${time(percentile(durationValues(images),.95))} · ${items.filter(item => item.kind === 'image-error').length} errores`)}</div>
      <div class="health-chart-grid"><article class="health-chart-card"><h3>Tiempo de inicio</h3><p>Desde apertura hasta inicio listo. Incluye la espera si tienes que iniciar sesión.</p>${drawStartup(recent)}<div class="health-chart-foot"><span>Sesiones numeradas abajo</span><span>Máximo ${time(maxValue(startup))}</span></div></article><article class="health-chart-card"><h3>Avisos por sesión</h3><p>Últimas ${recent.length} sesiones guardadas; los registros antiguos aparecen sin fecha.</p>${recent.length ? `<div class="health-session-chart">${sessionRows}</div>` : empty('Usa la app para empezar a registrar sesiones.')}${legend()}</article></div>
      <article class="health-chart-card health-area-chart"><h3>Dónde se acumulan los avisos</h3><p>Las imágenes se atribuyen a la pantalla visible al completar su carga. Son avisos registrados, no tasas de error.</p>${areaRows || empty('Todavía no hay avisos registrados en ninguna pantalla.')}${legend()}</article>
      <article class="health-chart-card health-response-chart"><h3>Respuesta al toque</h3><p>Tiempo estimado hasta presentar un fotograma tras el toque, incluido el trabajo del navegador. p95 por función; no mide la espera de red ni toda la animación.</p>${responseRows}</article>
      <article class="health-chart-card health-response-chart"><h3>Campos de texto</h3><p>Foco y primera escritura hasta presentar un fotograma. Permite localizar pausas por pantalla sin guardar texto ni nombres de campos. No incluye toda la apertura del teclado nativo.</p>${editorRows}</article>
      <p class="health-capture-note">${items.length} / ${limit} muestras · ${groups.length} sesiones conservadas · p95: el 95 % de las mediciones queda por debajo de ese tiempo.</p>`;
  }
  window.ClubHealth = {
    mark(name) { if (['authenticated','shell-ready','home-ready'].includes(name) && !marked.has(name)) { marked.add(name); record(name, {ms:Math.round(performance.now())}); } },
    show() {
      const target = document.getElementById('healthReport'), host = document.getElementById('healthDashboard');
      if (!target || !host) return;
      const data = report(); host.innerHTML = dashboard(data.samples); target.value = JSON.stringify(data, null, 2); persist();
    },
    async export() {
      this.show(); const text = JSON.stringify(report(), null, 2), file = new File([text], 'big-boy-diagnostico.json', {type:'application/json'});
      if (navigator.canShare?.({files:[file]})) { try { await navigator.share({files:[file], title:'Diagnóstico de Big Boy'}); return; } catch (error) { if (error.name === 'AbortError') return; } }
      try { await navigator.clipboard.writeText(text); document.getElementById('healthSummary').textContent = 'Diagnóstico copiado.'; }
      catch { const target = document.getElementById('healthReport'); target.closest('details').open = true; target.focus(); target.select(); document.getElementById('healthSummary').textContent = 'Selecciona y copia los datos técnicos.'; }
    },
    clear() { previous = []; samples.length = 0; persist(); this.show(); document.getElementById('healthSummary').textContent = 'Registro local eliminado. Se recogerán las siguientes mediciones.'; }
  };
  // Shared, non-blocking state row; callers keep their last successful content.
  window.ClubFeedback = {
    set(anchor, state, message, retry) {
      if (!anchor) return;
      let row = anchor.previousElementSibling;
      if (!row?.classList.contains('service-feedback')) { row = document.createElement('div'); row.className = 'service-feedback'; anchor.before(row); }
      row.replaceChildren(); row.hidden = !message; row.dataset.state = state; row.setAttribute('role', 'status');
      if (!message) return;
      const text = document.createElement('span'); text.textContent = message; row.append(text);
      if (retry) { const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Reintentar'; button.onclick = retry; row.append(button); }
    }
  };
})();
