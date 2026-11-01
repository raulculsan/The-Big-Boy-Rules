/* Everyday club tools inside Hoy en el club. All data and writes go through checked RPCs. */
(() => {
 'use strict';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'});
 const dayName=new Intl.DateTimeFormat('es-ES',{weekday:'short',day:'numeric',month:'short'});
 const longDate=new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'long',year:'numeric'});
 let config={},state=null,notice='',busy=false,epoch=0;
 const nameOf=id=>config.getMember?.(id)?.name||'Miembro';
 const asDay=value=>new Date(`${value}T12:00:00`);
 const people=()=>(config.getMembers?.()||[]).filter(m=>m.authId&&!m.hidden);
 const safeLink=url=>/^https:\/\/(open\.spotify\.com|music\.youtube\.com|www\.youtube\.com|youtu\.be|music\.apple\.com)\//.test(url||'')?url:'';
 function memories(){
  const {message,plan}=state.memory||{};
  const cards=[];
  if(message)cards.push(`<article class="club-day-award"><h4>${esc(nameOf(message.author))} dijo</h4><p class="club-day-message">${esc(message.body)}</p><p class="club-day-note">${esc(longDate.format(new Date(message.at)))}</p></article>`);
  if(plan)cards.push(`<article class="club-day-award"><h4>${esc(plan.title)}</h4><p class="club-day-note">Plan del ${esc(longDate.format(new Date(plan.at)))}</p></article>`);
  return `<h4>Un recuerdo para hoy</h4>${cards.join('')||'<p class="club-day-note">Aún no hay recuerdos. Volverán cuando el club tenga más historia.</p>'}<p class="club-day-note">Cada día sale uno distinto.</p>`;
 }
 function dates(){
  const polls=state.polls.map(p=>{
   const top=Math.max(0,...p.days.map(d=>d.votes));
   const rows=p.days.map(d=>{
    const label=dayName.format(asDay(d.day));
    if(p.chosen)return `<li class="${d.day===p.chosen?'is-own':''}"><span>${esc(label)}</span><b>${d.votes}</b></li>`;
    return `<li><button type="button" data-plus-day="${esc(p.id)}" data-day-value="${esc(d.day)}" aria-pressed="${d.mine}">${esc(label)}<b>${d.votes}</b></button>${p.own&&d.votes===top&&top>0?`<button type="button" class="plus-choose" data-plus-choose="${esc(p.id)}" data-day-value="${esc(d.day)}">Elegir</button>`:''}</li>`;
   }).join('');
   return `<article class="club-day-prediction"><h4>${esc(p.title)}</h4>${p.chosen?`<p class="club-day-note">Fecha elegida: ${esc(dayName.format(asDay(p.chosen)))}</p>`:'<p class="club-day-note">Marca los días que puedes.</p>'}<ul class="plus-days">${rows}</ul></article>`;
  }).join('');
  return `${polls||'<p class="club-day-note">Aún no hay votaciones.</p>'}<form class="club-day-form" data-plus-form="poll"><label>Nuevo plan<input name="title" required minlength="3" maxlength="80" placeholder="Cena, viaje, partido…"></label><fieldset class="plus-people"><legend>Fechas posibles</legend>${[0,1,2,3].map(i=>`<input type="date" name="days" aria-label="Fecha ${i+1}"${i<2?' required':''}>`).join('')}</fieldset><div><button type="submit" class="club-day-action">Crear votación</button></div></form>`;
 }
 function tabs(){
  const list=state.tabs.map(t=>{
   const rows=t.balances.map(b=>`<li><span>${esc(nameOf(b.id))}</span><b>${b.cents>0?'recibe':'debe'} ${esc(money.format(Math.abs(b.cents)/100))}</b></li>`).join('');
   const spent=t.expenses.map(e=>`<li><span>${esc(e.concept)} · ${esc(nameOf(e.payer))}</span><b>${esc(money.format(e.cents/100))}</b></li>`).join('');
   const add=t.settled?'':`<details><summary>Añadir gasto</summary><form class="club-day-form" data-plus-form="expense" data-tab="${esc(t.id)}"><label>Concepto<input name="concept" required maxlength="60"></label><label>Importe en euros<input name="amount" required inputmode="decimal" placeholder="12,50"></label><label>Pagó<select name="payer">${people().map(m=>`<option value="${esc(m.authId)}"${m.authId===config.getUser?.()?.id?' selected':''}>${esc(m.name)}</option>`).join('')}</select></label><fieldset class="plus-people"><legend>Entre quién se reparte</legend>${people().map(m=>`<label><input type="checkbox" name="people" value="${esc(m.authId)}" checked> ${esc(m.name)}</label>`).join('')}</fieldset><div><button type="submit" class="club-day-action">Guardar gasto</button></div></form></details>`;
   return `<article class="club-day-prediction"><h4>${esc(t.title)}${t.settled?' · cerrado':''}</h4><ul class="plus-lines">${rows||'<li><span>Sin deudas</span></li>'}</ul>${spent?`<details><summary>Gastos</summary><ul class="plus-lines">${spent}</ul></details>`:''}${add}${t.own&&!t.settled?`<button type="button" class="club-day-action is-quiet" data-plus-settle="${esc(t.id)}">Cerrar bote</button>`:''}</article>`;
  }).join('');
  return `<p class="club-day-note">Apunta gastos y la app calcula quién debe a quién. No mueve dinero.</p>${list}<form class="club-day-form" data-plus-form="tab"><label>Nuevo bote<input name="title" required minlength="3" maxlength="80" placeholder="Cena del viernes"></label><div><button type="submit" class="club-day-action">Crear bote</button></div></form>`;
 }
 function radio(){
  const songs=state.songs.map(s=>{
   const link=safeLink(s.url);
   return `<li><span>${link?`<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>`:esc(s.title)}<small>${esc(nameOf(s.user))}</small></span><button type="button" data-plus-song="${esc(s.id)}" aria-pressed="${s.mine}"${s.user===config.getUser?.()?.id?' disabled':''}>${s.votes}</button></li>`;
  }).join('');
  const winner=state.last_winner?`<p class="club-day-note">Ganó la semana pasada: ${esc(state.last_winner.title)}, de ${esc(nameOf(state.last_winner.user))}.</p>`:'';
  return `<h4>Canciones de la semana</h4><ul class="plus-lines plus-songs">${songs||'<li><span>Aún no hay canciones.</span></li>'}</ul>${winner}<form class="club-day-form" data-plus-form="song"><label>${state.own_song?'Cambiar tu canción':'Tu canción'}<input name="title" required minlength="2" maxlength="100" placeholder="Artista · Canción"></label><label>Enlace, si quieres<input name="url" type="url" placeholder="https://open.spotify.com/…"></label><div><button type="submit" class="club-day-action">Guardar</button></div></form>`;
 }
 function status(){
  const own=state.statuses[config.getUser?.()?.id]||'';
  const list=people().filter(m=>state.statuses[m.authId]).map(m=>`<li><span>${esc(m.name)}</span><b>${esc(state.statuses[m.authId])}</b></li>`).join('');
  return `<form class="club-day-form" data-plus-form="status"><label>Tu estado, dura 24 horas<input name="body" maxlength="60" value="${esc(own)}" placeholder="Libre esta noche"></label><div><button type="submit" class="club-day-action">Guardar</button></div></form><ul class="plus-lines">${list||'<li><span>Nadie ha puesto estado hoy.</span></li>'}</ul>`;
 }
 const views={estado:status,recuerdos:memories,fechas:dates,bote:tabs,radio};
 function view(id){return `${views[id]?.()||''}${notice?`<p class="club-day-note" role="status">${esc(notice)}</p>`:''}`;}
 async function refresh(){
  if(!config.db||!config.getUser?.())return;
  const run=++epoch,{data,error}=await config.db.rpc('get_club_plus');
  if(run!==epoch||error)return;
  state=data;config.onChange?.();
 }
 async function call(name,args,done=''){
  if(busy)return;busy=true;notice='';
  const {data,error}=await config.db.rpc(name,args);
  busy=false;
  if(error)notice=['PGRST202','42883'].includes(error.code)?'Esta función se está preparando.':error.message||'No se ha podido guardar.';
  else{state=data;notice=done;}
  config.onChange?.();
 }
 function click(event){
  const b=event.target.closest?.('#clubDay button');if(!b||b.disabled)return;
  const d=b.dataset;
  if(d.plusDay)void call('toggle_date_vote',{p_poll:d.plusDay,p_day:d.dayValue});
  if(d.plusChoose)void call('choose_poll_date',{p_poll:d.plusChoose,p_day:d.dayValue},'Fecha elegida');
  if(d.plusSettle)void call('settle_club_tab',{p_tab:d.plusSettle},'Bote cerrado');
  if(d.plusSong)void call('vote_club_song',{p_song:d.plusSong});
 }
 function submit(event){
  const form=event.target.closest?.('[data-plus-form]');if(!form)return;
  event.preventDefault();
  const f=new FormData(form),kind=form.dataset.plusForm;
  if(kind==='status')void call('set_club_status',{p_body:String(f.get('body'))},'Estado guardado');
  if(kind==='tab')void call('create_club_tab',{p_title:String(f.get('title'))},'Bote creado');
  if(kind==='song')void call('add_club_song',{p_title:String(f.get('title')),p_url:String(f.get('url')||'')||null},'Canción guardada');
  if(kind==='poll'){
   const days=f.getAll('days').map(String).filter(Boolean);
   void call('create_date_poll',{p_title:String(f.get('title')),p_days:days},'Votación creada');
  }
  if(kind==='expense'){
   const cents=Math.round(Number(String(f.get('amount')).replace(',','.'))*100),shared=f.getAll('people').map(String);
   if(!Number.isFinite(cents)||cents<1){notice='Escribe un importe válido.';return config.onChange?.();}
   if(!shared.length){notice='Elige al menos una persona.';return config.onChange?.();}
   void call('add_tab_expense',{p_tab:form.dataset.tab,p_payer:String(f.get('payer')),p_concept:String(f.get('concept')),p_cents:cents,p_people:shared},'Gasto guardado');
  }
 }
 function reset(){epoch++;state=null;notice='';busy=false;}
 function init(options){config=options;document.addEventListener('click',click);document.addEventListener('submit',submit);}
 globalThis.ClubPlus={init,refresh,reset,view,ready:()=>Boolean(state),clearNotice(){notice='';},statusFor:id=>state?.statuses?.[id]||''};
})();
