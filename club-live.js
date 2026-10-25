/* Club plans: shared arrivals, quick decisions, predictions and a private memory atlas. */
(() => {
 'use strict';
 let passportListScroll=0;
 let cfg, dialog, state, pending=false, refreshTimer=0, generation=0, aborter, roomCache=null, roomRequest=null, passportCache=null, passportRequest=null, passportEpoch=0;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const uid=()=>cfg?.getUser?.()?.id;
 const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid'}).format(new Date());
 const dateOf=e=>{const d=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid'}).format(new Date(e.startsAt||e.starts_at));if(!e.annual)return d;const candidate=today().slice(0,4)+d.slice(4);return candidate>=today()?candidate:String(Number(today().slice(0,4))+1)+d.slice(4);};
 const startFor=(e,occurrence)=>{const base=new Date(e.startsAt||e.starts_at);if(!e.annual)return base;const d=new Date(base);d.setFullYear(Number(occurrence.slice(0,4)));return d;};
 const name=id=>cfg?.getMember?.(id)?.name||cfg?.getMember?.(id)?.display_name||(id===uid()?'Tú':'Miembro');
 const events=()=>cfg?.getEvents?.()||[];
 const allowed=e=>e.createdBy===uid()||e.created_by===uid()||cfg?.canManage?.();
 const stamp=e=>new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Madrid'}).format(new Date(e.startsAt||e.starts_at));
 const safeUrl=v=>{try{const u=new URL(v,location.href);return u.protocol==='https:'||u.origin===location.origin?u.href:'';}catch{return '';}};
 async function query(q){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const r=await q.abortSignal(controller.signal);if(r.error)throw r.error;return r.data||[];}finally{clearTimeout(timer);}}
 function shell(title){
  close(); const previous=document.activeElement;
  dialog=document.createElement('dialog');dialog.className='club-live-dialog';dialog.setAttribute('aria-label',title);
  dialog.innerHTML=`<div class="club-live-shell"><header><h2>${esc(title)}</h2><button type="button" data-cl-close aria-label="Cerrar">Cerrar</button></header><div class="club-live-body"><p role="status">Cargando el plan…</p></div></div>`;
  document.body.append(dialog);dialog.addEventListener('close',()=>{close();previous?.focus?.({preventScroll:true});},{once:true});
  dialog.showModal();return dialog;
 }
 function close(){generation++;clearTimeout(refreshTimer);aborter?.abort();aborter=null;const hadDialog=!!dialog;if(dialog){const old=dialog;dialog=null;old.remove();}state=null;pending=false;if(hadDialog&&uid())document.querySelectorAll('.clubhouse-room, .chota-viewer-room-scene').forEach(room=>void mountRoomDetails(room));}
 function status(text){let n=dialog?.querySelector('.club-live-feedback');if(!n){n=document.createElement('p');n.className='club-live-feedback';n.setAttribute('role','status');dialog?.querySelector('.club-live-body')?.prepend(n);}if(n)n.textContent=text;}
 function friendly(e){return /does not exist|schema cache|PGRST/.test(e?.message||'')?'Estamos preparando esta función. Vuelve a intentarlo más tarde.':/abort|network|fetch/i.test(e?.message||'')?'La conexión se ha interrumpido. Vuelve a intentarlo.':e?.message||'No se pudo guardar. Inténtalo de nuevo.';}
 async function mutate(action){if(pending||!state)return;pending=true;dialog?.setAttribute('aria-busy','true');dialog?.querySelectorAll('button[type=submit]').forEach(n=>n.disabled=true);try{await action();invalidatePassport();await load();}catch(e){status(friendly(e));}finally{pending=false;dialog?.removeAttribute('aria-busy');dialog?.querySelectorAll('button[type=submit]').forEach(n=>n.disabled=false);}}
 function question(q){
  const votes=state.votes.filter(v=>v.question_id===q.id), own=votes.find(v=>v.user_id===uid()), closed=!!q.closed_at;
  const ended=q.kind==='prediction'&&startFor(state.event,state.occurrence)<=new Date();
  return `<article class="club-live-question"><h4>${esc(q.question)}</h4><div class="club-live-choices">${q.options.map((o,i)=>{const n=votes.filter(v=>v.option_index===i).length;return `<button type="button" data-cl-vote="${q.id}" data-option="${i}" aria-pressed="${own?.option_index===i}" ${closed||ended?'disabled':''}><span>${esc(o)}</span><span>${n}${q.result_index===i?' · Resultado':''}</span><i style="--vote:${votes.length?n/votes.length*100:0}%"></i></button>`;}).join('')}</div><small>${closed?'Cerrada':ended?'Predicciones cerradas':`${votes.length} ${votes.length===1?'voto':'votos'}`}</small>${!closed&&(q.created_by===uid()||cfg.canManage?.())?`<form data-cl-reveal="${q.id}">${q.kind==='prediction'?`<label>Resultado<select name="result" required>${q.options.map((o,i)=>`<option value="${i}">${esc(o)}</option>`).join('')}</select></label>`:''}<button type="submit">${q.kind==='prediction'?'Revelar resultado':'Cerrar votación'}</button></form>`:''}</article>`;
 }
 function memoryMedia(m, room=false){
  const url=safeUrl(m.signed_url||m.legacy_url||m.moments?.media_url),type=m.media_type||m.moments?.media_type;
  if(!url)return '';
  return type==='video'?`<video src="${esc(url)}" ${room?'muted':'controls'} playsinline preload="metadata" aria-label="Vídeo del plan"></video>`:`<img src="${esc(url)}" loading="lazy" decoding="async" alt="${esc(m.caption||m.moments?.caption||'Recuerdo del plan')}">`;
 }
 async function signMemories(rows){
  const paths=rows.filter(m=>m.media_path).map(m=>m.media_path);if(!paths.length)return rows;
  const {data,error}=await cfg.db.storage.from('club-memories').createSignedUrls(paths,3600);if(error)throw error;
  const signed=new Map(data.map(x=>[x.path,x.signedUrl]));return rows.map(m=>({...m,signed_url:signed.get(m.media_path)}));
 }
 function render(){
  if(!dialog||!state)return;const {event,arrivals,questions,memories,attendance,place,recap}=state;
  const own=arrivals.some(a=>a.user_id===uid()), canLocate=allowed(event), started=startFor(event,state.occurrence)<=new Date();
  const counts=attendance.filter(a=>a.response==='going').length;
  dialog.querySelector('.club-live-body').innerHTML=`<div class="club-live-event-heading"><p>${esc(stamp(event))}${event.location?' · '+esc(event.location):''}</p><h3>${esc(event.title)}</h3><div class="club-live-actions"><button type="button" data-cl-arrival ${state.occurrence!==today()?'disabled':''}>${own?'Ya estás aquí · Deshacer':'Ya he llegado'}</button><button type="button" data-cl-tab="recap">Ver recuerdo del plan</button></div></div><div class="club-live-columns"><section><h3>Quién está aquí <span>${arrivals.length}</span></h3><p>${counts} ${counts===1?'persona confirmada':'personas confirmadas'}</p><div class="club-live-people">${arrivals.length?arrivals.map(a=>`<span>${esc(name(a.user_id))}<small>${new Date(a.arrived_at).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</small></span>`).join(''):'<p>La primera llegada aparecerá aquí.</p>'}</div><h3>Decidimos sobre la marcha</h3>${questions.filter(q=>q.kind==='decision').map(question).join('')||'<p>Publica una pregunta para decidir el siguiente paso.</p>'}<details><summary>Nueva decisión</summary>${composer('decision')}</details></section><section><h3>Antes de quedar</h3><p>Dejad vuestra predicción. Los votos se cierran al empezar el plan.</p>${questions.filter(q=>q.kind==='prediction').map(question).join('')||'<p>Aún no hay predicciones para este plan.</p>'}${!started?`<details><summary>Nueva predicción</summary>${composer('prediction')}</details>`:''}</section></div><section class="club-live-recap" id="clubLiveRecap"><h3>El recuerdo del plan</h3>${recap?.highlight?`<blockquote class="club-live-highlight">${esc(recap.highlight)}</blockquote>`:""}<div class="club-live-recap-attendees">${attendance.filter(a=>a.response==='going').map(a=>`<span>${esc(name(a.user_id))}</span>`).join('')}</div>${canLocate?`<form data-cl-recap><label>Lo mejor del plan<textarea name="highlight" rows="2" maxlength="500" placeholder="Ese momento que queréis recordar…">${esc(recap?.highlight||'')}</textarea></label><button type="submit">Guardar recuerdo</button></form>`:""}<p>${arrivals.length} ${arrivals.length===1?'llegada':'llegadas'} · ${memories.length} ${memories.length===1?'recuerdo':'recuerdos'} · ${questions.filter(q=>q.closed_at).length} decisiones resueltas</p><div class="club-live-photos">${memories.map(m=>`<figure>${memoryMedia(m)}<figcaption>${esc(m.caption||m.moments?.caption||name(m.created_by))}</figcaption>${m.created_by===uid()||cfg.canManage?.()?`<button type="button" data-cl-feature="${m.id}" aria-pressed="${m.featured}">${m.featured?"En la habitación":"Mostrar en la habitación"}</button><form data-cl-caption="${m.id}"><input name="caption" maxlength="160" aria-label="Pie de foto" placeholder="Pie de foto" value="${esc(m.caption||'')}"><button type="submit">Guardar</button></form>`:""}</figure>`).join('')||'<p>Guardad las fotos, los vídeos y las anécdotas de este plan.</p>'}</div>${state.occurrence<=today()?`<details class="club-memory-compose"><summary>Añadir un recuerdo</summary><form data-cl-memory><label>Foto o vídeo<input type="file" name="media" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"></label><label>Qué pasó<textarea name="caption" maxlength="160" rows="2" placeholder="Una anécdota, con o sin foto…"></textarea></label><small>Fotos y vídeos de hasta 20 MB.</small><button type="submit">Guardar recuerdo</button></form></details>`:''}<button type="button" data-cl-photos ${state.occurrence>today()?'disabled':''}>Elegir de Momentos</button>${cfg.onAddPhoto?'<button type="button" data-cl-add-photo>Publicar nueva foto</button>':''}<div class="club-live-photo-picker"></div></section><section><h3>El lugar del recuerdo</h3>${place?`<p>${esc(place.label)}</p><a href="https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=16/${place.latitude}/${place.longitude}" target="_blank" rel="noopener noreferrer">Ver en el mapa</a>`:'<p>El organizador puede fijar el punto del plan para vuestro mapa de recuerdos.</p>'}${canLocate?`<details><summary>${place?'Cambiar punto':'Fijar punto en el mapa'}</summary><form data-cl-place><label>Nombre del sitio<input name="label" maxlength="120" required value="${esc(place?.label||event.location||'')}"></label><div class="club-live-coordinates"><label>Latitud<input name="latitude" type="number" inputmode="decimal" step="any" min="-90" max="90" required value="${place?.latitude??''}"></label><label>Longitud<input name="longitude" type="number" inputmode="decimal" step="any" min="-180" max="180" required value="${place?.longitude??''}"></label></div><button type="button" data-cl-location>Usar mi ubicación</button><button type="submit">Guardar punto</button><small>Solo se guarda la posición al pulsar Guardar punto.</small></form></details>`:''}</section>`;
 }
 function composer(kind){return `<form data-cl-compose="${kind}"><label>Pregunta<input name="question" minlength="3" maxlength="160" required placeholder="${kind==='prediction'?'¿Quién llegará primero?':'¿Dónde cenamos?'}"></label><label>Opciones, una por línea<textarea name="options" rows="3" maxlength="485" required placeholder="Entre 2 y 6 opciones"></textarea></label><button type="submit">Publicar ${kind==='prediction'?'predicción':'decisión'}</button></form>`;}
 async function load(){
  if(!state||!cfg?.db)return;const version=generation,eventId=state.event.id,occurrence=state.occurrence;
  try{
   const [arrivals,questions,memories,attendance,places,recaps]=await Promise.all([
    query(cfg.db.from('club_event_arrivals').select('*').eq('event_id',eventId).eq('occurrence',occurrence)),
    query(cfg.db.from('club_event_questions').select('*').eq('event_id',eventId).eq('occurrence',occurrence).order('created_at').limit(40)),
    query(cfg.db.from('club_event_memories').select('*,moments(media_url,caption,media_type)').eq('event_id',eventId).eq('occurrence',occurrence).limit(80)),
    query(cfg.db.from('event_attendance').select('user_id,response').eq('event_id',eventId).eq('occurrence',occurrence)),
    query(cfg.db.from('club_event_places').select('*').eq('event_id',eventId)),
    query(cfg.db.from('club_event_recaps').select('*').eq('event_id',eventId).eq('occurrence',occurrence))]);
   const signedMemories=await signMemories(memories);
   const votes=questions.length?await query(cfg.db.from('club_event_votes').select('*').in('question_id',questions.map(q=>q.id))):[];
   if(version!==generation||!state)return;Object.assign(state,{arrivals,questions,memories:signedMemories,attendance,place:places[0],recap:recaps[0],votes});
   // Background refresh never rebuilds a form while a member is typing.
   if(![...dialog.querySelectorAll('video')].some(video=>!video.paused)&&(!dialog.contains(document.activeElement)||!document.activeElement.matches('input,textarea,select'))){const scroll=dialog.scrollTop;render();dialog.scrollTop=scroll;}
  }catch(e){if(version===generation)status(friendly(e));}
  finally{if(version===generation&&dialog){clearTimeout(refreshTimer);if(!document.hidden)refreshTimer=setTimeout(()=>{if(!document.hidden&&!pending)void load();},20000);}}
 }
 function open(event,occurrence){if(!event||!uid()||!cfg?.db)return; shell('El plan en directo');state={event,occurrence:occurrence||dateOf(event),arrivals:[],questions:[],memories:[],attendance:[],votes:[]};void load();}
 async function pickPhotos(){try{const rows=await query(cfg.db.from('moments').select('id,media_url,caption,media_type').eq('user_id',uid()).in('media_type',['image','video']).order('created_at',{ascending:false}).limit(24));const n=dialog?.querySelector('.club-live-photo-picker');if(n)n.innerHTML=rows.length?`<p>Elige la foto que pertenece a este plan.</p><div class="club-live-pick-grid">${rows.map(r=>`<button type="button" data-cl-link-photo="${r.id}" aria-label="${esc(r.caption||'Añadir foto al plan')}">${memoryMedia({moments:r},true)}</button>`).join('')}</div>`:'<p>No tienes fotos en Momentos todavía.</p>';}catch(e){status(friendly(e));}}
 const milestones=[
  {id:'first_plan',label:'El primer encuentro',detail:'Un banderín en la pared',metric:'plans',target:1,unit:'plan con dos llegadas'},
  {id:'memory_wall',label:'Vuestras historias',detail:'Notas junto al tablón',metric:'memories',target:5,unit:'recuerdos de planes terminados'},
  {id:'places_souvenir',label:'Fuera de casa',detail:'Un recuerdo de vuestros sitios',metric:'places',target:3,unit:'sitios visitados y guardados'},
  {id:'club_trophy',label:'Diez para el recuerdo',detail:'Un trofeo para la estantería',metric:'plans',target:10,unit:'planes con dos llegadas'}
 ];
 const passportDate=value=>new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Madrid'}).format(new Date(`${value}T12:00:00Z`));
 function invalidatePassport(){passportEpoch++;passportCache=null;passportRequest=null;}
 async function getPassport(force=false){
  if(!uid()||!cfg?.db)throw new Error('Inicia sesión en el club.');
  const owner=uid(),epoch=passportEpoch;
  if(!force&&passportCache?.owner===owner&&Date.now()-passportCache.at<60000)return passportCache.data;
  if(!passportRequest){
   const request=query(cfg.db.rpc('get_club_room_passport')).then(async data=>{
    const visits=Array.isArray(data?.visits)?data.visits:[],photos=await signMemories(visits.map(v=>v.photo).filter(Boolean));
    let i=0;const signedVisits=visits.map(v=>({...v,photo:v.photo?photos[i++]:null}));
    const result={...data,visits:signedVisits,unlocks:Array.isArray(data?.unlocks)?data.unlocks:[]};
    if(owner===uid()&&epoch===passportEpoch)passportCache={owner,at:Date.now(),data:result};return result;
   }).finally(()=>{if(passportRequest===request)passportRequest=null;});
   passportRequest=request;
  }
  return passportRequest;
 }
 function placesOf(data){
  const places=new Map();
  for(const visit of data.visits){
   if(!places.has(visit.place_key))places.set(visit.place_key,{...visit,visits:[],cover:null});
   const place=places.get(visit.place_key);place.visits.push(visit);if(!place.cover&&visit.photo)place.cover=visit.photo;
  }
  return [...places.values()];
 }
 function passportTabs(active){return `<nav class="club-passport-tabs" aria-label="Pasaporte y sede"><button type="button" data-cl-passport-tab="places" aria-pressed="${active==='places'}">Vuestros sitios</button><button type="button" data-cl-passport-tab="room" aria-pressed="${active==='room'}">La sede</button></nav>`;}
 function renderPassport(data,tab='places'){
  if(!dialog)return;dialog.classList.add('club-passport-dialog');
  const body=dialog.querySelector('.club-live-body'),places=placesOf(data);
  body.innerHTML=`${passportTabs(tab)}${tab==='room'?roomProgressMarkup(data):`<section class="club-passport-intro"><div><h3>${Number(data.places)||0} ${(Number(data.places)||0)===1?'sitio':'sitios'} en vuestro pasaporte</h3><p>${Number(data.visit_count)||0} visitas guardadas · Solo para miembros del club</p></div><button type="button" data-cl-passport-tab="room">${data.unlocks.length} detalles en la sede</button></section>${places.length?`<div class="club-passport-map"><svg viewBox="0 0 600 290" role="img" aria-label="Distribución de los lugares visitados">${atlas(places)}</svg><p>Esquema de vuestros lugares. Abre un sitio para ver su mapa.</p></div><div class="club-passport-places">${places.map((p,i)=>`<button type="button" class="club-passport-place" data-cl-place-index="${i}">${p.cover?memoryMedia(p.cover):`<span class="club-passport-no-photo">${esc(p.label.slice(0,1))}</span>`}<span><strong>${esc(p.label)}</strong><small>${p.visits.length} ${p.visits.length===1?'visita':'visitas'} · ${esc(passportDate(p.occurrence))}</small><span>${esc(p.title)}</span></span></button>`).join('')}</div>${Number(data.visit_count)>data.visits.length?'<p>Se muestran las últimas 150 visitas.</p>':''}`:`<section class="club-passport-empty"><h3>El primer sitio os espera</h3><p>Cuando termine un plan, guardad su punto y una llegada o un recuerdo. Aparecerá aquí con vuestras fotos y fechas.</p><button type="button" data-cl-passport-calendar>Ver los planes</button></section>`}`}`;
  body.dataset.passportTab=tab;
 }
 function roomProgressMarkup(data){
  const earned=new Map(data.unlocks.map(u=>[u.milestone,u]));
  return `<section class="club-room-progress"><h3>La sede guarda lo que vivís</h3><p>Los encuentros y recuerdos del grupo dejan detalles permanentes en la habitación.</p><div class="club-room-progress-totals"><span><strong>${Number(data.plans)||0}</strong> planes con dos llegadas</span><span><strong>${Number(data.memories)||0}</strong> recuerdos</span><span><strong>${Number(data.places)||0}</strong> sitios</span></div><div class="club-room-milestones">${milestones.map(m=>{const unlocked=earned.get(m.id),value=Math.min(m.target,Number(data[m.metric])||0);return `<article class="${unlocked?'is-earned':''}"><div class="club-room-milestone-art" aria-hidden="true">${earnedArt(m.id)}</div><div><h4>${esc(m.label)}</h4><p>${esc(m.detail)}</p><small>${unlocked?'En la habitación desde el '+esc(passportDate(unlocked.unlocked_at.slice(0,10))):`${value} / ${m.target} ${esc(m.unit)}`}</small>${!unlocked?`<progress max="${m.target}" value="${value}" aria-label="${esc(m.label)}"></progress>`:''}</div></article>`;}).join('')}</div><p>Solo cuentan los planes que ya han terminado. Un detalle conseguido se queda en la sede.</p></section>`;
 }
 function renderPlace(index){
  const data=passportCache?.data,place=data&&placesOf(data)[index];if(!dialog||!place)return;passportListScroll=dialog.scrollTop;
  const people=ids=>ids.length?ids.map(id=>`<span>${esc(name(id))}</span>`).join(''):'<span>Sin llegadas registradas</span>';
  dialog.querySelector('.club-live-body').innerHTML=`<button type="button" class="club-passport-back" data-cl-passport-tab="places">Volver a los sitios</button><section class="club-passport-place-detail">${place.cover?`<div class="club-passport-cover">${memoryMedia(place.cover)}</div>`:''}<h3>${esc(place.label)}</h3><p>${place.visits.length} ${place.visits.length===1?'visita guardada':'visitas guardadas'}</p><div class="club-live-actions"><a class="club-passport-map-link" href="https://www.openstreetmap.org/?mlat=${Number(place.latitude)}&mlon=${Number(place.longitude)}#map=16/${Number(place.latitude)}/${Number(place.longitude)}" target="_blank" rel="noopener noreferrer">Abrir en mapas</a><button type="button" data-cl-repeat-place="${index}">Proponer volver</button></div><div class="club-passport-visits">${place.visits.map(v=>`<article><time datetime="${esc(v.occurrence)}">${esc(passportDate(v.occurrence))}</time><h4>${esc(v.title)}</h4><div class="club-passport-people">${people(v.attendees||[])}</div><p>${Number(v.memories)||0} ${(Number(v.memories)||0)===1?'recuerdo':'recuerdos'}</p><button type="button" data-cl-map-event="${esc(v.event_id)}" data-occurrence="${esc(v.occurrence)}">Ver recuerdo del plan</button></article>`).join('')}</div></section>`;
  dialog.scrollTop=0;
  const heading=dialog.querySelector('.club-passport-place-detail>h3');heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});
 }
 async function openMap(tab='places'){
  if(!uid()||!cfg?.db)return;passportListScroll=0;shell('Pasaporte del club');dialog.classList.add('club-passport-dialog');
  dialog.querySelector('[role=status]').textContent='Abriendo vuestro pasaporte…';const version=generation;
  try{const data=await getPassport();if(version===generation&&dialog)renderPassport(data,tab);}catch(e){if(version===generation&&dialog)dialog.querySelector('.club-live-body').innerHTML=`<section class="club-passport-empty"><h3>No pudimos abrir el pasaporte</h3><p role="status">${esc(friendly(e))}</p><button type="button" data-cl-passport-retry>Volver a intentar</button></section>`;}
 }
 function atlas(rows){
  const lo=Math.min(...rows.map(p=>Number(p.longitude))),hi=Math.max(...rows.map(p=>Number(p.longitude))),la=Math.min(...rows.map(p=>Number(p.latitude))),ha=Math.max(...rows.map(p=>Number(p.latitude)));
  const latitude=(la+ha)/2,dx=Math.max(.02,(hi-lo)*Math.cos(latitude*Math.PI/180)),dy=Math.max(.02,ha-la),scale=Math.min(480/dx,180/dy);
  const points=rows.map((p,i)=>({i,x:300+(Number(p.longitude)-(lo+hi)/2)*Math.cos(latitude*Math.PI/180)*scale,y:145-(Number(p.latitude)-(la+ha)/2)*scale}));
  return `<path d="M40 90Q140 40 230 100T420 75T565 115M30 225Q135 170 240 210T460 195T570 220M150 25Q125 120 180 265M440 25Q390 170 470 265" class="club-passport-map-land"/>${points.map(p=>`<a href="#" data-cl-place-index="${p.i}" aria-label="Abrir ${esc(rows[p.i].label)}"><circle cx="${p.x}" cy="${p.y}" r="18" class="club-passport-map-hit"/><circle cx="${p.x}" cy="${p.y}" r="6"/><title>${esc(rows[p.i].label)}</title></a>`).join('')}<text x="24" y="267" class="club-live-map-note">N ↑</text>`;
 }
 function earnedArt(id){
  const art={
   first_plan:'<path d="M12 8h56v9H12z" fill="#a86c33"/><path d="M18 18h44v48L40 84 18 66z" fill="#174a46" stroke="#092c2a" stroke-width="4"/><path d="M25 24h30v38L40 74 25 62z" fill="none" stroke="#c9a55d" stroke-width="3"/><path d="M33 36h14v5H33zm0 10h14v5H33zm0 10h10v5H33z" fill="#d6b978"/>',
   memory_wall:'<path d="M8 15L142 9" stroke="#533621" stroke-width="3"/><path d="M12 17h35v48H12zm45-3h35v48H57zm45-3h35v48h-35z" fill="#d9c79f" stroke="#705335" stroke-width="3"/><path d="M18 24h23v25H18z" fill="#45544b"/><path d="M18 44l8-10 7 7 8-6v14H18z" fill="#9d9e78"/><path d="M63 24h23m-23 9h19m-19 9h22m23-22h23m-23 9h18m-18 9h21" stroke="#887959" stroke-width="3"/><path d="M26 10v12m45-14v12m45-14v12" stroke="#9d6533" stroke-width="5"/>',
   places_souvenir:'<path d="M8 7h65v43H8z" fill="#c6ae70" stroke="#5d3c24" stroke-width="4"/><path d="M14 13h53v31H14z" fill="#3e514b"/><path d="M18 38V25h8v13m4 0V19h10v19m4 0V28h7v10m4 0V23h8v15" fill="#c3b779"/><path d="M16 46h48" stroke="#8b683b" stroke-width="2"/>',
   club_trophy:'<path d="M29 15H12v11q0 16 19 15m22-26h17v11q0 16-19 15" fill="none" stroke="#a26a2d" stroke-width="6"/><path d="M24 8h34v23q0 18-17 22-17-4-17-22z" fill="#c09242" stroke="#6e461f" stroke-width="3"/><path d="M29 12h8v27h-8z" fill="#e1b566"/><path d="M37 52h8v15h-8z" fill="#b68134"/><path d="M26 65h30v8H26zM20 73h42v10H20z" fill="#513c28"/><path d="M26 76h30v4H26z" fill="#b18d50"/>'
  };
  return `<svg viewBox="${id==='memory_wall'?'0 0 150 75':id==='places_souvenir'?'0 0 82 57':'0 0 82 90'}" fill="none" preserveAspectRatio="xMidYMax meet" shape-rendering="crispEdges" aria-hidden="true">${art[id]||''}</svg>`;
 }
 async function mountRoomDetails(room){
  if(!room||!uid())return;const owner=uid(),epoch=passportEpoch;
  try{const data=await getPassport();if(owner!==uid()||epoch!==passportEpoch||!room.isConnected)return;
   let layer=room.querySelector('.clubhouse-earned-details');if(!layer){layer=document.createElement('div');layer.className='clubhouse-earned-details';room.append(layer);}
   const signature=data.unlocks.map(u=>u.milestone).sort().join('|');if(layer.dataset.signature===signature)return;
   layer.dataset.signature=signature;
   layer.innerHTML=milestones.filter(m=>data.unlocks.some(u=>u.milestone===m.id)).map(m=>`<span class="clubhouse-earned-object earned-${m.id}" aria-hidden="true">${earnedArt(m.id)}</span>`).join('');
  }catch{/* The existing room remains available when offline. */}
 }
 document.addEventListener('click',e=>{
  const b=e.target.closest('[data-club-room-progress],[data-cl-passport-tab],[data-cl-place-index],[data-cl-repeat-place],[data-cl-passport-calendar],[data-cl-passport-retry],[data-cl-feature],[data-cl-close],[data-cl-arrival],[data-cl-vote],[data-cl-photos],[data-cl-link-photo],[data-cl-map-event],[data-cl-location],[data-cl-tab],[data-cl-add-photo],[data-club-live-event],[data-club-memory-map]');if(!b)return;
  if(b.hasAttribute('data-club-memory-map')||b.hasAttribute('data-cl-passport-retry'))return void openMap();
  if(b.hasAttribute('data-club-room-progress'))return void openMap('room');
  if(b.hasAttribute('data-cl-passport-tab')){const back=!!dialog?.querySelector('.club-passport-place-detail');if(passportCache)renderPassport(passportCache.data,b.dataset.clPassportTab);if(dialog){dialog.scrollTop=back?passportListScroll:0;dialog.querySelector('.club-passport-tabs button[aria-pressed=true]')?.focus({preventScroll:true});}return;}
  if(b.hasAttribute('data-cl-place-index')){e.preventDefault();return renderPlace(Number(b.dataset.clPlaceIndex));}
  if(b.hasAttribute('data-cl-passport-calendar')){close();return cfg.onOpenCalendar?.();}
  if(b.hasAttribute('data-cl-repeat-place')){const place=passportCache&&placesOf(passportCache.data)[Number(b.dataset.clRepeatPlace)];if(!place)return;close();return cfg.onProposePlace?.({title:`Volver a ${place.label}`.slice(0,80),location:place.label,description:`Repetimos en ${place.label}.`});}
  if(b.hasAttribute('data-club-live-event')||b.hasAttribute('data-cl-map-event')){e.preventDefault();const id=b.dataset.clubLiveEvent||b.dataset.clMapEvent;return open(events().find(p=>String(p.id)===String(id)),b.dataset.occurrence);}
  if(!dialog?.contains(b))return;
  if(b.hasAttribute('data-cl-close'))return close();
  if(b.hasAttribute('data-cl-tab'))return dialog.querySelector('#clubLiveRecap')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  if(b.hasAttribute('data-cl-photos'))return void pickPhotos();
  if(b.hasAttribute('data-cl-add-photo'))return cfg.onAddPhoto?.(state?.event);
  if(b.hasAttribute('data-cl-location')){if(!navigator.geolocation)return status('Tu dispositivo no permite obtener la ubicación.');return navigator.geolocation.getCurrentPosition(p=>{const f=b.closest('form');if(!f?.isConnected)return;f.elements.latitude.value=p.coords.latitude.toFixed(6);f.elements.longitude.value=p.coords.longitude.toFixed(6);},()=>status('No pudimos acceder a tu ubicación. Puedes introducir las coordenadas.'),{timeout:10000,maximumAge:60000});}
  if(b.hasAttribute('data-cl-arrival'))return void mutate(async()=>{const own=state.arrivals.some(a=>a.user_id===uid());await query(own?cfg.db.from('club_event_arrivals').delete().eq('event_id',state.event.id).eq('occurrence',state.occurrence).eq('user_id',uid()):cfg.db.from('club_event_arrivals').insert({event_id:state.event.id,occurrence:state.occurrence,user_id:uid()}));});
  if(b.dataset.clFeature)return void mutate(async()=>{const memory=state.memories.find(m=>String(m.id)===b.dataset.clFeature);if(!memory)return;await query(cfg.db.from('club_event_memories').update({featured:!memory.featured}).eq('id',memory.id));roomCache=null;document.querySelectorAll('.clubhouse-memory').forEach(n=>void mountRoom(n));});
  if(b.dataset.clVote)return void mutate(()=>query(cfg.db.from('club_event_votes').upsert({question_id:b.dataset.clVote,user_id:uid(),option_index:Number(b.dataset.option)},{onConflict:'question_id,user_id'})));
  if(b.dataset.clLinkPhoto)return void mutate(()=>query(cfg.db.from('club_event_memories').upsert({event_id:state.event.id,occurrence:state.occurrence,moment_id:Number(b.dataset.clLinkPhoto),created_by:uid()},{onConflict:'event_id,occurrence,moment_id',ignoreDuplicates:true})));
 });
 document.addEventListener('submit',e=>{
  const f=e.target;if(!dialog?.contains(f)||!f.matches('[data-cl-compose],[data-cl-reveal],[data-cl-place],[data-cl-recap],[data-cl-caption],[data-cl-memory]'))return;e.preventDefault();const data=new FormData(f);
  if(f.hasAttribute('data-cl-memory'))return void mutate(async()=>{
   const file=data.get('media'),caption=String(data.get('caption')||'').trim(),eventId=state.event.id,occurrence=state.occurrence,owner=uid();
   if(!caption&&!file?.size)throw new Error('Añade una foto, un vídeo o una anécdota.');
   let path=null,type=null;
   if(file?.size){
    const extensions={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/quicktime':'mov'};
    if(!extensions[file.type]||file.size>20*1024*1024)throw new Error('Usa una foto o vídeo compatible de hasta 20 MB.');
    type=file.type.startsWith('video/')?'video':'image';path=`${owner}/${eventId}/${crypto.randomUUID()}.${extensions[file.type]}`;
    const upload=await cfg.db.storage.from('club-memories').upload(path,file,{contentType:file.type,upsert:false});if(upload.error)throw upload.error;
   }
   try{await query(cfg.db.from('club_event_memories').insert({event_id:eventId,occurrence,created_by:owner,caption,media_path:path,media_type:type,featured:!!path}));}
   catch(error){if(path)await cfg.db.storage.from('club-memories').remove([path]);throw error;}
   roomCache=null;document.querySelectorAll('.clubhouse-memory').forEach(n=>void mountRoom(n));globalThis.ClubSocial?.refreshGoal(true);
  });
  if(f.hasAttribute('data-cl-recap'))return void mutate(()=>query(cfg.db.from('club_event_recaps').upsert({event_id:state.event.id,occurrence:state.occurrence,highlight:String(data.get('highlight')).trim(),created_by:uid(),updated_at:new Date().toISOString()},{onConflict:'event_id,occurrence'})));
  if(f.dataset.clCaption)return void mutate(()=>query(cfg.db.from('club_event_memories').update({caption:String(data.get('caption')).trim()}).eq('id',f.dataset.clCaption)));
  if(f.dataset.clCompose){const options=String(data.get('options')).split('\n').map(s=>s.trim()).filter(Boolean);if(options.length<2||options.length>6||options.some(s=>s.length>80)||new Set(options).size!==options.length)return status('Añade entre 2 y 6 opciones distintas, con un máximo de 80 caracteres cada una.');return void mutate(()=>query(cfg.db.from('club_event_questions').insert({event_id:state.event.id,occurrence:state.occurrence,created_by:uid(),question:String(data.get('question')).trim(),options,kind:f.dataset.clCompose})));}
  if(f.dataset.clReveal)return void mutate(()=>query(cfg.db.from('club_event_questions').update({closed_at:new Date().toISOString(),result_index:data.has('result')?Number(data.get('result')):null}).eq('id',f.dataset.clReveal)));
  if(f.hasAttribute('data-cl-place'))return void mutate(()=>query(cfg.db.from('club_event_places').upsert({event_id:state.event.id,latitude:Number(data.get('latitude')),longitude:Number(data.get('longitude')),label:String(data.get('label')).trim(),updated_by:uid()},{onConflict:'event_id'})));
 });
 async function mountRoom(node){
  if(!node||!uid()||!cfg?.db)return;const owner=uid();void mountRoomDetails(node.closest(".clubhouse-room, .chota-viewer-room-scene"));
  if(!roomCache||Date.now()-roomCache.at>60000){
   if(!roomRequest)roomRequest=query(cfg.db.from('club_event_memories').select('event_id,occurrence,caption,media_path,media_type,moments(media_url,caption,media_type)').eq('featured',true).order('created_at',{ascending:false}).limit(1)).then(signMemories).then(rows=>{if(owner===uid())roomCache={at:Date.now(),rows};}).catch(()=>{}).finally(()=>roomRequest=null);
   await roomRequest;
  }
  if(owner!==uid()||!node.isConnected)return;const photo=roomCache?.rows?.[0];if(!photo)return;
  node.innerHTML=`<button type="button" class="clubhouse-memory-photo" data-club-live-event="${esc(photo.event_id)}" data-occurrence="${esc(photo.occurrence)}" aria-label="Abrir recuerdo del plan">${memoryMedia(photo,true)}<span>${esc(photo.caption||photo.moments?.caption||'Recuerdos del club')}</span></button>`;
 }
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden){clearTimeout(refreshTimer);refreshTimer=0;return;}
  if(state&&dialog&&!pending)void load();
 });
 globalThis.ClubLive={init(options){cfg=options;},open,openMap,mountRoom,mountRoomDetails,reset(){close();roomCache=null;roomRequest=null;invalidatePassport();document.querySelectorAll(".clubhouse-earned-details").forEach(n=>n.remove());},refresh(){if(state&&!pending&&!document.hidden)void load();}};
})();
