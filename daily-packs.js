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
      heading:data.welcome_credited_packs === 20 ? '20 sobres de bienvenida' : data.credited?`${data.credited_packs || 1} ${(data.credited_packs || 1) === 1 ? 'sobre recibido' : 'sobres recibidos'}`:'Saldo de sobres actualizado',
      message:data.welcome_credited_packs === 20 ? 'Has recibido 20 sobres por tu primer acceso al club. Ya están guardados en tu cuenta.' : Number.isSafeInteger(data.streak_days) ? `Racha de ${data.streak_days} ${data.streak_days === 1 ? 'día' : 'días'} · ${data.daily_reward_packs} ${data.daily_reward_packs === 1 ? 'sobre diario' : 'sobres diarios'}${data.credited_coins > 0 ? ` y +${data.credited_coins} monedas` : ''}.${data.streak_shields_used > 0 ? ` ${data.streak_shields_used === 1 ? 'Un protector ha salvado' : 'Dos protectores han salvado'} tu racha.` : ''}` : 'El siguiente sobre diario estará disponible mañana.', filled:true};
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
    // El Chota reads the balance out loud on the collection stage.
    const chota=document.querySelector('[data-pack-chota]');
    if(chota){
      const known=count!=='—';
      chota.textContent=!known?'Contando tus sobres…':available===0?'Sin sobres por ahora. Mañana te guardo otro.':available===1?'Te queda un sobre. ¿Lo abrimos?':`${count} sobres esperando. ¡Ábrelos ya!`;
      chota.closest('.col-chota')?.setAttribute('data-mood',!known?'wait':available?'happy':'calm');
    }
    globalThis.PlanWidget?.updatePacks?.(available);
  }

  let ui, buyingShield = false, shieldNotice = '';
  // Streak protectors: bought here, spent automatically by the daily claim.
  function shieldMarkup(data) {
    const max = data.streak_shield_limit || 2, price = data.streak_shield_price || 80, held = data.streak_shields;
    const label = held >= max ? 'Tienes el máximo' : buyingShield ? 'Comprando…' : `Comprar por ${price} monedas`;
    return `<p><span>Protectores de racha</span><b>${held}/${max}</b></p><p class="pack-rarity-odds">Si un día no entras, un protector salva tu racha. Se usan solos al volver; si faltan más días que protectores, la racha empieza de nuevo y los conservas.</p><button type="button" class="packs-sync" data-buy-shield data-price="${price}" ${held >= max || buyingShield ? 'disabled' : ''}>${label}</button><p class="pack-rarity-odds" role="status">${shieldNotice}</p>`;
  }
  function initialize(options) {
    if (ui) return;
    let renderedBalanceData;
    const render = state => {
      if (state.data !== renderedBalanceData) {
        renderedBalanceData = state.data;
        updateBalance(state.data?.available);
        // The daily claim also pays coins; refresh the wallet when it did.
        if (state.data?.credited_coins > 0) globalThis.ClubCoinMissions?.activity?.({coins:state.data.credited_coins});
      }
      const info=document.getElementById('packsInfoPanel');
      if(info) {
        let rewards=info.querySelector('[data-pack-progression]');
        if(!rewards) {rewards=document.createElement('p');rewards.className='pack-rarity-odds';rewards.dataset.packProgression='';info.append(rewards);}
        let welcome=info.querySelector('[data-pack-welcome]');
        if(!welcome) {welcome=document.createElement('p');welcome.className='pack-rarity-odds';welcome.dataset.packWelcome='';info.insertBefore(welcome,rewards);}
        welcome.hidden=state.data?.welcome_credited_packs!==20;
        welcome.textContent=welcome.hidden ? '' : 'Has recibido 20 sobres de bienvenida por tu primer acceso al club. Se conceden una sola vez por cuenta.';
        const streak=state.data?.streak_days, allowance=state.data?.daily_reward_packs;
        rewards.textContent=(Number.isSafeInteger(streak) ? `Tu racha: ${streak} ${streak === 1 ? 'día' : 'días'} · ${allowance} ${allowance === 1 ? 'sobre hoy' : 'sobres hoy'}. ` : '')+'Racha: 1–2 días → 3 sobres y 20 monedas; 3–6 → 4 y 30; 7–13 → 5 y 40; 14–29 → 6 y 50; 30 o más → 7 y 60. Trofeos: bronce 2 · plata 3 · oro 5 · platino 8 sobres.';
        let shields=info.querySelector('[data-pack-shields]');
        if(!shields){shields=document.createElement('div');shields.className='pack-shields';shields.dataset.packShields='';info.append(shields);}
        shields.hidden=!Number.isSafeInteger(state.data?.streak_shields);
        if(!shields.hidden){const markup=shieldMarkup(state.data);if(shields.innerHTML!==markup)shields.innerHTML=markup;}
        let activities=info.querySelector('[data-pack-activities]');
        const enabled=state.data?.activity_reward_limit===3;
        if(enabled&&!activities){activities=document.createElement('p');activities.className='pack-rarity-odds';activities.dataset.packActivities='';info.append(activities);}
        if(activities){
          activities.hidden=!enabled;
          if(enabled){
            const earned=state.data.activity_rewards||{}, completed=['message','poll','event'].filter(key=>earned[key]===true).length;
            activities.textContent=`6 sobres extra cada día: +2 por tu primer mensaje en un grupo, +2 por votar en una encuesta y +2 por responder a un plan nuevo. Hoy: ${completed}/3 conseguidos. Se suman automáticamente; cambiar una respuesta no da otro sobre. El día se reinicia a las 00:00, hora de Madrid.`;
          }
        }
      }
    };
    ui=createStore({...options,onChange:render});
    render(ui.snapshot());
    document.addEventListener('click', async event => {
      const button = event.target.closest('[data-buy-shield]');
      if (!button || buyingShield || !options.buyShield) return;
      buyingShield = true; shieldNotice = ''; render(ui.snapshot());
      try {
        const {data, error} = await options.buyShield(Number(button.dataset.price));
        if (error) throw error;
        shieldNotice = `Protector comprado. Tienes ${data.shields}.`;
        globalThis.ClubCoinMissions?.activity?.({refreshWallet:true});
        void globalThis.BannerShop?.refresh?.(true);
        await ui.refresh(true);
      } catch (error) {
        shieldNotice = error?.message || 'No se pudo comprar. Vuelve a intentarlo.';
      } finally { buyingShield = false; render(ui.snapshot()); }
    });
  }
  function activityCompleted(kind) {
    const data=ui?.snapshot().data;
    if(!['message','poll','event'].includes(kind)||data?.activity_reward_limit!==3)return;
    if(data.activity_rewards?.[kind]===true&&Date.parse(data.next_reset_at)>Date.now())return;
    void ui.refresh(true);
  }
  globalThis.DailyPacks=Object.freeze({createStore,presentation,initialize,updateBalance,activityCompleted,snapshot:()=>ui?.snapshot(),refresh:(...args)=>ui?.refresh(...args),reset:()=>ui?.reset()});
})();
