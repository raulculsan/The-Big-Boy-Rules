/* Daily club play on Inicio. Votes, results and coins come only from authenticated RPCs. */
(() => {
 'use strict';
 const tabs=[['chota','El Chota'],['pregunta','Pregunta'],['estado','Estado'],['recuerdos','Recuerdos'],['foto','Foto'],['quien','Quién es'],['mentira','Mentira'],['juicio','Tribunal'],['reto','Reto'],['karaoke','Karaoke'],['duelos','Duelos'],['porra','Porra'],['liga','Liga'],['fechas','Fechas'],['bote','Bote'],['radio','Radio'],['carta','Carta'],['capsula','Cápsula'],['premios','Premios'],['ranking','Ranking'],['ano','Mi año'],['mapa','Mapa']];
 const groups=[['hoy','Hoy',['chota','pregunta','estado','recuerdos','foto']],['juegos','Juegos',['quien','mentira','juicio','reto','karaoke','duelos','porra','liga']],['grupo','Grupo',['fechas','bote','radio','carta','capsula','premios','ranking','ano','mapa']]];
 const plusTabs=['chota','estado','recuerdos','fechas','bote','radio','juicio','reto','mentira','liga','foto','karaoke'];
 // Each activity is a tile with its own icon and tint; the hub replaces the old tab rows.
 const icons={
  chota:'<path d="M5 4l3 4h8l3-4v9a7 7 0 0 1-14 0z"/><path d="M9.5 13h.01M14.5 13h.01"/>',
  pregunta:'<path d="M4 5h16v11H9l-5 4z"/><path d="M10 9a2 2 0 1 1 3 1.7c-.6.4-1 .8-1 1.3M12 14h.01"/>',
  estado:'<circle cx="12" cy="12" r="9"/><path d="M8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
  recuerdos:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2"/>',
  foto:'<path d="M4 7h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3"/>',
  quien:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  mentira:'<path d="M3 12s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6z"/><path d="M4 4l16 16"/>',
  juicio:'<path d="M14 4l6 6M11 7l6 6M12.5 5.5l-6 6 3 3 6-6M8 14l-5 5M4 21h9"/>',
  reto:'<path d="M5 21V4h11l-2 4 2 4H5"/>',
  karaoke:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4"/>',
  duelos:'<path d="M4 4l9 9M4 4h4M4 4v4M20 4l-9 9M20 4h-4M20 4v4M7 17l-3 3M17 17l3 3M9 15l-2 2M15 15l2 2"/>',
  porra:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12h.01"/>',
  liga:'<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M10 17h4"/>',
  fechas:'<path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"/>',
  bote:'<circle cx="12" cy="12" r="9"/><path d="M14.8 8.5h-4a2 2 0 0 0 0 4h2.4a2 2 0 0 1 0 4H9M12 6v12"/>',
  radio:'<path d="M4 9h16v11H4zM7 9l10-5M14 13h3M14 16h3"/><circle cx="9" cy="14.5" r="1.5"/>',
  carta:'<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M10 8h4M10 12h4"/>',
  capsula:'<path d="M7 3h10M7 21h10M8 3v3l4 6-4 6v3M16 3v3l-4 6 4 6v3"/>',
  premios:'<circle cx="12" cy="8" r="5"/><path d="M8.5 12 7 21l5-3 5 3-1.5-9"/>',
  ranking:'<path d="M5 20v-8M12 20V5M19 20v-6"/>',
  ano:'<path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/>',
  mapa:'<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/>'
 };
 const hues={chota:25,pregunta:210,estado:145,recuerdos:270,foto:330,quien:235,mentira:5,juicio:285,reto:175,karaoke:320,duelos:15,porra:195,liga:255,fechas:350,bote:150,radio:300,carta:220,capsula:185,premios:265,ranking:205,ano:340,mapa:160};
 const blurbs={chota:'Decide qué hace hoy',estado:'Cuenta cómo estás',recuerdos:'Tal día como hoy',foto:'Hora sorpresa',quien:'Adivina quién lo dijo',mentira:'Dos verdades y una mentira',juicio:'El club juzga',reto:'Reto de la semana',karaoke:'Canta y vota',duelos:'Carta contra carta',porra:'Apuesta y acierta',liga:'Partidas del club',fechas:'Elige fecha para un plan',bote:'Quién debe a quién',radio:'Canción de la semana',carta:'La carta de la semana',capsula:'Mensajes al futuro',premios:'Votos del mes',ranking:'Los que más aciertan',ano:'Tu resumen del año',mapa:'Pasaporte del club'};
 const icon=(id,size='')=>`<span class="cd-icon${size}" style="--cd-hue:${hues[id]||210}" aria-hidden="true"><svg viewBox="0 0 24 24">${icons[id]||''}</svg></span>`;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
 let painted={},lastRefresh=0,config={},cache=null,extras=null,whois=null,guesses={},owner=null,tab=null,busy=false,notice='',failed='',epoch=0,draft=false,duelRival=null,duelAnswer=null;
 const host=()=>document.getElementById('clubDay');
 const actor=()=>config.getUser?.()?.id||null;
 const person=id=>config.getMember?.(id)||null;
 const nameOf=id=>person(id)?.name||'Miembro';
 const people=()=>(config.getMembers?.()||[]).filter(m=>m.authId&&m.authId!==actor());
 const plural=(n,one,many)=>`${n} ${n===1?one:many}`;
 const closeLabel=value=>{
  const date=new Date(value);
  return `Cierra el ${date.getDate()} de ${months[date.getMonth()]} a las ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
 };
 function chooser(attr,selected=null,category=''){
  return `<div class="club-day-people">${people().map(m=>`<button type="button" ${attr}="${esc(m.authId)}"${category?` data-day-category="${esc(category)}"`:''} aria-pressed="${m.authId===selected}">${config.avatar(m)}<span>${esc(m.name)}</span></button>`).join('')}</div>`;
 }
 function question(data){
  const q=data.question;
  if(!q.results)return `<h4>${esc(q.prompt)}</h4><p class="club-day-note">Vota para ver qué piensa el club. +3 monedas.</p>${chooser('data-day-answer')}`;
  const top=Math.max(1,...q.results.map(r=>r.votes));
  return `<h4>${esc(q.prompt)}</h4><ul class="club-day-results">${q.results.map(r=>`<li class="${r.id===q.pick?'is-own':''}"><span>${esc(nameOf(r.id))}</span><b>${r.votes}</b><i style="--share:${Math.round(r.votes/top*100)}%"></i></li>`).join('')}</ul><p class="club-day-note">${plural(q.total,'voto','votos')} hoy. Mañana, otra pregunta.</p>`;
 }
 function prediction(p){
  const total=(p.counts||[]).reduce((sum,n)=>sum+n,0);
  const options=p.options.map((option,index)=>{
   const count=p.counts?.[index],own=p.pick===index,right=p.correct===index;
   return `<button type="button" data-day-pick="${esc(p.id)}" data-day-option="${index}" aria-pressed="${own}" class="${right?'is-right':''}"${p.closed?' disabled':''}><span>${esc(option)}</span>${count===undefined?'':`<b>${total?Math.round(count/total*100):0} %</b>`}</button>`;
  }).join('');
  const won=p.resolved&&p.pick===p.correct;
  const foot=won&&!p.claimed?`<button type="button" class="club-day-action" data-day-claim="${esc(p.id)}">Cobrar 15 monedas</button>`
   :won?'<p class="club-day-note">Acertaste. Premio cobrado.</p>'
   :p.resolved?'<p class="club-day-note">Resultado publicado.</p>'
   :p.closed?'<p class="club-day-note">Cerrada. Falta el resultado.</p>'
   :`<p class="club-day-note">${esc(closeLabel(p.closes_at))}. Acertar da 15 monedas.</p>`;
  const manage=config.canManage?.()&&!p.resolved?`<details class="club-day-manage"><summary>Publicar resultado</summary>${p.options.map((option,index)=>`<button type="button" data-day-resolve="${esc(p.id)}" data-day-option="${index}">${esc(option)}</button>`).join('')}</details>`:'';
  return `<article class="club-day-prediction"><h4>${esc(p.question)}</h4><div class="club-day-options">${options}</div>${foot}${manage}</article>`;
 }
 function composer(){
  if(!config.canManage?.())return '';
  if(!draft)return '<button type="button" class="club-day-action is-quiet" data-day-compose>Nueva porra</button>';
  return `<form class="club-day-form" data-day-form><label>Pregunta<input name="question" required minlength="3" maxlength="140"></label><label>Opciones, una por línea<textarea name="options" rows="3" required></textarea></label><label>Cierra<input name="closes" type="datetime-local" required></label><div><button type="submit" class="club-day-action">Publicar</button><button type="button" class="club-day-action is-quiet" data-day-compose>Cancelar</button></div></form>`;
 }
 function porra(data){
  const list=data.predictions.map(prediction).join('');
  return `${list||'<p class="club-day-note">No hay ninguna porra abierta.</p>'}${composer()}`;
 }
 function premios(data){
  const month=months[Number(String(data.awards.month).slice(5,7))-1];
  const rows=data.awards.categories.map(c=>`<article class="club-day-award"><h4>${esc(c.title)}</h4>${c.winners.length?`<p class="club-day-note">El mes pasado: ${esc(c.winners.map(nameOf).join(', '))}</p>`:''}${chooser('data-day-vote',c.vote,c.id)}</article>`).join('');
  return `<p class="club-day-note">Votos de ${esc(month)}. Son anónimos y el ganador se ve el mes que viene. Votar todos da 10 monedas.</p>${rows}`;
 }
 function ranking(data){
  const rows=data.ranking.map((r,index)=>`<li><b>${index+1}</b><span>${esc(nameOf(r.id))}</span><small>${plural(r.hits,'acierto','aciertos')} · ${plural(r.streak,'día','días')}</small></li>`).join('');
  return `<ol class="club-day-ranking">${rows}</ol><p class="club-day-note">Tu mejor racha: ${plural(data.best_streak,'día','días')}.</p>`;
 }
 function cardPicker(attr){
  const cards=extras.cards;
  if(!cards.length)return '<p class="club-day-note">Necesitas una carta con puntuación para jugar.</p>';
  return `<div class="club-day-cards">${cards.map(c=>`<button type="button" ${attr}="${esc(c.id)}"><img src="${esc(c.thumb)}" alt="" decoding="async"><span>${esc(c.name)}</span><b>${c.score}</b></button>`).join('')}</div>`;
 }
 function duelRow(d){
  const rival=esc(nameOf(d.opponent));
  if(d.incoming)return `<article class="club-day-award"><h4>${rival} te reta</h4>${duelAnswer===d.id?`<p class="club-day-note">Elige tu carta. Su carta sigue oculta.</p>${cardPicker('data-day-duel-card')}`:`<button type="button" class="club-day-action" data-day-duel-open="${esc(d.id)}">Responder</button>`}</article>`;
  if(d.waiting)return `<article class="club-day-award"><h4>Esperando a ${rival}</h4><p class="club-day-note">Has jugado ${esc(d.mine?.name)}.</p></article>`;
  const won=d.winner===actor(),tie=!d.winner;
  const claim=won&&!d.claimed?`<button type="button" class="club-day-action" data-day-duel-claim="${esc(d.id)}">Cobrar premio</button>`:'';
  return `<article class="club-day-award"><h4>${tie?'Empate':won?'Ganaste':'Perdiste'} contra ${rival}</h4><p class="club-day-note">${esc(d.mine?.name)} (${d.mine?.score}) contra ${esc(d.theirs?.name)} (${d.theirs?.score})</p>${claim}</article>`;
 }
 function duelos(){
  const list=extras.duels.map(duelRow).join('');
  const launch=duelRival?`<h4>Tu carta contra ${esc(nameOf(duelRival))}</h4>${cardPicker('data-day-duel-new')}`:`<h4>Reta a alguien</h4><p class="club-day-note">Gana la carta con más puntos. No se pierde ninguna carta. Una victoria al día da 10 monedas.</p>${chooser('data-day-duel-rival')}`;
  return `${launch}${list}`;
 }
 function carta(){
  const c=extras.week_card;
  if(!c)return '<p class="club-day-note">Esta semana no hay carta.</p>';
  const foot=c.claimed?'<p class="club-day-note">Premio cobrado esta semana.</p>':c.owned?`<button type="button" class="club-day-action" data-day-week-claim>Cobrar 10 monedas</button>`:'<p class="club-day-note">Consíguela esta semana para cobrar 10 monedas.</p>';
  return `<div class="club-day-week"><img src="${esc(c.thumb)}" alt=""><div><h4>${esc(c.name)}</h4><p class="club-day-note">${c.owners===1?'La tiene 1 miembro':`La tienen ${c.owners} miembros`}</p>${foot}</div></div>`;
 }
 function capsula(){
  const c=extras.capsules,min=new Date(Date.now()+7*864e5).toISOString().slice(0,10),yearEnd=`${new Date().getFullYear()}-12-31`;
  const opened=c.opened.map(o=>`<article class="club-day-award"><h4>${esc(nameOf(o.author))}</h4><p class="club-day-message">${esc(o.body)}</p><p class="club-day-note">Escrito el ${esc(String(o.created_at).slice(0,10).split('-').reverse().join('/'))}</p></article>`).join('');
  const form=c.mine.length<3?`<form class="club-day-form" data-day-capsule><label>Mensaje o predicción para el futuro<textarea name="body" rows="3" maxlength="500" required></textarea></label><label>Se abre el<input name="opens" type="date" min="${min}" value="${esc(yearEnd>min?yearEnd:'')}" required></label><div><button type="submit" class="club-day-action">Sellar</button></div></form>`:'<p class="club-day-note">Ya tienes 3 cápsulas selladas.</p>';
  return `<p class="club-day-note">Lo verá todo el club cuando llegue la fecha. Hasta entonces, nadie puede leerlo. ${plural(c.sealed,'cápsula sellada','cápsulas selladas')}.</p>${form}${opened}`;
 }
 function ano(){
  const y=extras.year;
  const rows=[['Preguntas respondidas',y.answers],['Mejor racha',plural(y.best_streak,'día','días')],['Porras acertadas',y.hits],['Duelos ganados',y.duels_won],['Premios ganados',y.awards_won],['Monedas ganadas',y.coins],['Cartas nuevas',y.cards],['Sobres abiertos',y.packs]];
  return `<h4>Tu ${y.year} en el club</h4><dl class="club-day-year">${rows.map(([label,value])=>`<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;
 }
 function timeLeft(value){
  const hours=Math.max(1,Math.ceil((new Date(value)-Date.now())/36e5));
  return hours<48?plural(hours,'hora','horas'):plural(Math.ceil(hours/24),'día','días');
 }
 function whoisLast(last){
  if(!last)return '';
  const scores=last.scores.map(r=>`${esc(nameOf(r.id))} ${r.score}/${r.total}`).join(' · ');
  return `<article class="club-day-award"><h4>Ronda anterior: ${esc(last.prompt)}</h4><ul class="club-day-whois">${last.answers.map(a=>`<li><p>${esc(a.body)}</p><small>${esc(nameOf(a.author))}</small></li>`).join('')}</ul>${scores?`<p class="club-day-note">${scores}</p>`:''}</article>`;
 }
 function quien(){
  const r=whois.round;let body;
  if(r.phase==='answer')body=`<p class="club-day-note">${plural(r.answered,'respuesta','respuestas')}. Quedan ${timeLeft(r.until)} para responder. Luego tocará adivinar de quién es cada una. Responder da 3 monedas.</p><form class="club-day-form" data-day-whois><label>Tu respuesta<textarea name="body" rows="2" maxlength="140" required>${esc(r.own||'')}</textarea></label><div><button type="submit" class="club-day-action">${r.own?'Cambiar':'Enviar'}</button></div></form>`;
  else if(r.guessed)body=`<p class="club-day-note">Has acertado ${r.guessed.score} de ${r.guessed.total}. Los autores se ven en ${timeLeft(r.until)}.</p>`;
  else if(!r.answers.length)body=`<p class="club-day-note">Esta ronda no tiene respuestas para ti. Termina en ${timeLeft(r.until)}.</p>`;
  else body=`<p class="club-day-note">¿De quién es cada respuesta? Solo tienes un intento. Cada acierto da 2 monedas. Quedan ${timeLeft(r.until)}.</p><form class="club-day-form" data-day-guess>${r.answers.map(a=>`<label><span class="club-day-message">${esc(a.body)}</span><select name="${esc(a.id)}" required><option value="">Elige</option>${r.authors.map(id=>`<option value="${esc(id)}"${guesses[a.id]===id?' selected':''}>${esc(nameOf(id))}</option>`).join('')}</select></label>`).join('')}<div><button type="submit" class="club-day-action">Enviar</button></div></form>`;
  return `<h4>${esc(r.prompt)}</h4>${body}${whoisLast(whois.last)}`;
 }
 function pending(data){
  const round=whois?.round;
  return [!data.question.results,round?.phase==='answer'&&!round.own,round?.phase==='guess'&&!round.guessed&&round.answers.length>0,
   ...data.predictions.map(p=>(!p.closed&&p.pick===null)||(p.resolved&&p.pick===p.correct&&!p.claimed)),
   ...(extras?.duels||[]).map(d=>d.incoming||(d.winner===actor()&&!d.claimed))].filter(Boolean).length;
 }
 function renderEntry(data){
  const entry=document.getElementById('clubDayEntry');if(!entry)return;
  const small=entry.querySelector('small'),cacheKey=`bb-club-day-entry-${actor()}`;
  if(!data){
   // Last known status keeps the button from changing a moment after opening.
   try{small.textContent=localStorage.getItem(cacheKey)||'Pregunta, porra y más';}catch{small.textContent='Pregunta, porra y más';}
   return;
  }
  const left=pending(data),streak=`${plural(data.streak,'día','días')} de racha`;
  small.textContent=left?`${plural(left,'cosa pendiente','cosas pendientes')} · ${streak}`:streak;
  try{localStorage.setItem(cacheKey,small.textContent);}catch{}
 }
 // Only what changed is rebuilt, so a half-written answer survives a notice or a reply.
 function paint(node,head,view){
  if(!node.querySelector('.club-day-head')){
   node.innerHTML='<div class="club-day-head"></div><div class="club-day-body"></div><p class="club-day-notice" role="status"></p>';
   painted={};
  }
  if(painted.head!==head)node.querySelector('.club-day-head').innerHTML=painted.head=head;
  if(painted.view!==view)node.querySelector('.club-day-body').innerHTML=painted.view=view;
  node.querySelector('.club-day-notice').textContent=notice;
  node.classList.toggle('is-busy',busy);
 }
 function available(id){
  if(id==='mapa')return true;
  if(plusTabs.includes(id))return Boolean(globalThis.ClubPlus?.ready());
  if(id==='quien')return Boolean(whois);
  return Boolean(extras)||!['duelos','carta','capsula','ano'].includes(id);
 }
 // What the tile says about today, and whether something waits for this member.
 function state(id,data){
  const plus=globalThis.ClubPlus?.snapshot?.()||{},round=whois?.round,me=actor();
  switch(id){
   case 'pregunta':return data.question.results?{note:`Votado · ${plural(data.question.total,'voto','votos')}`,done:true}:{note:data.question.prompt,todo:true,reward:3};
   case 'chota':{const t=plus.story?.today;return t?(t.mine==null?{note:t.title,todo:true}:{note:'Ya has votado',done:true}):{note:blurbs.chota};}
   case 'estado':{const own=globalThis.ClubPlus?.statusFor?.(me);return own?{note:own,done:true}:{note:blurbs.estado};}
   case 'foto':{const f=plus.photo||{};return !f.opens_at?{note:'Aún no ha salido'}:f.own?{note:'Subida',done:true}:{note:f.on_time?'¡Es la hora!':'Ya ha salido',todo:true};}
   case 'quien':return !round?{note:blurbs.quien}:round.phase==='answer'?(round.own?{note:'Respondido',done:true}:{note:'Toca responder',todo:true,reward:3}):round.guessed?{note:`${round.guessed.score} de ${round.guessed.total} aciertos`,done:true}:round.answers.length?{note:'Toca adivinar',todo:true}:{note:blurbs.quien};
   case 'porra':{const open=data.predictions.filter(p=>!p.closed&&p.pick===null).length,claim=data.predictions.some(p=>p.resolved&&p.pick===p.correct&&!p.claimed);return claim?{note:'Tienes un premio',todo:true,reward:15}:open?{note:plural(open,'porra abierta','porras abiertas'),todo:true,reward:15}:{note:blurbs.porra};}
   case 'duelos':{const d=extras?.duels||[],incoming=d.filter(x=>x.incoming).length,claim=d.some(x=>x.winner===me&&!x.claimed);return claim?{note:'Cobra tu victoria',todo:true,reward:10}:incoming?{note:`${incoming===1?'Te reta alguien':`${incoming} te retan`}`,todo:true}:{note:blurbs.duelos};}
   case 'carta':{const c=extras?.week_card;return c?(c.claimed?{note:c.name,done:true}:c.owned?{note:'Cobra 10 monedas',todo:true,reward:10}:{note:c.name}):{note:blurbs.carta};}
   default:return {note:blurbs[id]||''};
  }
 }
 const today=new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'numeric',month:'long'});
 function hub(data){
  const shown=groups.map(([key,label,ids])=>[key,label,ids.filter(available)]);
  const all=shown.flatMap(g=>g[2]).map(id=>[id,state(id,data)]),todo=all.filter(([,s])=>s.todo).length,done=all.filter(([,s])=>s.done).length;
  const ratio=done+todo?Math.round(done/(done+todo)*100):100;
  const name=id=>tabs.find(t=>t[0]===id)?.[1]||id;
  const hero=`<header class="cd-hero"><div class="cd-streak"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.6 1 2.5 2 3 0-3 0-5.5 1-8.5z"/></svg><b>${data.streak}</b><small>${data.streak===1?'día':'días'}</small></div><div class="cd-hero-copy"><span>${esc(today.format(new Date()).replace(/^./,c=>c.toUpperCase()))}</span><strong>${todo?plural(todo,'cosa pendiente','cosas pendientes'):'Todo hecho por hoy'}</strong><div class="cd-progress" role="progressbar" aria-label="Hecho hoy" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${ratio}"><i style="width:${ratio}%"></i></div></div></header>`;
  const row=id=>{const s=state(id,data);return `<button type="button" class="cd-row${s.todo?' is-todo':''}${s.done?' is-done':''}" data-day-tab="${id}">${icon(id)}<span class="cd-row-copy"><strong>${esc(name(id))}</strong><small>${esc(s.note)}</small></span>${s.done?'<span class="cd-check" aria-label="Hecho"><svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg></span>':s.reward?`<span class="cd-reward">+${s.reward}</span>`:s.todo?'<i class="cd-dot is-inline" aria-label="Pendiente"></i>':'<svg class="cd-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>'}</button>`;};
  const tile=id=>{const s=state(id,data);return `<button type="button" class="cd-tile${s.todo?' is-todo':''}" data-day-tab="${id}">${icon(id,' is-large')}<strong>${esc(name(id))}</strong><small>${esc(s.note)}</small>${s.todo?'<i class="cd-dot" aria-label="Pendiente"></i>':''}</button>`;};
  const [first,...rest]=shown;
  return `${hero}${first[2].length?`<section class="cd-section"><h3>${esc(first[1]==='Hoy'?'Para hoy':first[1])}</h3><div class="cd-list">${first[2].map(row).join('')}</div></section>`:''}${rest.filter(g=>g[2].length).map(g=>`<section class="cd-section"><h3>${esc(g[0]==='grupo'?'El grupo':g[1])}</h3><div class="cd-grid">${g[2].map(tile).join('')}</div></section>`).join('')}`;
 }
 function render(){
  renderEntry(owner===actor()?cache:null);
  const node=host();if(!node)return;
  const data=owner===actor()?cache:null;
  if(!data){painted={};node.hidden=!failed;node.innerHTML=failed?`<p class="club-day-note">${esc(failed)}</p><button type="button" class="club-day-action is-quiet" data-day-retry>Reintentar</button>`:'';return;}
  node.hidden=false;
  if(tab&&!available(tab))tab=null;
  node.classList.toggle('is-hub',!tab);
  if(!tab)return paint(node,'',hub(data));
  const view=plusTabs.includes(tab)?globalThis.ClubPlus.view(tab):{pregunta:question,quien,porra,premios,ranking,duelos,carta,capsula,ano}[tab](data);
  const label=tabs.find(t=>t[0]===tab)?.[1]||'';
  paint(node,`<div class="cd-detail-head"><button type="button" class="cd-back" data-day-home aria-label="Volver a Hoy en el club"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button>${icon(tab)}<div><strong>${esc(label)}</strong><small>${esc(state(tab,data).note)}</small></div></div>`,view);
 }
 function message(error){return ['PGRST202','42883','42P01'].includes(error?.code)?'Esta sección se está preparando.':error?.message||'No hemos podido conectar con el club.';}
 async function call(name,args={},done=''){
  if(busy)return;
  const run=epoch;busy=true;notice='';render();
  try{
   const {data,error}=await config.db.rpc(name,args);
   if(error)throw error;
   if(run!==epoch)return;
   if(data?.round)whois=data;else if(Array.isArray(data?.cards))extras=data;else cache=data;
   owner=actor();failed='';
   const earned=Number(data?.earned)||0;
   notice=earned?`+${earned} monedas`:done;
   if(earned)await config.refreshWallet?.();
  }catch(error){if(run===epoch)notice=message(error);}
  finally{if(run===epoch){busy=false;render();}}
 }
 async function refresh(){
  if(!config.db||!actor())return;
  const run=++epoch;busy=false;lastRefresh=Date.now();
  try{
   const [day,more,who]=await Promise.all([config.db.rpc('get_club_day'),config.db.rpc('get_club_extras'),config.db.rpc('get_club_whois')]);
   if(day.error)throw day.error;
   if(run!==epoch)return;
   cache=day.data;extras=more.error?null:more.data;whois=who.error?null:who.data;owner=actor();failed='';
  }catch(error){if(run===epoch){cache=null;failed=['PGRST202','42883','42P01'].includes(error?.code)?'':message(error);}}
  if(run===epoch)render();
 }
 function reset(){epoch++;painted={};lastRefresh=0;cache=null;extras=null;whois=null;guesses={};owner=null;tab=null;busy=false;notice='';failed='';draft=false;duelRival=null;duelAnswer=null;render();}
 function publish(form){
  const fields=new FormData(form),options=String(fields.get('options')).split('\n').map(s=>s.trim()).filter(Boolean),closes=new Date(String(fields.get('closes')));
  if(Number.isNaN(closes.getTime())){notice='Pon una fecha de cierre válida.';return render();}
  draft=false;
  void call('create_club_prediction',{p_question:String(fields.get('question')).trim(),p_options:options,p_closes_at:closes.toISOString()},'Porra publicada');
 }
 function click(event){
  if(event.target.closest('#clubDayEntry')){tab=null;notice='';render();if(Date.now()-lastRefresh>3e4)void refresh();}
  const b=event.target.closest('#clubDay button');if(!b||b.disabled||busy)return;
  const d=b.dataset;
  if('dayHome' in d){tab=null;notice='';render();return scrollTo({top:0});}
  if(d.dayTab==='mapa')return document.querySelector('[data-club-memory-map]')?.click();
  if(d.dayTab){tab=d.dayTab;notice='';globalThis.ClubPlus?.clearNotice();duelRival=null;duelAnswer=null;render();return scrollTo({top:0});}
  if(d.dayDuelRival){duelRival=d.dayDuelRival;return render();}
  if(d.dayDuelOpen){duelAnswer=d.dayDuelOpen;return render();}
  if(d.dayDuelNew){const rival=duelRival;duelRival=null;return void call('create_club_duel',{p_rival:rival,p_card:d.dayDuelNew},'Duelo lanzado');}
  if(d.dayDuelCard){const id=duelAnswer;duelAnswer=null;return void call('answer_club_duel',{p_id:id,p_card:d.dayDuelCard},'Duelo resuelto');}
  if(d.dayDuelClaim)return void call('claim_club_duel',{p_id:d.dayDuelClaim},'Hoy ya cobraste una victoria');
  if('dayWeekClaim' in d)return void call('claim_club_week_card');
  if('dayRetry' in d)return void refresh();
  if('dayCompose' in d){draft=!draft;return render();}
  if(d.dayAnswer)return void call('answer_club_question',{p_pick:d.dayAnswer});
  if(d.dayPick)return void call('pick_club_prediction',{p_id:d.dayPick,p_pick:Number(d.dayOption)},'Porra guardada');
  if(d.dayClaim)return void call('claim_club_prediction',{p_id:d.dayClaim});
  if(d.dayResolve)return void call('resolve_club_prediction',{p_id:d.dayResolve,p_correct:Number(d.dayOption)},'Resultado publicado');
  if(d.dayVote)return void call('vote_club_award',{p_category:d.dayCategory,p_nominee:d.dayVote},'Voto guardado');
 }
 function init(options){
  config=options;
  document.addEventListener('click',click);
  document.addEventListener('change',event=>{
   const pick=event.target.closest?.('[data-day-guess] select');
   if(pick)guesses[pick.name]=pick.value;
  });
  document.addEventListener('submit',event=>{
   const form=event.target.closest?.('[data-day-form]');
   if(form){event.preventDefault();publish(form);}
   const answer=event.target.closest?.('[data-day-whois]');
   if(answer){event.preventDefault();void call('answer_club_whois',{p_body:String(new FormData(answer).get('body'))},'Respuesta guardada');}
   const guess=event.target.closest?.('[data-day-guess]');
   if(guess){event.preventDefault();void call('guess_club_whois',{p_guesses:Object.fromEntries(new FormData(guess))});}
   const capsule=event.target.closest?.('[data-day-capsule]');
   if(capsule){
    event.preventDefault();
    const fields=new FormData(capsule);
    void call('create_club_capsule',{p_body:String(fields.get('body')),p_opens_on:String(fields.get('opens'))},'Cápsula sellada');
   }
  });
 }
 globalThis.ClubDay={init,refresh,reset,paintEntry:render};
})();
