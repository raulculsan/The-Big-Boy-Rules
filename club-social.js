/* Shared social season and a member's three chosen cards. Rewards and ownership stay server-owned. */
(() => {
 'use strict';
 let cfg, epoch=0, goalCache=null,goalRequest=null,showcaseRequests=new Map(),picker=null;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const user=()=>cfg?.getUser?.()?.id;
 const catalog=()=>globalThis.CardCollection?.catalog||[];
 const card=id=>catalog().find(c=>c.id===id);
 const art=c=>globalThis.CardMedia?.source(globalThis.CardCollection?.thumbnail(c))||globalThis.CardCollection?.thumbnail(c)||'';
 const image=c=>`<img src="${esc(art(c))}" alt="${esc(c.name)} · ${Number(c.score)||0} PTS" loading="lazy" decoding="async" draggable="false">`;
 async function rpc(name,args={}){if(!user())throw new Error('Inicia sesión.');const {data,error}=await cfg.db.rpc(name,args);if(error)throw error;return data;}
 const friendly=e=>['PGRST202','42883','42P01'].includes(e?.code)?'Esta función se está preparando. Vuelve a intentarlo más tarde.':e?.message||'No se pudo cargar. Inténtalo de nuevo.';
 async function mountProfile(node,owner,own){
  if(!node||!owner||!user())return;
  let section=node.querySelector('.profile-card-vitrine');
  if(!section){section=document.createElement('section');section.className='profile-card-vitrine';section.setAttribute('aria-label','Vitrina de cartas');node.append(section);}
  section.dataset.owner=owner;
  if(!showcaseRequests.has(owner))showcaseRequests.set(owner,rpc('get_profile_card_showcase',{target_user_id:owner}).catch(e=>{showcaseRequests.delete(owner);throw e;}));
  const version=epoch;
  try{
   const ids=await showcaseRequests.get(owner);if(version!==epoch||!section.isConnected||section.dataset.owner!==owner)return;
   const shown=ids.map(card).filter(Boolean);
   section.innerHTML=`<header><h3>Vitrina</h3>${own?'<button type="button" data-vitrine-edit>Elegir cartas</button>':''}</header>${shown.length?`<div class="profile-vitrine-cards">${shown.map(c=>`<button type="button" data-vitrine-open="${esc(c.id)}" aria-label="Ver ${esc(c.name)}">${image(c)}</button>`).join('')}</div>`:`<p>${own?'Elige hasta tres cartas de tu colección para mostrarlas aquí.':'Todavía no ha elegido sus cartas.'}</p>`}`;
   section.querySelector('[data-vitrine-edit]')?.addEventListener('click',()=>void editShowcase(owner,ids));
  }catch(e){if(version===epoch&&section.isConnected)section.innerHTML=`<p role="status">${esc(friendly(e))}</p><button type="button" data-vitrine-retry>Volver a cargar</button>`;section.querySelector('[data-vitrine-retry]')?.addEventListener('click',()=>void mountProfile(node,owner,own));}
 }
 async function editShowcase(owner,ids){
  picker?.remove();const version=epoch;
  const dialog=document.createElement('dialog');picker=dialog;dialog.className='club-vitrine-dialog';dialog.setAttribute('aria-label','Elegir cartas para tu vitrina');
  dialog.innerHTML='<header><h2>Tu vitrina</h2><button type="button" data-close>Cerrar</button></header><p role="status">Cargando tu colección…</p>';document.body.append(dialog);dialog.showModal();
  dialog.addEventListener('close',()=>{dialog.remove();if(picker===dialog)picker=null;},{once:true});dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  let selected=[...ids];
  try{
   const {data,error}=await cfg.db.from('member_card_inventory').select('card_id,quantity').eq('user_id',owner).gt('quantity',0);if(error)throw error;
   if(version!==epoch||!dialog.isConnected)return;
   const owned=data.map(i=>card(i.card_id)).filter(Boolean).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));selected=selected.filter(id=>owned.some(c=>c.id===id));
   dialog.innerHTML=`<header><h2>Tu vitrina</h2><button type="button" data-close>Cerrar</button></header><p>Elige hasta tres. Se muestran en el orden en que las tocas.</p><label class="vitrine-search">Buscar carta<input type="search" maxlength="100" placeholder="Nombre de la carta" autocomplete="off"></label><p class="vitrine-feedback" role="status"></p><div class="vitrine-picker-grid">${owned.map(c=>`<button type="button" data-vitrine-pick="${esc(c.id)}" aria-pressed="${selected.includes(c.id)}" data-name="${esc(c.name.toLocaleLowerCase('es'))}">${image(c)}<span>${esc(c.name)}</span><small>${esc(c.edition||c.rarity)} · ${Number(c.score)||0} PTS</small><b>${selected.includes(c.id)?selected.indexOf(c.id)+1:''}</b></button>`).join('')||'<p>Aún no tienes cartas para exponer.</p>'}</div><footer><span data-selection-count></span><button type="button" data-save>Guardar vitrina</button></footer>`;
   const feedback=dialog.querySelector('.vitrine-feedback'),count=dialog.querySelector('[data-selection-count]');count.textContent=`${selected.length} / 3`;
   dialog.querySelector('[data-close]').onclick=()=>dialog.close();
   dialog.querySelector('input').oninput=e=>{const q=e.target.value.toLocaleLowerCase('es').trim();dialog.querySelectorAll('[data-vitrine-pick]').forEach(b=>b.hidden=!b.dataset.name.includes(q));};
   dialog.addEventListener('click',e=>{const b=e.target.closest('[data-vitrine-pick]');if(!b)return;const id=b.dataset.vitrinePick;if(selected.includes(id))selected=selected.filter(v=>v!==id);else if(selected.length<3)selected.push(id);else{feedback.textContent='Ya has elegido tres. Toca una para quitarla.';return;}feedback.textContent='';count.textContent=`${selected.length} / 3`;dialog.querySelectorAll('[data-vitrine-pick]').forEach(n=>{n.setAttribute('aria-pressed',selected.includes(n.dataset.vitrinePick));n.querySelector('b').textContent=selected.includes(n.dataset.vitrinePick)?selected.indexOf(n.dataset.vitrinePick)+1:'';});});
   dialog.querySelector('[data-save]').onclick=async e=>{e.target.disabled=true;try{await rpc('set_profile_card_showcase',{card_ids:selected});if(version!==epoch)return;showcaseRequests.delete(owner);dialog.close();const host=document.getElementById('profileContent');if(host)void mountProfile(host,owner,true);}catch(error){feedback.textContent=friendly(error);e.target.disabled=false;}};
  }catch(error){if(dialog.isConnected)dialog.querySelector('[role=status]').textContent=friendly(error);}
 }
 function renderGoal(node,data){
  const end=new Date(data.ends_at).toLocaleDateString('es-ES',{day:'numeric',month:'short',timeZone:'Europe/Madrid'});
  node.innerHTML=`<header><span>Objetivo del club</span><small>Hasta el ${esc(end)}</small></header><h3>${esc(data.theme)}</h3><p>Completadlo entre todos. Cada participante recibe ${Number(data.reward_packs)} sobres.</p><div class="club-social-progress">${[['plans','plan_target','Planes con dos llegadas'],['memories','memory_target','Recuerdos de planes'],['trades','trade_target','Parejas que intercambian']].map(([key,target,label])=>`<div><span>${label}</span><strong>${Number(data[key])} / ${Number(data[target])}</strong><progress max="${Number(data[target])}" value="${Math.min(Number(data[key]),Number(data[target]))}" aria-label="${label}"></progress></div>`).join('')}</div><small>Cuenta un recuerdo por persona y plan, y un intercambio por pareja este mes.</small><button type="button" data-social-claim ${!data.complete||!data.contributed||data.claimed?'disabled':''}>${data.claimed?'Recompensa recogida':data.complete&&!data.contributed?'Participa para recoger tus sobres':data.complete?'Recoger los 3 sobres':'3 sobres al completar el objetivo'}</button><p role="status" class="social-goal-feedback"></p>`;
  node.querySelector('[data-social-claim]').onclick=async e=>{e.target.disabled=true;try{const result=await rpc('claim_club_social_season');goalCache=null;await cfg.refreshPacks?.();await refreshGoal(true);if(result.awarded)node.querySelector('.social-goal-feedback').textContent='Tus 3 sobres ya están disponibles.';}catch(error){node.querySelector('.social-goal-feedback').textContent=friendly(error);e.target.disabled=false;}};
 }
 async function refreshGoal(force=false){
  const nodes=[...document.querySelectorAll('[data-club-social-goal]')];if(!nodes.length||!user())return;const version=epoch;
  try{if(force||!goalCache||Date.now()-goalCache.at>60000){if(!goalRequest)goalRequest=rpc('get_club_social_season').then(data=>{if(version===epoch)goalCache={data,at:Date.now()};}).finally(()=>goalRequest=null);await goalRequest;}if(version!==epoch||!goalCache)return;nodes.filter(n=>n.isConnected).forEach(n=>renderGoal(n,goalCache.data));}catch(e){if(version===epoch)nodes.forEach(n=>n.innerHTML=`<p role="status">${esc(friendly(e))}</p><button type="button" data-goal-retry>Volver a cargar</button>`);nodes.forEach(n=>n.querySelector('[data-goal-retry]')?.addEventListener('click',()=>void refreshGoal(true)));}
 }
 function mountGoal(host){if(!host||!user())return;let node=host.querySelector('[data-club-social-goal]');if(!node){node=document.createElement('section');node.className='club-social-season';node.setAttribute('data-club-social-goal','');host.append(node);}void refreshGoal();}
 document.addEventListener('click',e=>{const b=e.target.closest('[data-vitrine-open]');if(b)globalThis.CardCollection?.open(b.dataset.vitrineOpen,b);});
 document.addEventListener('collection-social-change',()=>{goalCache=null;showcaseRequests.clear();});
 globalThis.ClubSocial={init(options){cfg=options;},mountProfile,mountGoal,refreshGoal,reset(){epoch++;goalCache=null;goalRequest=null;showcaseRequests.clear();picker?.close();}};
})();
