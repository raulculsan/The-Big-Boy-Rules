/* @mentions: suggestions while typing and tappable names in messages. The server reads the
   stored text to decide who is notified, so nothing here can notify anyone on its own. */
(() => {
 'use strict';
 const normal=value=>String(value||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let config={},box=null,target=null,matches=[];
 const tiles=new Map();
 const inputs={messageInput:'group',privateMessageInput:'private'};
 function people(kind){
  const self=config.getSelf?.();
  if(kind==='private'){const peer=config.getPeer?.();return peer?[peer]:[];}
  return (config.getMembers?.()||[]).filter(m=>m.username&&!m.hidden&&m.id!==self?.id);
 }
 function token(input){
  const caret=input.selectionStart??input.value.length,found=/(?:^|[^\w@.])@([\p{L}\p{N}_.-]*)$/u.exec(input.value.slice(0,caret));
  return found?{query:found[1],start:caret-found[1].length-1,end:caret}:null;
 }
 function close(){if(box){box.hidden=true;box.replaceChildren();}matches=[];target=null;}
 function suggest(input){
  const kind=inputs[input.id],found=kind?token(input):null;
  if(!found)return close();
  const query=normal(found.query);
  matches=people(kind).filter(m=>normal(m.username).includes(query)||normal(m.name).includes(query)).slice(0,5);
  if(!matches.length)return close();
  box||=Object.assign(document.createElement('div'),{className:'mention-suggest'});
  if(box.nextElementSibling!==input.form)input.form.before(box);
  target=input;box.hidden=false;
  // Rows are kept per member: rebuilding them on every letter reloads each photo.
  const rows=matches.map((m,i)=>{
   const key=`${m.id}|${m.name}|${m.username}|${m.avatarUrl||''}`;
   let row=tiles.get(key);
   if(!row){
    row=document.createElement('button');row.type='button';
    row.innerHTML=`${config.avatar(m,'avatar tiny')}<span><strong>${esc(m.name)}</strong><small>@${esc(m.username)}</small></span>`;
    tiles.set(key,row);
   }
   row.dataset.mention=i;
   return row;
  });
  if(rows.length!==box.children.length||rows.some((row,i)=>box.children[i]!==row))box.replaceChildren(...rows);
 }
 function choose(index){
  const member=matches[index],input=target,found=input&&token(input);
  if(!member||!found)return close();
  const text=`@${member.username} `;
  input.value=input.value.slice(0,found.start)+text+input.value.slice(found.end);
  const caret=found.start+text.length;input.setSelectionRange(caret,caret);
  close();input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();
 }
 // Takes already-escaped text. Only real usernames become links, so e-mails and stray @ stay as written.
 function format(html){
  if(!html.includes('@'))return html;
  const known=new Map((config.getMembers?.()||[]).filter(m=>m.username&&!m.hidden).map(m=>[m.username.toLowerCase(),m]));
  const self=config.getSelf?.();
  return html.replace(/(^|[^\w@.])@([\w.-]*[\w])/gu,(all,before,name)=>{
   const member=known.get(name.toLowerCase());
   return member?`${before}<button type="button" class="message-mention${member.id===self?.id?' is-self':''}" data-profile="${esc(member.id)}">@${esc(name)}</button>`:all;
  });
 }
 function init(options){
  config=options;
  document.addEventListener('input',event=>{if(inputs[event.target.id])suggest(event.target);});
  document.addEventListener('keydown',event=>{
   if(!matches.length||event.target!==target)return;
   if(event.key==='Enter'||event.key==='Tab'){event.preventDefault();event.stopPropagation();choose(0);}
   else if(event.key==='Escape')close();
  },true);
  // Keep the keyboard open: the input must not lose focus when a name is tapped.
  document.addEventListener('pointerdown',event=>{if(event.target.closest?.('.mention-suggest'))event.preventDefault();});
  document.addEventListener('click',event=>{
   const pick=event.target.closest?.('[data-mention]');
   if(pick)return choose(Number(pick.dataset.mention));
   if(!event.target.closest?.('.mention-suggest')&&event.target!==target)close();
  });
 }
 globalThis.ChatMentions={init,format,close};
})();
