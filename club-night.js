/* La Sala: live games for the people at a plan. Reads poll while open; the server scores everything. */
(() => {
 'use strict';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const games=[['never','Yo nunca'],['likely','Quién es más probable'],['trivia','¿Quién lo dijo?'],['draw','Dibuja y adivina']];
 const emojis=['😂','🔥','😮','👏','💀','❤️'];
 let config={},dialog=null,room=null,state=null,timer=0,epoch=0,busy=false,notice='',shown=new Set(),lastPaint='',strokes=[],line=null,drawing=false;
 const uid=()=>config.getUser?.()?.id;
 const nameOf=id=>id===uid()?'Tú':config.getMember?.(id)?.name||'Miembro';
 const fail=error=>['PGRST202','42883'].includes(error?.code)?'La Sala se está preparando.':error?.message||'No se ha podido completar.';
 const args=()=>({p_event:room.event,p_occurrence:room.occurrence});
 function scores(rows){return rows?.length?`<ul class="night-scores">${rows.map(s=>`<li><span>${esc(nameOf(s.user))}</span><b>${s.points}</b></li>`).join('')}</ul>`:'';}
 function answerArea(r){
  if(r.game==='draw'&&r.drawer===uid())return '<p class="night-note">Dibuja sin escribir letras.</p>';
  if(r.game==='draw')return `<form data-night-guess><label>¿Qué es?<input name="value" maxlength="40" autocomplete="off" value="${esc(r.mine||'')}" required></label><button type="submit">Responder</button></form>`;
  if(r.game==='never')return `<div class="night-options">${[['yes','Yo sí'],['no','Yo no']].map(([v,l])=>`<button type="button" data-night-answer="${v}" aria-pressed="${r.mine===v}">${l}</button>`).join('')}</div>`;
  return `<div class="night-options">${state.people.map(id=>`<button type="button" data-night-answer="${esc(id)}" aria-pressed="${r.mine===id}">${esc(nameOf(id))}</button>`).join('')}</div>`;
 }
 function results(r){
  const line=a=>{
   const value=r.game==='never'?(a.value==='yes'?'Sí':'No'):r.game==='draw'?a.value:nameOf(a.value);
   return `<li><span>${esc(nameOf(a.user))}${value?` · ${esc(value)}`:''}</span>${a.points?`<b>+${a.points}</b>`:''}</li>`;
  };
  return `${r.game==='trivia'?`<p class="night-note">Lo dijo ${esc(nameOf(r.author))}.</p>`:''}${r.game==='draw'?`<p class="night-note">Era ${esc(r.prompt)}.</p>`:''}<ul class="night-scores">${r.results.map(line).join('')}</ul>`;
 }
 function round(r){
  if(!r)return '';
  const heading=games.find(g=>g[0]===r.game)?.[1]||'';
  const open=!r.revealed,total=state.people.length-(r.game==='draw'?1:0);
  const prompt=r.prompt?`<p class="night-prompt">${esc(r.game==='trivia'?`«${r.prompt}»`:r.prompt)}</p>`:'';
  const canvas=r.game==='draw'?`<canvas class="night-canvas" width="600" height="600" data-night-canvas="${r.drawer===uid()&&open?'own':'view'}" aria-label="Dibujo de ${esc(nameOf(r.drawer))}"></canvas>`:'';
  return `<article class="night-round"><h3>${esc(heading)}</h3>${prompt}${canvas}${open?`${answerArea(r)}<p class="night-note">${r.answered} de ${total} han respondido.</p><button type="button" data-night-reveal>Revelar ya</button>`:results(r)}</article>`;
 }
 function paint(force=false){
  if(!dialog||!state)return;
  const focus=document.activeElement;
  if(!force&&dialog.contains(focus)&&focus.matches('input'))return drawCanvas();
  const key=JSON.stringify({...state,reactions:null,round:state.round&&{...state.round,strokes:null},notice});
  if(!force&&key===lastPaint)return drawCanvas();
  lastPaint=key;
  const body=dialog.querySelector('.night-body'),r=state.round,open=r&&!r.revealed,recap=state.recap;
  if(recap){body.innerHTML=`<article class="night-round"><h3>Ganador: ${esc(nameOf(recap.winner))}</h3>${recap.highlight?`<p class="night-note">Mejor momento: ${esc(recap.highlight)}</p>`:''}${scores(recap.scores)}<p class="night-note">Guardado en Recuerdos.</p></article>`;return;}
  body.innerHTML=`${round(r)}${open?'':`<section class="night-picker"><h3>${r?'Siguiente juego':'Elige un juego'}</h3><div class="night-options">${games.map(([id,label])=>`<button type="button" data-night-game="${id}">${label}</button>`).join('')}</div></section>`}
  ${state.scores.length?`<section><h3>Marcador</h3>${scores(state.scores)}</section>`:''}
  <div class="night-reactions">${emojis.map(e=>`<button type="button" data-night-emoji="${e}" aria-label="Reaccionar ${e}">${e}</button>`).join('')}</div>
  ${state.scores.length&&!open?'<button type="button" data-night-finish>Terminar la Sala</button>':''}
  ${notice?`<p class="night-note" role="status">${esc(notice)}</p>`:''}`;
  drawCanvas();
 }
 function drawCanvas(){
  const canvas=dialog?.querySelector('[data-night-canvas]');if(!canvas)return;
  const own=canvas.dataset.nightCanvas==='own',list=own?strokes:state.round?.strokes||[],ctx=canvas.getContext('2d');
  ctx.fillStyle='#f4f5f7';ctx.fillRect(0,0,600,600);ctx.strokeStyle='#14161a';ctx.lineWidth=7;ctx.lineCap='round';ctx.lineJoin='round';
  for(const stroke of list){ctx.beginPath();stroke.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
 }
 function float(items){
  const layer=dialog?.querySelector('.night-float');if(!layer)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  for(const item of items){
   if(shown.has(item.id))continue;shown.add(item.id);if(reduced)continue;
   const node=document.createElement('span');node.textContent=item.emoji;node.style.left=`${10+Math.random()*80}%`;layer.append(node);node.addEventListener('animationend',()=>node.remove(),{once:true});
  }
 }
 function accept(data){
  const before=state?.round?.id;state=data;
  if(state.round?.id!==before){strokes=[];notice='';}
  paint();float(state.reactions||[]);
 }
 async function load(){
  if(!dialog||!room)return;
  const run=++epoch,{data,error}=await config.db.rpc('get_club_night',args());
  if(run!==epoch||!dialog)return;
  if(error){if(!state){dialog.querySelector('.night-body').innerHTML=`<p class="night-note" role="status">${esc(fail(error))}</p>`;}}
  else accept(data);
  clearTimeout(timer);if(!document.hidden&&!state?.recap)timer=setTimeout(load,2500);
 }
 async function act(name,params){
  if(busy)return;busy=true;notice='';epoch++;
  const {data,error}=await config.db.rpc(name,params);
  busy=false;
  if(error){notice=fail(error);paint(true);}else if(data)accept(data);
  clearTimeout(timer);timer=setTimeout(load,800);
 }
 function point(event,canvas){const b=canvas.getBoundingClientRect();return [Math.round((event.clientX-b.left)/b.width*600),Math.round((event.clientY-b.top)/b.height*600)];}
 function pointer(event){
  const canvas=event.target.closest?.('[data-night-canvas="own"]');
  if(event.type==='pointerdown'&&canvas){event.preventDefault();canvas.setPointerCapture(event.pointerId);drawing=true;line=[point(event,canvas)];strokes.push(line);return drawCanvas();}
  if(!drawing)return;
  const target=dialog.querySelector('[data-night-canvas="own"]');if(!target)return;
  if(event.type==='pointermove'){line.push(point(event,target));drawCanvas();return;}
  drawing=false;void config.db.rpc('save_night_strokes',{p_round:state.round.id,p_strokes:strokes});
 }
 function click(event){
  const b=event.target.closest('button');if(!b)return;const d=b.dataset;
  if(d.nightClose!==undefined)return close();
  if(d.nightGame)return void act('start_night_round',{...args(),p_game:d.nightGame});
  if(d.nightAnswer)return void act('answer_night_round',{p_round:state.round.id,p_value:d.nightAnswer});
  if(d.nightReveal!==undefined)return void act('reveal_night_round',{p_round:state.round.id});
  if(d.nightFinish!==undefined)return void act('finish_club_night',args());
  if(d.nightEmoji){void config.db.rpc('send_night_reaction',{...args(),p_emoji:d.nightEmoji});const id=`own-${Date.now()}`;float([{id,emoji:d.nightEmoji}]);}
 }
 function submit(event){
  event.preventDefault();
  const value=String(new FormData(event.target).get('value')||'');
  document.activeElement?.blur?.();
  void act('answer_night_round',{p_round:state.round.id,p_value:value});
 }
 function close(){clearTimeout(timer);epoch++;const old=dialog;dialog=null;room=null;state=null;lastPaint='';shown=new Set();strokes=[];old?.close();old?.remove();}
 function open(event,occurrence,title){
  if(dialog)close();
  room={event:Number(event),occurrence};
  dialog=document.createElement('dialog');dialog.className='night-dialog';dialog.setAttribute('aria-label','La Sala');
  dialog.innerHTML=`<div class="night-shell"><header><div><small>${esc(title||'Plan')}</small><h2>La Sala</h2></div><button type="button" data-night-close aria-label="Cerrar">Cerrar</button></header><div class="night-float" aria-hidden="true"></div><div class="night-body"><p class="night-note" role="status">Abriendo la Sala…</p></div></div>`;
  dialog.addEventListener('click',click);dialog.addEventListener('submit',submit);
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])dialog.addEventListener(type,pointer);
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  document.body.append(dialog);dialog.showModal();void load();
 }
 function entry(event){
  const b=event.target.closest?.('[data-night-open]');if(!b)return;
  open(b.dataset.nightOpen,b.dataset.nightOccurrence,b.dataset.nightTitle);
 }
 function init(options){config=options;document.addEventListener('click',entry);document.addEventListener('visibilitychange',()=>{if(dialog&&!document.hidden){clearTimeout(timer);void load();}});}
 globalThis.ClubNight={init,open,close};
})();
