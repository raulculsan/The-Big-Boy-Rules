/* Daily club play on Inicio. Votes, results and coins come only from authenticated RPCs. */
(() => {
 'use strict';
 const tabs=[['pregunta','Pregunta'],['quien','Quién es'],['porra','Porra'],['premios','Premios'],['ranking','Ranking'],['duelos','Duelos'],['carta','Carta'],['capsula','Cápsula'],['ano','Mi año']];
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
 let painted={},lastRefresh=0,config={},cache=null,extras=null,whois=null,guesses={},owner=null,tab='pregunta',busy=false,notice='',failed='',epoch=0,draft=false,duelRival=null,duelAnswer=null;
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
  return `<div class="club-day-cards">${cards.map(c=>`<button type="button" ${attr}="${esc(c.id)}"><img src="${esc(c.thumb)}" alt="" loading="lazy"><span>${esc(c.name)}</span><b>${c.score}</b></button>`).join('')}</div>`;
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
  const c=extras.capsules,min=new Date(Date.now()+7*864e5).toISOString().slice(0,10);
  const opened=c.opened.map(o=>`<article class="club-day-award"><h4>${esc(nameOf(o.author))}</h4><p class="club-day-message">${esc(o.body)}</p><p class="club-day-note">Escrito el ${esc(String(o.created_at).slice(0,10).split('-').reverse().join('/'))}</p></article>`).join('');
  const form=c.mine.length<3?`<form class="club-day-form" data-day-capsule><label>Mensaje para el futuro<textarea name="body" rows="3" maxlength="500" required></textarea></label><label>Se abre el<input name="opens" type="date" min="${min}" required></label><div><button type="submit" class="club-day-action">Sellar</button></div></form>`:'<p class="club-day-note">Ya tienes 3 cápsulas selladas.</p>';
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
 function paint(node,tabsMarkup,view){
  if(!node.firstElementChild?.matches('.club-day-tabs')){
   node.innerHTML='<div class="club-day-tabs"></div><div class="club-day-body"></div><p class="club-day-notice" role="status"></p>';
   painted={};
  }
  if(painted.tabs!==tabsMarkup)node.firstElementChild.outerHTML=painted.tabs=tabsMarkup;
  if(painted.view!==view)node.querySelector('.club-day-body').innerHTML=painted.view=view;
  node.querySelector('.club-day-notice').textContent=notice;
  node.classList.toggle('is-busy',busy);
 }
 function render(){
  renderEntry(owner===actor()?cache:null);
  const node=host();if(!node)return;
  const data=owner===actor()?cache:null;
  if(!data){painted={};node.hidden=!failed;node.innerHTML=failed?`<p class="club-day-note">${esc(failed)}</p><button type="button" class="club-day-action is-quiet" data-day-retry>Reintentar</button>`:'';return;}
  node.hidden=false;
  const extra=['duelos','carta','capsula','ano'].includes(tab);
  if((extra&&!extras)||(tab==='quien'&&!whois))tab='pregunta';
  const view={pregunta:question,quien,porra,premios,ranking,duelos,carta,capsula,ano}[tab](data);
  paint(node,`<div class="club-day-tabs" role="tablist">${tabs.filter(([id])=>id==='quien'?whois:extras||!['duelos','carta','capsula','ano'].includes(id)).map(([id,label])=>`<button type="button" role="tab" data-day-tab="${id}" aria-selected="${tab===id}">${label}</button>`).join('')}</div>`,view);
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
 function reset(){epoch++;painted={};lastRefresh=0;cache=null;extras=null;whois=null;guesses={};owner=null;tab='pregunta';busy=false;notice='';failed='';draft=false;duelRival=null;duelAnswer=null;render();}
 function publish(form){
  const fields=new FormData(form),options=String(fields.get('options')).split('\n').map(s=>s.trim()).filter(Boolean),closes=new Date(String(fields.get('closes')));
  if(Number.isNaN(closes.getTime())){notice='Pon una fecha de cierre válida.';return render();}
  draft=false;
  void call('create_club_prediction',{p_question:String(fields.get('question')).trim(),p_options:options,p_closes_at:closes.toISOString()},'Porra publicada');
 }
 function click(event){
  if(event.target.closest('#clubDayEntry')&&Date.now()-lastRefresh>3e4)void refresh();
  const b=event.target.closest('#clubDay button');if(!b||b.disabled||busy)return;
  const d=b.dataset;
  if(d.dayTab){tab=d.dayTab;notice='';duelRival=null;duelAnswer=null;return render();}
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
