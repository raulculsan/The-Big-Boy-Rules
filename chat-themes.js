/* Personal wallpapers stay on this device, scoped to the signed-in user and chat. */
(function (global) {
  'use strict';
  const STORAGE_KEY = 'bb-chat-themes-v1';
  const DEFAULT_ID = 'big-boy';
  const paletteIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18h1.2a2 2 0 0 0 1.5-3.3 1.4 1.4 0 0 1 1.1-2.3H17a4 4 0 0 0 4-4c0-4.7-4-8.4-9-8.4Z"/><circle cx="7.5" cy="10" r=".8"/><circle cx="10" cy="6.5" r=".8"/><circle cx="14.5" cy="6.5" r=".8"/><circle cx="17" cy="10" r=".8"/></svg>';
  let catalog = [], getContext = () => null, dialog, draft, opener, loadPromise;
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function key(context) {
    return context?.userId && context?.conversationId != null && ['group', 'private'].includes(context.kind)
      ? JSON.stringify([String(context.userId), context.kind, String(context.conversationId)]) : null;
  }
  function read() {
    try {
      const value = JSON.parse(global.localStorage.getItem(STORAGE_KEY) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch { return {}; }
  }
  function saved(context) {
    const id = read()[key(context)];
    return catalog.some(theme => theme.id === id) ? id : DEFAULT_ID;
  }
  function save(context, id) {
    const idKey = key(context);
    if (!idKey || !catalog.some(theme => theme.id === id)) return false;
    try {
      const values = read();
      if (id === DEFAULT_ID) delete values[idKey]; else values[idKey] = id;
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
      return true;
    } catch { return false; }
  }
  function luminance(color) {
    const value = /^#[\da-f]{6}$/i.test(color) ? color : '#ffffff';
    return [1,3,5].map(start => parseInt(value.slice(start,start+2),16)/255)
      .map(x => x <= .04045 ? x/12.92 : ((x+.055)/1.055)**2.4)
      .reduce((sum, x, i) => sum + x * [.2126,.7152,.0722][i], 0);
  }
  function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }
  function accessibleColor(candidate, surfaces, minimum = 4.5) {
    if (surfaces.every(surface => contrast(candidate, surface) >= minimum)) return candidate;
    return ['#f8fafc','#18212b'].sort((a,b) => Math.min(...surfaces.map(s => contrast(b,s))) - Math.min(...surfaces.map(s => contrast(a,s))))[0];
  }
  function apply(element, theme) {
    if (!element || !theme) return;
    const surfaces = [theme.incoming, theme.outgoing];
    element.dataset.chatTheme = theme.id;
    element.style.setProperty('--chat-base', theme.color || '#0c0e12');
    element.style.setProperty('--chat-wallpaper', `url("${theme.background}")`);
    element.style.setProperty('--chat-incoming', theme.incoming);
    element.style.setProperty('--chat-outgoing', theme.outgoing);
    element.style.setProperty('--chat-text', accessibleColor(theme.text, surfaces));
    element.style.setProperty('--chat-muted', accessibleColor(theme.muted, surfaces));
    element.style.setProperty('--chat-accent', accessibleColor(theme.accent, surfaces));
  }
  function sync(kind) {
    const context = getContext(kind), container = document.getElementById(kind === 'private' ? 'privateMessages' : 'messages');
    const header = document.querySelector(kind === 'private' ? '#privateChatHeader' : '.group-conversation .chat-header');
    if (dialog?.open && key(getContext(draft.context.kind)) !== key(draft.context)) close();
    const theme = catalog.find(item => item.id === saved(context)) || catalog[0];
    if (theme) apply(container, theme);
    const existing = header?.querySelector('[data-chat-themes]');
    if (!key(context)) { existing?.remove(); if (container) delete container.dataset.chatTheme; return; }
    if (header && !existing) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'chat-theme-button'; button.dataset.chatThemes = kind;
      button.setAttribute('aria-label', 'Cambiar fondo del chat'); button.setAttribute('aria-haspopup', 'dialog'); button.innerHTML = paletteIcon;
      header.append(button);
    }
  }
  function previews(theme, sample = false) {
    return `<div class="chat-theme-preview${sample ? ' chat-theme-preview-large' : ''}" data-theme-preview="${escape(theme.id)}"><span class="chat-theme-sample incoming">${sample ? '¿Nos vemos esta tarde?' : '¿Qué tal?'}</span><span class="chat-theme-sample outgoing">${sample ? '¡Claro! A las 18:00 🙌' : '¡Todo bien!'}</span>${sample ? '<span class="chat-theme-sample-time">18:00 · Vista previa</span>' : ''}</div>`;
  }
  function renderGallery() {
    const theme = catalog.find(item => item.id === draft.id) || catalog[0];
    dialog.innerHTML = `<div class="chat-theme-sheet"><header class="chat-theme-gallery-header"><button type="button" data-theme-cancel aria-label="Cerrar fondos del chat">‹</button><div><h2 id="chatThemeTitle">Fondos del chat</h2><p>Solo tú verás este fondo.</p></div></header><div class="chat-theme-gallery-scroll">${previews(theme,true)}<div class="chat-theme-preview-caption"><strong>${escape(theme.name)}</strong><span>Así se verá tu conversación</span></div>${['Esenciales','Naturaleza','Especiales'].map(section => `<section class="chat-theme-category"><h3>${section}</h3><div class="chat-theme-grid">${catalog.filter(item => item.section === section).map(item => `<button class="chat-theme-tile${draft.id === item.id ? ' selected' : ''}" type="button" data-theme-choice="${escape(item.id)}" aria-pressed="${draft.id === item.id}" aria-label="${escape(item.name)}">${previews(item)}<span class="chat-theme-tile-label">${escape(item.name)}<span class="chat-theme-check" aria-hidden="true">${draft.id === item.id ? '✓' : ''}</span></span></button>`).join('')}</div></section>`).join('')}</div><footer class="chat-theme-gallery-footer"><button type="button" data-theme-default>Restablecer</button><button type="button" data-theme-apply>Aplicar fondo</button><p data-theme-status role="status"></p></footer></div>`;
    dialog.querySelectorAll('[data-theme-preview]').forEach(element => apply(element, catalog.find(item => item.id === element.dataset.themePreview)));
  }
  function close() { if (!dialog?.open) return; dialog.close(); draft = null; document.body.classList.remove('chat-theme-gallery-open'); opener?.focus({preventScroll:true}); }
  async function open(kind, button) {
    await loadPromise;
    const context = getContext(kind);
    if (!key(context) || !catalog.length) return;
    opener = button;
    draft = {context: {...context}, id: saved(context)};
    if (!dialog) {
      dialog = document.createElement('dialog'); dialog.className = 'chat-theme-gallery'; dialog.setAttribute('aria-labelledby','chatThemeTitle');
      document.body.append(dialog);
      dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
      dialog.addEventListener('click', event => {
        const choice = event.target.closest('[data-theme-choice]');
        if (choice) { draft.id = choice.dataset.themeChoice; renderGallery(); dialog.querySelector(`[data-theme-choice="${draft.id}"]`)?.focus({preventScroll:true}); }
        if (event.target.closest('[data-theme-default]')) { draft.id = DEFAULT_ID; renderGallery(); dialog.querySelector('[data-theme-default]')?.focus({preventScroll:true}); }
        if (event.target.closest('[data-theme-cancel]')) close();
        if (event.target.closest('[data-theme-apply]')) {
          if (key(getContext(draft.context.kind)) !== key(draft.context)) { close(); return; }
          if (!save(draft.context, draft.id)) { dialog.querySelector('[data-theme-status]').textContent = 'No se ha podido guardar. Inténtalo de nuevo.'; return; }
          const kind = draft.context.kind; close(); sync(kind);
        }
      });
      dialog.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.target.matches('button')) event.preventDefault(); });
    }
    renderGallery(); document.body.classList.add('chat-theme-gallery-open'); dialog.showModal(); dialog.querySelector('[data-theme-cancel]').focus();
  }
  function init(options) {
    getContext = options.getContext;
    loadPromise = fetch('./chat-theme-catalog.json?v=20261010-241').then(response => { if (!response.ok) throw new Error('Catalog unavailable'); return response.json(); })
      .then(value => { catalog = Array.isArray(value) ? value.filter(item => /^[a-z0-9-]+$/.test(item.id) && /^icons\/chat-backgrounds\/[a-z0-9-]+\.svg$/.test(item.background) && ['incoming','outgoing','text','muted','accent'].every(field => /^#[\da-f]{6}$/i.test(item[field]))) : []; sync('group'); sync('private'); })
      .catch(() => { catalog = []; });
    document.addEventListener('click', event => { const button = event.target.closest('[data-chat-themes]'); if (button) void open(button.dataset.chatThemes, button); });
    global.addEventListener('storage', event => { if (event.key === STORAGE_KEY) { sync('group'); sync('private'); } });
  }
  global.ChatThemes = Object.freeze({init, sync, close, contrast, accessibleColor});
})(globalThis);
