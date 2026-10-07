/* A daily pack is granted by the server, never by a local timer or localStorage. */
(() => {
  function createStore({session, visible = () => true, rpc, onChange = () => {}, now = Date.now, timeoutMs = 12000}) {
    let owner, data = null, status = 'idle', pending, lastAttempt = -Infinity;
    const snapshot = () => ({status, data});
    const emit = () => onChange(snapshot());
    function reset() {pending?.controller.abort();owner = null;data = null;status = 'idle';pending = null;lastAttempt = -Infinity;emit();}
    async function refresh(force = false) {
      const user = session();
      if (!user) {if(owner) reset();return;}
      if (owner !== user) {reset();owner = user;}
      if (!visible()) return;
      if (pending) return pending.promise;
      if (!force && ((status === 'ready' && Date.parse(data.next_reset_at) > now()) || now()-lastAttempt < 60000)) return;
      lastAttempt = now();
      status = 'loading';emit();
      const request = {promise:null, controller:new AbortController()};pending = request;
      request.promise = (async () => {
        let timer;
        try {
          const result = await Promise.race([rpc(request.controller.signal), new Promise((_,reject) => {
            timer=setTimeout(()=>{request.controller.abort();reject(new Error('Pack sync timeout'));},timeoutMs);
          })]);
          if (pending !== request || session() !== user) return;
          if (result.error) throw result.error;
          const value = result.data;
          if (!value || !Number.isSafeInteger(value.available) || value.available < 0 ||
              !Number.isSafeInteger(value.total) || value.total < value.available || !Number.isFinite(Date.parse(value.next_reset_at))) {
            throw new Error('Invalid pack response');
          }
          data = value;status = 'ready';
        } catch (error) {
          if (pending !== request || session() !== user) return;
          status = ['PGRST202','PGRST205','42883','42P01'].includes(error.code) ? 'unavailable' : 'error';
        } finally {
          clearTimeout(timer);
          if (pending === request && session() === user) {pending = null;emit();}
        }
      })();
      return request.promise;
    }
    return {refresh, reset, snapshot};
  }

  function presentation({status, data}) {
    const known = data != null;
    const count = known ? new Intl.NumberFormat('es-ES').format(data.available) : '—';
    if (status === 'ready') return {count, label:data.available===1?'sobre guardado':'sobres guardados',
      heading:data.credited?'Tu sobre de hoy ya está contigo.':'Tu sobre de hoy está guardado.',
      message:'Vuelve mañana para sumar otro. No necesitas cerrar sesión.', filled:true};
    if (status === 'unavailable') return {count, label:'sobres guardados', heading:'La recarga diaria aún no está activada.',
      message:'Tu colección está preparada. Falta activar la recarga en el servidor.', filled:false};
    if (status === 'error') return {count, label:known?'sobres · última sincronización':'sobres guardados',
      heading:'No hemos podido sincronizar tus sobres.', message:'Revisa la conexión. No se descuenta ni se pierde ningún sobre.', filled:false};
    return {count, label:'sobres guardados', heading:status==='idle'?'Tu colección empieza aquí.':'Comprobando tu acceso de hoy…',
      message:'El saldo se guarda en tu cuenta y se comparte entre tus dispositivos.', filled:false};
  }

  function updateBalance(available) {
    const count = Number.isSafeInteger(available) && available >= 0 ? new Intl.NumberFormat('es-ES').format(available) : '—';
    const label = count === '—' ? 'Saldo de sobres pendiente de sincronización' : `${count} ${available === 1 ? 'sobre disponible' : 'sobres disponibles'}`;
    for (const id of ['packsCount', 'packsHomeBalance']) {
      const node = document.getElementById(id);
      if (node) {node.textContent = count; node.setAttribute('aria-label', label);}
    }
    document.querySelector('.packs-home-link')?.setAttribute('aria-label', `Abrir mis sobres de la colección Los nuestros. ${label}`);
  }

  let ui;
  function initialize(options) {
    if (ui) return;
    const text = (id,value) => {const node=document.getElementById(id);if(node && node.textContent !== value) node.textContent=value;};
    let renderedBalanceData;
    const render = state => {
      const view = presentation(state);
      if (state.data !== renderedBalanceData) {
        renderedBalanceData = state.data;
        updateBalance(state.data?.available);
      }
      text('packsStatusTitle',view.heading);text('packsStatusMessage',view.message);
      const meter=document.getElementById('packsDailyProgress');
      if(meter) {meter.value=view.filled?1:0;meter.setAttribute('aria-valuetext',view.filled?'Sobre de hoy recibido':'Acceso de hoy pendiente de comprobar');}
      text('packsDailyLabel',view.filled?'ACCESO DE HOY · COMPLETADO':'UN ACCESO · UN SOBRE');
      const button=document.getElementById('packsSyncButton');
      if(button) {button.disabled=state.status==='loading';button.textContent=state.status==='loading'?'Sincronizando…':state.status==='error'?'Reintentar':'Actualizar saldo';}
      const next = state.status === 'ready' ? new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Madrid'}).format(new Date(state.data.next_reset_at)) : 'Pendiente de sincronización';
      text('packsNextReset',next);
      const panel=document.getElementById('packsDailyPanel');
      if(panel) panel.dataset.state=state.status;
    };
    ui=createStore({...options,onChange:render});
    document.getElementById('packsSyncButton')?.addEventListener('click',()=>void ui.refresh(true));
    render(ui.snapshot());
  }
  globalThis.DailyPacks=Object.freeze({createStore,presentation,initialize,updateBalance,refresh:(...args)=>ui?.refresh(...args),reset:()=>ui?.reset()});
})();
