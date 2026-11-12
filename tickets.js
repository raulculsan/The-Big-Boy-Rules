/* Tickets: one column on a phone, list and conversation side by side on wide screens.
   Reads rely on RLS; every change goes through a checked server function. */
(() => {
 'use strict';
 const statuses={new:'Nuevo',in_progress:'En curso',answered:'Respondido',closed:'Cerrado'};
 const types={help:'Ayuda',suggestion:'Sugerencia',complaint:'Queja'};
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const when=new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
 let config={},tickets=[],messages=[],view='list',activeId=null,filter='open',loaded=false,loading=false,failure='',busy=false,notice='',armed='',armTimer=0,epoch=0;
 const el=id=>document.getElementById(id);
 const actor=()=>config.getUser?.()?.id||null;
 const staff=()=>Boolean(config.canManage?.());
 const active=()=>tickets.find(t=>String(t.id)===String(activeId))||null;
 const thread=id=>messages.filter(m=>String(m.request_id)===String(id));
 const title=t=>t.subject||`${types[t.request_type]||'Ayuda'} #${t.id}`;
 function unread(t){
  const last=thread(t.id).at(-1);
  if(!last||last.sender_id===actor())return false;
  const seen=t.user_id===actor()?t.member_read_at:t.staff_read_at;
  return !seen||new Date(last.created_at)>new Date(seen);
 }
 function visible(){
  if(filter==='open')return tickets.filter(t=>t.status!=='closed');
  return tickets.filter(t=>t.status===filter);
 }
 function chip(t){return `<span class="ticket-status is-${esc(t.status)}">${esc(statuses[t.status]||t.status)}</span>`;}
 function row(t){
  const author=config.getMember?.(t.user_id),last=thread(t.id).at(-1),time=t.updated_at?when.format(new Date(t.updated_at)):'';
  const isUnread=unread(t);
  return `<button type="button" class="ticket-row${String(activeId)===String(t.id)?' is-active':''}${isUnread?' is-unread':''}" data-ticket-open="${esc(t.id)}"><span class="ticket-row-top"><strong>${esc(title(t))}</strong>${isUnread?'<i aria-label="Sin leer"></i>':''}</span><span class="ticket-row-preview">${esc(last?.body||'')}</span><span class="ticket-row-meta">${chip(t)}${t.priority==='high'?'<span class="ticket-urgent">Urgente</span>':''}<small>${staff()?`${esc(author?.name||'Miembro')} · `:''}${esc(time)}</small></span></button>`;
 }
 function renderList(){
  const filters=staff()?[['open','Abiertos'],['new','Nuevos'],['in_progress','En curso'],['answered','Respondidos'],['closed','Cerrados']]:[['open','Abiertos'],['closed','Cerrados']];
  el('ticketFilters').innerHTML=filters.map(([id,label])=>{
   const count=id==='open'?tickets.filter(t=>t.status!=='closed').length:tickets.filter(t=>t.status===id).length;
   return `<button type="button" data-ticket-filter="${id}" aria-pressed="${filter===id}">${label}<b>${count}</b></button>`;
  }).join('');
  const list=visible();
  el('ticketList').innerHTML=failure?`<div class="ticket-empty"><strong>No se han podido cargar</strong><p>${esc(failure)}</p><button type="button" data-ticket-retry>Reintentar</button></div>`
   :!loaded?'<p class="ticket-note" role="status">Cargando tickets…</p>'
   :list.length?list.map(row).join('')
   :`<div class="ticket-empty"><strong>${filter==='closed'?'Sin tickets cerrados':'Todo al día'}</strong><p>${staff()?'No hay tickets aquí.':'Si necesitas algo, abre un ticket y te responderemos aquí.'}</p></div>`;
 }
 function actions(t){
  const closed=t.status==='closed',own=t.user_id===actor(),buttons=[];
  if(staff()&&t.status==='new')buttons.push(['in_progress','Atender']);
  if(closed&&(own||staff()))buttons.push(['new','Reabrir']);
  if(!closed&&(own||staff()))buttons.push(['closed',armed==='closed'?'Confirmar cierre':'Cerrar ticket']);
  return buttons.map(([status,label])=>`<button type="button" data-ticket-status="${status}"${busy?' disabled':''}>${esc(label)}</button>`).join('');
 }
 function renderDetail(){
  const t=active();
  if(!t){el('ticketDetail').hidden=true;return;}
  const author=config.getMember?.(t.user_id),closed=t.status==='closed';
  const handler=t.handled_by?config.getMember?.(t.handled_by):null;
  el('ticketHead').innerHTML=`<h3>${esc(title(t))}</h3><p>${esc(types[t.request_type]||'Ayuda')} · #${esc(t.id)}${staff()?` · ${esc(author?.name||'Miembro')}`:''}${handler?` · Atiende ${esc(handler.name)}`:''}</p><div class="ticket-row-meta">${chip(t)}${t.priority==='high'?'<span class="ticket-urgent">Urgente</span>':''}</div><div class="ticket-actions">${actions(t)}</div>`;
  el('ticketThread').innerHTML=thread(t.id).map(m=>{
   const sender=config.getMember?.(m.sender_id),own=m.sender_id===actor();
   return `<article class="ticket-message${own?' is-own':''}">${config.avatar(sender,'avatar tiny')}<div><header><strong>${esc(own?'Tú':sender?.name||'Administración')}</strong><time datetime="${esc(m.created_at)}">${esc(when.format(new Date(m.created_at)))}</time></header><p>${esc(m.body)}</p></div></article>`;
  }).join('');
  el('helpReplyForm').hidden=closed;
  el('ticketClosed').hidden=!closed;
 }
 function render(){
  if(!el('ticketList'))return;
  const page=el('ayuda');
  page.dataset.ticketView=view;
  el('ticketPageTitle').textContent=staff()?'Tickets del club':'Ayuda';
  el('ticketIntro').textContent=staff()?'Atiende y resuelve lo que piden los miembros.':'Tus consultas privadas con administración.';
  renderList();
  el('ticketNew').hidden=view!=='new';
  el('ticketDetail').hidden=view!=='detail';
  el('ticketEmptyPane').hidden=view!=='list';
  if(view==='detail')renderDetail();
  el('ticketFeedback').textContent=notice;
 }
 async function refresh(){
  if(!config.db||!actor()||loading)return;
  const run=++epoch;loading=true;
  try{
   let query=config.db.from('help_requests').select('*').order('updated_at',{ascending:false}).limit(250);
   if(!staff())query=query.eq('user_id',actor());
   const requests=await query;
   if(requests.error)throw requests.error;
   const ids=(requests.data||[]).map(t=>t.id);
   const replies=ids.length?await config.db.from('help_messages').select('*').in('request_id',ids).order('created_at'):{data:[]};
   if(replies.error)throw replies.error;
   if(run!==epoch)return;
   tickets=requests.data||[];messages=replies.data||[];loaded=true;failure='';
   if(activeId!=null&&!active()){activeId=null;view='list';}
   if(view==='detail')void markRead();
  }catch(error){if(run===epoch)failure=error?.message||'Inténtalo de nuevo.';}
  finally{if(run===epoch){loading=false;render();}}
 }
 async function markRead(){
  const t=active();
  if(!t||!unread(t))return;
  const stamp=new Date().toISOString();
  if(t.user_id===actor())t.member_read_at=stamp;else t.staff_read_at=stamp;
  renderList();
  const {error}=await config.db.rpc('mark_ticket_read',{p_id:t.id});
  if(!error)config.onRead?.();
 }
 function openTicket(id){
  activeId=id;view='detail';armed='';notice='';
  config.drafts?.(id);
  render();void markRead();
  requestAnimationFrame(()=>el('ticketThread')?.lastElementChild?.scrollIntoView({block:'nearest'}));
 }
 function back(){
  if(view==='list')return false;
  view='list';activeId=null;armed='';notice='';config.drafts?.(null);render();
  return true;
 }
 async function run(name,args,done){
  if(busy)return false;
  busy=true;notice='';render();
  try{
   const {data,error}=await config.db.rpc(name,args);
   if(error)throw error;
   notice=done||'';busy=false;await refresh();
   return data??true;
  }catch(error){busy=false;notice=['PGRST202','42883'].includes(error?.code)?'Esta función se está preparando.':error?.message||'No se ha podido guardar.';render();return false;}
 }
 async function submitNew(form){
  const subject=el('ticketSubject').value.trim(),body=el('helpRequestMessage').value.trim();
  const id=await run('create_ticket',{p_type:el('helpRequestType').value,p_subject:subject,p_priority:el('ticketUrgent').checked?'high':'normal',p_body:body},'');
  if(id===false)return;
  config.clearDraft?.('helpRequestForm');form.reset();filter='open';openTicket(id);
 }
 async function submitReply(form){
  const t=active(),body=el('helpReplyMessage').value.trim();
  if(!t||!body)return;
  if(await run('reply_ticket',{p_id:t.id,p_body:body},'')===false)return;
  config.clearDraft?.('helpReplyForm');form.reset();
  requestAnimationFrame(()=>el('ticketThread')?.lastElementChild?.scrollIntoView({block:'nearest'}));
 }
 function changeStatus(status){
  const t=active();if(!t)return;
  if(status==='closed'&&armed!=='closed'){
   armed='closed';render();clearTimeout(armTimer);
   armTimer=setTimeout(()=>{armed='';render();},4000);
   return;
  }
  clearTimeout(armTimer);armed='';
  void run('set_ticket_status',{p_id:t.id,p_status:status},status==='closed'?'Ticket cerrado':'Ticket actualizado');
 }
 function click(event){
  const b=event.target.closest?.('#ayuda button');if(!b||b.disabled)return;
  const d=b.dataset;
  if(d.ticketOpen)return openTicket(Number(d.ticketOpen));
  if(d.ticketFilter){filter=d.ticketFilter;return render();}
  if('ticketNew' in d){view='new';activeId=null;notice='';render();el('ticketSubject')?.focus();return;}
  if('ticketBack' in d){if(!back())config.leave?.();return;}
  if('ticketRetry' in d){failure='';render();return void refresh();}
  if(d.ticketStatus)changeStatus(d.ticketStatus);
 }
 function submit(event){
  if(event.target.id==='helpRequestForm'){event.preventDefault();void submitNew(event.target);}
  if(event.target.id==='helpReplyForm'){event.preventDefault();void submitReply(event.target);}
 }
 function reset(){epoch++;tickets=[];messages=[];view='list';activeId=null;filter='open';loaded=false;loading=false;failure='';busy=false;notice='';armed='';clearTimeout(armTimer);render();}
 function init(options){config=options;document.addEventListener('click',click);document.addEventListener('submit',submit);render();}
 globalThis.Tickets={init,refresh,render,reset,back,show(id){filter='open';if(id!=null)activeId=id;view=id!=null?'detail':'list';render();void refresh();},activeId:()=>activeId,isLoaded:()=>loaded};
})();
