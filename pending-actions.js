/* A private, current view of decisions still waiting for this account. */
(() => {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let config, owner = null, generation = 0, controller, loading = false, loaded = false, errors = [], items = [], busy = false, refreshedAt = 0;
  const dialog = document.createElement('dialog');
  dialog.className = 'pending-actions-dialog'; dialog.setAttribute('aria-labelledby','pendingActionsTitle');
  dialog.innerHTML = '<header class="pending-heading"><div><span class="eyebrow">POR RESOLVER</span><h2 id="pendingActionsTitle">Pendientes</h2></div><button type="button" data-pending-close aria-label="Cerrar pendientes">×</button></header><div class="pending-overview"></div><div class="pending-status" role="status" aria-live="polite"></div><div class="pending-content"></div><footer><button type="button" data-pending-refresh>Actualizar</button><small>Solo aparecen decisiones de tu cuenta.</small></footer>';
  document.body.append(dialog);
  const session = () => config?.session?.();
  const dateKey = date => new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
  const schedule = date => date.toLocaleString('es-ES',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  const online = () => navigator.onLine !== false;
  function reset() {
    generation++; controller?.abort(); controller=null; owner=null; loading=loaded=busy=false; items=[]; errors=[]; refreshedAt=0; dialog.close(); render();
  }
  async function run(builder, signal) {
    const result = await builder.abortSignal(signal);
    if (result.error) throw result.error;
    return result.data || [];
  }
  function render() {
    const categories = [{key:'trade',label:'Intercambios',symbol:'<svg viewBox="0 0 24 24"><rect x="3" y="7" width="12" height="14" rx="2"/><path d="M9 7V3h12v14h-6"/></svg>'},{key:'poll',label:'Encuestas',symbol:'<svg viewBox="0 0 24 24"><path d="M4 20V12m8 8V4m8 16V8"/></svg>'},{key:'plan',label:'Planes',symbol:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 5h2"/></svg>'}];
    dialog.querySelector('.pending-overview').innerHTML = categories.map(type=>`<div><span>${type.symbol}</span><strong>${loaded ? items.filter(item=>item.kind===type.key).length : '—'}</strong><small>${type.label}</small></div>`).join('');
    const status=dialog.querySelector('.pending-status');
    status.textContent = !session() ? 'Inicia sesión para consultar tus pendientes.' : !online() ? 'Sin conexión. Conéctate para consultar y resolver tus pendientes.' : loading ? 'Consultando tus decisiones pendientes…' : errors.length ? `No se pudo actualizar: ${errors.join(', ')}. Puedes reintentarlo.` : busy ? 'Guardando tu respuesta…' : '';
    status.hidden=!status.textContent;
    dialog.querySelector('[data-pending-refresh]').disabled=loading||busy||!online()||!session();
    document.querySelectorAll('[data-pending-count]').forEach(node=>{node.textContent=String(items.length);node.hidden=!loaded||!items.length;});
    const content=dialog.querySelector('.pending-content');
    if (!loaded) { content.innerHTML=loading?'<div class="pending-skeleton" aria-hidden="true"></div><div class="pending-skeleton" aria-hidden="true"></div>':''; return; }
    content.innerHTML = categories.map(type=>{
      const rows=items.filter(item=>item.kind===type.key);
      if(!rows.length)return '';
      return `<section class="pending-group"><h3>${type.label}<span>${rows.length}</span></h3>${rows.map(item=>`<article class="pending-card" data-pending-item="${escape(item.key)}"><div class="pending-card-symbol" aria-hidden="true">${type.symbol}</div><div class="pending-card-copy"><small>${escape(item.subtitle)}</small><h4>${escape(item.title)}</h4>${item.deadline?`<p class="pending-deadline">${escape(item.deadline)}</p>`:''}${item.kind==='poll'?`<div class="pending-poll-options">${item.options.map(option=>`<button type="button" data-pending-vote="${escape(option.id)}" ${busy||!online()?'disabled':''}>${escape(option.label)}</button>`).join('')}</div>`:`<button type="button" data-pending-open ${busy||!online()?'disabled':''}>${item.kind==='trade'?'Revisar intercambio':'Indicar asistencia'}</button>`}</div></article>`).join('')}</section>`;
    }).join('') || (!errors.length?'<div class="pending-empty"><span aria-hidden="true">✓</span><h3>Todo resuelto</h3><p>Has respondido a tus invitaciones, encuestas y planes.</p></div>':'');
  }
  async function refresh() {
    const account=session(); if(!account||!online()||loading)return render();
    if(owner!==account){reset();owner=account;}
    const token=++generation;controller?.abort();controller=new AbortController();const signal=controller.signal, requestController=controller;
    const timeout=setTimeout(()=>requestController.abort(),12000);
    loading=true;errors=[];render();
    const db=config.db;
    const tasks = [
      ['intercambios',async()=>{
        const trades=await run(db.rpc('get_card_trade_updates'),signal);
        return trades.filter(t=>new Date(t.expires_at)>new Date()&&((t.recipient_id===account&&['invited','selecting'].includes(t.status))||(t.sender_id===account&&t.status==='review'))).map(t=>({key:`trade:${t.id}`,kind:'trade',id:t.id,title:t.recipient_id===account?t.sender_name:t.recipient_name,deadline:`Hasta ${schedule(new Date(t.expires_at))}`,subtitle:t.status==='invited'?'Te ha invitado a intercambiar':t.status==='selecting'?'Elige tu carta para continuar':'Propuesta lista para tu confirmación'}));
      }],
      ['encuestas',async()=>{
        const polls=await run(db.from('group_polls').select('id,channel_id,question,group_poll_options(id,label,position),group_poll_votes(user_id)').is('closed_at',null).order('created_at',{ascending:false}),signal);
        return polls.filter(p=>!(p.group_poll_votes||[]).some(v=>v.user_id===account)&&config.canVote(p.channel_id)).map(p=>({key:`poll:${p.id}`,kind:'poll',id:p.id,channelId:p.channel_id,title:p.question,subtitle:'Encuesta abierta · Falta tu voto',options:[...(p.group_poll_options||[])].sort((a,b)=>a.position-b.position)}));
      }],
      ['planes',async()=>{
        const rows=await run(db.from('group_events').select('id,title,description,starts_at,ends_at,location,event_type,annual'),signal);
        const events=rows.map(e=>({id:e.id,title:e.title,description:e.description,startsAt:e.starts_at,endsAt:e.ends_at,location:e.location,eventType:e.event_type||'event',annual:!!e.annual}));
        const upcoming=globalThis.ClubModel.upcomingEvents(events,new Date(),100).filter(item=>item.event.eventType!=='birthday');
        if(!upcoming.length)return [];
        const responses=await run(db.from('event_attendance').select('event_id,occurrence').eq('user_id',account).in('event_id',upcoming.map(item=>item.event.id)),signal);
        return upcoming.filter(item=>!responses.some(r=>String(r.event_id)===String(item.event.id)&&r.occurrence===dateKey(item.date))).map(item=>({key:`plan:${item.event.id}`,kind:'plan',id:item.event.id,event:{...item.event,startsAt:item.date.toISOString()},title:item.event.title,subtitle:`${schedule(item.date)}${item.event.location?' · '+item.event.location:''}`}));
      }]
    ];
    const results=await Promise.allSettled(tasks.map(([,task])=>task()));clearTimeout(timeout);
    if(token!==generation||account!==session())return;
    items=[];results.forEach((result,index)=>{if(result.status==='fulfilled')items.push(...result.value);else errors.push(tasks[index][0]);});
    loading=false;loaded=true;refreshedAt=Date.now();render();
  }
  function open() {
    if(owner!==session()){reset();owner=session();}
    config?.closeNotifications?.();if(!dialog.open)dialog.showModal();render();void refresh();
  }
  dialog.addEventListener('click',async event=>{
    if(event.target.closest('[data-pending-close]'))return dialog.close();
    if(event.target.closest('[data-pending-refresh]'))return void refresh();
    const row=event.target.closest('[data-pending-item]');if(!row||busy||!online())return;
    const item=items.find(item=>item.key===row.dataset.pendingItem);if(!item)return;
    if(event.target.closest('[data-pending-open]')){dialog.close();if(item.kind==='trade')globalThis.CollectionSocial?.openTrade(item.id);else globalThis.GroupInteractions?.openPlan(item.event);return;}
    const vote=event.target.closest('[data-pending-vote]');if(!vote)return;
    busy=true;const account=session(),token=generation, voteController=new AbortController(), voteTimeout=setTimeout(()=>voteController.abort(),12000);render();
    try{const response=await config.db.rpc('vote_group_poll',{p_poll_id:item.id,p_channel_id:item.channelId,p_option_id:vote.dataset.pendingVote}).abortSignal(voteController.signal);if(response.error)throw response.error;if(account!==session()||token!==generation)return;items=items.filter(row=>row.key!==item.key);document.dispatchEvent(new CustomEvent('bb:pending-resolved'));}
    catch{if(account===session()&&token===generation)errors=['tu voto. No se ha confirmado'];}
    finally{clearTimeout(voteTimeout);if(account===session()&&token===generation){busy=false;render();}}
  });
  document.addEventListener('click',event=>{if(event.target.closest('[data-pending-actions]'))open();});
  window.addEventListener('offline',render);
  window.addEventListener('online',()=>{if(dialog.open)void refresh();});
  document.addEventListener('collection-social-change',()=>{if(dialog.open&&!loading&&!busy&&Date.now()-refreshedAt>1000)void refresh();});
  document.addEventListener('close',event=>{if(dialog.open&&event.target!==dialog&&!loading&&!busy)void refresh();},true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&dialog.open)void refresh();});
  globalThis.PendingActions=Object.freeze({configure(options){config=options;},open,refresh,reset});
})();
