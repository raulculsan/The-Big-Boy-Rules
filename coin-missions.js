/* Coin amounts and eligibility come only from authenticated reward RPCs. */
(() => {
 'use strict';
 const groups=[['daily','Con El Chota','Dos tareas al día en la sede.'],['weekly','Esta semana','Tres objetivos distintos, una recompensa.'],['level','Nuevos niveles','Una recompensa por cada nivel nuevo.'],['memory','Recuerdos de planes','Fotos de los planes a los que has asistido.'],['album','Tu álbum','Completa páginas y categorías.'],['club','Entre todos','El objetivo compartido del club.']];
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const integer=value=>Number.isSafeInteger(Math.floor(Number(value)))?Math.max(0,Math.floor(Number(value))):0;
 const number=value=>new Intl.NumberFormat('es-ES').format(integer(value));
 let config={},epoch=0,cache=null,inflight=null,filter='active',expanded=new Set(),claiming=new Set(),noticeTimer=0,toast=null;
 const actor=()=>config.getUser?.()?.id||null;
 const hosts=()=>[...document.querySelectorAll('[data-club-coin-missions]')].filter(n=>n.isConnected);
 const message=error=>['PGRST202','42883','42P01'].includes(error?.code)?'Las misiones de monedas se están preparando. Vuelve a intentarlo más tarde.':error?.message||'No pudimos consultar las monedas. Comprueba tu conexión e inténtalo de nuevo.';
 async function rpc(name,args={}){
  if(!actor())throw new Error('Inicia sesión para ver tus misiones.');
  const controller=new AbortController();let timer;
  try{
   const query=config.db.rpc(name,args);const call=query?.abortSignal?query.abortSignal(controller.signal):query;
   const result=await Promise.race([call,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('La conexión está tardando demasiado. Vuelve a intentarlo.'));},10000);})]);
   if(result.error)throw result.error;return result.data;
  }finally{clearTimeout(timer);}
 }
 function valid(data){return data&&Number.isFinite(Number(data.balance))&&Number(data.balance)>=0&&Array.isArray(data.missions);}
 function row(m){
  const claimed=m.claimed===true,complete=m.completed===true,current=integer(m.current),target=Math.max(1,integer(m.target)),pending=claiming.has(m.id);
  const hasReceipt=claimed&&m.earned_coins!==null&&m.earned_coins!==undefined,earned=hasReceipt?integer(m.earned_coins):integer(m.coins),baseline=hasReceipt&&earned===0;
  return `<article class="coin-mission-row${claimed?' is-claimed':''}"><div class="coin-mission-copy"><h5>${esc(m.title)}</h5><p>${esc(m.description)}</p>${Array.isArray(m.objectives)?`<ul class="coin-mission-objectives">${m.objectives.slice(0,6).map(o=>`<li><span>${esc(o.title)}</span><b>${o.completed?'Hecho':'Pendiente'}</b></li>`).join('')}</ul>`:''}${claimed?`<span class="coin-mission-state">${baseline?'Completado antes de las recompensas':'Recibida'}</span>`:`<div class="coin-mission-progress"><progress value="${Math.min(target,current)}" max="${target}" aria-label="${esc(m.title)}"></progress><span>${number(Math.min(target,current))} / ${number(target)}</span></div>`}</div><div class="coin-mission-reward"><strong>+${number(earned)}<small>monedas</small></strong>${claimed?'':complete?`<button type="button" data-coin-claim="${esc(m.id)}" ${pending?'disabled aria-busy="true"':''}>${pending?'Guardando…':'Recoger'}</button>`:m.action?`<button type="button" class="coin-mission-go" data-coin-action="${esc(m.action)}">${['football','skateboard','robot-vacuum'].includes(m.action)?'Jugar':m.action==='album'?'Ver álbum':'Ver planes'}</button>`:''}</div></article>`;
 }
 function render(host,error=''){
  const data=cache?.owner===actor()?cache.data:null;
  const opened=new Set([...host.querySelectorAll('details[open]')].map(n=>n.dataset.coinGroup));
  if(!data){host.innerHTML=`<div class="coin-missions-loading"><h3>Gana monedas</h3><p role="status">${esc(error||'Consultando tus misiones…')}</p>${error?'<button type="button" data-coin-retry>Reintentar</button>':''}</div>`;return;}
  const missions=data.missions.filter(m=>m&&typeof m.id==='string'&&groups.some(([key])=>key===m.category));
  const ready=missions.filter(m=>m.completed===true&&m.claimed!==true).reduce((sum,m)=>sum+integer(m.coins),0);
  const selected=missions.filter(m=>filter==='completed'?m.claimed===true:m.claimed!==true);
  host.innerHTML=`<header class="coin-missions-overview"><div><span>Tu saldo</span><h3>${number(data.balance)} <small>monedas</small></h3><p>${ready?`${number(ready)} monedas listas para recoger`:`${number(data.earned_total)} monedas ganadas con misiones`}</p></div><span class="coin-missions-mark" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20"/><circle cx="24" cy="24" r="15"/><path d="M18 17h8a5 5 0 0 1 0 10h-8V17Zm0 10h9a5 5 0 0 1 0 10h-9V27M22 13v4m0 20v4"/></svg></span></header><div class="coin-missions-toolbar"><h3>Gana monedas</h3><div class="coin-missions-filter" role="group" aria-label="Mostrar misiones"><button type="button" data-coin-filter="active" aria-pressed="${filter==='active'}">Activas</button><button type="button" data-coin-filter="completed" aria-pressed="${filter==='completed'}">Recibidas</button></div></div><p class="coin-missions-feedback" role="status" aria-live="polite">${esc(error)}</p><div class="coin-missions-groups">${groups.map(([key,title,description])=>{
   const rows=selected.filter(m=>m.category===key).sort((a,b)=>Number(b.completed)-Number(a.completed));
   if(!rows.length)return '';
   const shown=expanded.has(key)?rows:rows.slice(0,4),claimable=rows.filter(m=>m.completed&&!m.claimed).length;
   return `<details class="coin-mission-group" data-coin-group="${key}" ${opened.has(key)||(!host.dataset.coinRendered&&['daily','weekly'].includes(key))?'open':''}><summary><span><h4>${title}</h4><small>${claimable?`${claimable} ${claimable===1?'recompensa lista':'recompensas listas'}`:description}</small></span><span class="coin-mission-group-count">${rows.length}</span><span class="coin-mission-disclosure" aria-hidden="true">+</span></summary><div>${shown.map(row).join('')}${rows.length>4?`<button type="button" class="coin-missions-more" data-coin-more="${key}">${expanded.has(key)?'Mostrar menos':`Ver las ${rows.length} misiones`}</button>`:''}</div></details>`;
  }).join('')||`<p class="coin-missions-empty">${filter==='completed'?'Aquí aparecerán las recompensas que hayas recibido.':'Todo recogido. Vuelve mañana para las tareas de El Chota.'}</p>`}</div>`;
  host.dataset.coinRendered='true';
 }
 async function refresh(force=false){
  const nodes=hosts(),owner=actor(),version=epoch;if(!nodes.length||!owner)return;
  if(!force&&cache?.owner===owner&&Date.now()-cache.at<15000){nodes.forEach(n=>render(n));return;}
  if(inflight?.owner===owner)return inflight.promise;
  const request={owner,promise:null};inflight=request;
  request.promise=(async()=>{try{
   const data=await rpc('get_club_coin_missions');if(version!==epoch||owner!==actor())return;
   if(!valid(data))throw new Error('No se pudo comprobar el saldo de monedas. Vuelve a intentarlo.');
   cache={owner,data,at:Date.now()};hosts().forEach(n=>render(n));
  }catch(error){if(version===epoch&&owner===actor())hosts().forEach(n=>render(n,message(error)));}
  finally{if(inflight===request)inflight=null;}})();return request.promise;
 }
 async function claim(id){
  if(claiming.has(id)||!actor())return;
  const owner=actor(),version=epoch,mission=cache?.data?.missions.find(m=>m.id===id);
  if(!mission?.completed||mission.claimed)return;
  claiming.add(id);hosts().forEach(n=>render(n));
  try{
   const result=await rpc('claim_club_coin_reward',{reward_id:id});if(owner!==actor()||version!==epoch)return;
   mission.claimed=true;if(result?.awarded)mission.earned_coins=integer(result.coins);cache.at=0;
   if(Number.isFinite(Number(result?.balance)))cache.data.balance=Number(result.balance);
   if(result?.awarded){cache.data.earned_total=integer(cache.data.earned_total)+integer(result.coins);activity({coins:result.coins});}
   hosts().forEach(n=>render(n,result?.awarded?`+${number(result.coins)} monedas añadidas a tu saldo.`:'Esta recompensa ya estaba recogida.'));
  }catch(error){if(owner===actor()&&version===epoch)hosts().forEach(n=>render(n,message(error)));}
  finally{claiming.delete(id);if(owner===actor()&&version===epoch)hosts().forEach(n=>{n.querySelectorAll('[data-coin-claim]').forEach(b=>{b.disabled=claiming.has(b.dataset.coinClaim);b.removeAttribute('aria-busy');});});}
 }
 function activity({coins=0,refreshWallet=false}={}){
  if(!actor())return;if(cache)cache.at=0;
  if(integer(coins)>0||refreshWallet)void Promise.resolve(config.refreshWallet?.()).catch(()=>{});
  if(hosts().length)void refresh(true);
  if(integer(coins)<1)return;
  clearTimeout(noticeTimer);toast?.remove();toast=document.createElement('div');toast.className='club-coin-toast';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');toast.textContent=`+${number(coins)} monedas`;([ ...document.querySelectorAll('dialog[open]') ].at(-1)||document.body).append(toast);
  noticeTimer=setTimeout(()=>{toast?.remove();toast=null;},3200);
 }
 function mount(host){
  if(!host||!actor())return;host.dataset.clubCoinMissions='';host.classList.add('coin-missions');render(host);void refresh();
 }
 document.addEventListener('click',event=>{
  const host=event.target.closest('[data-club-coin-missions]');if(!host)return;
  const button=event.target.closest('button');if(!button)return;
  if(button.hasAttribute('data-coin-retry'))return void refresh(true);
  if(button.dataset.coinClaim)return void claim(button.dataset.coinClaim);
  if(button.dataset.coinFilter){filter=button.dataset.coinFilter;render(host);return;}
  if(button.dataset.coinMore){expanded.has(button.dataset.coinMore)?expanded.delete(button.dataset.coinMore):expanded.add(button.dataset.coinMore);render(host);return;}
  const action=button.dataset.coinAction;if(!action)return;
  host.closest('dialog')?.querySelector('[data-missions-close]')?.click();
  if(['football','skateboard','robot-vacuum'].includes(action))void globalThis.ChotaGames?.openGame?.(action);
  else if(action==='album')globalThis.CardAlbum?.open();
  else if(action==='calendar')config.navigate?.('calendario');
 });
 document.addEventListener('collection-social-change',()=>{if(cache)cache.at=0;if(hosts().length)void refresh(true);});
 globalThis.ClubCoinMissions=Object.freeze({init(options){config=options||{};},mount,refresh,activity,reset(){epoch++;cache=null;inflight=null;filter='active';expanded.clear();claiming.clear();clearTimeout(noticeTimer);toast?.remove();toast=null;hosts().forEach(n=>{n.innerHTML='';delete n.dataset.coinRendered;});}});
})();
