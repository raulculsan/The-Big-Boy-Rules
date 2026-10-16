/* Shared plans and group polls. All mutations are checked by Supabase RPCs. */
(() => {
  'use strict';
  let config = null, epoch = 0, composer = null, pollViewer = null, pollMount = null, subscription = null, refreshTimer = 0, planViewer = null, planSubscription = null;
  const attendance = new Map(), requests = new Map(), locks = new Set();
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const user = () => config?.getUser?.();
  const userId = () => user()?.id || null;
  const canWriteChannel = channelId => config?.canWriteChannel?.(channelId) !== false;
  const labels = {going:'Voy',maybe:'Quizá',declined:'No voy'};
  const icons = {going:'✓',maybe:'?',declined:'−'};
  function localDate(value) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
  }
  function occurrenceFor(event, value) {
    if (value) return localDate(value);
    const original = localDate(event.startsAt);
    if (!event.annual) return original;
    const today = localDate(new Date()), candidate = `${today.slice(0,4)}${original.slice(4)}`;
    return candidate >= today ? candidate : `${Number(today.slice(0,4))+1}${original.slice(4)}`;
  }
  async function query(builder) {
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),18000);
    try{return await builder.abortSignal(controller.signal);}finally{clearTimeout(timer);}
  }
  function message(error) {
    const text = String(error?.message || 'No se pudo guardar. Inténtalo de nuevo.');
    if(/abort|timeout|failed to fetch|load failed|network/i.test(text))return 'La conexión se ha interrumpido. Vuelve a intentarlo.';
    return /schema cache|does not exist|could not find|PGRST/i.test(text) ? 'Esta función aún no está disponible. Vuelve a intentarlo más tarde.' : text;
  }
  function attendanceMarkup(event, occurrenceDate, showPeople=false) {
    if (!event || event.eventType === 'birthday' || event.event_type === 'birthday') return '';
    const occurrence = occurrenceFor(event, occurrenceDate);
    if (!event?.id || !occurrence) return '';
    const key = `${event.id}:${occurrence}`;
    if (!attendance.has(key)) attendance.set(key,{eventId:event.id,occurrence,rows:null,fetchedAt:0,error:'',pending:false});
    return `<div class="plan-attendance" data-plan-attendance="${escape(key)}" ${showPeople?'data-attendance-people':''} aria-label="Asistencia al plan">${attendanceBody(attendance.get(key),showPeople)}</div>`;
  }
  function attendancePeople(state) {
    if (!state.rows) return '';
    return `<div class="plan-attendance-people">${Object.entries(labels).map(([response,label]) => {
      const rows=state.rows.filter(row=>row.response===response);
      return `<section><h3>${label}<span>${rows.length}</span></h3>${rows.length ? `<ul>${rows.map(row=>{
        const member=config?.getMember?.(row.user_id), name=member?.name || (row.user_id===userId()?'Tú':'Miembro del club');
        return `<li><span class="plan-person-initial" aria-hidden="true">${escape(name.charAt(0).toUpperCase())}</span><span>${escape(name)}</span>${row.user_id===userId()?'<small>Tú</small>':''}</li>`;
      }).join('')}</ul>` : '<p>Todavía nadie</p>'}</section>`;
    }).join('')}</div>`;
  }
  function attendanceBody(state, showPeople=false) {
    const own = state.rows?.find(row => row.user_id === userId())?.response;
    const counts = Object.fromEntries(Object.keys(labels).map(key => [key,state.rows?.filter(row => row.response===key).length || 0]));
    const past = state.occurrence < localDate(new Date());
    return `<div class="plan-attendance-heading"><span>¿Te apuntas?</span><small>${state.rows ? `${counts.going} ${counts.going===1?'confirmado':'confirmados'}` : 'Cargando…'}</small></div><div class="plan-attendance-options">${Object.keys(labels).map(key => `<button type="button" data-attendance-response="${key}" aria-pressed="${own===key}" ${!userId() || state.pending || !state.rows || past ? 'disabled' : ''}><span class="plan-attendance-symbol" aria-hidden="true">${icons[key]}</span><span>${labels[key]}</span><b>${counts[key]}</b></button>`).join('')}</div>${past ? '<small class="plan-attendance-note">Respuestas cerradas</small>' : ''}<p class="group-interaction-status" role="status" ${!state.error?'hidden':''}>${escape(state.error)}${state.error && !state.rows ? ' <button type="button" data-attendance-retry>Reintentar</button>' : ''}</p>${showPeople?attendancePeople(state):''}`;
  }
  function renderAttendance(key) {
    const state = attendance.get(key);
    if (!state) return;
    document.querySelectorAll('[data-plan-attendance]').forEach(node => {
      if(node.dataset.planAttendance!==key)return;
      const focused=node.contains(document.activeElement)?document.activeElement.dataset.attendanceResponse:null;
      const scroll=planViewer?.scrollTop;
      node.innerHTML=attendanceBody(state,node.hasAttribute('data-attendance-people'));
      if(focused){const button=node.querySelector(`[data-attendance-response="${focused}"]`);if(button&&!button.disabled)button.focus({preventScroll:true});}
      if(planViewer&&scroll!=null)planViewer.scrollTop=scroll;
    });
  }
  async function hydrateAttendance(root=document) {
    if (!config?.db || !userId()) return;
    const mounts=[...(root.matches?.('[data-plan-attendance]')?[root]:[]),...root.querySelectorAll('[data-plan-attendance]')];
    const pending = [...new Set(mounts.map(node=>node.dataset.planAttendance))].filter(key => attendance.has(key) && (!attendance.get(key).fetchedAt || Date.now()-attendance.get(key).fetchedAt>30000) && !attendance.get(key).pending && !requests.has(key));
    if (!pending.length) return;
    const version=epoch;
    const request=(async()=>{
      const {data,error}=await query(config.db.from('event_attendance').select('event_id,occurrence,user_id,response').in('event_id',[...new Set(pending.map(key=>attendance.get(key).eventId))]));
      if(version!==epoch)return;
      for(const key of pending){
        const state=attendance.get(key); if(!state)continue;
        state.rows=error?null:(data||[]).filter(row=>String(row.event_id)===String(state.eventId)&&row.occurrence===state.occurrence);
        state.fetchedAt=error?0:Date.now();state.error=error?message(error):'';renderAttendance(key);
      }
    })().catch(error=>{if(version!==epoch)return;for(const key of pending){const state=attendance.get(key);if(state){state.error=message(error);renderAttendance(key);}}}).finally(()=>{if(version===epoch)pending.forEach(key=>requests.delete(key));});
    pending.forEach(key=>requests.set(key,request));
    return request;
  }
  async function respond(node,response) {
    const key=node.dataset.planAttendance, state=attendance.get(key);
    if(!state||state.pending||!userId()||!labels[response])return;
    state.pending=true;state.error='';renderAttendance(key);
    const version=epoch, id=userId();
    try{
      const {error}=await query(config.db.rpc('respond_to_event',{p_event_id:state.eventId,p_occurrence:state.occurrence,p_response:response}));
      if(error)throw error;if(version!==epoch)return;
      state.fetchedAt=Date.now();state.rows=[...(state.rows||[]).filter(row=>row.user_id!==id),{user_id:id,response,event_id:state.eventId,occurrence:state.occurrence}];
    }catch(error){if(version===epoch)state.error=message(error);}finally{if(version===epoch){state.pending=false;renderAttendance(key);}}
  }
  function dismissPlan() {
    if(planSubscription){void config?.db?.removeChannel(planSubscription);planSubscription=null;}
    const dialog=planViewer;planViewer=null;
    if(dialog){dialog.close();dialog.remove();}
  }
  function planDetailMarkup(event) {
    const date=new Date(event.startsAt);
    const schedule=date.toLocaleString('es-ES',{timeZone:'Europe/Madrid',weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});
    return `<p class="plan-detail-date">${escape(schedule)}</p><h2 id="chatPlanTitle">${escape(event.title)}</h2>${event.location?`<p class="plan-detail-location">${escape(event.location)}</p>`:''}${event.description?`<p class="plan-detail-description">${escape(event.description)}</p>`:''}${attendanceMarkup(event,localDate(date),true)}`;
  }
  function openPlan(event) {
    if(!event?.id || !userId())return;
    dismissPlan();
    const dialog=document.createElement('dialog');dialog.className='plan-detail-viewer';
    dialog.dataset.eventId=String(event.id);dialog.dataset.channelId=String(config?.getChannelId?.()??'');
    dialog.setAttribute('aria-labelledby','chatPlanTitle');
    dialog.innerHTML='<button type="button" class="plan-detail-close" aria-label="Cerrar plan" autofocus>×</button><div class="plan-detail-content"></div>';
    dialog.querySelector('.plan-detail-content').innerHTML=planDetailMarkup(event);
    planViewer=dialog;document.body.append(dialog);
    dialog.querySelector('.plan-detail-close').addEventListener('click',dismissPlan);
    dialog.addEventListener('cancel',event=>{event.preventDefault();dismissPlan();});
    dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const bounds=dialog.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dismissPlan();});
    dialog.showModal();
    const key=dialog.querySelector('[data-plan-attendance]')?.dataset.planAttendance;
    if(key&&attendance.has(key))attendance.get(key).fetchedAt=0;
    void hydrateAttendance(dialog);
    if(config.db?.channel)planSubscription=config.db.channel(`plan-attendance-${event.id}-${epoch}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'event_attendance',filter:`event_id=eq.${event.id}`},()=>{
        if(planViewer!==dialog||!key)return;
        const state=attendance.get(key);if(state)state.fetchedAt=0;
        const inflight=requests.get(key);
        if(inflight)void inflight.finally(()=>{if(planViewer===dialog){if(state)state.fetchedAt=0;void hydrateAttendance(dialog);}});
        else void hydrateAttendance(dialog);
      }).subscribe();
  }
  function refreshPlan(events) {
    if(!planViewer)return;
    const event=events.find(event=>String(event.id)===planViewer.dataset.eventId);
    if(!event || String(config?.getChannelId?.()??'')!==planViewer.dataset.channelId){dismissPlan();return;}
    const content=planViewer.querySelector('.plan-detail-content');
    content.innerHTML=planDetailMarkup(event);void hydrateAttendance(planViewer);
  }
  function pollBody(poll) {
    const votes=poll.group_poll_votes||[], total=votes.length, own=votes.find(vote=>vote.user_id===userId())?.option_id;
    const closed=Boolean(poll.closed_at), pending=locks.has(poll.id);
    const writable=canWriteChannel(poll.channel_id), canClose=writable&&(poll.created_by===userId()||user()?.isAdmin);
    const options=[...(poll.group_poll_options||[])].sort((a,b)=>a.position-b.position);
    return `<article class="group-poll-card" data-poll-id="${escape(poll.id)}"><header><span class="group-poll-eyebrow"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 15V9m7 6V3m7 12v-5"/></svg>Encuesta</span><span class="group-poll-state">${closed?'Cerrada':writable?'Abierta':'Solo lectura'}</span></header><h3>${escape(poll.question)}</h3><div class="group-poll-options">${options.map(option=>{
      const count=votes.filter(vote=>vote.option_id===option.id).length, percentage=total?Math.round(count/total*100):0, selected=own===option.id;
      return `<button type="button" class="group-poll-option ${selected?'is-chosen':''}" data-poll-vote="${escape(option.id)}" aria-pressed="${selected}" ${closed||pending||!userId()||!writable?'disabled':''}><span class="group-poll-fill" style="--poll-share:${percentage}%" aria-hidden="true"></span><span class="group-poll-option-label"><i aria-hidden="true">${selected?'✓':''}</i>${escape(option.label)}</span><b>${percentage}<small>%</small></b><span class="sr-only"> · ${count} ${count===1?'voto':'votos'}</span></button>`;
    }).join('')}</div><footer><span>${total} ${total===1?'voto':'votos'}${own?' · Has votado':''}</span>${!closed&&canClose?`<button type="button" data-poll-close ${pending?'disabled':''}>Cerrar encuesta</button>`:''}</footer></article>`;
  }
  function dismissPollViewer() {
    if (pollViewer?.open) pollViewer.close();
  }
  function openPollViewer() {
    if (!pollMount?.polls?.some(poll=>!poll.closed_at) || pollViewer?.open) return;
    const dialog=document.createElement('dialog');
    dialog.className='group-poll-viewer';
    dialog.setAttribute('aria-label','Encuestas activas');
    dialog.innerHTML='<header class="group-poll-viewer-heading"><h2>Encuestas activas</h2><button type="button" data-poll-viewer-dismiss aria-label="Cerrar encuestas" autofocus>✕</button></header><div class="group-poll-viewer-content"></div>';
    pollViewer=dialog;
    document.body.append(dialog);
    dialog.querySelector('[data-poll-viewer-dismiss]').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{if(event.target===dialog){const bounds=dialog.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.close();}});
    dialog.addEventListener('close',()=>{dialog.remove();if(pollViewer===dialog)pollViewer=null;},{once:true});
    renderPolls();
    dialog.showModal();
  }
  function renderPolls() {
    const mount=pollMount;if(!mount?.node.isConnected)return;
    const active=(mount.polls||[]).filter(poll=>!poll.closed_at);
    // Keep this small notice stable during votes and realtime refreshes.
    let notice=mount.node.querySelector('[data-poll-open]');
    if(active.length){
      if(!notice){notice=document.createElement('button');notice.type='button';notice.className='group-poll-notice';notice.setAttribute('data-poll-open','');notice.setAttribute('aria-haspopup','dialog');mount.node.replaceChildren(notice);}
      notice.textContent=active.length===1?'Hay una encuesta activa':`Hay ${active.length} encuestas activas`;
      notice.setAttribute('aria-label',`${notice.textContent}. ${canWriteChannel(mount.channelId)?"Ver y votar":"Ver resultados"}`);
    }else mount.node.replaceChildren();
    const content=pollViewer?.querySelector('.group-poll-viewer-content');
    if(!content)return;
    const scroll=content.scrollTop;
    const focused=content.contains(document.activeElement)?document.activeElement:null;
    const optionId=focused?.dataset.pollVote, closeId=focused?.hasAttribute('data-poll-close')?focused.closest('[data-poll-id]')?.dataset.pollId:null;
    content.innerHTML=active.map(pollBody).join('')||'<p class="group-poll-empty" role="status">No quedan encuestas activas.</p>';
    if(mount.error){const status=document.createElement('p');status.className='group-interaction-status';status.setAttribute('role','status');status.textContent=mount.error;content.append(status);}
    content.scrollTop=scroll;
    if(focused){const replacement=[...content.querySelectorAll('button')].find(button=>optionId?button.dataset.pollVote===optionId:closeId&&button.hasAttribute('data-poll-close')&&button.closest('[data-poll-id]')?.dataset.pollId===closeId);(replacement&&!replacement.disabled?replacement:pollViewer.querySelector('[data-poll-viewer-dismiss]')).focus({preventScroll:true});}
  }
  async function refreshPolls() {
    const mount=pollMount;if(!mount||!userId())return;if(mount.loading){mount.refreshAgain=true;return;}
    mount.loading=true;mount.error='';renderPolls();
    try{
      const {data,error}=await query(config.db.from('group_polls').select('id,channel_id,created_by,question,created_at,closed_at,group_poll_options(id,label,position),group_poll_votes(user_id,option_id)').eq('channel_id',mount.channelId).is('closed_at',null).order('created_at',{ascending:false}));
      if(error)throw error;if(pollMount!==mount)return;
      mount.polls=data||[];
    }catch(error){if(pollMount===mount)mount.error=message(error);}finally{if(pollMount===mount){mount.loading=false;renderPolls();if(mount.refreshAgain){mount.refreshAgain=false;queueRefresh();}}}
  }
  function queueRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>void refreshPolls(),250);}
  function clearSubscription(){if(subscription){void config?.db?.removeChannel(subscription);subscription=null;}clearTimeout(refreshTimer);}
  function mountPolls(container,channelId) {
    const node=typeof container==='string'?document.querySelector(container):container;
    if(!node||!config?.db)return;
    if(pollMount?.node===node&&String(pollMount.channelId)===String(channelId)){renderPolls();return;}
    if(planViewer&&planViewer.dataset.channelId!==String(channelId))dismissPlan();
    dismissPollViewer();clearSubscription();pollMount={node,channelId,polls:null,loading:false,error:''};renderPolls();void refreshPolls();
    if(userId()&&config.db.channel)subscription=config.db.channel(`group-polls-${channelId}-${epoch}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'group_polls',filter:`channel_id=eq.${channelId}`},queueRefresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'group_poll_votes'},queueRefresh).subscribe();
  }
  async function vote(pollId,optionId) {
    const mount=pollMount;if(!mount||locks.has(pollId)||!userId()||!canWriteChannel(mount.channelId))return;
    locks.add(pollId);mount.error='';renderPolls();
    let succeeded=false;
    try{
      const {error}=await query(config.db.rpc('vote_group_poll',{p_poll_id:pollId,p_channel_id:mount.channelId,p_option_id:optionId}));if(error)throw error;succeeded=true;
    }catch(error){if(pollMount===mount)mount.error=message(error);}finally{locks.delete(pollId);if(pollMount===mount){renderPolls();if(succeeded)void refreshPolls();}}
  }
  async function closePoll(pollId) {
    const mount=pollMount;if(!mount||locks.has(pollId)||!canWriteChannel(mount.channelId))return;
    locks.add(pollId);mount.error='';renderPolls();
    let succeeded=false;
    try{const {error}=await query(config.db.rpc('close_group_poll',{p_poll_id:pollId,p_channel_id:mount.channelId}));if(error)throw error;succeeded=true;}
    catch(error){if(pollMount===mount)mount.error=message(error);}finally{locks.delete(pollId);if(pollMount===mount){renderPolls();if(succeeded)void refreshPolls();}}
  }
  function openPollComposer(channelId=config?.getChannelId?.()) {
    if(!userId()||!channelId||composer?.open||!canWriteChannel(channelId))return;
    composer=document.createElement('dialog');composer.className='group-poll-composer';composer.setAttribute('aria-label','Crear encuesta');
    composer.innerHTML=`<form class="group-poll-create-form"><header><span class="group-poll-eyebrow">EN GRUPO</span><button type="button" data-poll-dismiss aria-label="Cerrar">✕</button></header><h2>¿Qué decidimos?</h2><p>Una pregunta clara. Hasta seis opciones.</p><label class="group-poll-question-label">Pregunta<textarea name="question" autofocus maxlength="180" rows="2" placeholder="¿Dónde quedamos el viernes?" required></textarea></label><div class="group-poll-edit-options"></div><button type="button" class="group-poll-add-option" data-poll-add>＋ Añadir opción</button><div class="group-interaction-status" role="status" hidden></div><button type="submit" class="group-poll-publish">Publicar encuesta</button><small class="group-poll-create-note">Un voto por persona. Se puede cambiar mientras esté abierta.</small></form>`;
    document.body.append(composer);
    const form=composer.querySelector('form'), options=form.querySelector('.group-poll-edit-options');
    function addOption(){if(options.children.length>=6)return;const row=document.createElement('label');row.className='group-poll-edit-option';row.innerHTML=`<span aria-hidden="true">${String(options.children.length+1).padStart(2,'0')}</span><input name="option" aria-label="Opción" maxlength="80" placeholder="Escribe una opción" required><button type="button" aria-label="Quitar opción">×</button>`;options.append(row);row.querySelector('button').addEventListener('click',()=>{if(options.children.length<=2)return;row.remove();updateOptions();});updateOptions();}
    function updateOptions(){[...options.children].forEach((row,index)=>{row.querySelector('span').textContent=String(index+1).padStart(2,'0');row.querySelector('input').setAttribute('aria-label',`Opción ${index+1}`);row.querySelector('button').disabled=options.children.length<=2;});form.querySelector('[data-poll-add]').hidden=options.children.length>=6;}
    addOption();addOption();
    form.querySelector('[data-poll-add]').addEventListener('click',()=>{addOption();options.lastElementChild.querySelector('input').focus({preventScroll:true});});
    const dialog=composer;let pending=false,requestId=crypto.randomUUID(),fingerprint='';
    const dismiss=()=>{if(!pending)dialog.close();};form.querySelector('[data-poll-dismiss]').addEventListener('click',dismiss);
    dialog.addEventListener('cancel',event=>{if(pending)event.preventDefault();});
    dialog.addEventListener('close',()=>{dialog.remove();if(composer===dialog)composer=null;},{once:true});
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(pending)return;
      if(!canWriteChannel(channelId)){dialog.close();return;}
      const question=form.elements.question.value.trim(), values=[...form.querySelectorAll('[name="option"]')].map(input=>input.value.trim());
      const status=form.querySelector('.group-interaction-status'),publish=form.querySelector('[type="submit"]');
      status.hidden=true;
      if(new Set(values.map(value=>value.toLocaleLowerCase('es'))).size!==values.length){status.textContent='Escribe opciones diferentes.';status.hidden=false;return;}
      const nextFingerprint=JSON.stringify([question,values]);if(fingerprint&&fingerprint!==nextFingerprint)requestId=crypto.randomUUID();fingerprint=nextFingerprint;
      pending=true;publish.disabled=true;publish.textContent='Publicando…';
      try{
        const {error}=await query(config.db.rpc('create_group_poll',{p_channel_id:channelId,p_question:question,p_options:values,p_request_id:requestId}));if(error)throw error;
        pending=false;dialog.close();if(String(pollMount?.channelId)===String(channelId)){void refreshPolls();}
      }catch(error){status.textContent=message(error);status.hidden=false;}finally{pending=false;publish.disabled=false;publish.textContent='Publicar encuesta';}
    });
    // Keep focus in the editor in the opening user gesture. Letting showModal
    // focus the close button first dismisses an already open iOS keyboard, then
    // tapping a field starts a competing keyboard presentation/layout transition.
    dialog.showModal();
    form.elements.question.focus({preventScroll:true});
    dialog.addEventListener('pointerdown',event=>{
      const field=event.target.closest?.('input,textarea');
      if(field&&event.pointerType!=='mouse'&&document.activeElement!==field){
        field.focus({preventScroll:true});
      }
    },{passive:true});
  }
  document.addEventListener('click',event=>{
    const target=event.target.closest?.('button');if(!target)return;
    const attendanceNode=target.closest('[data-plan-attendance]');
    if(attendanceNode&&target.dataset.attendanceResponse){void respond(attendanceNode,target.dataset.attendanceResponse);return;}
    if(attendanceNode&&target.hasAttribute('data-attendance-retry')){void hydrateAttendance(attendanceNode);return;}
    if(!pollMount||(!pollMount.node.contains(target)&&!pollViewer?.contains(target)))return;
    if(target.hasAttribute('data-poll-open'))openPollViewer();
    else if(target.hasAttribute('data-poll-refresh'))void refreshPolls();
    else if(target.hasAttribute('data-poll-vote'))void vote(target.closest('[data-poll-id]').dataset.pollId,target.dataset.pollVote);
    else if(target.hasAttribute('data-poll-close'))void closePoll(target.closest('[data-poll-id]').dataset.pollId);
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(pollMount?.node.isConnected)void refreshPolls();for(const state of attendance.values())state.fetchedAt=0;void hydrateAttendance();}});
  function reset(){epoch++;dismissPlan();dismissPollViewer();clearSubscription();pollMount?.node.replaceChildren();pollMount=null;attendance.clear();requests.clear();locks.clear();composer?.close();}
  globalThis.GroupInteractions=Object.freeze({init(options){reset();config=options;},reset,openPlan,refreshPlan,attendanceMarkup,hydrateAttendance,mountPolls,openPollComposer,refreshPolls});
})();
