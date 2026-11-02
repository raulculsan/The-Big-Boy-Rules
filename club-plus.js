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
  return `<h4>Un recuerdo para hoy</h4>${cards.join('')||'<p class="club-day-note">Aún no hay recuerdos. Volverán cuando el club tenga más historia.</p>'}<p class="club-day-note">Cada día sale uno distinto.</p>${(state.story?.endings||[]).map(e=>`<article class="club-day-award"><h4>Temporada ${e.number}: ${esc(e.title)}</h4><p>${esc(e.body)}</p></article>`).join('')}${(state.nights||[]).map(n=>`<article class="club-day-award"><h4>La Sala: ${esc(n.title)}</h4><p>Ganó ${esc(nameOf(n.winner))}.${n.highlight?` Mejor momento: ${esc(n.highlight)}`:''}</p></article>`).join('')}`;
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
   const spent=t.expenses.map(e=>`<li><span>${esc(e.concept)} · ${esc(nameOf(e.payer))}</span><b>${esc(money.format(e.cents/100))}</b>${t.settled?'':`<button type="button" class="plus-remove" data-plus-expense="${esc(e.id)}" aria-label="Borrar ${esc(e.concept)}">×</button>`}</li>`).join('');
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
 const options=(selected='')=>people().map(m=>`<option value="${esc(m.authId)}"${m.authId===selected?' selected':''}>${esc(m.name)}</option>`).join('');
 function court(){
  const me=config.getUser?.()?.id;
  const rows=(state.trials||[]).map(t=>{
   const verdict=t.guilty>t.innocent?'Culpable':t.guilty<t.innocent?'Inocente':'Empate';
   const canVote=!t.closed&&me!==t.accused&&me!==t.accuser;
   const votes=canVote?`<div class="club-day-options"><button type="button" data-plus-trial="${esc(t.id)}" data-guilty="true" aria-pressed="${t.vote===true}"><span>Culpable</span><b>${t.guilty}</b></button><button type="button" data-plus-trial="${esc(t.id)}" data-guilty="false" aria-pressed="${t.vote===false}"><span>Inocente</span><b>${t.innocent}</b></button></div>`:`<p class="club-day-note">${t.closed?`Veredicto: ${verdict}`:'Votando'} · ${t.guilty} culpable, ${t.innocent} inocente</p>`;
   const defend=!t.closed&&me===t.accused?`<form class="club-day-form" data-plus-form="defence" data-trial="${esc(t.id)}"><label>Tu defensa<input name="body" maxlength="200" value="${esc(t.defence||'')}"></label><div><button type="submit" class="club-day-action is-quiet">Guardar</button></div></form>`:t.defence?`<p class="club-day-note">Defensa: ${esc(t.defence)}</p>`:'';
   return `<article class="club-day-prediction"><h4>${esc(nameOf(t.accused))}</h4><p class="club-day-message">${esc(t.charge)}</p><p class="club-day-note">Acusa ${esc(nameOf(t.accuser))}</p>${defend}${votes}</article>`;
  }).join('');
  return `${rows||'<p class="club-day-note">No hay juicios abiertos.</p>'}<form class="club-day-form" data-plus-form="trial"><label>Acusar a<select name="accused">${people().filter(m=>m.authId!==me).map(m=>`<option value="${esc(m.authId)}">${esc(m.name)}</option>`).join('')}</select></label><label>De qué<input name="charge" required minlength="5" maxlength="140" placeholder="Llegó una hora tarde al plan"></label><div><button type="submit" class="club-day-action">Abrir juicio</button></div></form><p class="club-day-note">Dura 2 días. Es en broma: máximo 2 juicios por semana y uno abierto por persona.</p>`;
 }
 function weekly(){
  const c=state.challenge||{},me=config.getUser?.()?.id,own=(c.entries||[]).find(e=>e.user===me);
  const rows=(c.entries||[]).map(e=>`<li><span>${esc(e.body)}<small>${esc(nameOf(e.user))}</small></span><button type="button" data-plus-entry="${esc(e.user)}" aria-pressed="${e.mine}"${e.user===me?' disabled':''}>Vale ${e.votes}</button></li>`).join('');
  return `<h4>${esc(c.prompt||'')}</h4><ul class="plus-lines plus-songs">${rows||'<li><span>Nadie lo ha hecho todavía.</span></li>'}</ul><form class="club-day-form" data-plus-form="entry"><label>${own?'Cambiar tu respuesta':'¿Cómo lo hiciste?'}<input name="body" required minlength="2" maxlength="200" value="${esc(own?.body||'')}"></label><div><button type="submit" class="club-day-action">Guardar</button></div></form>`;
 }
 function liar(){
  const rows=(state.lies||[]).map(l=>{
   const answered=l.lie!==null&&l.lie!==undefined;
   const claims=l.claims.map((text,i)=>answered?`<li class="${i===l.lie?'is-own':''}"><span>${esc(text)}${i===l.lie?' · mentira':''}</span></li>`:`<li><button type="button" data-plus-lie="${esc(l.id)}" data-guess="${i}">${esc(text)}</button></li>`).join('');
   return `<article class="club-day-prediction"><h4>${esc(nameOf(l.author))}</h4><ul class="plus-days">${claims}</ul><p class="club-day-note">${answered?`${l.fooled} de ${l.guesses} han picado`:'¿Cuál es la mentira?'}</p></article>`;
  }).join('');
  return `${rows||'<p class="club-day-note">Nadie ha jugado todavía.</p>'}<form class="club-day-form" data-plus-form="lie"><label>Primera frase<input name="c0" required minlength="3" maxlength="120"></label><label>Segunda frase<input name="c1" required minlength="3" maxlength="120"></label><label>Tercera frase<input name="c2" required minlength="3" maxlength="120"></label><label>La mentira es la<select name="lie"><option value="0">Primera</option><option value="1">Segunda</option><option value="2">Tercera</option></select></label><div><button type="submit" class="club-day-action">Publicar</button></div></form>`;
 }
 function league(){
  const me=config.getUser?.()?.id;
  const rows=(state.league||[]).map((r,i)=>`<li><b>${i+1}</b><span>${esc(nameOf(r.id))}</span><small>${r.points} pts · ${r.won}G ${r.lost}P</small></li>`).join('');
  const recent=(state.matches||[]).map(m=>`<li><span>${esc(m.game)}<small>${esc(nameOf(m.winner))} ganó a ${esc(nameOf(m.loser))}</small></span>${m.own?`<button type="button" class="plus-remove" data-plus-match="${esc(m.id)}" aria-label="Borrar partida">×</button>`:''}</li>`).join('');
  return `<ol class="club-day-ranking">${rows||'<li><span>Aún no hay partidas.</span></li>'}</ol>${recent?`<details><summary>Últimas partidas</summary><ul class="plus-lines">${recent}</ul></details>`:''}<form class="club-day-form" data-plus-form="match"><label>Juego<input name="game" required minlength="2" maxlength="40" placeholder="FIFA, pádel, cartas…"></label><label>Ganó<select name="winner">${options(me)}</select></label><label>Perdió<select name="loser">${options(people().find(m=>m.authId!==me)?.authId)}</select></label><div><button type="submit" class="club-day-action">Apuntar partida</button></div></form>`;
 }
 const safeFile=url=>/^https:\/\/[^\s"'<>]+\/storage\/v1\/object\/public\/group-media\//.test(url||'')?url:'';
 function photo(){
  const p=state.photo||{},time=p.opens_at?new Intl.DateTimeFormat('es-ES',{hour:'2-digit',minute:'2-digit'}).format(new Date(p.opens_at)):'';
  const grid=(p.photos||[]).map(x=>{const url=safeFile(x.url);return url?`<figure class="plus-photo"><img src="${esc(url)}" alt="Foto de ${esc(nameOf(x.user))}" loading="lazy"><figcaption>${esc(nameOf(x.user))}${x.late?' · tarde':''}</figcaption></figure>`:'';}).join('');
  if(!p.opens_at)return '<h4>La foto del día</h4><p class="club-day-note">Hoy sale a una hora sorpresa entre las 10:00 y las 21:00. Vuelve más tarde.</p>';
  const upload=p.own?'':`<label class="club-day-action plus-upload">${busy?'Subiendo…':'Subir mi foto'}<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" data-plus-file="photo" hidden></label>`;
  return `<h4>La foto del día</h4><p class="club-day-note">${p.on_time?`Es la hora: quedan menos de 10 minutos desde las ${esc(time)}.`:`Salió a las ${esc(time)}.`} ${p.own?'':`${p.count} ${p.count===1?'persona la ha subido':'personas la han subido'}. Sube la tuya para verlas.`}</p>${upload}<div class="plus-photos">${grid}</div>`;
 }
 function karaoke(){
  const k=state.karaoke||{},me=config.getUser?.()?.id,own=(k.entries||[]).some(e=>e.user===me);
  const rows=(k.entries||[]).map(e=>{const url=safeFile(e.url);return `<article class="club-day-award"><h4>${esc(nameOf(e.user))}</h4>${url?`<audio controls preload="none" src="${esc(url)}"></audio>`:''}<button type="button" class="club-day-action is-quiet" data-plus-karaoke="${esc(e.user)}" aria-pressed="${k.vote===e.user}"${e.user===me?' disabled':''}>Votar · ${e.votes}</button></article>`;}).join('');
  return `<h4>${esc(k.prompt||'')}</h4><p class="club-day-note">Canta esto esta semana y vota la mejor.</p><label class="club-day-action plus-upload">${busy?'Subiendo…':own?'Cambiar mi audio':'Subir mi audio'}<input type="file" accept="audio/*" capture data-plus-file="karaoke" hidden></label>${rows}`;
 }
 function chota(){
  const story=state.story;if(!story)return '<p class="club-day-note">La historia se está preparando.</p>';
  const {season,today,yesterday}=story,meter=(label,value)=>`<li><span>${label}</span><meter min="0" max="100" value="${value}" aria-label="${label}"></meter></li>`;
  const change=(label,value)=>value?`${label} ${value>0?'+':''}${value}`:'';
  const changes=yesterday?[change('Dinero',yesterday.money),change('Fama',yesterday.fame),change('Energía',yesterday.energy),change('Líos',yesterday.trouble)].filter(Boolean).join(' · '):'';
  const past=yesterday?`<article class="club-day-award"><h4>Lo que pasó: ${esc(yesterday.title)}</h4><p class="club-day-note">Salió «${esc(yesterday.choice)}»${yesterday.votes?'':' porque nadie votó'}.</p><p>${esc(yesterday.result)}</p><p class="club-day-note">${esc(changes)}</p>${yesterday.twist?`<p class="club-day-note">Giro de ${esc(nameOf(yesterday.twist))}</p>`:''}</article>`:'';
  const options=today.options.map(o=>`<li><button type="button" data-story-day="${esc(today.id)}" data-story-option="${o.i}" aria-pressed="${today.mine===o.i}">${esc(o.label)}${o.votes==null?'':`<b>${o.votes}</b>`}</button></li>`).join('');
  const twist=today.twisted?'<p class="club-day-note">Alguien ha soltado un giro: hoy ganará la segunda opción.</p>':story.twist&&today.mine!=null?`<button type="button" data-story-twist="${esc(today.id)}">Soltar mi giro</button>`:'';
  return `<h4>Temporada ${season.number} · Día ${season.day}</h4><ul class="plus-meters">${meter('Dinero',season.money)}${meter('Fama',season.fame)}${meter('Energía',season.energy)}${meter('Líos',season.trouble)}</ul>${past}<article class="club-day-prediction"><h4>${esc(today.title)}</h4><p>${esc(today.body)}</p><ul class="plus-days plus-story">${options}</ul>${twist}<p class="club-day-note">Racha: ${story.streak} · Mejor: ${story.best}. Mañana se sabrá qué pasa.</p></article>`;
 }
 // The latest season shows up in the sede as one line about how the Chota is doing.
 function mood(season){
  if(season.trouble>=70)return 'El Chota anda metido en líos.';
  if(season.energy<=30)return 'El Chota está agotado.';
  if(season.money>=70)return 'Al Chota le sobra el dinero.';
  if(season.money<=30)return 'El Chota está sin un euro.';
  if(season.fame>=70)return 'Al Chota le piden fotos por la calle.';
  return 'El Chota sigue a lo suyo.';
 }
 function syncSede(){
  const season=state?.story?.season;
  document.querySelectorAll('[data-chota-story]').forEach(node=>{node.hidden=!season;if(season)node.textContent=`Temporada ${season.number} · ${mood(season)}`;});
 }
 const views={chota,estado:status,recuerdos:memories,fechas:dates,bote:tabs,radio,juicio:court,reto:weekly,mentira:liar,liga:league,foto:photo,karaoke};
 function view(id){return `${views[id]?.()||''}${notice?`<p class="club-day-note" role="status">${esc(notice)}</p>`:''}`;}
 async function refresh(){
  if(!config.db||!config.getUser?.())return;
  const run=++epoch,[{data,error},story]=await Promise.all([config.db.rpc('get_club_plus'),config.db.rpc('get_club_story')]);
  if(run!==epoch||error)return;
  state={...data,...story.data};syncSede();config.onChange?.();
 }
 async function call(name,args,done=''){
  if(busy)return;busy=true;notice='';
  const {data,error}=await config.db.rpc(name,args);
  busy=false;
  if(error)notice=['PGRST202','42883'].includes(error.code)?'Esta función se está preparando.':error.message||'No se ha podido guardar.';
  else{state={...state,...data};notice=done;syncSede();}
  config.onChange?.();
 }
 function click(event){
  const b=event.target.closest?.('#clubDay button');if(!b||b.disabled)return;
  const d=b.dataset;
  if(d.storyOption)void call('vote_club_story',{p_day:d.storyDay,p_option:Number(d.storyOption)},'Voto guardado');
  if(d.storyTwist)void call('use_club_story_twist',{p_day:d.storyTwist},'Giro soltado');
  if(d.plusDay)void call('toggle_date_vote',{p_poll:d.plusDay,p_day:d.dayValue});
  if(d.plusChoose)void call('choose_poll_date',{p_poll:d.plusChoose,p_day:d.dayValue},'Fecha elegida');
  if(d.plusSettle)void call('settle_club_tab',{p_tab:d.plusSettle},'Bote cerrado');
  if(d.plusSong)void call('vote_club_song',{p_song:d.plusSong});
  if(d.plusTrial)void call('vote_club_trial',{p_trial:d.plusTrial,p_guilty:d.guilty==='true'});
  if(d.plusEntry)void call('toggle_challenge_vote',{p_author:d.plusEntry});
  if(d.plusExpense)void call('delete_tab_expense',{p_expense:d.plusExpense},'Gasto borrado');
  if(d.plusMatch)void call('delete_club_match',{p_match:d.plusMatch},'Partida borrada');
  if(d.plusKaraoke)void call('vote_karaoke',{p_author:d.plusKaraoke});
  if(d.plusLie)void call('guess_club_lie',{p_id:d.plusLie,p_guess:Number(d.guess)});
 }
 function submit(event){
  const form=event.target.closest?.('[data-plus-form]');if(!form)return;
  event.preventDefault();
  const f=new FormData(form),kind=form.dataset.plusForm;
  if(kind==='status')void call('set_club_status',{p_body:String(f.get('body'))},'Estado guardado');
  if(kind==='trial')void call('open_club_trial',{p_accused:String(f.get('accused')),p_charge:String(f.get('charge'))},'Juicio abierto');
  if(kind==='defence')void call('defend_club_trial',{p_trial:form.dataset.trial,p_defence:String(f.get('body'))},'Defensa guardada');
  if(kind==='entry')void call('enter_club_challenge',{p_body:String(f.get('body'))},'Reto guardado');
  if(kind==='lie')void call('create_club_lie',{p_claims:[f.get('c0'),f.get('c1'),f.get('c2')].map(String),p_lie:Number(f.get('lie'))},'Publicado');
  if(kind==='match'){
   if(f.get('winner')===f.get('loser')){notice='Elige dos personas distintas.';return config.onChange?.();}
   void call('record_club_match',{p_game:String(f.get('game')),p_winner:String(f.get('winner')),p_loser:String(f.get('loser'))},'Partida apuntada');
  }
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
 async function upload(event){
  const input=event.target.closest?.('[data-plus-file]'),file=input?.files?.[0];if(!file)return;
  const kind=input.dataset.plusFile;
  if(busy)return;busy=true;notice='';config.onChange?.();
  try{
   const url=await config.upload(file,kind==='photo'?'club-foto':'club-karaoke');
   busy=false;
   await call(kind==='photo'?'post_day_photo':'post_karaoke',{p_url:url},kind==='photo'?'Foto subida':'Audio subido');
  }catch(error){busy=false;notice=error?.message||'No se ha podido subir.';config.onChange?.();}
 }
 function reset(){epoch++;state=null;notice='';busy=false;}
 function init(options){config=options;document.addEventListener('click',click);document.addEventListener('submit',submit);document.addEventListener('change',upload);}
 globalThis.ClubPlus={init,refresh,reset,view,ready:()=>Boolean(state),clearNotice(){notice='';},statusFor:id=>state?.statuses?.[id]||'',snapshot:()=>state};
})();
