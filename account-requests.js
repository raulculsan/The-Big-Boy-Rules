/* Account applications: no password is retained by this page or visible to admins. */
(() => {
 'use strict';
 function create(api) {
  let applicant, review, busy=false, owner=null, generation=0, requests=[];
  const text=(node,value)=>{node.textContent=value;};
  async function invoke(action,values={}) {
   if(!api.client)throw new Error('El servicio de acceso no está disponible.');
   const {data,error}=await api.client.functions.invoke('account-requests',{body:{action,...values}});
   if(error){let detail='';try{detail=(await error.context?.json())?.error||'';}catch{}throw new Error(detail||'No se pudo conectar con las solicitudes. Inténtalo más tarde.');}
   if(data?.error)throw new Error(data.error);return data;
  }
  function makeDialog(label) {
   const node=document.createElement('dialog');node.className='account-request-dialog';node.setAttribute('aria-label',label);
   node.innerHTML=`<div class="request-dialog-head"><span class="eyebrow">BIG BOY · ACCESO</span><button type="button" data-request-close aria-label="Cerrar">×</button></div>`;
   node.addEventListener('click',event=>{if(event.target.closest('[data-request-close]')){if(!busy)node.close();}});
   node.addEventListener('cancel',event=>{if(busy)event.preventDefault();});document.body.append(node);return node;
  }
  async function openApplication() {
   if(!applicant){
    applicant=makeDialog('Solicitar una cuenta');
    applicant.insertAdjacentHTML('beforeend',`<h2>Solicita tu acceso.</h2><p class="request-intro">Cuéntanos quién eres. La administración revisará tu solicitud y recibirás su decisión por correo.</p><form class="account-request-form"><label>Tu nombre<input name="displayName" autocomplete="name" maxlength="60" required placeholder="Nombre y apellidos"></label><label>Correo electrónico<input name="email" type="email" autocomplete="email" maxlength="254" required placeholder="tu@email.com"></label><label>Nombre de usuario<div class="request-username"><span>@</span><input name="username" autocomplete="username" minlength="3" maxlength="32" pattern="[a-zA-Z0-9._-]{3,32}" required placeholder="tuusuario"></div></label><label>Contraseña<input name="password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><small class="request-password-hint">Mínimo 8 caracteres y un símbolo. No puede contener tu nombre ni usuario.</small><label>Repite la contraseña<input name="confirmation" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><label class="request-honeypot" aria-hidden="true">Web<input name="website" tabindex="-1" autocomplete="off"></label><p class="request-feedback" role="status" aria-live="polite"></p><button type="submit" class="login-submit">Enviar solicitud</button><small class="request-footnote">Te enviaremos un enlace para verificar tu correo. Tu cuenta se activará cuando administración la apruebe.</small></form>`);
    applicant.addEventListener('submit',async event=>{
     event.preventDefault();if(busy)return;const form=event.target,values=Object.fromEntries(new FormData(form)),feedback=form.querySelector('.request-feedback');
     if(values.password!==values.confirmation){text(feedback,'Las contraseñas no coinciden.');return;}
     delete values.confirmation;busy=true;form.querySelector('button').disabled=true;text(feedback,'Enviando…');
     try{const result=await invoke('submit',values);form.reset();form.querySelectorAll('label,small,.request-password-hint,button').forEach(n=>n.hidden=true);text(feedback,result.message);feedback.classList.add('request-success');}
     catch(error){text(feedback,error.message);}finally{busy=false;form.querySelector('button').disabled=false;}
    });
    applicant.addEventListener('close',()=>{applicant.querySelector('form').reset();});
   }
   const form=applicant.querySelector('form');form.querySelectorAll('label,small,button').forEach(n=>n.hidden=false);form.querySelector('.request-feedback').classList.remove('request-success');text(form.querySelector('.request-feedback'),'');applicant.showModal();
   const submit=form.querySelector('[type=submit]');submit.disabled=true;
   try{const status=await invoke('configuration');if(!status.configured)text(form.querySelector('.request-feedback'),'La recepción de solicitudes se está preparando. Vuelve a intentarlo más tarde.');submit.disabled=!status.configured;}catch(error){text(form.querySelector('.request-feedback'),error.message);submit.disabled=true;}
  }
  function requestRow(item) {
   const card=document.createElement('article');card.className='request-review-card';
   const heading=document.createElement('div');heading.className='request-review-person';
   const mark=document.createElement('span');mark.className='request-avatar';text(mark,item.display_name.slice(0,1).toUpperCase());
   const info=document.createElement('div'),name=document.createElement('strong'),username=document.createElement('small'),email=document.createElement('span');
   text(name,item.display_name);text(username,`@${item.username}`);text(email,item.email);info.append(name,username,email);heading.append(mark,info);card.append(heading);
   const meta=document.createElement('p');meta.className='request-review-meta';text(meta,`${new Date(item.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'short'})} · ${({pending_email:'Correo pendiente de verificar',pending:'Correo verificado',approving:'Aprobación pendiente de completar',rejecting:'Rechazo pendiente de completar',approved:'Cuenta creada',rejected:'Solicitud rechazada'})[item.status]||item.status}`);card.append(meta);
   const controls=document.createElement('div');controls.className='request-review-actions';
   const button=(label,action)=>{const node=document.createElement('button');node.type='button';text(node,label);node.dataset.requestAction=action;node.dataset.requestId=item.id;controls.append(node);};
   if(item.status==='pending_email')button('Reenviar verificación','resend-verification');
   if(['pending','approving'].includes(item.status))button(item.status==='approving'?'Completar aprobación':'Aceptar solicitud','approve');
   if(item.status==='pending'&&item.admin_email_status!=='sent')button('Reintentar aviso a administración','retry-admin');
   if(['pending','rejecting'].includes(item.status))button(item.status==='rejecting'?'Completar rechazo':'Rechazar','reject');
   if(['approved','rejected'].includes(item.status)&&item.email_status!=='sent'){const warning=document.createElement('small');text(warning,'Aviso por correo pendiente de envío.');card.append(warning);button('Reintentar correo','retry');}
   card.append(controls);return card;
  }
  const reviewHosts=()=>Array.from(document.querySelectorAll('[data-request-review]'));
  function render() {
   const pending=requests.filter(r=>!['approved','rejected'].includes(r.status)),old=requests.filter(r=>['approved','rejected'].includes(r.status));
   for(const host of reviewHosts()){
    const list=host.querySelector('.request-review-list');list.replaceChildren();
    if(!pending.length){const empty=document.createElement('p');empty.className='request-empty';text(empty,'No hay solicitudes de cuenta pendientes.');list.append(empty);}
    pending.forEach(r=>list.append(requestRow(r)));
    if(old.length){const details=document.createElement('details'),summary=document.createElement('summary');text(summary,`Revisadas · ${old.length}`);details.append(summary,...old.map(requestRow));list.append(details);}
   }
   document.querySelectorAll('[data-request-count]').forEach(node=>{text(node,String(pending.length));node.hidden=!pending.length;});
  }
  function reviewFeedback(message){for(const host of reviewHosts())text(host.querySelector('.request-feedback'),message);}
  async function refresh() {
   if(!api.canManage()||!api.owner())return;
   const current=api.owner(),ticket=++generation;
   try{const result=await invoke('list');if(ticket!==generation||api.owner()!==current||!api.canManage())return;requests=result.requests||[];render();reviewFeedback(result.configured?'':'El correo de solicitudes todavía está pendiente de configuración.');}
   catch(error){if(api.owner()===current)reviewFeedback(error.message);}
  }
  async function openReview() {
   if(!api.canManage())return;
   if(!review){review=makeDialog('Solicitudes de cuenta');review.classList.add('request-review-dialog');review.insertAdjacentHTML('beforeend','<h2>Solicitudes de acceso.</h2><div data-request-review><p class="request-intro">Las solicitudes aparecen desde que se envían. El correo debe estar verificado antes de aceptar y activar la cuenta.</p><p class="request-feedback" role="status" aria-live="polite"></p><div class="request-review-list"></div></div>');}
   render();reviewFeedback('Cargando solicitudes…');review.showModal();await refresh();
  }
  document.addEventListener('click',async event=>{
   const refreshButton=event.target.closest('[data-request-refresh]');
   if(refreshButton&&api.canManage()){if(busy)return;refreshButton.disabled=true;try{reviewFeedback('Actualizando…');await refresh();}finally{refreshButton.disabled=false;}return;}
   const button=event.target.closest('[data-request-action]');if(!button||busy||!api.canManage())return;
   if(button.dataset.requestAction==='reject'&&!button.dataset.confirm){button.dataset.confirm='true';text(button,'Confirmar rechazo');return;}
   busy=true;document.querySelectorAll('[data-request-action],[data-request-refresh]').forEach(n=>n.disabled=true);const current=api.owner();reviewFeedback('Guardando…');
   try{const result=await invoke(button.dataset.requestAction,{id:button.dataset.requestId});if(api.owner()!==current)return;await refresh();if(api.owner()===current)reviewFeedback(result.message||(result.emailSent===false?'La decisión está guardada. El correo está pendiente: puedes reintentarlo.':'Decisión guardada y correo enviado.'));}
   catch(error){if(api.owner()===current)reviewFeedback(error.message);}finally{busy=false;document.querySelectorAll('[data-request-action],[data-request-refresh]').forEach(n=>n.disabled=false);}
  });
  document.addEventListener('club-account-requests-open',()=>{if(api.canManage()){render();reviewFeedback('Actualizando…');void refresh();}});
  function sync() {
   const current=api.canManage()?api.owner():null;if(owner===current)return;owner=current;++generation;requests=[];
   if(!current){review?.close();reviewHosts().forEach(host=>{host.querySelector('.request-review-list').replaceChildren();text(host.querySelector('.request-feedback'),'');});document.querySelectorAll('[data-request-count]').forEach(n=>n.hidden=true);}else void refresh();
  }
  document.addEventListener('click',event=>{if(event.target.closest('[data-request-account]'))void openApplication();if(event.target.closest('[data-open-account-requests]'))void openReview();});
  let confirmation=null,activeVerification='';
  function showVerification(id,token) {
   const key=`${id}.${token}`;if(activeVerification===key&&confirmation?.open)return;
   activeVerification=key;
   if(!confirmation){confirmation=makeDialog('Verificar correo');confirmation.insertAdjacentHTML('beforeend','<h2>Confirma tu correo.</h2><p class="request-intro">Verifica esta dirección para que administración reciba tu solicitud.</p><p class="request-feedback" role="status"></p><button type="button" class="login-submit" data-confirm-request>Confirmar solicitud</button>');
    confirmation.querySelector('[data-confirm-request]').addEventListener('click',async event=>{if(busy)return;busy=true;event.target.disabled=true;const feedback=confirmation.querySelector('.request-feedback');try{const [id,token]=activeVerification.split('.');const result=await invoke('verify',{id,token});text(feedback,result.message);event.target.hidden=true;}catch(error){text(feedback,error.message);event.target.disabled=false;}finally{busy=false;}});
   }
   const button=confirmation.querySelector('[data-confirm-request]');button.hidden=false;button.disabled=false;text(confirmation.querySelector('.request-feedback'),'');
   if(!confirmation.open)confirmation.showModal();
  }
  const verification=location.hash.match(/^#account-request=([0-9a-f-]{36})\.([0-9a-f-]{72})$/i);
  if(verification){history.replaceState(null,'',location.pathname+location.search);showVerification(verification[1],verification[2]);}
  if(window.Capacitor?.isNativePlatform?.()){
   const bridge=window.Capacitor.registerPlugin('ClubDeepLink');
   const handle=value=>{try{const link=new URL(value);if(link.protocol!=='bigboyrules:'||link.hostname!=='account-request'||link.pathname!=='/verify')return;const id=link.searchParams.get('id'),token=link.searchParams.get('token');if(/^[0-9a-f-]{36}$/i.test(id||'')&&/^[0-9a-f-]{72}$/i.test(token||''))showVerification(id,token);}catch{}};
   void bridge.addListener('open',event=>handle(event.url));
   void bridge.consume().then(event=>handle(event.url)).catch(()=>{});
  }
  return {sync,refresh};
 }
 globalThis.ClubAccountRequests={create};
})();
