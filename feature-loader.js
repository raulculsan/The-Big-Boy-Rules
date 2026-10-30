/* Load optional surfaces when they are opened; the shared shell stays immediately usable.
   Explicit ordering preserves the classic-script globals used by the native/offline app. */
(() => {
  'use strict';
  const registry = {
    chat: {styles:[], scripts:['chat-themes.js?v=20261010-241']},
    collection: {styles:['album.css?v=20261026-album-missions-416']},
    admin: {styles:['admin-grants.css?v=20261009-213','admin-console.css?v=20261030-app-update-440'], scripts:['achievement-admin.js?v=20261010-244','admin-grants.js?v=20261018-password-335']},
    spotify: {styles:['spotify-player.css?v=20261014-balanced'], scripts:['spotify-player.js?v=20261021-deferred-364']}
  };
  const loaded = new Set(), pending = new Map(), assets = new Map(), initializers = new Map();
  function asset(url, style) {
    if (assets.has(url)) return assets.get(url);
    const promise = new Promise((resolve, reject) => {
      const node = document.createElement(style ? 'link' : 'script');
      if (style) { node.rel = 'stylesheet'; node.href = url; }
      else { node.src = url; node.async = false; }
      node.dataset.featureAsset = 'true';
      const timer = setTimeout(() => fail(), 15000);
      const fail = () => { clearTimeout(timer); node.remove(); assets.delete(url); reject(new Error('No se pudo cargar esta sección. Comprueba la conexión y vuelve a intentarlo.')); };
      node.onload = () => { clearTimeout(timer); resolve(); };
      node.onerror = fail;
      if (style) document.head.insertBefore(node, document.querySelector('link[href^="visual-system.css"]'));
      else document.head.append(node);
    });
    assets.set(url, promise);
    return promise;
  }
  function load(name) {
    if (loaded.has(name)) return Promise.resolve();
    if (pending.has(name)) return pending.get(name);
    const feature = registry[name];
    if (!feature) return Promise.resolve();
    const promise = (async () => {
      await Promise.all((feature.styles || []).map(url => asset(url, true)));
      for (const url of feature.scripts || []) await asset(url, false);
      for (const initialize of initializers.get(name) || []) initialize();
      loaded.add(name);
    })().finally(() => pending.delete(name));
    pending.set(name, promise);
    return promise;
  }
  function lazyService(globalName, feature, {remember=[], actions=[], quiet=[]}) {
    const saved = new Map();
    let generation = 0;
    const facade = {};
    const actual = () => globalThis[globalName] !== facade ? globalThis[globalName] : null;
    for (const method of remember) facade[method] = (...args) => {
      saved.set(method, args);
      return actual()?.[method]?.(...args);
    };
    for (const method of actions) facade[method] = async (...args) => {
      const token = generation;
      try { await load(feature); if (token === generation) return actual()?.[method]?.(...args); }
      catch (error) { feedback(error.message, () => facade[method](...args)); }
    };
    for (const method of quiet) facade[method] = (...args) => { if (method === 'disconnect') generation++; return actual()?.[method]?.(...args); };
    facade.reset = (...args) => { generation++; for (const method of [...saved.keys()]) if (!['initialize','init'].includes(method)) saved.delete(method); return actual()?.reset?.(...args); };
    globalThis[globalName] = facade;
    const hooks = initializers.get(feature) || [];
    hooks.push(() => { for (const [method, args] of saved) actual()?.[method]?.(...args); });
    initializers.set(feature, hooks);
  }
  lazyService('AdminGrants','admin',{remember:['initialize'],actions:['open'],quiet:['render','didNavigate']});
  lazyService('ChatThemes','chat',{remember:['init','sync'],actions:[],quiet:['close']});
  lazyService('ClubSpotify','spotify',{remember:[],actions:['mount'],quiet:['disconnect']});
  globalThis.AchievementAdmin = {
    create(options) {
      let instance;
      const get = () => instance ||= globalThis.AchievementAdmin.create(options);
      const hooks = initializers.get('admin') || []; hooks.push(get); initializers.set('admin',hooks);
      return {
        render() { if (loaded.has('admin')) get().render(); },
        async openCreate(...args) { try { await load('admin'); get().openCreate(...args); } catch (error) { feedback(error.message); } },
        async openAssignments(...args) { try { await load('admin'); get().openAssignments(...args); } catch (error) { feedback(error.message); } },
        closeCreate() { instance?.closeCreate(); }, closeAssignments() { instance?.closeAssignments(); }
      };
    }
  };
  function forRoute(id) {
    if (['chat','privados','seccion-chat'].includes(id)) return 'chat';
    if (['sobres','album','catalogo'].includes(id)) return 'collection';
    if (id === 'administracion' || id.startsWith('admin-') || ['crear-logro','asignar-logro','editar-usuario'].includes(id)) return 'admin';
    return null;
  }
  let notice;
  function feedback(message, retry) {
    notice ||= Object.assign(document.createElement('div'),{className:'feature-load-notice'});
    notice.setAttribute('role','status'); notice.replaceChildren(document.createTextNode(message));
    if (retry) { const button = document.createElement('button'); button.type='button'; button.textContent='Reintentar'; button.onclick=()=>{notice.remove();retry();}; notice.append(button); }
    const close = document.createElement('button'); close.type='button'; close.textContent='Cerrar'; close.onclick=()=>notice.remove(); notice.append(close);
    document.body.append(notice);
  }
  globalThis.ClubFeatures = Object.freeze({load,feedback,routeReady:id=>!forRoute(id)||forRoute(id)==='chat'||loaded.has(forRoute(id)),forRoute:id=>load(forRoute(id))});
})();
