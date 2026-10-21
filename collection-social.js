/* Personal collection marks and server-authoritative, one-for-one trades. */
(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icons = {favorite:'<path d="m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.6l6.2-.9Z"/>',wanted:'<path d="M12 20S3 15 3 8.8C3 3.7 9 2.5 12 7c3-4.5 9-3.3 9 1.8C21 15 12 20 12 20Z"/>',exchange:'<rect x="3" y="5" width="12" height="16" rx="2"/><rect x="9" y="3" width="12" height="16" rx="2"/>'};
  const svg = key => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[key]}</svg>`;
  const activeStatuses = ['invited','selecting','review'];
  const labels = {invited:'Invitación enviada',selecting:'Eligiendo carta',review:'Revisar y confirmar',pending:'Solicitud anterior',accepted:'Completado',declined:'Rechazado',cancelled:'Cancelado',expired:'Caducado',unavailable:'Sin copias disponibles'};
  let config, inventory = [], state = {marks:[],peers:[],trades:[]}, loaded = false, loading = false, busy = false, failure = '', notice = '', tab = 'favorite', epoch = 0, pendingRequest = null, trigger, pushDispatch;
  let popupId = null, seen = new Set(), lastRefresh = 0, recovering = false, stateVersion = 0, seenOwner = null;
  let tradePage = 'desk', pickerOfferId = null, pickerCard = '', search = '';
  let draft = {peer:'',give:''}, createId = null, marksLoading = false;
  const dialog = document.createElement('dialog'); dialog.className = 'collection-social-dialog'; dialog.setAttribute('aria-labelledby','collectionSocialTitle'); document.body.append(dialog);
  const tradeDialog = document.createElement('dialog'); tradeDialog.className = 'collection-social-dialog collection-trade-dialog'; tradeDialog.setAttribute('aria-labelledby','collectionTradeTitle'); document.body.append(tradeDialog);
  const requestDialog = document.createElement('dialog'); requestDialog.className = 'collection-social-dialog trade-request-dialog'; requestDialog.setAttribute('aria-labelledby','tradeRequestTitle'); document.body.append(requestDialog);
  const design = id => globalThis.CardCollection?.catalog.find(card => card.id === id);
  const owned = id => inventory.find(card => card.card_id === id)?.quantity > 0;
  const marked = (id,kind) => state.marks.some(mark => mark.card_id === id && mark.kind === kind);
  const session = () => config?.session?.();
  function message(error) {
    if (navigator.onLine === false) return 'Sin conexión. Tus cartas están guardadas. Vuelve a intentarlo cuando tengas internet.';
    if (['PGRST202','42883','42P01'].includes(error?.code)) return 'Esta función todavía no está activada en el servidor.';
    return error?.message || 'No se pudo guardar. Vuelve a intentarlo.';
  }
  async function rpc(name,args = {}) {
    if (!session()) throw new Error('Inicia sesión para usar tu colección.');
    if (navigator.onLine === false) throw new Error('Sin conexión.');
    const response = await config.rpc(name,args); if (response.error) throw response.error; return response.data;
  }
  function announce() { document.dispatchEvent(new CustomEvent('collection-social-change')); }
  async function refresh() {
    if (pendingRequest) return pendingRequest;
    if (!session()) return;
    if(seenOwner!==session()){seenOwner=session();try{seen=new Set(JSON.parse(sessionStorage.getItem(seenKey())||'[]'));}catch{seen=new Set();}}
    const token = epoch, version = ++stateVersion; loading = true; failure = ''; render();
    pendingRequest = (async () => {
      try { const data = await rpc('get_collection_social_state'); if (token !== epoch || version !== stateVersion) return; state = data; loaded = true; lastRefresh = Date.now(); announce(); }
      catch(error) { if (token === epoch) failure = message(error); }
      finally { if (token === epoch) {loading = false; pendingRequest = null; render(); checkIncoming();} }
    })();
    return pendingRequest;
  }
  async function recoverRequests() {
    if(!session()||document.hidden||recovering||busy||loading)return;
    recovering=true;const token=epoch,version=++stateVersion;lastRefresh=Date.now();
    try {
      const trades=await rpc('get_card_trade_updates');
      if(token!==epoch||version!==stateVersion)return;
      if(seenOwner!==session()){seenOwner=session();try{seen=new Set(JSON.parse(sessionStorage.getItem(seenKey())||'[]'));}catch{seen=new Set();}}
      const changed=JSON.stringify(state.trades)!==JSON.stringify(trades);
      state.trades=trades||[];
      if(changed){announce();render();}
      checkIncoming();
    } catch { /* Existing requests remain available in the trading desk. */ }
    finally{if(token===epoch)recovering=false;}
  }
  function actions(id,hasCard) {
    const kind = hasCard ? 'favorite' : 'wanted', active = marked(id,kind);
    return `<button type="button" class="album-mark-button ${active ? 'is-marked' : ''}" data-collection-mark="${kind}" data-mark-card="${esc(id)}" aria-pressed="${active}" aria-label="${active ? 'Quitar de' : 'Añadir a'} ${hasCard ? 'favoritas' : 'deseadas'}: ${esc(design(id)?.name || id)}">${svg(kind)}</button>`;
  }
  function cardTile(id,kind) {
    const card = design(id); if (!card) return '';
    return `<article class="social-card" data-social-rarity="${esc(card.edition)}"><button type="button" class="social-card-art" data-social-view="${esc(id)}" aria-label="Ver ${esc(card.name)}">${cardImage(card)}</button><div><strong>${esc(card.name)}</strong><small>${esc(card.edition)}${card.score ? ` · ${esc(card.score)} PTS` : ''}</small></div><button type="button" class="social-remove" data-collection-mark="${kind}" data-mark-card="${esc(id)}" aria-label="Quitar ${esc(card.name)} de ${kind==='favorite'?'favoritas':'deseadas'}">${svg(kind)}</button></article>`;
  }
  function cardImage(card,eager=false) {
    // Reuse the catalog/album recovery path when a cached thumbnail is missing.
    // Trade previews are already visible inside a dialog: load them immediately.
    return `<img data-card-original="${esc(card.front)}" src="${esc(globalThis.CardCollection.thumbnail(card))}" alt="${esc(card.name)}" loading="${eager?'eager':'lazy'}" decoding="async" width="${Number(card.width)||948}" height="${Number(card.height)||1660}">`;
  }
  function tradeArt(id,caption) {
    const card = design(id); return `<div class="social-trade-card"><small>${esc(caption)}</small>${card ? `${cardImage(card,true)}<strong>${esc(card.name)}</strong><span>${esc(card.edition)}</span>` : '<div class="social-trade-placeholder">?</div><strong>Selecciona una carta</strong>'}</div>`;
  }
  const activeTrade = offer => activeStatuses.includes(offer.status) && new Date(offer.expires_at)>new Date();
  const needsAction = offer => activeTrade(offer) && (offer.recipient_id===session() && ['invited','selecting'].includes(offer.status) || offer.sender_id===session() && offer.status==='review');
  function tradeOffer(offer) {
    const incoming=offer.recipient_id===session(), mine=incoming?offer.requested_card_id:offer.offered_card_id, theirs=incoming?offer.offered_card_id:offer.requested_card_id;
    let controls='', hint='';
    if(activeTrade(offer)) {
      if(offer.status==='invited') {
        hint=incoming?'Primero acepta participar. Después elegirás tu propia carta.':'Esperando a que acepte participar y elija su carta.';
        if(incoming) controls=`<button type="button" class="social-primary" data-trade-resolve="join" data-trade-id="${esc(offer.id)}">Aceptar y elegir mi carta</button>`;
      } else if(offer.status==='selecting') {
        hint=incoming?'Selecciona una repetida y confirma tu propuesta.':'Ha aceptado la invitación. Está eligiendo su carta.';
        if(incoming) controls=`<button type="button" class="social-primary" data-trade-pick-offer="${esc(offer.id)}">Elegir mi carta</button>`;
      } else {
        hint=incoming?'Has confirmado esta propuesta. Falta su aceptación final.':'La otra persona ha confirmado su carta. Acepta para completar el intercambio.';
        if(!incoming) controls=`<button type="button" class="social-primary" data-trade-resolve="confirm" data-trade-id="${esc(offer.id)}">Aceptar intercambio definitivo</button>`;
      }
      controls+=`<button type="button" data-trade-resolve="${incoming?'decline':'cancel'}" data-trade-id="${esc(offer.id)}">${incoming?'Rechazar':'Cancelar'}</button>`;
    }
    return `<article class="social-offer" data-trade-offer-id="${esc(offer.id)}" ${busy?'inert aria-busy="true"':''}><header><div><small>${incoming?'CON':'CON'}</small><strong>${esc(incoming?offer.sender_name:offer.recipient_name)}</strong></div><span class="social-offer-state" data-state="${esc(offer.status)}">${esc(labels[offer.status]||offer.status)}</span></header><div class="social-trade-pair">${tradeArt(mine,mine?'Tu carta':'Tu carta por elegir')}<span class="social-trade-arrow">${svg('exchange')}</span>${tradeArt(theirs,theirs?'Su carta':'Su carta por elegir')}</div>${hint?`<p class="social-help">${hint}</p>`:''}${activeTrade(offer)?`<p class="social-offer-expiry">Hasta el ${esc(new Date(offer.expires_at).toLocaleDateString('es-ES',{day:'numeric',month:'short'}))} · Conserváis vuestra última copia</p><footer>${controls}</footer>`:''}</article>`;
  }
  function peerTile(peer) {
    const initial=esc(peer.name?.charAt(0).toUpperCase()||'U');
    return `<button class="club-member trade-member" type="button" data-trade-peer="${esc(peer.id)}" data-member-banner-user="${esc(peer.id)}" aria-label="Intercambiar con ${esc(peer.name)}"><div class="club-member-hero"><div class="club-member-banner" aria-hidden="true"></div><div class="avatar ${peer.avatar_url?'has-image':''}" data-avatar><span class="avatar-fallback" aria-hidden="true">${initial}</span>${peer.avatar_url?`<img src="${esc(peer.avatar_url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:''}</div></div><span class="club-member-identity"><strong>${esc(peer.name)}</strong><small>@${esc(peer.username)}</small></span><span class="trade-member-cta">Elegir miembro</span></button>`;
  }
  function cardPicker() {
    const offer=state.trades.find(t=>t.id===pickerOfferId), selected=offer?pickerCard:draft.give;
    const cards=inventory.filter(i=>i.quantity>1&&design(i.card_id)&&(!offer||i.card_id!==offer.offered_card_id)).sort((a,b)=>(design(b.card_id)?.score||0)-(design(a.card_id)?.score||0));
    const filtered=cards.filter(i=>`${design(i.card_id).name} ${design(i.card_id).edition}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')));
    return `<div class="trade-page-heading"><span class="eyebrow">${offer?'TU PROPUESTA':'PASO 02 · TU OFERTA'}</span><h3>Elige tu carta</h3><p>${offer?`Recibirías ${esc(design(offer.offered_card_id)?.name||'su carta')}. Elige la repetida que quieres ofrecer.`:`Para ${esc(state.peers.find(p=>p.id===draft.peer)?.name||'este miembro')}. La otra persona elegirá la suya.`}</p></div><label class="trade-search"><span>⌕</span><input type="search" data-trade-search value="${esc(search)}" placeholder="Buscar en tus repetidas" aria-label="Buscar tus cartas repetidas"></label><div class="trade-card-picker">${filtered.map(i=>{const c=design(i.card_id);return `<button type="button" class="trade-pick-card ${selected===i.card_id?'is-picked':''}" data-trade-card="${esc(i.card_id)}" aria-pressed="${selected===i.card_id}"><span class="trade-copy-count">${Number(i.quantity)-1} disponible${i.quantity>2?'s':''}</span>${cardImage(c,true)}<strong>${esc(c.name)}</strong><small>${esc(c.edition)}${c.score?` · ${c.score} PTS`:''}</small><span class="trade-card-check" aria-hidden="true">✓</span></button>`;}).join('')||`<p class="social-empty">${cards.length?'No hay coincidencias.':'No tienes repetidas elegibles para este intercambio.'}</p>`}</div>${selected?`<div class="trade-selection-dock"><div><small>TU CARTA</small><strong>${esc(design(selected)?.name)}</strong></div><button type="button" class="social-primary" data-trade-next ${busy?'disabled':''}>Revisar</button></div>`:''}`;
  }
  function tradePageContent() {
    if(tradePage==='members') return `<div class="trade-page-heading"><span class="eyebrow">PASO 01 · EL OTRO LADO</span><h3>¿Con quién intercambias?</h3><p>Elige a un miembro para invitarle a un intercambio.</p></div><label class="trade-search"><span>⌕</span><input type="search" data-trade-search value="${esc(search)}" placeholder="Buscar miembro" aria-label="Buscar miembro"></label><div class="trade-member-grid">${state.peers.filter(p=>`${p.name} ${p.username}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))).map(peerTile).join('')||'<p class="social-empty">No se han encontrado miembros.</p>'}</div>`;
    if(tradePage==='cards')return cardPicker();
    if(tradePage==='review') {
      const offer=state.trades.find(t=>t.id===pickerOfferId), peer=state.peers.find(p=>p.id===draft.peer), id=offer?pickerCard:draft.give;
      return `<div class="trade-page-heading"><span class="eyebrow">${offer?'CONFIRMA TU PARTE':'PASO 03 · INVITACIÓN'}</span><h3>${offer?'Tu propuesta está lista':'Invita a '+esc(peer?.name||'este miembro')}</h3><p>${offer?'Al confirmar esta carta aceptas tu parte del intercambio. La otra persona debe dar su aceptación final.':'Enviarás esta carta como oferta. La otra persona aceptará participar y elegirá su propia carta.'}</p></div><div class="trade-review-art">${tradeArt(id,'Tu repetida')}${offer?tradeArt(offer.offered_card_id,'Recibirías'):''}</div><p class="social-help">Una copia por persona. Las cartas se entregan solo cuando los dos estáis de acuerdo. La solicitud dura 7 días.</p><button type="button" class="social-primary social-send" data-trade-create ${busy||!id?'disabled':''}>${busy?'Guardando…':offer?'Confirmar mi carta y enviar propuesta':'Enviar solicitud'}</button>`;
    }
    const active=state.trades.filter(activeTrade), history=state.trades.filter(t=>!activeTrade(t));
    return `<section class="trade-start"><div><span class="eyebrow">UN ACUERDO ENTRE DOS</span><h3>Intercambia<br>tus repetidas.</h3><p>Invita a alguien. Cada persona elige su carta y los dos confirmáis.</p></div><span class="trade-start-symbol">${svg('exchange')}</span><button type="button" class="social-primary social-send" data-trade-start>Nuevo intercambio</button></section>${active.length?`<section class="social-inbox"><div class="social-section-title"><span>ABIERTOS · ${active.length}</span><h3>En la mesa</h3></div>${active.sort((a,b)=>Number(needsAction(b))-Number(needsAction(a))).map(tradeOffer).join('')}</section>`:'<p class="trade-no-active">No hay intercambios abiertos.</p>'}${history.length?`<details class="trade-history"><summary>Historial <span>${history.length}</span></summary>${history.map(tradeOffer).join('')}</details>`:''}`;
  }
  function feedback() {
    return `<div class="social-feedback" role="status" aria-live="polite" ${!failure&&!notice&&!loading?'hidden':''}>${esc(failure || notice || 'Sincronizando tu colección…')}${failure?'<button type="button" data-social-retry>Reintentar</button>':''}</div>`;
  }
  function render() {
    mountTrigger();
    if(dialog.open) {
      const scroll=dialog.scrollTop;
      dialog.innerHTML=`<header class="social-header"><div><span class="eyebrow">LOS NUESTROS · TU SELECCIÓN</span><h2 id="collectionSocialTitle" tabindex="-1">Favoritas y deseos</h2></div><button type="button" class="social-close" data-social-close aria-label="Cerrar">✕</button></header><nav class="social-tabs" aria-label="Colección personal">${[['favorite','Favoritas'],['wanted','Deseadas']].map(([key,label])=>`<button type="button" data-social-tab="${key}" aria-pressed="${tab===key}">${svg(key)}<span>${label}</span><b>${state.marks.filter(m=>m.kind===key).length}</b></button>`).join('')}</nav>${feedback()}${loaded?`<p class="social-intro">${tab==='favorite'?'Las cartas que eliges destacar.':'Las que faltan en tu álbum.'}</p><div class="social-card-grid">${state.marks.filter(mark=>mark.kind===tab).map(mark=>cardTile(mark.card_id,mark.kind)).join('')||`<p class="social-empty">${tab==='favorite'?'Marca la estrella de una carta que tengas en el álbum.':'Marca el corazón de un hueco por conseguir en el álbum.'}</p>`}</div>`:''}`;
      dialog.scrollTop=scroll;
    }
    if(tradeDialog.open) {
      const scroll=tradeDialog.scrollTop;
      tradeDialog.innerHTML=`<header class="social-header trade-page-header"><button type="button" class="trade-back" data-trade-back aria-label="Volver">Volver</button><div><span class="eyebrow">LOS NUESTROS</span><h2 id="collectionTradeTitle" tabindex="-1">Intercambios</h2></div><button type="button" class="social-close" data-social-close aria-label="Cerrar intercambios">✕</button></header>${feedback()}<main class="trade-page-body">${loaded?tradePageContent():''}</main>`;
      tradeDialog.scrollTop=scroll;
      if(tradePage==='members'&&loaded)globalThis.BannerShop?.mountMembers(tradeDialog.querySelector('.trade-member-grid'));
      else {const grid=document.getElementById('membersGrid');if(grid)globalThis.BannerShop?.mountMembers(grid);}
    }
    if(requestDialog.open) renderRequest();
  }
  function mountTrigger() {
    const header = document.querySelector('.card-album-header'); if (!header) return;
    let group=header.querySelector('.social-album-actions');
    header.querySelector(':scope > [data-social-open]')?.remove();
    if(!group){group=document.createElement('div');group.className='social-album-actions';header.insertBefore(group,header.querySelector('[data-duplicates-open]'));}
    const count=state.trades.filter(t=>needsAction(t)).length;
    const markup=`<button type="button" class="social-album-trigger" data-social-open aria-label="Favoritas y deseos" title="Favoritas y deseos">${svg('favorite')}</button><button type="button" class="social-album-trigger social-trade-trigger" data-trades-open aria-label="Intercambios${count?`, ${count} solicitudes recibidas`:''}" title="Intercambios">${svg('exchange')}${count?`<span>${count}</span>`:''}</button>`;
    if(group.innerHTML!==markup)group.innerHTML=markup;
  }
  function seenKey(){return `bigboy.trade-requests.seen.${session()}`;}
  function remember(id){seen.add(id);try{sessionStorage.setItem(seenKey(),JSON.stringify([...seen].slice(-200)));}catch{}}
  function renderRequest(){
    const offer=state.trades.find(t=>t.id===popupId);
    if(!offer||!needsAction(offer)||offer.status==='selecting'){requestDialog.close();return;}
    const isInvite=offer.status==='invited';
    requestDialog.innerHTML=`<header class="social-header"><span class="trade-request-seal">${svg('exchange')}</span><button type="button" class="social-close" data-social-close aria-label="Ver más tarde">✕</button></header><span class="eyebrow">${isInvite?'INVITACIÓN DE INTERCAMBIO':'PROPUESTA PARA REVISAR'}</span><h2 id="tradeRequestTitle" tabindex="-1">${esc(isInvite?offer.sender_name:offer.recipient_name)}<br><span>${isInvite?'quiere intercambiar contigo':'ha elegido su carta'}</span></h2>${feedback()}${tradeOffer(offer)}<button type="button" class="trade-request-later" data-request-later>Ver más tarde en Intercambios</button>`;
  }
  function checkIncoming(){
    if(!session()||document.hidden||busy)return;
    if(requestDialog.open){renderRequest();return;}
    if(document.querySelector('dialog[open]'))return;
    const offer=state.trades.find(t=>needsAction(t)&&t.status!=='selecting'&&!seen.has(`${t.id}:${t.status}`));
    if(!offer)return;
    popupId=offer.id;remember(`${offer.id}:${offer.status}`);requestDialog.showModal();renderRequest();requestDialog.querySelector('h2')?.focus({preventScroll:true});
  }

  async function mark(id,kind) {
    if (marksLoading || busy) return;
    marksLoading=true; const token=epoch, previous=session();
    try { if (!loaded) await refresh(); if(token!==epoch)return; if(!loaded)throw new Error(failure || 'No se pudo cargar tu colección.'); const enabled=!marked(id,kind); await rpc('set_collection_card_mark',{target_card_id:id,mark_kind:kind,enabled}); if(token!==epoch||session()!==previous)return; state.marks=state.marks.filter(m=>m.card_id!==id||m.kind!==kind);if(enabled)state.marks.push({card_id:id,kind});failure='';announce();render(); }
    catch(error){if(token===epoch){failure=message(error); if(!dialog.open){trigger=document.activeElement;tab=kind;dialog.showModal();}render();}}
    finally{if(token===epoch)marksLoading=false;}
  }
  async function mutate(name,args,success) {
    if(busy)return;stateVersion++;busy=true;failure='';notice='';const token=epoch;render();
    try {if(pendingRequest)await pendingRequest;if(token!==epoch)return;const result=await rpc(name,args);if(token!==epoch)return;notice=typeof success==='function'?success(result):success;
      if(name==='invite_card_trade'){void pushDispatch?.('trade_offer',args.offer_id);draft={peer:'',give:''};createId=null;tradePage='desk';}
      if(name==='advance_card_trade') {
        if(args.decision==='propose')void pushDispatch?.('trade_offer',args.offer_id);
        if(result==='selecting'&&args.decision==='join'){pickerOfferId=args.offer_id;pickerCard='';tradePage='cards';search='';requestDialog.close();if(!tradeDialog.open)tradeDialog.showModal();}
        if(args.decision==='propose'){pickerOfferId=null;pickerCard='';tradePage='desk';}
        if(requestDialog.open&&!['invited','review'].includes(result))requestDialog.close();
      }
      await config.refreshInventory?.();await refresh();
    }
    catch(error){if(token===epoch)failure=message(error);}
    finally{if(token===epoch){busy=false;render();}}
  }
  function open(opener,section=tab) {if(section==='trades')return openTrades(opener);trigger=opener||document.activeElement;tab=['favorite','wanted'].includes(section)?section:'favorite';notice='';if(!dialog.open)dialog.showModal();render();dialog.querySelector('h2')?.focus({preventScroll:true});void refresh();}
  function openTrades(opener){tradePage='desk';search='';pickerOfferId=null;trigger=opener||document.activeElement;notice='';if(!tradeDialog.open)tradeDialog.showModal();requestDialog.close();dialog.close();render();tradeDialog.querySelector('h2')?.focus({preventScroll:true});void refresh();}
  function handleClick(event){
    if(event.target.closest('[data-social-close]'))event.currentTarget.close();
    if(event.target.closest('[data-request-later]'))requestDialog.close();
    const selected=event.target.closest('[data-social-tab]');if(selected){tab=selected.dataset.socialTab;failure='';notice='';render();}
    if(event.target.closest('[data-social-retry]'))void refresh();
    const view=event.target.closest('[data-social-view]');if(view)globalThis.CardCollection?.open(view.dataset.socialView,view);
    if(event.target.closest('[data-trade-start]')){tradePage='members';search='';draft={peer:'',give:''};pickerOfferId=null;render();tradeDialog.scrollTop=0;}
    if(event.target.closest('[data-trade-back]')) {
      if(tradePage==='desk'){tradeDialog.close();return;}
      tradePage=tradePage==='review'?'cards':tradePage==='cards'&&!pickerOfferId?'members':'desk';search='';render();tradeDialog.scrollTop=0;
    }
    const peer=event.target.closest('[data-trade-peer]');if(peer){draft.peer=peer.dataset.tradePeer;draft.give='';createId=null;tradePage='cards';search='';render();tradeDialog.scrollTop=0;}
    const card=event.target.closest('[data-trade-card]');if(card){if(pickerOfferId)pickerCard=card.dataset.tradeCard;else draft.give=card.dataset.tradeCard;createId=null;render();tradeDialog.querySelector(`[data-trade-card="${CSS.escape(card.dataset.tradeCard)}"]`)?.focus({preventScroll:true});}
    const pick=event.target.closest('[data-trade-pick-offer]');if(pick){pickerOfferId=pick.dataset.tradePickOffer;pickerCard='';tradePage='cards';search='';requestDialog.close();if(!tradeDialog.open)tradeDialog.showModal();render();tradeDialog.scrollTop=0;}
    if(event.target.closest('[data-trade-next]')){tradePage='review';render();tradeDialog.scrollTop=0;}
    if(event.target.closest('[data-trade-create]')){
      if(pickerOfferId)void mutate('advance_card_trade',{offer_id:pickerOfferId,decision:'propose',own_card_id:pickerCard},'Tu carta está confirmada. Esperando su aceptación final.');
      else {createId ||= crypto.randomUUID();void mutate('invite_card_trade',{offer_id:createId,target_user_id:draft.peer,give_card_id:draft.give},'Invitación enviada. La otra persona elegirá su carta.');}
    }
    const resolve=event.target.closest('[data-trade-resolve]');if(resolve)void mutate('advance_card_trade',{offer_id:resolve.dataset.tradeId,decision:resolve.dataset.tradeResolve},result=>({selecting:'Has aceptado participar. Elige tu carta.',accepted:'Intercambio completado. Las cartas están en vuestros álbumes.',declined:'Intercambio rechazado.',cancelled:'Intercambio cancelado.',expired:'La solicitud ha caducado.',unavailable:'Las repetidas ya no están disponibles. No se ha movido ninguna carta.'}[result]||'Intercambio actualizado.'));
  }

  [dialog,tradeDialog,requestDialog].forEach(surface=>surface.addEventListener('click',handleClick));
  tradeDialog.addEventListener('input',event=>{
    if(!event.target.matches('[data-trade-search]'))return;
    search=event.target.value;
    const template=document.createElement('template');template.innerHTML=tradePageContent();
    const selector=tradePage==='members'?'.trade-member-grid':'.trade-card-picker', grid=tradeDialog.querySelector(selector), next=template.content.querySelector(selector);
    if(grid&&next){grid.replaceChildren(...next.childNodes);if(tradePage==='members')globalThis.BannerShop?.mountMembers(grid);}
  });
  tradeDialog.addEventListener('close',()=>{const grid=document.getElementById('membersGrid');if(grid)globalThis.BannerShop?.mountMembers(grid);});
  [dialog,tradeDialog].forEach(surface=>surface.addEventListener('close',()=>{if(trigger?.isConnected&&!trigger.closest('[hidden],[inert]'))trigger.focus({preventScroll:true});checkIncoming();}));
  document.addEventListener('click',event=>{const markButton=event.target.closest('[data-collection-mark]');if(markButton){event.preventDefault();event.stopPropagation();void mark(markButton.dataset.markCard,markButton.dataset.collectionMark);}const opener=event.target.closest('[data-social-open]');if(opener)open(opener);const tradeOpener=event.target.closest('[data-trades-open]');if(tradeOpener)openTrades(tradeOpener);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session())void recoverRequests();});
  window.addEventListener('focus',()=>{if(session()&&Date.now()-lastRefresh>15000)void recoverRequests();});
  document.addEventListener('close',()=>setTimeout(checkIncoming,100),true);
  setInterval(()=>{if(session()&&!document.hidden&&!busy&&Date.now()-lastRefresh>30000)void recoverRequests();},30000);
  document.addEventListener('bb:card-catalog-updated', () => {if (dialog.open || tradeDialog.open) render();});
  globalThis.CollectionSocial=Object.freeze({initialize(options){config=options;try{seen=new Set(JSON.parse(sessionStorage.getItem(seenKey())||'[]'));}catch{}mountTrigger();},configurePush(callback){pushDispatch=callback;},openTrades,async openTrade(id){openTrades();await refresh();const offer=tradeDialog.querySelector(`[data-trade-offer-id="${CSS.escape(String(id))}"]`);offer?.scrollIntoView({block:'center',behavior:'smooth'});},receiveNotification(){void recoverRequests();},update(cards){inventory=cards||[];state.marks=state.marks.filter(mark=>mark.kind!=='wanted'||!owned(mark.card_id));mountTrigger();if(dialog.open||tradeDialog.open)render();if(session()&&!loaded&&!loading&&Date.now()-lastRefresh>15000)void recoverRequests();},actions,marked,open,refresh,reset(){epoch++;inventory=[];state={marks:[],peers:[],trades:[]};loaded=false;loading=false;busy=false;marksLoading=false;pendingRequest=null;failure='';notice='';draft={peer:'',give:''};tradePage='desk';pickerOfferId=null;pickerCard='';search='';createId=null;lastRefresh=0;recovering=false;popupId=null;seenOwner=null;seen=new Set();dialog.close();tradeDialog.close();requestDialog.close();announce();mountTrigger();}});
})();
