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
      heading:data.credited?`${data.credited_packs || 1} ${(data.credited_packs || 1) === 1 ? 'sobre recibido' : 'sobres recibidos'}`:'Saldo de sobres actualizado',
      message:Number.isSafeInteger(data.streak_days) ? `Racha de ${data.streak_days} ${data.streak_days === 1 ? 'día' : 'días'} · ${data.daily_reward_packs} ${data.daily_reward_packs === 1 ? 'sobre diario' : 'sobres diarios'}.` : 'El siguiente sobre diario estará disponible mañana.', filled:true};
    if (status === 'unavailable') return {count, label:'sobres guardados', heading:'Recarga diaria no configurada',
      message:'La recarga diaria no está activada en el servidor.', filled:false};
    if (status === 'error') return {count, label:known?'sobres · última sincronización':'sobres guardados',
      heading:'No se pudieron actualizar los sobres', message:'Comprueba la conexión y vuelve a intentarlo.', filled:false};
    return {count, label:'sobres guardados', heading:status==='idle'?'Saldo de sobres':'Comprobando saldo…',
      message:'El saldo se sincroniza con tu cuenta.', filled:false};
  }

  function updateBalance(available) {
    const count = Number.isSafeInteger(available) && available >= 0 ? new Intl.NumberFormat('es-ES').format(available) : '—';
    const label = count === '—' ? 'Saldo de sobres pendiente de sincronización' : `${count} ${available === 1 ? 'sobre disponible' : 'sobres disponibles'}`;
    for (const id of ['packsCount', 'packsHomeBalance']) {
      const node = document.getElementById(id);
      if (node) {node.textContent = count; node.setAttribute('aria-label', label); if (id === 'packsHomeBalance') node.style.fontSize = `${Math.min(9, 30 / Math.max(1, count.length))}px`;}
    }
    document.getElementById('packsTopButton')?.setAttribute('aria-label', `Abrir mis sobres de la colección Los nuestros. ${label}`);
    globalThis.PlanWidget?.updatePacks?.(available);
  }

  let ui;
  function initialize(options) {
    if (ui) return;
    let renderedBalanceData;
    const render = state => {
      if (state.data !== renderedBalanceData) {
        renderedBalanceData = state.data;
        updateBalance(state.data?.available);
      }
      const info=document.getElementById('packsInfoPanel');
      if(info) {
        let rewards=info.querySelector('[data-pack-progression]');
        if(!rewards) {rewards=document.createElement('p');rewards.className='pack-rarity-odds';rewards.dataset.packProgression='';info.append(rewards);}
        const streak=state.data?.streak_days, allowance=state.data?.daily_reward_packs;
        rewards.textContent=(Number.isSafeInteger(streak) ? `Tu racha: ${streak} ${streak === 1 ? 'día' : 'días'} · ${allowance} ${allowance === 1 ? 'sobre hoy' : 'sobres hoy'}. ` : '')+'Racha: 1–2 días → 1 sobre; 3–6 → 2; 7–13 → 3; 14–29 → 4; 30 o más → 5. Trofeos: bronce 1 · plata 2 · oro 4 · platino 6 sobres.';
        let activities=info.querySelector('[data-pack-activities]');
        const enabled=state.data?.activity_reward_limit===3;
        if(enabled&&!activities){activities=document.createElement('p');activities.className='pack-rarity-odds';activities.dataset.packActivities='';info.append(activities);}
        if(activities){
          activities.hidden=!enabled;
          if(enabled){
            const earned=state.data.activity_rewards||{}, completed=['message','poll','event'].filter(key=>earned[key]===true).length;
            activities.textContent=`3 sobres extra cada día: +1 por tu primer mensaje en un grupo, +1 por votar en una encuesta y +1 por responder a un plan nuevo. Hoy: ${completed}/3 conseguidos. Se suman automáticamente; cambiar una respuesta no da otro sobre. El día se reinicia a las 00:00, hora de Madrid.`;
          }
        }
      }
    };
    ui=createStore({...options,onChange:render});
    render(ui.snapshot());
  }
  function activityCompleted(kind) {
    const data=ui?.snapshot().data;
    if(!['message','poll','event'].includes(kind)||data?.activity_reward_limit!==3)return;
    if(data.activity_rewards?.[kind]===true&&Date.parse(data.next_reset_at)>Date.now())return;
    void ui.refresh(true);
  }
  globalThis.DailyPacks=Object.freeze({createStore,presentation,initialize,updateBalance,activityCompleted,snapshot:()=>ui?.snapshot(),refresh:(...args)=>ui?.refresh(...args),reset:()=>ui?.reset()});
})();
