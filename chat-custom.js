/* Shared chat look, nicknames, reactions and pins. Reads rely on RLS; writes use checked RPCs. */
(() => {
 'use strict';
 const defaults=['👍','❤️','😂','😮','😢','🔥'];
 const swatches=['#2f4f6f','#3c6e5a','#6b3f69','#7a3b3b','#3f4a5a','#1f7a8c','#8a4b2a'];
 const pencil='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4"/></svg>';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let config={},looks=new Map(),nicknames=new Map(),reactions=new Map(),channel=null,timer=0,dialog=null,editing=null,epoch=0;
 const actor=()=>config.getUser?.()?.id||null;
 function keyFor(kind){
  if(kind==='group'){const id=config.getChannel?.();return id==null||!/^\d+$/.test(String(id))?null:`group:${id}`;}
  const peer=config.getPeer?.()?.authId,own=actor();
  return peer&&own?`private:${[own,peer].sort().join(':')}`:null;
 }
 const look=key=>looks.get(key)||{};
 function name(kind,member){return nicknames.get(`${keyFor(kind)}|${member?.authId}`)||member?.name||'Miembro';}
 function emojis(kind){const own=look(keyFor(kind)).emojis;return own?.length?own:defaults;}
 function chips(kind,id){
  const key=keyFor(kind),rows=reactions.get(`${key}|${id}`);
  if(!rows?.length)return '';
  const counts=new Map();rows.forEach(r=>counts.set(r.emoji,(counts.get(r.emoji)||0)+1));
  const mine=rows.find(r=>r.user_id===actor())?.emoji;
  return `<div class="message-reactions">${[...counts].map(([emoji,count])=>`<button type="button" data-chat-reaction="${esc(emoji)}" data-reaction-kind="${esc(kind)}" data-reaction-id="${esc(id)}" aria-pressed="${emoji===mine}">${esc(emoji)}${count>1?`<b>${count}</b>`:''}</button>`).join('')}</div>`;
 }
 async function rpc(name,args){
  const {error}=await config.db.rpc(name,args);
  if(error)throw error;
  await load();
 }
 const fail=error=>config.notify?.(['PGRST202','42883','42P01'].includes(error?.code)?'Esta función se está preparando.':error?.message||'No se ha podido guardar.');
 function react(kind,id,emoji){return rpc('toggle_chat_reaction',{p_key:keyFor(kind),p_message:Number(id),p_emoji:emoji}).catch(fail);}
 function pin(kind,id){return rpc('set_chat_pin',{p_key:keyFor(kind),p_message:id==null?null:Number(id)}).catch(fail);}
 function saveLook(key,changes){
  const current=look(key),next={...current,...changes};
  return rpc('save_chat_look',{p_key:key,p_theme:next.theme_id||null,p_bubble:next.bubble_color||null,p_emojis:next.emojis?.length?next.emojis:null});
 }
 function sharedTheme(context){
  const member=context?.kind==='private'?config.getPeer?.():null;
  const key=context?.kind==='group'?`group:${context.conversationId}`:member?.authId?`private:${[actor(),member.authId].sort().join(':')}`:null;
  return look(key).theme_id||null;
 }
 function publishTheme(context,id){const key=keyFor(context.kind);if(key)void saveLook(key,{theme_id:id==='big-boy'?null:id}).catch(fail);}
 function pinBanner(kind,container){
  const key=keyFor(kind),id=look(key).pinned_id,message=id?config.getMessage?.(kind,id):null;
  let banner=container?.previousElementSibling?.matches?.('.chat-pin-banner')?container.previousElementSibling:null;
  if(!message){banner?.remove();return;}
  if(!banner){banner=document.createElement('div');banner.className='chat-pin-banner';container.before(banner);}
  banner.innerHTML=`<button type="button" data-chat-pin-open="${esc(id)}" data-pin-kind="${esc(kind)}"><small>Fijado</small><span>${esc(message)}</span></button><button type="button" data-chat-unpin="${esc(kind)}" aria-label="Quitar mensaje fijado">×</button>`;
 }
 function sync(kind){
  const container=document.getElementById(kind==='private'?'privateMessages':'messages');
  const header=document.querySelector(kind==='private'?'#privateChatHeader':'.group-conversation .chat-header');
  const key=keyFor(kind),color=look(key).bubble_color;
  const existing=header?.querySelector('[data-chat-edit]');
  if(!key){existing?.remove();container?.previousElementSibling?.matches?.('.chat-pin-banner')&&container.previousElementSibling.remove();return;}
  if(container){if(color)container.dataset.chatBubble='';else delete container.dataset.chatBubble;}
  if(container&&color){
   container.style.setProperty('--chat-outgoing',color);
   const incoming=getComputedStyle(container).getPropertyValue('--chat-incoming').trim();
   const text=getComputedStyle(container).getPropertyValue('--chat-text').trim();
   if(incoming&&text&&globalThis.ChatThemes?.accessibleColor)container.style.setProperty('--chat-text',globalThis.ChatThemes.accessibleColor(text,[incoming,color]));
  }
  if(header&&!existing){
   const button=document.createElement('button');
   button.type='button';button.className='chat-theme-button chat-edit-button';button.dataset.chatEdit=kind;
   button.setAttribute('aria-label','Editar chat');button.innerHTML=pencil;
   header.append(button);
  }
  pinBanner(kind,container);
 }
 function paint(){
  const {key,kind,error=''}=editing,current=look(key),people=kind==='private'?[config.getPeer?.(),config.getSelf?.()].filter(Boolean):config.getMembers?.().filter(m=>m.authId&&!m.hidden)||[];
  const admin=kind==='group'&&config.canManage?.();
  dialog.innerHTML=`<div class="chat-edit-sheet"><header><h2 id="chatEditTitle">Editar chat</h2><button type="button" data-edit-close aria-label="Cerrar">×</button></header>
  ${admin?`<section><h3>Grupo</h3><form data-edit-group><label>Nombre<input name="name" maxlength="40" required value="${esc(config.getGroupName?.()||'')}"></label><button type="submit">Guardar nombre</button></form><button type="button" data-edit-photo>Cambiar foto</button></section>`:''}
  <section><h3>Color de tus mensajes</h3><p>Lo veréis todos en este chat.</p><div class="chat-edit-swatches"><button type="button" data-edit-bubble="" aria-pressed="${!current.bubble_color}" aria-label="Color del fondo">Auto</button>${swatches.map(color=>`<button type="button" data-edit-bubble="${color}" style="background:${color}" aria-pressed="${current.bubble_color===color}" aria-label="Color ${color}"></button>`).join('')}</div></section>
  <section><h3>Reacciones rápidas</h3><form data-edit-emojis><label>Hasta 6 emojis<input name="emojis" autocomplete="off" value="${esc((current.emojis?.length?current.emojis:defaults).join(' '))}"></label><button type="submit">Guardar</button></form></section>
  <section><h3>Apodos</h3><p>Solo se ven en este chat.</p>${people.map(m=>`<form data-edit-nick="${esc(m.authId)}"><label>${esc(m.name)}<input name="nick" maxlength="30" value="${esc(nicknames.get(`${key}|${m.authId}`)||'')}" placeholder="Sin apodo"></label><button type="submit">Guardar</button></form>`).join('')}</section>
  <p class="chat-edit-status" role="status">${esc(error)}</p></div>`;
 }
 function open(kind){
  const key=keyFor(kind);if(!key)return;
  if(!dialog){
   dialog=document.createElement('dialog');dialog.className='chat-edit';dialog.setAttribute('aria-labelledby','chatEditTitle');document.body.append(dialog);
   dialog.addEventListener('click',sheetClick);dialog.addEventListener('submit',sheetSubmit);
  }
  editing={key,kind};paint();dialog.showModal();
 }
 const guarded=task=>task.then(()=>{editing.error='Guardado';paint();}).catch(error=>{editing.error=error?.message||'No se ha podido guardar.';paint();});
 function sheetClick(event){
  if(event.target===dialog||event.target.closest('[data-edit-close]'))return dialog.close();
  const bubble=event.target.closest('[data-edit-bubble]');
  if(bubble)return void guarded(saveLook(editing.key,{bubble_color:bubble.dataset.editBubble||null}));
  if(event.target.closest('[data-edit-photo]')){dialog.close();config.openGroupPhoto?.();}
 }
 function sheetSubmit(event){
  event.preventDefault();
  const form=event.target,fields=new FormData(form);
  if(form.matches('[data-edit-emojis]')){
   const list=[...new Intl.Segmenter('es',{granularity:'grapheme'}).segment(String(fields.get('emojis')))].map(s=>s.segment).filter(s=>s.trim()&&!/[\p{L}\p{N}]/u.test(s)).slice(0,6);
   return void guarded(saveLook(editing.key,{emojis:list}));
  }
  if(form.matches('[data-edit-group]'))return void guarded(config.saveGroupName(String(fields.get('name')).trim()));
  guarded(rpc('set_chat_nickname',{p_key:editing.key,p_target:form.dataset.editNick,p_nickname:String(fields.get('nick'))}));
 }
 async function load(){
  if(!config.db||!actor())return;
  const run=epoch;
  const [a,b,c]=await Promise.all(['chat_customizations','chat_nicknames','chat_reactions'].map(t=>config.db.from(t).select('*')));
  if(run!==epoch||a.error||b.error||c.error)return;
  looks=new Map(a.data.map(r=>[r.chat_key,r]));
  nicknames=new Map(b.data.map(r=>[`${r.chat_key}|${r.target_id}`,r.nickname]));
  reactions=new Map();
  c.data.forEach(r=>{const k=`${r.chat_key}|${r.message_id}`;reactions.set(k,[...(reactions.get(k)||[]),r]);});
  config.onChange?.();
 }
 function start(){
  if(!config.db||channel)return;
  void load();
  const later=()=>{clearTimeout(timer);timer=setTimeout(load,200);};
  channel=['chat_customizations','chat_nicknames','chat_reactions'].reduce((c,table)=>c.on('postgres_changes',{event:'*',schema:'public',table},later),config.db.channel('chat-custom'));
  channel.subscribe();
 }
 function reset(){
  epoch++;clearTimeout(timer);looks=new Map();nicknames=new Map();reactions=new Map();
  if(channel){config.db?.removeChannel(channel);channel=null;}
  if(dialog?.open)dialog.close();
 }
 function click(event){
  const b=event.target.closest('button');if(!b)return;
  const d=b.dataset;
  if(d.chatEdit)return open(d.chatEdit);
  if(d.chatReaction){event.stopPropagation();return void react(d.reactionKind,d.reactionId,d.chatReaction);}
  if(d.chatUnpin)return void pin(d.chatUnpin,null);
  if(d.chatPinOpen){
   const node=document.querySelector(`[data-message-kind="${d.pinKind}"][data-message-id="${CSS.escape(d.chatPinOpen)}"]`);
   node?.scrollIntoView({block:'center',behavior:'smooth'});
  }
 }
 function init(options){config=options;document.addEventListener('click',click);}
 globalThis.ChatCustom={init,start,reset,sync,name,chips,emojis,react,pin,sharedTheme,publishTheme,keyFor,isPinned:(kind,id)=>String(look(keyFor(kind)).pinned_id)===String(id)};
})();
