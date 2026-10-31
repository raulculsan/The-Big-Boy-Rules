/* Daily club play on Inicio. Votes, results and coins come only from authenticated RPCs. */
(() => {
 'use strict';
 const tabs=[['pregunta','Pregunta'],['porra','Porra'],['premios','Premios'],['ranking','Ranking']];
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
 let config={},cache=null,owner=null,tab='pregunta',busy=false,notice='',failed='',epoch=0,draft=false;
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
  return `<div class="club-day-people">${people().map(m=>`<button type="button" ${attr}="${esc(m.authId)}"${category?` data-day-category="${esc(category)}"`:''} aria-pressed="${m.authId===selected}"${busy?' disabled':''}>${config.avatar(m)}<span>${esc(m.name)}</span></button>`).join('')}</div>`;
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
   return `<button type="button" data-day-pick="${esc(p.id)}" data-day-option="${index}" aria-pressed="${own}" class="${right?'is-right':''}"${p.closed||busy?' disabled':''}><span>${esc(option)}</span>${count===undefined?'':`<b>${total?Math.round(count/total*100):0} %</b>`}</button>`;
  }).join('');
  const won=p.resolved&&p.pick===p.correct;
  const foot=won&&!p.claimed?`<button type="button" class="club-day-action" data-day-claim="${esc(p.id)}"${busy?' disabled':''}>Cobrar 15 monedas</button>`
   :won?'<p class="club-day-note">Acertaste. Premio cobrado.</p>'
   :p.resolved?'<p class="club-day-note">Resultado publicado.</p>'
   :p.closed?'<p class="club-day-note">Cerrada. Falta el resultado.</p>'
   :`<p class="club-day-note">${esc(closeLabel(p.closes_at))}. Acertar da 15 monedas.</p>`;
  const manage=config.canManage?.()&&!p.resolved?`<details class="club-day-manage"><summary>Publicar resultado</summary>${p.options.map((option,index)=>`<button type="button" data-day-resolve="${esc(p.id)}" data-day-option="${index}"${busy?' disabled':''}>${esc(option)}</button>`).join('')}</details>`:'';
  return `<article class="club-day-prediction"><h4>${esc(p.question)}</h4><div class="club-day-options">${options}</div>${foot}${manage}</article>`;
 }
 function composer(){
  if(!config.canManage?.())return '';
  if(!draft)return '<button type="button" class="club-day-action is-quiet" data-day-compose>Nueva porra</button>';
  return `<form class="club-day-form" data-day-form><label>Pregunta<input name="question" required minlength="3" maxlength="140"></label><label>Opciones, una por línea<textarea name="options" rows="3" required></textarea></label><label>Cierra<input name="closes" type="datetime-local" required></label><div><button type="submit" class="club-day-action"${busy?' disabled':''}>Publicar</button><button type="button" class="club-day-action is-quiet" data-day-compose>Cancelar</button></div></form>`;
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
 function render(){
  const node=host();if(!node)return;
  const data=owner===actor()?cache:null;
  if(!data){node.hidden=!failed;node.innerHTML=failed?`<p class="club-day-note">${esc(failed)}</p><button type="button" class="club-day-action is-quiet" data-day-retry>Reintentar</button>`:'';return;}
  node.hidden=false;
  const view={pregunta:question,porra,premios,ranking}[tab](data);
  node.innerHTML=`<header><h3>Hoy en el club</h3><span class="club-day-streak" aria-label="Racha de ${plural(data.streak,'día','días')}">${plural(data.streak,'día','días')} de racha</span></header><div class="club-day-tabs" role="tablist">${tabs.map(([id,label])=>`<button type="button" role="tab" data-day-tab="${id}" aria-selected="${tab===id}">${label}</button>`).join('')}</div><div class="club-day-body">${view}</div><p class="club-day-notice" role="status">${esc(notice)}</p>`;
 }
 function message(error){return ['PGRST202','42883','42P01'].includes(error?.code)?'Esta sección se está preparando.':error?.message||'No hemos podido conectar con el club.';}
 async function call(name,args={},done=''){
  const run=epoch;busy=true;notice='';render();
  try{
   const {data,error}=await config.db.rpc(name,args);
   if(error)throw error;
   if(run!==epoch)return;
   cache=data;owner=actor();failed='';
   const earned=Number(data?.earned)||0;
   notice=earned?`+${earned} monedas`:done;
   if(earned)await config.refreshWallet?.();
  }catch(error){if(run===epoch)notice=message(error);}
  finally{if(run===epoch){busy=false;render();}}
 }
 async function refresh(){
  if(!config.db||!actor())return;
  const run=++epoch;busy=false;
  try{
   const {data,error}=await config.db.rpc('get_club_day');
   if(error)throw error;
   if(run!==epoch)return;
   cache=data;owner=actor();failed='';
  }catch(error){if(run===epoch){cache=null;failed=['PGRST202','42883','42P01'].includes(error?.code)?'':message(error);}}
  if(run===epoch)render();
 }
 function reset(){epoch++;cache=null;owner=null;tab='pregunta';busy=false;notice='';failed='';draft=false;render();}
 function publish(form){
  const fields=new FormData(form),options=String(fields.get('options')).split('\n').map(s=>s.trim()).filter(Boolean),closes=new Date(String(fields.get('closes')));
  if(Number.isNaN(closes.getTime())){notice='Pon una fecha de cierre válida.';return render();}
  draft=false;
  void call('create_club_prediction',{p_question:String(fields.get('question')).trim(),p_options:options,p_closes_at:closes.toISOString()},'Porra publicada');
 }
 function click(event){
  const b=event.target.closest('#clubDay button');if(!b||b.disabled)return;
  const d=b.dataset;
  if(d.dayTab){tab=d.dayTab;notice='';return render();}
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
  document.addEventListener('submit',event=>{
   const form=event.target.closest?.('[data-day-form]');
   if(form){event.preventDefault();publish(form);}
  });
 }
 globalThis.ClubDay={init,refresh,reset};
})();
