/* A published minimum build controls supported Android clients, not authorization. */
(() => {
  'use strict';
  const CACHE_KEY = 'bb-android-release-policy-v1';
  function safeDownloadUrl(value) {
    if (typeof value !== 'string' || value.length > 2048 || /[\s\\]/.test(value)) return '';
    try {
      const url = new URL(value.trim());
      const host=url.hostname.toLowerCase();
      if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !host.includes('.') || host.length > 253 || !host.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) || /^\d+(?:\.\d+)*$/.test(host) || /\.(local|localhost|internal|test|invalid|example)$/i.test(host)) return '';
      return url.href;
    } catch { return ''; }
  }
  function normalizePolicy(value) {
    if (!value || typeof value !== 'object' || value.platform !== 'android') return null;
    const min = Number(value.minimum_build), latest = Number(value.latest_build), url = safeDownloadUrl(value.download_url);
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(latest) || min < 1 || latest < min || latest > 2100000000 || !url || typeof value.latest_version !== 'string' || !value.latest_version.trim() || value.latest_version.length > 32 || typeof value.message !== 'string' || value.message.length > 240) return null;
    return {platform:'android', minimum_build:min, latest_build:latest, latest_version:value.latest_version.trim(), download_url:url, message:value.message.trim(), updated_at:value.updated_at || null};
  }
  const requiresUpdate = (info, policy) => Boolean(info && policy && Number.isSafeInteger(info.build) && info.build > 0 && info.build < policy.minimum_build);
  function start({client, platform = window.Capacitor?.getPlatform?.(), bridge, storage = window.localStorage} = {}) {
    const noop = {ready:Promise.resolve(), blocked:() => false, check:async () => false, destroy() {}};
    if (platform !== 'android' || !client) return noop;
    bridge ||= window.Capacitor?.registerPlugin?.('ClubAppUpdate');
    if (!bridge) return noop;
    let info = null, policy = null, pending = null, dialog = null, dialogObserver = null, blocked = false, lastChecked = 0, dead = false;
    const readCache = () => { try { return normalizePolicy(JSON.parse(storage?.getItem(CACHE_KEY) || 'null')); } catch { return null; } };
    const writeCache = value => { try { storage?.setItem(CACHE_KEY, JSON.stringify(value)); } catch {} };
    function ensureDialog() {
      if (dialog) return dialog;
      dialog = document.createElement('dialog'); dialog.className = 'app-update-gate'; dialog.id = 'appUpdateGate';
      dialog.setAttribute('aria-labelledby','appUpdateTitle');
      dialog.innerHTML = '<section class="app-update-sheet"><div class="app-update-brand">The Big Boy Rules<span>Android</span></div><p class="app-update-caption">Versión de la aplicación</p><h1 id="appUpdateTitle">Actualiza para continuar.</h1><p class="app-update-message"></p><dl class="app-update-versions"><div><dt>Instalada</dt><dd data-update-current></dd></div><div><dt>Disponible</dt><dd data-update-latest></dd></div></dl><p class="app-update-minimum"></p><div class="app-update-actions"><button type="button" data-update-download>Descargar actualización</button><button type="button" data-update-recheck>Ya he actualizado</button></div><p class="app-update-feedback" role="status" aria-live="polite"></p><p class="app-update-help">Android te pedirá confirmar la instalación. Actualiza sobre la app actual para conservar tus datos.</p></section>';
      dialog.addEventListener('cancel', event => event.preventDefault());
      dialog.querySelector('[data-update-download]').addEventListener('click', async () => {
        const url = safeDownloadUrl(policy?.download_url); if (!url) return;
        const feedback = dialog.querySelector('.app-update-feedback');
        try { await bridge.openDownload({url}); feedback.textContent = 'Se ha abierto la descarga. Instala el APK y vuelve a abrir Big Boy.'; }
        catch { feedback.textContent = 'No se pudo abrir la descarga. Comprueba la conexión y vuelve a intentarlo.'; }
      });
      dialog.querySelector('[data-update-recheck]').addEventListener('click', async () => {
        const button = dialog.querySelector('[data-update-recheck]'); button.disabled = true;
        dialog.querySelector('.app-update-feedback').textContent = 'Comprobando la versión…';
        await check(true);
        if (blocked) dialog.querySelector('.app-update-feedback').textContent = `Sigue instalada la versión ${info.version} (${info.build}). Instala la actualización y vuelve a abrir la app.`;
        button.disabled = false;
      });
      document.body.append(dialog); return dialog;
    }
    function paint() {
      blocked = requiresUpdate(info, policy);
      document.documentElement.classList.toggle('app-update-required', blocked);
      if (!blocked) { dialogObserver?.disconnect(); dialogObserver=null; if (dialog?.open) dialog.close(); return; }
      const node = ensureDialog();
      node.querySelector('.app-update-message').textContent = policy.message || 'Esta versión de Big Boy ya no está disponible. Instala la actualización para entrar al club.';
      node.querySelector('[data-update-current]').textContent = `${info.version} (${info.build})`;
      node.querySelector('[data-update-latest]').textContent = `${policy.latest_version} (${policy.latest_build})`;
      node.querySelector('.app-update-minimum').textContent = `Se requiere la compilación ${policy.minimum_build} o posterior.`;
      if (!node.open) node.showModal();
      if (!dialogObserver) {
        // A delayed account/MFA dialog must not become the top layer above a mandatory update.
        dialogObserver = new MutationObserver(records => {
          if (!blocked || dead || !dialog?.isConnected) return;
          const anotherOpened = records.some(record => record.target !== dialog && (
            record.type === 'attributes' ? record.target.matches?.('dialog[open]') :
              [...record.addedNodes].some(added => added !== dialog && (added.matches?.('dialog[open]') || added.querySelector?.('dialog[open]')))
          ));
          if (anotherOpened) { if (dialog.open) dialog.close(); dialog.showModal(); }
        });
        dialogObserver.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
      }
    }
    async function readInfo() {
      let timeout;
      const result = await Promise.race([bridge.getInfo(), new Promise((_, reject) => {timeout=setTimeout(() => reject(new Error('version-timeout')), 2000);})]).finally(()=>clearTimeout(timeout));
      const build = Number(result?.build);
      if (!Number.isSafeInteger(build) || build < 1 || typeof result.version !== 'string') throw new Error('invalid-version');
      info = {platform:'android',build,version:result.version.slice(0,32)};
    }
    async function check(force = false) {
      if (dead) return false;
      if (pending) return pending;
      if (!force && Date.now() - lastChecked < 60000) return blocked;
      pending = (async () => {
        try {
          await readInfo(); if (dead) return false;
          policy ||= readCache(); paint();
          const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 5000);
          try {
            const {data,error} = await client.from('app_release_policy').select('platform,minimum_build,latest_build,latest_version,download_url,message,updated_at').eq('platform','android').maybeSingle().abortSignal(controller.signal);
            if (error) throw error;
            const value = normalizePolicy(data);
            if (value && !dead) { policy = value; writeCache(value); paint(); }
          } finally { clearTimeout(timeout); }
        } catch { /* Keep a known mandatory policy offline; never guess a build or lock an unconfigured client. */ }
        finally { lastChecked = Date.now(); pending = null; }
        return blocked;
      })();
      return pending;
    }
    const resumed = () => { if (!document.hidden) void check(); };
    const online = () => { void check(true); };
    document.addEventListener('visibilitychange',resumed); window.addEventListener('online',online);
    const firstCheck = check(true);
    // Version checking must not add a long cold-start wait to a supported app.
    const ready = new Promise(resolve => { const timeout=setTimeout(resolve,1200); firstCheck.finally(()=>{clearTimeout(timeout);resolve();}); });
    return {ready, blocked:() => blocked, check, destroy() {dead=true;dialogObserver?.disconnect();dialogObserver=null;document.removeEventListener('visibilitychange',resumed);window.removeEventListener('online',online);dialog?.close();dialog?.remove();document.documentElement.classList.remove('app-update-required');}};
  }
  function createAdmin(mount, {client, allowed, owner}) {
    let actor = null, request = 0, loaded = false, dirty = false, busy = false;
    mount.innerHTML = '<div class="control-release-heading"><div><h3>Actualizaciones de Android</h3><p>Elige qué compilaciones pueden seguir entrando al club.</p></div><button type="button" data-release-reload>Actualizar datos</button></div><form class="control-release-form"><div class="control-release-summary"><strong data-release-summary>Sin datos publicados</strong><p>Esta primera versión incorpora el control de actualizaciones. Las instalaciones anteriores necesitan instalarla una vez.</p></div><div class="control-release-fields"><label>Versión disponible<input name="latest_version" required maxlength="32" autocomplete="off" placeholder="1.1.0"></label><label>Compilación disponible<input name="latest_build" required type="number" min="1" max="2100000000" step="1" inputmode="numeric"></label><label>Compilación mínima para entrar<input name="minimum_build" required type="number" min="1" max="2100000000" step="1" inputmode="numeric"><small>Las compilaciones inferiores quedan bloqueadas al abrir o volver a la app.</small></label><label class="control-release-wide">Enlace HTTPS del APK<input name="download_url" required type="url" maxlength="2048" autocomplete="off" placeholder="https://…/BigBoy-Android.apk"></label><label class="control-release-wide">Mensaje de actualización<textarea name="message" rows="2" maxlength="240"></textarea></label></div><footer class="control-release-publish"><p data-release-impact>Publica primero el APK nuevo y después sube la compilación mínima.</p><button type="submit">Guardar actualización</button></footer><p data-release-feedback role="status" aria-live="polite"></p></form>';
    const form = mount.querySelector('form'), feedback = mount.querySelector('[data-release-feedback]'), reload = mount.querySelector('[data-release-reload]');
    const names = ['latest_version','latest_build','minimum_build','download_url','message'];
    const validActor = id => allowed() && owner() === id;
    function controls() { form.querySelectorAll('input,textarea,button').forEach(node => {node.disabled = !loaded || busy || !allowed();}); reload.disabled=busy; }
    function read() { return normalizePolicy(Object.fromEntries([['platform','android'],...names.map(name => [name,form.elements.namedItem(name).value])])); }
    function impact() { const min=Number(form.elements.namedItem('minimum_build').value);mount.querySelector('[data-release-impact]').textContent=Number.isSafeInteger(min)&&min>0 ? `Se permitirá entrar desde la compilación ${min}. Las anteriores deberán actualizarse.` : 'Publica primero el APK nuevo y después sube la compilación mínima.'; }
    async function load(force = false) {
      if (!allowed() || busy || (loaded && !force) || (dirty && !force)) return;
      const id=owner(), token=++request;actor=id;busy=true;controls();feedback.textContent='Cargando política de versiones…';
      try {
        const {data,error}=await client.from('app_release_policy').select('*').eq('platform','android').maybeSingle(); if(error)throw error;
        if(!validActor(id)||token!==request)return;
        const value=normalizePolicy(data);if(!value)throw new Error('No hay una política de Android válida publicada.');
        for(const name of names)form.elements.namedItem(name).value=value[name];
        loaded=true;dirty=false;mount.querySelector('[data-release-summary]').textContent=`Disponible: ${value.latest_version} · compilación ${value.latest_build}`;feedback.textContent='La política se aplica al abrir o volver a la app.';impact();
      } catch(error) {if(validActor(id)&&token===request)feedback.textContent=error.message||'No se pudo cargar. Vuelve a intentarlo.';}
      finally{if(token===request){busy=false;controls();}}
    }
    form.addEventListener('input',()=>{dirty=true;impact();feedback.textContent='Cambios sin publicar.';});
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(busy||!loaded||!validActor(actor)||!form.reportValidity())return;
      const value=read();if(!value){feedback.textContent='Revisa el enlace HTTPS y las compilaciones: la mínima no puede superar a la disponible.';return;}
      const id=actor,token=++request;busy=true;controls();feedback.textContent='Guardando política…';
      try{
        const payload={...value,updated_at:new Date().toISOString()};
        const {data,error}=await client.from('app_release_policy').upsert(payload,{onConflict:'platform'}).select('*').single();if(error)throw error;
        if(!validActor(id)||token!==request)return;
        const saved=normalizePolicy(data);if(!saved)throw new Error('El servidor no devolvió una política válida.');
        dirty=false;mount.querySelector('[data-release-summary]').textContent=`Disponible: ${saved.latest_version} · compilación ${saved.latest_build}`;feedback.textContent='Guardado. Los Android con una compilación inferior deberán actualizar.';
      }catch(error){if(validActor(id)&&token===request)feedback.textContent=error.message||'No se pudo guardar. Comprueba la conexión.';}
      finally{if(token===request){busy=false;controls();}}
    });
    reload.addEventListener('click',()=>{if(dirty){feedback.textContent='Guarda tus cambios antes de volver a cargar los datos.';return;}void load(true);});
    controls();
    return {load, sync(){if(actor!==owner()||!allowed()){++request;actor=owner();loaded=false;dirty=false;busy=false;form.reset();feedback.textContent='';mount.querySelector('[data-release-summary]').textContent='Sin datos publicados';controls();}}};
  }
  globalThis.ClubAppUpdate = Object.freeze({start,createAdmin,normalizePolicy,safeDownloadUrl,requiresUpdate});
})();
