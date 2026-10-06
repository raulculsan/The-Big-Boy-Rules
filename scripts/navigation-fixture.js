// Local-only stress controls; never included in the app bundle.
if (new URLSearchParams(location.search).has('navigation-qa')) {
  const panel = document.createElement('details');
  panel.style.cssText = 'position:fixed;top:64px;right:4px;z-index:9000;background:#161a20;color:white;font:11px sans-serif;padding:6px';
  panel.innerHTML = '<summary>Pruebas de pestañas</summary><button data-nav-stress>80 pulsaciones rápidas</button><button data-nav-touch>80 toques sin click tardío</button><button data-nav-long>Comprobar pulsación larga</button><button data-nav-delayed="inicio">Inicio tras arrastre</button><button data-nav-delayed="calendario">Calendario tras arrastre</button><button data-nav-scroll>Bajar contenido</button><button data-nav-safe>Zona segura iPhone</button><output id="navigationReport" hidden></output>';
  document.body.appendChild(panel);
  const report = panel.querySelector('output');
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const page = () => document.querySelector('.page-section.active');
  const scroller = () => getComputedStyle(page()).overflowY === 'auto' ? page() : document.scrollingElement;
  const position = () => ({documentY:Math.round(window.scrollY),pageY:Math.round(page()?.scrollTop || 0),active:page()?.id});
  const point = (link, type, id = 90) => {
    const r = link.getBoundingClientRect();
    return link.dispatchEvent(new PointerEvent(type, {bubbles:true,cancelable:true,isPrimary:true,pointerType:'touch',pointerId:id,button:0,clientX:r.x+r.width/2,clientY:r.y+r.height/2}));
  };
  const run = async withClick => {
    report.textContent = 'running';
    const links = [...document.querySelectorAll('.app-tab')];
    links[0].click();
    scroller().scrollTo({top:scroller().scrollHeight,behavior:'instant'});
    await wait(50);
    const results = [];
    let mutations = 0;
    const observer = new MutationObserver(() => mutations++);
    observer.observe(document.getElementById('profileContent'), {childList:true});
    for (let i=0;i<80;i++) {
      const link = links[[3,0,2,1,0,3,1,2][i%8]];
      const start = performance.now();
      point(link, 'pointerdown');
      point(link, 'pointerup');
      if (withClick) link.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,detail:1}));
      results.push({target:link.dataset.section,...position(),y:Math.round(window.scrollY),ms:Math.round((performance.now()-start)*10)/10});
      await wait(24);
    }
    await wait(600);
    observer.disconnect();
    report.textContent = JSON.stringify({results,profileRebuilds:mutations,final:document.querySelector('.page-section.active')?.id,y:Math.round(window.scrollY)});
  };
  panel.querySelector('[data-nav-stress]').onclick = () => run(true);
  panel.querySelector('[data-nav-touch]').onclick = () => run(false);
  panel.querySelector('[data-nav-scroll]').onclick = () => scroller().scrollBy({top:420,behavior:'smooth'});
  panel.querySelector('[data-nav-safe]').onclick = () => {
    document.body.classList.add('standalone-app');
    document.body.style.setProperty('--pwa-safe-top','58px');
  };
  panel.querySelectorAll('[data-nav-delayed]').forEach(button => button.onclick = async () => {
    report.textContent = 'running';
    const target = button.dataset.navDelayed;
    const source = target === 'inicio' ? 'calendario' : 'inicio';
    document.querySelector(`.app-tab[data-section="${source}"]`).click();
    const previousScrollOwner = scroller();
    previousScrollOwner.scrollTo({top:previousScrollOwner.scrollHeight,behavior:'smooth'});
    await wait(60);
    document.querySelector('.app-tab[data-section="chat"]').click();
    await wait(24);
    document.querySelector(`.app-tab[data-section="${target}"]`).click();
    // Model a late scroll from the old owner and late data/layout updates independently.
    setTimeout(() => previousScrollOwner.scrollTo({top:400,behavior:'smooth'}), 60);
    setTimeout(() => {renderCalendar(); renderUpcomingEvents();}, 180);
    const samples=[];
    const start=performance.now();
    while(performance.now()-start<1600) {
      samples.push({...position(),t:Math.round(performance.now()-start)});
      await wait(16);
    }
    report.textContent=JSON.stringify({target,samples});
  });
  panel.querySelector('[data-nav-long]').onclick = async () => {
    const link = document.querySelector('.profile-tab');
    point(link,'pointerdown');
    await wait(520);
    point(link,'pointerup');
    link.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,detail:1}));
    report.textContent = JSON.stringify({menuOpen:!document.getElementById('profileQuickMenu').hidden});
  };
}
