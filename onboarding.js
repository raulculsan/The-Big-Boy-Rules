/* Optional first-use guide. Authentication supplies the account; no profile data is stored. */
(() => {
  const version = 1;
  const steps = [
    {title:'Tus sobres',text:'Abre el sobre con un toque o deslizando. Pulsa la información para consultar saldo y probabilidades.',route:'sobres',target:'#ownedPackOpen'},
    {title:'Tu álbum',text:'Aquí encontrarás tus cartas y los huecos que faltan. Busca por nombre y filtra por rareza o tipo.',route:'sobres',target:'[data-card-album]'},
    {title:'Intercambios',text:'Desde este icono puedes invitar a otro miembro. Cada persona elige su carta y los dos confirmáis.',route:'album',target:'[data-trades-open]'},
    {title:'La agenda',text:'Consulta los planes, indica si vas a asistir y mira quién se apunta.',route:'calendario',target:'.calendar-agenda-panel'}
  ];
  let userId = '', navigate, step = -1, frame = 0, target = null, priorFocus = null, active = false;
  const panel = document.createElement('aside');
  panel.className = 'club-onboarding'; panel.hidden = true;
  panel.setAttribute('role','dialog'); panel.setAttribute('aria-labelledby','clubGuideTitle'); panel.setAttribute('aria-describedby','clubGuideText');
  const highlight = document.createElement('div'); highlight.className = 'club-guide-highlight'; highlight.hidden = true; highlight.setAttribute('aria-hidden','true');
  document.body.append(highlight,panel);
  const key = () => `bigboy:onboarding:v${version}:${userId}`;
  function seen() {try {return localStorage.getItem(key()) === 'done';} catch {return false;}}
  function position() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!active || !target?.isConnected || !target.getClientRects().length) {highlight.hidden = true;return;}
      const rect = target.getBoundingClientRect();
      highlight.hidden = false; highlight.style.cssText = `left:${Math.max(4,rect.left-5)}px;top:${Math.max(4,rect.top-5)}px;width:${Math.min(innerWidth-8,rect.width+10)}px;height:${Math.min(innerHeight-8,rect.height+10)}px`;
    });
  }
  function finish() {
    try {localStorage.setItem(key(),'done');} catch {}
    active = false; step = -1; target = null; panel.hidden = highlight.hidden = true;
    if (priorFocus?.isConnected) priorFocus.focus({preventScroll:true});
  }
  function draw() {
    const intro = step < 0, item = steps[step];
    panel.innerHTML = `<div class="club-guide-heading"><span>${intro?'BIENVENIDO A BIG BOY':`${step+1} / ${steps.length}`}</span><button type="button" data-guide-skip aria-label="Omitir guía">✕</button></div><h2 id="clubGuideTitle">${intro?'Un vistazo rápido':item.title}</h2><p id="clubGuideText">${intro?'Descubre dónde están tus sobres, cartas, intercambios y planes.':item.text}</p><div class="club-guide-actions"><button type="button" data-guide-skip>${intro?'Ahora no':'Omitir'}</button><button type="button" data-guide-next>${intro?'Ver guía':step===steps.length-1?'Listo':'Siguiente'}</button></div>`;
    panel.hidden = false;
    if (!intro) panel.querySelector('[data-guide-next]').focus({preventScroll:true});
  }
  function next() {
    if (step === steps.length - 1) {finish();return;}
    step++; target = null; highlight.hidden = true;
    const item = steps[step];
    if (typeof navigate === 'function') navigate(item.route);
    else document.querySelector(`[data-go="${item.route}"],[data-section="${item.route}"]`)?.click();
    draw();
    requestAnimationFrame(() => {
      if (!active) return;
      target = [...document.querySelectorAll(item.target)].find(node => node.getClientRects().length);
      target?.scrollIntoView({block:'center',behavior:'instant'}); position();
    });
  }
  panel.addEventListener('click',event => {if (event.target.closest('[data-guide-skip]')) finish();else if (event.target.closest('[data-guide-next]')) next();});
  panel.addEventListener('keydown',event => {if (event.key === 'Escape') {event.preventDefault();finish();}});
  window.addEventListener('resize',position,{passive:true});
  document.addEventListener('scroll',position,{passive:true,capture:true});
  function reset() {active = false; cancelAnimationFrame(frame); target = null; panel.hidden = highlight.hidden = true; userId = ''; step = -1;}
  function ready(options = {}) {
    if (!options.userId) {reset();return;}
    if (userId === String(options.userId) && active) return;
    reset(); userId = String(options.userId); navigate = options.navigate;
    if (seen()) return;
    priorFocus = document.activeElement; active = true; draw();
  }
  globalThis.ClubOnboarding = Object.freeze({ready,reset});
  document.addEventListener('club-onboarding-ready',event => ready(event.detail));
  document.addEventListener('club-onboarding-reset',reset);
})();
