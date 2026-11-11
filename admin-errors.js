/* Administration → Diagnóstico: the errors members' phones have reported,
   newest first, grouped by error. Read-only and admin-only (enforced by the
   admin_client_errors function on the server). */
(() => {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const platforms = {ios:'iPhone', android:'Android', web:'Web'};
  let request = 0;
  function when(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const minutes = Math.round((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return 'ahora';
    if (minutes < 60) return `hace ${minutes} min`;
    if (minutes < 1440) return `hace ${Math.round(minutes / 60)} h`;
    return date.toLocaleDateString('es-ES', {day:'numeric', month:'short'});
  }
  function row(item) {
    const where = Array.isArray(item.frames) && item.frames.length ? item.frames[0] : 'sin archivo';
    const version = item.native?.version ? `${item.native.version} (${item.native.build})` : item.build || '';
    return `<li class="admin-error">
      <div class="admin-error-head"><strong>${escape(item.name || 'Error')}</strong><span class="admin-error-count" title="Veces">×${escape(item.occurrences)}</span></div>
      <p class="admin-error-message">${escape(item.message || 'Sin mensaje')}</p>
      <p class="admin-error-meta">${escape(item.member)} · ${escape(platforms[item.platform] || item.platform || '—')} · ${escape(item.area || '—')} · <code>${escape(where)}</code>${version ? ` · ${escape(version)}` : ''}</p>
      <p class="admin-error-time">Última vez ${escape(when(item.last_seen))}${item.occurrences > 1 ? ` · primera ${escape(when(item.first_seen))}` : ''}</p>
    </li>`;
  }
  async function show(client) {
    const host = document.getElementById('adminErrors');
    if (!host || !client?.rpc) return;
    const current = ++request;
    host.setAttribute('aria-busy', 'true');
    if (!host.dataset.loaded) host.innerHTML = '<p class="admin-errors-empty">Cargando errores…</p>';
    try {
      const {data, error} = await client.rpc('admin_client_errors', {p_limit: 60});
      if (current !== request) return;
      if (error) throw error;
      const items = Array.isArray(data) ? data : [];
      host.dataset.loaded = 'true';
      host.innerHTML = `<div class="health-dashboard-heading"><div><span class="eyebrow">EN LOS MÓVILES DEL GRUPO</span><p>Errores que la app ha enviado sola. Se agrupan por error y se borran a los 30 días.</p></div><button type="button" class="secondary-button" data-admin-errors-refresh>Actualizar</button></div>`
        + (items.length ? `<ul class="admin-error-list">${items.map(row).join('')}</ul>` : '<p class="admin-errors-empty">Ningún error en los últimos 30 días.</p>');
    } catch (error) {
      if (current !== request) return;
      host.innerHTML = `<p class="admin-errors-empty">No se pudieron cargar los errores. ${escape(error?.message || '')}</p><button type="button" class="secondary-button" data-admin-errors-refresh>Reintentar</button>`;
    } finally {
      if (current === request) host.removeAttribute('aria-busy');
    }
  }
  let lastClient = null;
  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-admin-errors-refresh]') && lastClient) void show(lastClient);
  });
  globalThis.AdminErrors = Object.freeze({show(client) { lastClient = client; return show(client); }});
})();
